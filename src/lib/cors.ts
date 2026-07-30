import { NextResponse } from "next/server";

const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://cccindex.github.io",
]);

export function corsOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  return allowedOrigins.has(origin) ? origin : false;
}

export function withCors(request: Request, response: NextResponse) {
  const origin = corsOrigin(request);
  if (origin) response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Headers", "content-type");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Private-Network", "true");
  response.headers.set("Vary", "Origin");
  return response;
}

export function rejectDisallowedOrigin(request: Request) {
  return corsOrigin(request) === false
    ? NextResponse.json({ error: "Origin is not allowed." }, { status: 403 })
    : null;
}

export function corsPreflight(request: Request) {
  const rejected = rejectDisallowedOrigin(request);
  if (rejected) return rejected;
  return withCors(request, new NextResponse(null, { status: 204 }));
}
