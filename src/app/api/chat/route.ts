import { z } from "zod";
import { transactionPlanSchema } from "@/lib/action-plan";
import { getTransactionTokenCatalog } from "@/lib/service";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const requestSchema = z.object({
  kind: z.enum(["trade", "stocks", "predictions"]).default("trade"),
  context: z.object({
    payboxConnected: z.boolean(),
    walletSelected: z.boolean(),
    realFinancialExecutionEnabled: z.boolean(),
    marketContext: z.string().max(8_000).optional(),
  }),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4_000),
      }),
    )
    .min(1)
    .max(24),
});

const aiResponseSchema = z.object({
  reply: z.string().min(1).max(4_000),
  transaction: z.object({
    type: z.enum(["none", "swap", "transfer"]),
    title: z.string(),
    rationale: z.string(),
    sourceSymbol: z.string().nullable(),
    destinationSymbol: z.string().nullable(),
    tokenSymbol: z.string().nullable(),
    amount: z.number().nullable(),
    recipient: z.string().nullable(),
    slippageBps: z.number().int().nullable(),
  }),
});

function responseSchema() {
  return {
    type: "json_schema",
    json_schema: {
      name: "paybox_transaction_response",
      strict: true,
      schema: {
        type: "object",
        properties: {
          reply: { type: "string" },
          transaction: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["none", "swap", "transfer"] },
              title: { type: "string" },
              rationale: { type: "string" },
              sourceSymbol: { type: ["string", "null"] },
              destinationSymbol: { type: ["string", "null"] },
              tokenSymbol: { type: ["string", "null"] },
              amount: { type: ["number", "null"] },
              recipient: { type: ["string", "null"] },
              slippageBps: { type: ["integer", "null"] },
            },
            required: [
              "type",
              "title",
              "rationale",
              "sourceSymbol",
              "destinationSymbol",
              "tokenSymbol",
              "amount",
              "recipient",
              "slippageBps",
            ],
            additionalProperties: false,
          },
        },
        required: ["reply", "transaction"],
        additionalProperties: false,
      },
    },
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "OpenRouter is not configured." }, { status: 503 });
  }

  try {
    const input = requestSchema.parse(await request.json());
    const catalog = await getTransactionTokenCatalog();
    const model = process.env.OPENROUTER_MODEL ?? "openai/gpt-5.4-mini";
    const assets = catalog
      .map(
        (asset) =>
          `${asset.symbol} (${asset.name}; ${asset.decimals} decimals; mint ${asset.mint}; ${asset.priceUsd ? `$${asset.priceUsd}` : "price unavailable"})`,
      )
      .join("\n");
    const system = [
      "You are Milo, a concise Solana transaction and market-research agent connected to Paybox.",
      "You can formulate two real Paybox operations: exact-in Solana token swaps and Solana token transfers. You never execute automatically; the UI always presents the exact plan for explicit confirmation and Paybox signing.",
      `Verified asset catalog:\n${assets}`,
      `Connection state: Paybox connected=${input.context.payboxConnected}; wallet selected=${input.context.walletSelected}; execution enabled=${input.context.realFinancialExecutionEnabled}.`,
      input.context.marketContext
        ? `Live market context supplied by the server:\n${input.context.marketContext}`
        : "No additional live market context was supplied.",
      "Only create a transaction when the user's latest message clearly asks to swap, buy, sell, or transfer and specifies every necessary fact. Never invent an amount, recipient, asset, mint, or side.",
      "For swaps, both symbols must exactly match the verified catalog. Selling an asset means sourceSymbol is that asset and destinationSymbol is USDC. Buying means USDC is normally the source.",
      "For transfers, the recipient must be a Solana base58 address copied from the user's message and tokenSymbol must exactly match the catalog.",
      "Use 1.0% slippage (100 bps) unless the user explicitly requests another value; never exceed 3%. Keep every proposed transaction at or below $25 for this testing build.",
      "If anything is ambiguous or the wallet is not ready, set type=none, explain what is missing, and use empty strings/nulls for unused fields.",
      "Do not claim a trade is good merely because it can be executed. Separate market evidence from speculation. Keep the reply under 150 words.",
    ].join("\n\n");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.APP_URL ?? "https://five-minute-bitcoin.vercel.app",
        "X-OpenRouter-Title": "Paybox Rooms",
      },
      body: JSON.stringify({
        model,
        max_tokens: 700,
        response_format: responseSchema(),
        messages: [{ role: "system", content: system }, ...input.messages],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    const body = (await response.json()) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    };
    if (!response.ok) {
      throw new Error(body.error?.message ?? `OpenRouter returned ${response.status}.`);
    }
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenRouter returned an empty response.");
    const parsed = aiResponseSchema.parse(JSON.parse(content));

    let plan = null;
    const action = parsed.transaction;
    if (action.type === "swap") {
      if (
        !action.sourceSymbol ||
        !action.destinationSymbol ||
        !action.amount ||
        !action.slippageBps
      ) {
        throw new Error("The AI returned an incomplete swap plan.");
      }
      const source = catalog.find(
        (item) => item.symbol.toLowerCase() === action.sourceSymbol!.toLowerCase(),
      );
      const valueCents = Math.max(
        1,
        Math.round(action.amount * (source?.priceUsd ?? 1) * 100),
      );
      plan = transactionPlanSchema.parse({
        type: "swap",
        title: action.title,
        rationale: action.rationale,
        sourceSymbol: action.sourceSymbol,
        destinationSymbol: action.destinationSymbol,
        amount: action.amount,
        slippageBps: action.slippageBps,
        valueCents,
      });
    } else if (action.type === "transfer") {
      if (!action.tokenSymbol || !action.amount || !action.recipient) {
        throw new Error("The AI returned an incomplete transfer plan.");
      }
      const asset = catalog.find(
        (item) => item.symbol.toLowerCase() === action.tokenSymbol!.toLowerCase(),
      );
      const valueCents = Math.max(
        1,
        Math.round(action.amount * (asset?.priceUsd ?? 1) * 100),
      );
      plan = transactionPlanSchema.parse({
        type: "transfer",
        title: action.title,
        rationale: action.rationale,
        tokenSymbol: action.tokenSymbol,
        amount: action.amount,
        recipient: action.recipient,
        valueCents,
      });
    }

    if (plan && (!input.context.payboxConnected || !input.context.walletSelected)) {
      plan = null;
    }
    return Response.json({ message: parsed.reply, plan, model });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "AI request failed." },
      { status: 502 },
    );
  }
}
