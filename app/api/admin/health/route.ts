import { NextRequest, NextResponse } from "next/server";
import { databaseHealth, getDashboardSnapshot } from "@/lib/data/store";
import { rateLimit } from "@/lib/security/rate-limit";
import { getIngestionMetrics } from "@/server/ingestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, { limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  const [database, snapshot] = await Promise.all([databaseHealth(), getDashboardSnapshot(50)]);

  return NextResponse.json({
    ok: true,
    service: "crashpulse-ai",
    uptimeSeconds: Math.round(process.uptime()),
    database,
    ingestion: getIngestionMetrics(),
    roundsTracked: snapshot.rounds.length,
    latestStats: snapshot.stats,
    timestamp: new Date().toISOString()
  });
}
