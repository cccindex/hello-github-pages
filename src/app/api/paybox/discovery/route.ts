import { NextResponse } from "next/server";
import { discoverPaybox } from "@/lib/paybox/discovery";
import {
  corsPreflight,
  rejectDisallowedOrigin,
  withCors,
} from "@/lib/cors";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  const rejected = rejectDisallowedOrigin(request);
  if (rejected) return rejected;
  try {
    return withCors(request, NextResponse.json(await discoverPaybox()));
  } catch (error) {
    return withCors(
      request,
      NextResponse.json(
        { error: error instanceof Error ? error.message : "Paybox discovery failed." },
        { status: 502 },
      ),
    );
  }
}
