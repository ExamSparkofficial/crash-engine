import { NextRequest, NextResponse } from "next/server";
import { getRounds } from "@/lib/data/store";
import { buildFeatureRows, toCsv, writeDatasetSnapshot } from "@/lib/feature-engineering/dataset";
import { rateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, { limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 10_000), 100_000);
  const format = request.nextUrl.searchParams.get("format") === "csv" ? "csv" : "json";
  const rows = buildFeatureRows(await getRounds(limit));

  if (format === "csv") {
    return new NextResponse(toCsv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="crashpulse-features-${Date.now()}.csv"`
      }
    });
  }

  return NextResponse.json({ rows, count: rows.length });
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const format = body.format === "parquet" ? "parquet" : "csv";
  const limit = Math.min(Number(body.limit ?? 100_000), 1_000_000);
  const rows = buildFeatureRows(await getRounds(limit));
  const snapshot = await writeDatasetSnapshot(rows, format, body.name);

  return NextResponse.json({ snapshot }, { status: 201 });
}
