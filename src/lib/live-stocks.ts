import type { TokenDefinition } from "@/lib/action-plan";

const SYMBOLS = ["AAPLx", "TSLAx", "NVDAx", "MSFTx", "AMZNx", "METAx", "COINx", "SPYx"];
const API = "https://api.backed.fi/api/v2/public/assets";

type Asset = {
  name: string;
  symbol: string;
  underlyingSymbol: string;
  logo: string;
  isTradingHalted: boolean;
  deployments: Array<{
    network: string;
    address: string;
    supportsAtomicSwaps?: boolean;
  }>;
};

type DexPair = {
  baseToken?: { address?: string };
  priceUsd?: string;
  priceChange?: { h24?: number };
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  url?: string;
};

async function json<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    next: { revalidate: 60 },
  });
  if (!response.ok) throw new Error(`Live market source returned ${response.status}.`);
  return response.json() as Promise<T>;
}

async function loadStock(symbol: string) {
  const asset = await json<Asset>(`${API}/${symbol}`);
  const deployment = asset.deployments.find((item) => item.network === "Solana");
  if (!deployment) return null;
  const [reference, multiplierResult, dex] = await Promise.all([
    json<{ quote: number }>(`${API}/${symbol}/price-data`).catch(() => null),
    json<{ currentMultiplier?: number }>(
      `https://api.backed.fi/api/v1/token/${symbol}/multiplier?network=Solana`,
    ).catch(() => null),
    json<{ pairs?: DexPair[] }>(
      `https://api.dexscreener.com/latest/dex/tokens/${deployment.address}`,
    ).catch(() => null),
  ]);
  const referencePrice = reference?.quote ?? null;
  const pairs = (dex?.pairs ?? []).filter((pair) => {
    if (pair.baseToken?.address !== deployment.address) return false;
    const price = Number(pair.priceUsd);
    return (
      Number.isFinite(price) &&
      (!referencePrice || Math.abs(price - referencePrice) / referencePrice <= 0.3)
    );
  });
  const pair = pairs.sort(
    (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0),
  )[0];
  const onchainPrice = Number(pair?.priceUsd);
  const multiplier = multiplierResult?.currentMultiplier ?? 1;
  const premiumPct =
    Number.isFinite(onchainPrice) && referencePrice
      ? ((onchainPrice - referencePrice) / referencePrice) * 100
      : null;
  const liquidityUsd = pair?.liquidity?.usd ?? 0;
  const volume24hUsd = pair?.volume?.h24 ?? 0;
  const change24hPct = pair?.priceChange?.h24 ?? null;
  const score =
    Math.log10(Math.max(1, liquidityUsd)) * 8 +
    Math.log10(Math.max(1, volume24hUsd)) * 5 -
    Math.abs(premiumPct ?? 0) * 2 +
    Math.abs(change24hPct ?? 0);
  return {
    symbol: asset.symbol,
    underlyingSymbol: asset.underlyingSymbol,
    name: asset.name,
    logo: asset.logo,
    mint: deployment.address,
    decimals: 8,
    multiplier,
    halted: asset.isTradingHalted,
    atomicSwaps: Boolean(deployment.supportsAtomicSwaps),
    referencePrice,
    onchainPrice: Number.isFinite(onchainPrice) ? onchainPrice : null,
    premiumPct,
    change24hPct,
    liquidityUsd,
    volume24hUsd,
    dexUrl: pair?.url ?? null,
    score,
  };
}

export async function getLiveStockFeed() {
  const values = await Promise.all(SYMBOLS.map(loadStock));
  const stocks = values
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => b.score - a.score);
  return {
    asOf: new Date().toISOString(),
    methodology:
      "Ranked from live Solana liquidity, 24h volume/momentum, and deviation from the issuer reference price. It is a market-structure screen, not a prediction.",
    stocks,
  };
}

export function stockTokens(
  feed: Awaited<ReturnType<typeof getLiveStockFeed>>,
): TokenDefinition[] {
  return feed.stocks.map((stock) => ({
    symbol: stock.symbol,
    name: stock.name,
    mint: stock.mint,
    decimals: stock.decimals,
    multiplier: stock.multiplier,
    priceUsd: stock.referencePrice,
    source: "xStocks",
  }));
}
