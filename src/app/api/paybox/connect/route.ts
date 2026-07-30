import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { payboxClientId, payboxRedirectUri } from "@/lib/paybox/oauth";
import {
  resolveBrowserSession,
  setBrowserSessionCookie,
} from "@/lib/browser-session";
import { ensureLocalUser } from "@/lib/service";

const AUTHORIZATION_ENDPOINT = "https://api.paybox.sh/oauth/authorize";
const MCP_RESOURCE = "https://api.paybox.sh/mcp";

export async function GET(request: Request) {
  const session = resolveBrowserSession(request);
  await ensureLocalUser(session.localUserId);
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const authorizationUrl = new URL(AUTHORIZATION_ENDPOINT);
  authorizationUrl.search = new URLSearchParams({
    response_type: "code",
    client_id: payboxClientId(),
    redirect_uri: payboxRedirectUri(),
    scope: "mcp offline_access",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: MCP_RESOURCE,
  }).toString();

  const response = NextResponse.redirect(authorizationUrl);
  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    maxAge: 600,
    path: "/",
  };
  response.cookies.set("paybox_oauth_state", state, cookieOptions);
  response.cookies.set("paybox_pkce_verifier", verifier, cookieOptions);
  return setBrowserSessionCookie(response, session);
}
