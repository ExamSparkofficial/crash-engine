import { NextRequest, NextResponse } from "next/server";
import { getDashboardSnapshot } from "@/lib/data/store";
import { getDisclaimer } from "@/lib/analytics/statistics";
import { rateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limited = rateLimit(request);
  if (limited) return limited;

  const snapshot = await getDashboardSnapshot();
  return NextResponse.json({
    ...snapshot,
    disclaimer: getDisclaimer()
  });
}
