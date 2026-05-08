import { NextRequest, NextResponse } from "next/server";
import { createRound, getDashboardSnapshot, getRounds } from "@/lib/data/store";
import { rateLimit } from "@/lib/security/rate-limit";
import { normalizeRoundPayload } from "@/lib/security/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limited = rateLimit(request);
  if (limited) return limited;

  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 250);
  const rounds = await getRounds(Math.min(Math.max(limit, 1), 1_000));
  return NextResponse.json({ rounds });
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  const payload = normalizeRoundPayload(await request.json().catch(() => null));
  if (!payload) {
    return NextResponse.json({ error: "Invalid round payload." }, { status: 400 });
  }

  const round = await createRound(payload);
  const snapshot = await getDashboardSnapshot();
  return NextResponse.json({ round, snapshot }, { status: 201 });
}
