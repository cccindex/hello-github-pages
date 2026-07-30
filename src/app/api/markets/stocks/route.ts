import { getLiveStockFeed } from "@/lib/live-stocks";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getLiveStockFeed(), {
      headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not load live stock data." },
      { status: 502 },
    );
  }
}
