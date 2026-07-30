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
import { resolveBrowserSession } from "@/lib/browser-session";

function finishRedirect(request: NextRequest, query: string) {
  const returnTo = request.cookies.get("paybox_oauth_return_to")?.value === "/trade"
    ? "/trade"
    : "/connect";
  const response = NextResponse.redirect(new URL(`${returnTo}?${query}`, request.url));
  response.cookies.delete("paybox_oauth_state");
  response.cookies.delete("paybox_pkce_verifier");
  response.cookies.delete("paybox_oauth_return_to");
  return response;
}

export async function GET(request: NextRequest) {
  const session = resolveBrowserSession(request);
  if (session.isNew) {
    return finishRedirect(request, "paybox_error=session_cookie_missing");
  }
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
    await ensureLocalUser(session.localUserId);
    const tokens = await exchangePayboxCode(code, verifier);
    const tools = await inspectRealPayboxTools(tokens.access_token);
    if (!tools.includes("list_credentials") || !tools.includes("get_portfolio")) {
      throw new Error("Paybox did not expose the required wallet tools.");
    }
    await savePayboxTokens(session.localUserId, tokens);
    await completeRealPayboxConnection(session.localUserId, tokens.access_token);
    return finishRedirect(request, "paybox=connected");
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Paybox connection failed.";
    return finishRedirect(request, `paybox_error=${encodeURIComponent(message)}`);
  }
}
