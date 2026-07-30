import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const requestSchema = z.object({
  kind: z.enum(["trade", "intel", "duel", "quest"]),
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

const roomInstructions = {
  trade:
    "You are Milo, a concise trading research agent. Separate evidence from speculation. You may propose only the product's supported real action: exactly 1 USDC to cbBTC on Solana with maximum 1% slippage. You may also propose the fixed automation described below.",
  intel:
    "You are Iris, a skeptical research agent. Explain which evidence is duplicated, independent, free, or worth purchasing. Never pretend you actually purchased a source or accessed live data.",
  duel:
    "You are The Ref, an impartial moderator between Momentum Goblin and Paranoid Quant. Score evidence quality rather than confidence. You may propose the supported $1 trade only when the user explicitly asks to let a winner trade.",
  quest:
    "You are Cleo, an onchain mystery game master. Create short playable investigations, reveal clues gradually, and clearly distinguish fictional game clues from live blockchain facts.",
} as const;

function responseSchema() {
  return {
    type: "json_schema",
    json_schema: {
      name: "paybox_room_response",
      strict: true,
      schema: {
        type: "object",
        properties: {
          reply: { type: "string" },
          action: {
            type: "string",
            enum: ["none", "trade", "automation"],
          },
        },
        required: ["reply", "action"],
        additionalProperties: false,
      },
    },
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OpenRouter is not configured." },
      { status: 503 },
    );
  }

  try {
    const input = requestSchema.parse(await request.json());
    const model = process.env.OPENROUTER_MODEL ?? "openai/gpt-4.1-mini";
    const system = [
      roomInstructions[input.kind],
      "The interface contains illustrative market feeds. Do not claim you have live prices, private tools, browsing, wallet access, or x402 access.",
      "A trade or automation is never executed by your response. You may only surface a review card. Set action='trade' only for the exact 1 USDC to cbBTC proposal. Set action='automation' only for exactly 1 USDC every five minutes with a $12 rolling-day cap, $25 lifetime cap, and 24-hour expiry. Otherwise set action='none'.",
      "Keep replies under 130 words and make the next useful step obvious.",
    ].join("\n\n");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL ?? "https://five-minute-bitcoin.vercel.app",
        "X-OpenRouter-Title": "Paybox Rooms",
      },
      body: JSON.stringify({
        model,
        temperature: 0.45,
        max_tokens: 260,
        response_format: responseSchema(),
        messages: [
          { role: "system", content: system },
          ...input.messages,
        ],
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

    const parsed = z
      .object({
        reply: z.string().min(1).max(4_000),
        action: z.enum(["none", "trade", "automation"]),
      })
      .parse(JSON.parse(content));

    return Response.json({
      message: parsed.reply,
      action: parsed.action === "none" ? null : parsed.action,
      model,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "AI request failed." },
      { status: 502 },
    );
  }
}
