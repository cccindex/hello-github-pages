import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ensureLocalUser } from "@/lib/service";
import {
  exchangePayboxCode,
  savePayboxTokens,
} from "@/lib/paybox/oauth";
import {
  completeRealPayboxConnection,
  inspectRealPayboxTools,
} from "@/lib/paybox/real-provider";

function finishRedirect(request: NextRequest, query: string) {
  const response = NextResponse.redirect(new URL(`/connect?${query}`, request.url));
  response.cookies.delete("paybox_oauth_state");
  response.cookies.delete("paybox_pkce_verifier");
  return response;
}

export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get("error");
  if (error) return finishRedirect(request, `paybox_error=${encodeURIComponent(error)}`);

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("paybox_oauth_state")?.value;
  const verifier = request.cookies.get("paybox_pkce_verifier")?.value;
  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    return finishRedirect(request, "paybox_error=invalid_oauth_state");
  }

  try {
    await ensureLocalUser();
    const tokens = await exchangePayboxCode(code, verifier);
    const tools = await inspectRealPayboxTools(tokens.access_token);
    if (!tools.includes("list_credentials") || !tools.includes("get_portfolio")) {
      throw new Error("Paybox did not expose the required wallet tools.");
    }
    await savePayboxTokens(tokens);
    await completeRealPayboxConnection(tokens.access_token);
    return finishRedirect(request, "paybox=connected");
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Paybox connection failed.";
    return finishRedirect(request, `paybox_error=${encodeURIComponent(message)}`);
  }
}
