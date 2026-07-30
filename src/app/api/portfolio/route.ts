import { resolveBrowserSession } from "@/lib/browser-session";
import { getLocalState, getTransactionTokenCatalog } from "@/lib/service";
import { callRealPayboxReadTool } from "@/lib/paybox/real-provider";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

type Row = Record<string, unknown>;

function record(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {};
}

function value(result: unknown) {
  const raw = record(result);
  if (raw.structuredContent) return raw.structuredContent;
  const content = Array.isArray(raw.content) ? raw.content : [];
  const text = content
    .map(record)
    .find((item) => item.type === "text")?.text;
  if (typeof text !== "string") return result;
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

function firstArray(input: unknown, keys: string[]): Row[] {
  if (Array.isArray(input)) return input.map(record);
  const root = record(input);
  for (const key of keys) {
    if (Array.isArray(root[key])) return (root[key] as unknown[]).map(record);
  }
  for (const child of Object.values(root)) {
    if (child && typeof child === "object") {
      const found = firstArray(child, keys);
      if (found.length) return found;
    }
  }
  return [];
}

function text(...values: unknown[]) {
  const found = values.find(
    (item) => typeof item === "string" && item.trim().length > 0,
  );
  return typeof found === "string" ? found : null;
}

function numeric(...values: unknown[]) {
  for (const item of values) {
    if (typeof item === "number" && Number.isFinite(item)) return item;
    if (typeof item === "string" && item.trim() && Number.isFinite(Number(item))) {
      return Number(item);
    }
  }
  return null;
}

function normalizeAsset(item: Row, index: number) {
  const token = record(item.token);
  const symbol =
    text(item.symbol, item.tokenSymbol, item.token_symbol, token.symbol) ??
    `ASSET ${index + 1}`;
  const rawBalance = text(
    item.balance,
    item.rawBalance,
    item.raw_balance,
    item.amount,
    item.quantity,
  ) ?? "0";
  const decimals = numeric(item.decimals, token.decimals);
  const explicitUiAmount = numeric(
    item.uiAmount,
    item.ui_amount,
    item.balanceFormatted,
    item.balance_formatted,
  );
  const amount =
    explicitUiAmount ??
    (decimals !== null ? Number(rawBalance) / 10 ** decimals : Number(rawBalance));
  const priceUsd = numeric(
    item.priceUsd,
    item.price_usd,
    item.usdPrice,
    item.usd_price,
    record(item.price).usd,
  );
  const valueUsd =
    numeric(
      item.valueUsd,
      item.value_usd,
      item.usdValue,
      item.usd_value,
      item.currentValueUsd,
    ) ?? (priceUsd !== null && Number.isFinite(amount) ? amount * priceUsd : null);
  return {
    symbol,
    name: text(item.name, item.tokenName, item.token_name, token.name) ?? symbol,
    tokenAddress:
      text(item.tokenAddress, item.token_address, item.mint, item.address, token.address) ??
      "unknown",
    amount: Number.isFinite(amount) ? amount : 0,
    rawBalance,
    decimals,
    priceUsd,
    valueUsd,
    logo: text(item.logo, item.logoUrl, item.logo_url, token.logoURI),
  };
}

async function splDecimals(mint: string) {
  if (!mint || mint === "unknown") return null;
  if (mint === "native") return 9;
  try {
    const response = await fetch("https://api.mainnet-beta.solana.com", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenSupply",
        params: [mint],
      }),
      signal: AbortSignal.timeout(8_000),
    });
    const body = (await response.json()) as {
      result?: { value?: { decimals?: number } };
    };
    return body.result?.value?.decimals ?? null;
  } catch {
    return null;
  }
}

async function dexPrice(mint: string) {
  const address =
    mint === "native"
      ? "So11111111111111111111111111111111111111112"
      : mint;
  if (!address || address === "unknown") return null;
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(address)}`,
      { signal: AbortSignal.timeout(8_000), next: { revalidate: 60 } },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as {
      pairs?: Array<{ priceUsd?: string; liquidity?: { usd?: number } }>;
    };
    const pair = (body.pairs ?? [])
      .filter((item) => Number.isFinite(Number(item.priceUsd)))
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
    return pair ? Number(pair.priceUsd) : null;
  } catch {
    return null;
  }
}

async function enrichAssets(rows: ReturnType<typeof normalizeAsset>[]) {
  const catalog = await getTransactionTokenCatalog();
  return Promise.all(
    rows.map(async (asset) => {
      const definition = catalog.find(
        (item) =>
          item.mint === asset.tokenAddress ||
          item.symbol.toUpperCase() === asset.symbol.toUpperCase(),
      );
      const decimals =
        asset.decimals ??
        definition?.decimals ??
        (asset.symbol.toUpperCase() === "CASH" ? 6 : null) ??
        (await splDecimals(asset.tokenAddress));
      const amount =
        decimals === null
          ? asset.amount
          : Number(asset.rawBalance) / 10 ** decimals;
      const priceUsd =
        asset.priceUsd ??
        definition?.priceUsd ??
        (asset.symbol.toUpperCase() === "USDC" ||
        asset.symbol.toUpperCase() === "CASH"
          ? 1
          : await dexPrice(asset.tokenAddress));
      return {
        ...asset,
        decimals,
        amount: Number.isFinite(amount) ? amount : 0,
        priceUsd,
        valueUsd:
          asset.valueUsd ??
          (priceUsd !== null && Number.isFinite(amount) ? amount * priceUsd : null),
      };
    }),
  );
}

function normalizeRequest(item: Row, index: number) {
  const output = record(record(item.output).value);
  return {
    id:
      text(item.request_id, item.requestId, item.id) ??
      `paybox-request-${index}`,
    status: text(item.status, output.status) ?? "UNKNOWN",
    tool: text(item.tool_name, item.toolName, item.tool, item.operation, item.type) ?? "Paybox request",
    createdAt: text(
      item.created_at,
      item.createdAt,
      item.requested_at,
      item.timestamp,
    ),
    transactionSignature: text(
      item.transaction_signature,
      item.transaction_hash,
      item.signature,
      output.transaction_signature,
      output.transaction_hash,
    ),
    amount: text(item.amount, item.amount_in, item.value, record(item.input).amount),
  };
}

function normalizePosition(item: Row, index: number) {
  return {
    id: text(item.id, item.position_id, item.market_ticker, item.ticker) ?? `position-${index}`,
    market: text(item.title, item.market_title, item.question, item.market_ticker, item.ticker) ?? "World market",
    outcome: text(item.outcome, item.side, item.position) ?? "—",
    quantity: numeric(item.quantity, item.amount, item.balance, item.shares) ?? 0,
    valueUsd: numeric(item.valueUsd, item.value_usd, item.usd_value, item.current_value),
  };
}

async function safeTool(
  localUserId: string,
  name: "get_portfolio" | "list_requests" | "world_positions",
  args: Row,
) {
  try {
    return { data: value(await callRealPayboxReadTool(localUserId, name, args)), error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : `${name} failed`,
    };
  }
}

export async function GET(request: Request) {
  try {
    const session = resolveBrowserSession(request);
    const state = await getLocalState(session.localUserId);
    const address = state.connection?.selectedWalletAddress;
    const credentialId = state.connection?.selectedCredentialId;
    if (!address || !credentialId) {
      return Response.json(
        { error: "Select a connected Paybox wallet to load the portfolio." },
        { status: 400 },
      );
    }

    const [portfolio, requests, positions] = await Promise.all([
      safeTool(session.localUserId, "get_portfolio", { address }),
      safeTool(session.localUserId, "list_requests", {}),
      safeTool(session.localUserId, "world_positions", {
        credential_id: credentialId,
      }),
    ]);

    const assets = await enrichAssets(
      firstArray(portfolio.data, [
        "items",
        "assets",
        "tokens",
        "holdings",
        "portfolio",
        "balances",
      ]).map(normalizeAsset),
    );
    const providerRequests = firstArray(requests.data, [
      "requests",
      "items",
      "data",
      "results",
    ]).map(normalizeRequest);
    const worldPositions = firstArray(positions.data, [
      "positions",
      "items",
      "data",
      "results",
    ]).map(normalizePosition);

    return Response.json({
      asOf: new Date().toISOString(),
      wallet: {
        name: state.connection?.selectedWalletName,
        address,
        credentialId,
      },
      assets,
      providerRequests,
      worldPositions,
      errors: {
        portfolio: portfolio.error,
        requests: requests.error,
        positions: positions.error,
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not load portfolio." },
      { status: 400 },
    );
  }
}
