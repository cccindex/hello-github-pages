import { resolveBrowserSession } from "@/lib/browser-session";
import { callRealPayboxReadTool } from "@/lib/paybox/real-provider";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

function value(result: unknown) {
  const raw = result as {
    structuredContent?: unknown;
    content?: Array<{ type?: string; text?: string }>;
  };
  if (raw?.structuredContent) return raw.structuredContent;
  const text = raw?.content?.find((item) => item.type === "text")?.text;
  if (!text) return result;
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

async function analyzeMarkets(markets: Array<Record<string, unknown>>) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return new Map<string, { label: string; reason: string }>();
  const observations = markets.map((market) => {
    const orderbook = (market.orderbook ?? {}) as Record<string, unknown>;
    return {
      ticker: market.ticker,
      title: market.title,
      yesBid: (orderbook.yes as Record<string, unknown> | undefined)?.bid,
      yesAsk: (orderbook.yes as Record<string, unknown> | undefined)?.ask,
      noBid: (orderbook.no as Record<string, unknown> | undefined)?.bid,
      noAsk: (orderbook.no as Record<string, unknown> | undefined)?.ask,
      volume: market.volume,
      volume24h: market.volume24hFp,
      trades24h: market.trades24h,
      openInterest: market.openInterest,
    };
  });
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.APP_URL ?? "https://five-minute-bitcoin.vercel.app",
        "X-OpenRouter-Title": "Paybox World Feed",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL ?? "openai/gpt-5.4-mini",
        max_tokens: 1200,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "world_market_screen",
            strict: true,
            schema: {
              type: "object",
              properties: {
                analyses: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      ticker: { type: "string" },
                      label: {
                        type: "string",
                        enum: ["YES LOOKS CHEAP", "YES LOOKS EXPENSIVE", "NO CLEAR EDGE"],
                      },
                      reason: { type: "string" },
                    },
                    required: ["ticker", "label", "reason"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["analyses"],
              additionalProperties: false,
            },
          },
        },
        messages: [
          {
            role: "system",
            content:
              "You screen prediction markets using ONLY the supplied live order-book and activity fields. Do not use outside political knowledge. Label relative market-structure opportunities, not truth. A wide spread, one-sided book, or weak activity lowers confidence. Explain in one concise sentence and explicitly state the condition that would make the price cheap/expensive. Never claim certainty.",
          },
          { role: "user", content: JSON.stringify(observations) },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) return new Map();
    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) return new Map();
    const parsed = JSON.parse(content) as {
      analyses?: Array<{ ticker?: string; label?: string; reason?: string }>;
    };
    return new Map(
      (parsed.analyses ?? []).flatMap((item) =>
        item.ticker && item.label && item.reason
          ? [[item.ticker, { label: item.label, reason: item.reason }] as const]
          : [],
      ),
    );
  } catch {
    return new Map();
  }
}

export async function GET(request: Request) {
  try {
    const session = resolveBrowserSession(request);
    if (session.isNew) throw new Error("Connect Paybox to load World markets.");
    const found = value(
      await callRealPayboxReadTool(session.localUserId, "world_find_markets", {
        status: "active",
        limit: 12,
      }),
    ) as Record<string, unknown>;
    const rows =
      (Array.isArray(found.markets) && found.markets) ||
      (Array.isArray(found.items) && found.items) ||
      (Array.isArray(found.data) && found.data) ||
      [];
    const markets: Array<Record<string, unknown>> = await Promise.all(
      rows.slice(0, 8).map(async (row) => {
        const item = row as Record<string, unknown>;
        const ticker = String(item.ticker ?? item.market_ticker ?? "");
        if (!ticker) return { ...item, orderbook: null };
        const orderbook = value(
          await callRealPayboxReadTool(session.localUserId, "world_orderbook", {
            id: ticker,
          }),
        );
        return { ...item, orderbook };
      }),
    );
    const analysis = await analyzeMarkets(markets);
    const enriched = markets.map((market) => ({
      ...market,
      analysis: analysis.get(String(market.ticker ?? "")) ?? null,
    }));
    const payload = { asOf: new Date().toISOString(), markets: enriched };
    return Response.json(payload);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not load World markets." },
      { status: 400 },
    );
  }
}
