import { randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

export const BROWSER_SESSION_COOKIE = "paybox_room_session";

const SESSION_PATTERN = /^(?:local-owner|web-[A-Za-z0-9_-]{32,})$/;

export type BrowserSession = {
  localUserId: string;
  isNew: boolean;
};

export function resolveBrowserSession(request: Request | NextRequest): BrowserSession {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const value = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${BROWSER_SESSION_COOKIE}=`))
    ?.slice(BROWSER_SESSION_COOKIE.length + 1);
  const decoded = value ? decodeURIComponent(value) : "";
  if (SESSION_PATTERN.test(decoded)) return { localUserId: decoded, isNew: false };
  return {
    localUserId: `web-${randomBytes(32).toString("base64url")}`,
    isNew: true,
  };
}

export function setBrowserSessionCookie(
  response: NextResponse,
  session: BrowserSession,
) {
  response.cookies.set(BROWSER_SESSION_COOKIE, session.localUserId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return response;
}
