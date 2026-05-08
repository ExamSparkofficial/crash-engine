import { NextRequest, NextResponse } from "next/server";
import { getStrategies } from "@/lib/data/store";
import { rateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limited = rateLimit(request);
  if (limited) return limited;

  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 20);
  const strategies = await getStrategies(Math.min(Math.max(limit, 1), 100));
  return NextResponse.json({ strategies });
}
