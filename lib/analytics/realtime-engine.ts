import type { RoundRecord } from "@/lib/types";
import { clamp, roundNumber } from "@/lib/utils";
import { entropy, mean, slope, standardDeviation } from "@/lib/statistics/descriptive";

export type ProbabilityBuckets = {
  under1_25x: number;
  under2x: number;
  over2x: number;
  over5x: number;
  over10x: number;
  over25x: number;
};

export type RealtimeAnalyticsFrame = {
  ma10: number;
  ma25: number;
  ma50: number;
  ma100: number;
  rollingVolatility: number;
  rollingStdDev: number;
  entropyScore: number;
  streakClusters: Record<string, number>;
  probabilityBuckets: ProbabilityBuckets;
  trendScore: number;
  riskScore: number;
};

export function computeProbabilityBuckets(values: number[]): ProbabilityBuckets {
  const total = Math.max(values.length, 1);
  const rate = (predicate: (value: number) => boolean) =>
    roundNumber(values.filter(predicate).length / total, 4);
  return {
    under1_25x: rate((value) => value < 1.25),
    under2x: rate((value) => value < 2),
    over2x: rate((value) => value >= 2),
    over5x: rate((value) => value >= 5),
    over10x: rate((value) => value >= 10),
    over25x: rate((value) => value >= 25)
  };
}

export function computeStreakClusters(rounds: RoundRecord[]) {
  return rounds.reduce<Record<string, number>>((clusters, round) => {
    clusters[round.streakType] = Math.max(clusters[round.streakType] ?? 0, round.streakLength);
    return clusters;
  }, {});
}

export function computeRealtimeAnalytics(rounds: RoundRecord[]): RealtimeAnalyticsFrame {
  const latest = [...rounds].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const values = latest.map((round) => round.multiplier);
  const last100 = values.slice(0, 100);
  const logValues = last100.map((value) => Math.log(Math.max(value, 1.01)));
  const rollingVolatility = standardDeviation(logValues) * 42;
  const trendRaw = slope(values.slice(0, 40).reverse());
  const trendScore = clamp(50 + trendRaw * 16 - rollingVolatility * 0.08, 0, 100);
  const probabilityBuckets = computeProbabilityBuckets(last100);
  const entropyScore = entropy(last100, 1);
  const riskScore = clamp(
    rollingVolatility * 0.58 + probabilityBuckets.under2x * 42 + Math.max(0, 50 - trendScore) * 0.2,
    0,
    100
  );

  return {
    ma10: roundNumber(mean(values.slice(0, 10)), 2),
    ma25: roundNumber(mean(values.slice(0, 25)), 2),
    ma50: roundNumber(mean(values.slice(0, 50)), 2),
    ma100: roundNumber(mean(values.slice(0, 100)), 2),
    rollingVolatility: roundNumber(rollingVolatility, 2),
    rollingStdDev: roundNumber(standardDeviation(last100), 4),
    entropyScore,
    streakClusters: computeStreakClusters(latest),
    probabilityBuckets,
    trendScore: roundNumber(trendScore, 2),
    riskScore: roundNumber(riskScore, 2)
  };
}
