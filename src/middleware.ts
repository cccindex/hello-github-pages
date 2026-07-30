import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/api/cron") return NextResponse.next();
  const password = process.env.APP_ACCESS_PASSWORD;
  if (!password && process.env.NODE_ENV !== "production") return NextResponse.next();
  if (!password) return new NextResponse("Owner login is not configured.", { status: 503 });
  const expected = `Basic ${btoa(`owner:${password}`)}`;
  if (request.headers.get("authorization") === expected) return NextResponse.next();
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Five Minute Bitcoin", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
