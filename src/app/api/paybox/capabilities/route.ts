import { NextResponse } from "next/server";
import { resolveBrowserSession } from "@/lib/browser-session";
import { describeRealPayboxTools } from "@/lib/paybox/real-provider";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = resolveBrowserSession(request);
    if (session.isNew) throw new Error("Connect Paybox first.");
    const tools = await describeRealPayboxTools(session.localUserId);
    return NextResponse.json({ tools });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load Paybox capabilities.",
      },
      { status: 400 },
    );
  }
}
