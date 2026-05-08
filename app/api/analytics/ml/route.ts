import { NextRequest, NextResponse } from "next/server";
import { getRounds } from "@/lib/data/store";
import { buildFeatureRows } from "@/lib/feature-engineering/dataset";
import { rateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  const analyticsUrl = process.env.ANALYTICS_SERVICE_URL;
  const rounds = await getRounds(500);

  if (!analyticsUrl) {
    return NextResponse.json({
      features: buildFeatureRows(rounds),
      note: "ANALYTICS_SERVICE_URL is not configured; returned local ML-ready feature rows."
    });
  }

  const response = await fetch(`${analyticsUrl.replace(/\/$/, "")}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rounds: rounds.map((round) => ({
        round_id: round.id,
        multiplier: round.multiplier,
        timestamp: round.createdAt
      }))
    })
  }).catch((error: unknown) => {
    console.error("Analytics service request failed.", error);
    return null;
  });

  if (!response?.ok) {
    return NextResponse.json(
      { error: "Analytics service unavailable or returned an error." },
      { status: 502 }
    );
  }

  return NextResponse.json(await response.json());
}
