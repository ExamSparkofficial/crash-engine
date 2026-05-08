import {
  buildChartPoints,
  buildDistribution,
  buildHeatmap,
  buildStreakFrequency,
  calculateStatistics,
  calculateVolatilityScore,
  classifyStreak,
  enrichRounds
} from "@/lib/analytics/statistics";
import { MAX_ROUNDS_IN_MEMORY } from "@/lib/constants";
import { prisma } from "@/lib/db/prisma";
import type {
  DashboardSnapshot,
  RoundRecord,
  StrategySimulationResult,
  StrategySimulationInput
} from "@/lib/types";
import { runStrategySimulation } from "@/lib/analytics/simulator";
import { roundNumber } from "@/lib/utils";

type IncomingRound = {
  id?: string;
  roundId?: string | null;
  multiplier: number;
  players?: number | null;
  bets?: number | null;
  cashouts?: number | null;
  volatility?: number | null;
  rawPayload?: unknown;
  createdAt?: Date | string;
};

type StoredStrategy = {
  id: string;
  strategyName: string;
  totalProfit: number;
  totalLoss: number;
  winRate: number;
  roi: number;
  createdAt: string;
};

const memoryRounds: RoundRecord[] = seedRounds();
const memoryStrategies: StoredStrategy[] = [];

function generateId(prefix = "round") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function demoMultiplier(index: number) {
  const roll = Math.random();
  const rhythmDip = index % 19 === 0 ? 0.08 : 0;

  if (roll < 0.72) {
    return roundNumber(Math.max(1.01, 1.01 + Math.random() ** 1.35 * 1.99 - rhythmDip), 2);
  }
  if (roll < 0.93) return roundNumber(3 + Math.random() ** 1.8 * 4, 2);
  if (roll < 0.99) return roundNumber(7 + Math.random() ** 2.1 * 18, 2);
  return roundNumber(25 + Math.random() ** 2.8 * 175, 2);
}

function seedRounds() {
  const start = Date.now() - 1000 * 60 * 120;
  const raw = Array.from({ length: 180 }, (_, index) => ({
    id: `demo_${index + 1}`,
    multiplier: demoMultiplier(index),
    createdAt: new Date(start + index * 40_000)
  }));

  return enrichRounds(raw);
}

function toRoundRecord(round: {
  id: string;
  roundId?: string | null;
  multiplier: number | null;
  players?: number | null;
  bets?: number | null;
  cashouts?: number | null;
  volatility?: number | null;
  createdAt: Date;
  volatilityScore: number;
  streakType: string;
  streakLength: number;
}): RoundRecord {
  return {
    id: round.id,
    roundId: round.roundId,
    multiplier: round.multiplier ?? 1,
    players: round.players,
    bets: round.bets,
    cashouts: round.cashouts,
    volatility: round.volatility,
    createdAt: round.createdAt.toISOString(),
    volatilityScore: round.volatilityScore,
    streakType: round.streakType as RoundRecord["streakType"],
    streakLength: round.streakLength
  };
}

async function getDatabaseRounds(limit: number) {
  if (!prisma) return null;

  try {
    const rounds = await prisma.round.findMany({
      orderBy: { createdAt: "desc" },
      take: limit
    });
    return rounds.map(toRoundRecord);
  } catch (error) {
    console.warn("Prisma round read failed; falling back to memory store.", error);
    return null;
  }
}

export async function getRounds(limit = 250): Promise<RoundRecord[]> {
  const databaseRounds = await getDatabaseRounds(limit);
  if (databaseRounds?.length) {
    return databaseRounds;
  }

  return [...memoryRounds]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

export async function createRound(incoming: IncomingRound): Promise<RoundRecord> {
  const existing = await getRounds(250);
  const createdAt = new Date(incoming.createdAt ?? new Date());
  const id = incoming.id ?? incoming.roundId ?? generateId();
  const streakType = classifyStreak(incoming.multiplier);
  const previous = existing[0];
  const streakLength =
    previous && previous.streakType === streakType ? previous.streakLength + 1 : 1;
  const volatilityScore = calculateVolatilityScore([
    ...existing.slice(0, 24).reverse(),
    {
      id,
      multiplier: incoming.multiplier,
      createdAt: createdAt.toISOString(),
      volatilityScore: 0,
      streakType,
      streakLength
    }
  ]);

  const record: RoundRecord = {
    id,
    multiplier: roundNumber(incoming.multiplier, 2),
    createdAt: createdAt.toISOString(),
    volatilityScore,
    streakType,
    streakLength
  };

  if (prisma) {
    try {
      const saved = await prisma.round.upsert({
        where: { id: record.id },
        create: {
          id: record.id,
          roundId: incoming.roundId ?? incoming.id ?? null,
          multiplier: record.multiplier,
          players: incoming.players ?? null,
          bets: incoming.bets ?? null,
          cashouts: incoming.cashouts ?? null,
          volatility: incoming.volatility ?? record.volatilityScore,
          rawPayload: incoming.rawPayload as never,
          createdAt,
          volatilityScore: record.volatilityScore,
          streakType: record.streakType,
          streakLength: record.streakLength
        },
        update: {
          multiplier: record.multiplier,
          players: incoming.players ?? undefined,
          bets: incoming.bets ?? undefined,
          cashouts: incoming.cashouts ?? undefined,
          volatility: incoming.volatility ?? record.volatilityScore,
          rawPayload: incoming.rawPayload as never,
          volatilityScore: record.volatilityScore,
          streakType: record.streakType,
          streakLength: record.streakLength
        }
      });
      await persistStatistics();
      return toRoundRecord(saved);
    } catch (error) {
      console.warn("Prisma round write failed; persisting to memory store.", error);
    }
  }

  memoryRounds.unshift(record);
  memoryRounds.splice(MAX_ROUNDS_IN_MEMORY);
  return record;
}

export async function getDashboardSnapshot(limit = 250): Promise<DashboardSnapshot> {
  const rounds = await getRounds(limit);
  const chronological = [...rounds].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return {
    rounds,
    stats: calculateStatistics(rounds),
    distribution: buildDistribution(rounds),
    heatmap: buildHeatmap(rounds),
    streaks: buildStreakFrequency(chronological),
    charts: buildChartPoints(rounds)
  };
}

export async function persistStatistics() {
  if (!prisma) return calculateStatistics(await getRounds(250));

  const stats = calculateStatistics(await getRounds(250));
  try {
    await prisma.statistics.create({
      data: {
        avg10: stats.avg10,
        avg25: stats.avg25,
        avg50: stats.avg50,
        avg100: stats.avg100,
        lowCrashRate: stats.lowCrashRate,
        highCrashRate: stats.highCrashRate,
        volatilityIndex: stats.volatilityIndex,
        entropyScore: stats.entropyScore,
        riskScore: stats.riskScore
      }
    });
  } catch (error) {
    console.warn("Prisma statistics write failed.", error);
  }

  return stats;
}

export async function simulateStrategy(
  input: StrategySimulationInput
): Promise<StrategySimulationResult> {
  const rounds = await getRounds(input.maxRounds);
  return runStrategySimulation(rounds, input);
}

export async function saveStrategyResult(result: StrategySimulationResult) {
  if (prisma) {
    try {
      const saved = await prisma.strategy.create({
        data: {
          strategyName: result.strategyName,
          totalProfit: result.totalProfit,
          totalLoss: result.totalLoss,
          winRate: result.winRate,
          roi: result.roi
        }
      });
      return {
        ...saved,
        createdAt: saved.createdAt.toISOString()
      };
    } catch (error) {
      console.warn("Prisma strategy write failed; persisting to memory store.", error);
    }
  }

  const record = {
    id: generateId("strategy"),
    strategyName: result.strategyName,
    totalProfit: result.totalProfit,
    totalLoss: result.totalLoss,
    winRate: result.winRate,
    roi: result.roi,
    createdAt: new Date().toISOString()
  };
  memoryStrategies.unshift(record);
  return record;
}

export async function getStrategies(limit = 20): Promise<StoredStrategy[]> {
  if (prisma) {
    try {
      const strategies = await prisma.strategy.findMany({
        orderBy: { createdAt: "desc" },
        take: limit
      });
      return strategies.map((strategy: {
        id: string;
        strategyName: string;
        totalProfit: number;
        totalLoss: number;
        winRate: number;
        roi: number;
        createdAt: Date;
      }) => ({
        ...strategy,
        createdAt: strategy.createdAt.toISOString()
      }));
    } catch (error) {
      console.warn("Prisma strategy read failed; falling back to memory store.", error);
    }
  }

  return memoryStrategies.slice(0, limit);
}

export async function databaseHealth() {
  const started = performance.now();
  if (!prisma) {
    return {
      ok: false,
      provider: "memory",
      latencyMs: 0,
      message: "DATABASE_URL not configured; using in-memory demo store."
    };
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    const [roundCount, strategyCount] = await Promise.all([
      prisma.round.count(),
      prisma.strategy.count()
    ]);
    return {
      ok: true,
      provider: "postgresql",
      latencyMs: Math.round(performance.now() - started),
      roundCount,
      strategyCount,
      message: "PostgreSQL connection healthy."
    };
  } catch (error) {
    return {
      ok: false,
      provider: "postgresql",
      latencyMs: Math.round(performance.now() - started),
      message: error instanceof Error ? error.message : "Unknown database error."
    };
  }
}
