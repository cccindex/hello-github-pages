import { NextResponse } from "next/server";
import { getPayboxSigningResource } from "@/lib/paybox/real-provider";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const resource = (await getPayboxSigningResource()) as {
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
