import { z } from "zod";

export const roundInputSchema = z.object({
  round_id: z.string().min(1).max(120).optional(),
  roundId: z.string().min(1).max(120).optional(),
  id: z.string().min(1).max(120).optional(),
  multiplier: z.coerce.number().min(1).max(10_000),
  players: z.coerce.number().int().min(0).optional(),
  bets: z.coerce.number().int().min(0).optional(),
  cashouts: z.coerce.number().int().min(0).optional(),
  volatility: z.coerce.number().min(0).optional(),
  timestamp: z.union([z.string().datetime(), z.number(), z.date()]).optional()
});

export const strategySimulationSchema = z.object({
  strategyName: z.enum(["fixed-cashout", "martingale", "fixed-bet", "dynamic-bankroll"]),
  autoCashout: z.union([z.literal(1.5), z.literal(2), z.literal(3)]),
  baseBet: z.coerce.number().min(1).max(10_000),
  bankroll: z.coerce.number().min(10).max(1_000_000),
  maxRounds: z.coerce.number().int().min(10).max(1_000)
});

export function normalizeRoundPayload(payload: unknown) {
  const parsed = roundInputSchema.safeParse(payload);
  if (!parsed.success) return null;
  const data = parsed.data;

  return {
    id: data.round_id ?? data.roundId ?? data.id,
    roundId: data.round_id ?? data.roundId ?? data.id,
    multiplier: data.multiplier,
    players: data.players,
    bets: data.bets,
    cashouts: data.cashouts,
    volatility: data.volatility,
    createdAt:
      typeof data.timestamp === "number"
        ? new Date(data.timestamp)
        : data.timestamp
          ? new Date(data.timestamp)
          : new Date()
  };
}

export function parseJsonSafely(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
