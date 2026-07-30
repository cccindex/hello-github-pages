import { db } from "@/lib/db";
import { LOCAL_USER_ID } from "@/lib/constants";
import { decryptPayboxToken, encryptPayboxToken } from "@/lib/paybox/token-crypto";

const TOKEN_ENDPOINT = "https://api.paybox.sh/oauth/token";
const MCP_RESOURCE = "https://api.paybox.sh/mcp";

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type: string;
};

export function payboxClientId() {
  const value = process.env.PAYBOX_CLIENT_ID;
  if (!value) throw new Error("PAYBOX_CLIENT_ID is not configured.");
  return value;
}

export function payboxRedirectUri() {
  const appUrl = process.env.APP_URL;
  if (!appUrl) throw new Error("APP_URL is not configured.");
  return `${appUrl.replace(/\/+$/, "")}/api/paybox/callback`;
}

async function tokenRequest(body: URLSearchParams) {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const value = (await response.json()) as TokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !value.access_token) {
    throw new Error(value.error_description ?? value.error ?? "Paybox token exchange failed.");
  }
  return value;
}

export async function exchangePayboxCode(code: string, verifier: string) {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: payboxClientId(),
      code,
      code_verifier: verifier,
      redirect_uri: payboxRedirectUri(),
      resource: MCP_RESOURCE,
    }),
  );
}

export async function savePayboxTokens(tokens: TokenResponse) {
  const user = await db.user.findUniqueOrThrow({
    where: { localUserId: LOCAL_USER_ID },
    include: { payboxConnection: true },
  });
  const existingRefreshToken = user.payboxConnection?.oauthRefreshToken;
  const refreshToken = tokens.refresh_token
    ? encryptPayboxToken(tokens.refresh_token)
    : existingRefreshToken;
  await db.payboxConnection.update({
    where: { userId: user.id },
    data: {
      oauthAccessToken: encryptPayboxToken(tokens.access_token),
      oauthRefreshToken: refreshToken,
      oauthTokenExpiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000),
      oauthScopes: tokens.scope?.split(/\s+/).filter(Boolean) ?? ["mcp"],
    },
  });
}

export async function getPayboxAccessToken() {
  const user = await db.user.findUniqueOrThrow({
    where: { localUserId: LOCAL_USER_ID },
    include: { payboxConnection: true },
  });
  const connection = user.payboxConnection;
  if (!connection?.oauthAccessToken) throw new Error("Paybox is not connected.");
  if (
    !connection.oauthTokenExpiresAt ||
    connection.oauthTokenExpiresAt.getTime() > Date.now() + 60_000
  ) {
    return decryptPayboxToken(connection.oauthAccessToken);
  }
  if (!connection.oauthRefreshToken) throw new Error("Paybox authorization has expired.");

  const tokens = await tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: payboxClientId(),
      refresh_token: decryptPayboxToken(connection.oauthRefreshToken),
      resource: MCP_RESOURCE,
    }),
  );
  await savePayboxTokens(tokens);
  return tokens.access_token;
}
