import { NextResponse } from "next/server";
import { getPayboxSigningResource } from "@/lib/paybox/real-provider";
import { resolveBrowserSession } from "@/lib/browser-session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = resolveBrowserSession(request);
    if (session.isNew) throw new Error("Connect Paybox first.");
    const resource = (await getPayboxSigningResource(session.localUserId)) as {
      contents?: Array<{
        text?: string;
        blob?: string;
        _meta?: {
          ui?: {
            csp?: unknown;
            permissions?: unknown;
          };
        };
      }>;
    };
    const content = resource.contents?.[0];
    const html = content?.text ??
      (content?.blob ? Buffer.from(content.blob, "base64").toString("utf8") : null);
    if (!html) throw new Error("Paybox returned an empty signing application.");
    return NextResponse.json({
      html,
      csp: content?._meta?.ui?.csp,
      permissions: content?._meta?.ui?.permissions,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load Paybox signing app." },
      { status: 502 },
    );
  }
}
