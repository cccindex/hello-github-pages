import { runDueAutomations } from "@/lib/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await runDueAutomations();
  return Response.json({
    ok: true,
    processed: results.length,
    checkedAt: new Date().toISOString(),
  });
}
