import { NextRequest, NextResponse } from "next/server";
import { saveStrategyResult, simulateStrategy } from "@/lib/data/store";
import { rateLimit } from "@/lib/security/rate-limit";
import { strategySimulationSchema } from "@/lib/security/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { limit: 40, windowMs: 60_000 });
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const parsed = strategySimulationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid strategy configuration.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await simulateStrategy(parsed.data);
  const saved = await saveStrategyResult(result);
  return NextResponse.json({ result, saved });
}
