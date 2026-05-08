import { DISCLAIMER, RISK_THRESHOLDS } from "@/lib/constants";
import type {
  ChartPoint,
  DistributionBucket,
  HeatmapCell,
  RoundRecord,
  StatisticsRecord,
  StreakFrequency,
  StreakType
} from "@/lib/types";
import { clamp, roundNumber } from "@/lib/utils";
import { computeRealtimeAnalytics } from "@/lib/analytics/realtime-engine";

type RawRound = {
  id: string;
  multiplier: number;
  createdAt: string | Date;
};

const DISTRIBUTION_BINS = [
  { label: "< 1.25x", min: 0, max: 1.25 },
  { label: "1.25-2x", min: 1.25, max: 2 },
  { label: "2-5x", min: 2, max: 5 },
  { label: "5-10x", min: 5, max: 10 },
  { label: "10x+", min: 10, max: null }
];

export function classifyStreak(multiplier: number): StreakType {
  if (multiplier < 2) return "low";
  if (multiplier < 5) return "mid";
  if (multiplier < 10) return "high";
  return "mega";
}

export function calculateVolatilityScore(rounds: Pick<RoundRecord, "multiplier">[]) {
  if (rounds.length < 2) return 0;
  const values = rounds.map((round) => Math.log(Math.max(round.multiplier, 1.01)));
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);

  return roundNumber(clamp(Math.sqrt(variance) * 42, 0, 100), 2);
}

export function enrichRounds(rawRounds: RawRound[]): RoundRecord[] {
  const ordered = [...rawRounds]
    .filter((round) => Number.isFinite(round.multiplier) && round.multiplier >= 1)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const result: RoundRecord[] = [];
  let previousType: StreakType | null = null;
  let streakLength = 0;

  ordered.forEach((round, index) => {
    const streakType = classifyStreak(round.multiplier);
    streakLength = streakType === previousType ? streakLength + 1 : 1;
    previousType = streakType;

    const recentWindow = result.slice(Math.max(0, index - 24), index);
    const volatilityScore = calculateVolatilityScore([
      ...recentWindow,
      {
        id: round.id,
        multiplier: round.multiplier,
        createdAt: new Date(round.createdAt).toISOString(),
        volatilityScore: 0,
        streakType,
        streakLength
      }
    ]);

    result.push({
      id: round.id,
      multiplier: round.multiplier,
      createdAt: new Date(round.createdAt).toISOString(),
      volatilityScore,
      streakType,
      streakLength
    });
  });

  return result;
}

function rate(values: number[], predicate: (value: number) => boolean) {
  if (!values.length) return 0;
  return values.filter(predicate).length / values.length;
}

function betaSmoothedRate(values: number[], predicate: (value: number) => boolean) {
  const successes = values.filter(predicate).length;
  return (successes + 1) / (values.length + 2);
}

export function calculateStatistics(rounds: RoundRecord[]): StatisticsRecord {
  const latest = [...rounds].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const frame = computeRealtimeAnalytics(latest);
  const values = latest.map((round) => round.multiplier);
  const last100 = values.slice(0, 100);
  const volatilityIndex = frame.rollingVolatility;
  const lowCrashRate = rate(last100, (value) => value < 2);
  const highCrashRate = rate(last100, (value) => value > 5);
  const probabilityUnder2x = betaSmoothedRate(last100, (value) => value < 2);
  const probabilityOver5x = betaSmoothedRate(last100, (value) => value > 5);
  const probabilityOver10x = betaSmoothedRate(last100, (value) => value > 10);
  const riskComposite = frame.riskScore;

  return {
    id: "latest",
    avg10: frame.ma10,
    avg25: frame.ma25,
    avg50: frame.ma50,
    avg100: frame.ma100,
    lowCrashRate: roundNumber(lowCrashRate, 4),
    highCrashRate: roundNumber(highCrashRate, 4),
    volatilityIndex: roundNumber(volatilityIndex, 2),
    entropyScore: frame.entropyScore,
    lowStreakCount: latest.find((round) => round.streakType === "low")?.streakLength ?? 0,
    probabilityUnder2x: roundNumber(probabilityUnder2x, 4),
    probabilityOver5x: roundNumber(probabilityOver5x, 4),
    probabilityOver10x: roundNumber(probabilityOver10x, 4),
    trendScore: frame.trendScore,
    riskScore: frame.riskScore,
    riskLevel:
      riskComposite < RISK_THRESHOLDS.low
        ? "Low Risk"
        : riskComposite < RISK_THRESHOLDS.medium
          ? "Medium Risk"
          : "High Volatility",
    updatedAt: new Date().toISOString()
  };
}

export function buildDistribution(rounds: RoundRecord[]): DistributionBucket[] {
  const total = Math.max(rounds.length, 1);
  return DISTRIBUTION_BINS.map((bucket) => {
    const count = rounds.filter((round) => {
      const aboveMin = round.multiplier >= bucket.min;
      const belowMax = bucket.max === null ? true : round.multiplier < bucket.max;
      return aboveMin && belowMax;
    }).length;

    return {
      ...bucket,
      count,
      rate: roundNumber(count / total, 4)
    };
  });
}

export function buildChartPoints(rounds: RoundRecord[]): ChartPoint[] {
  return [...rounds]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-100)
    .map((round, index) => ({
      index: index + 1,
      roundId: round.id,
      multiplier: roundNumber(round.multiplier, 2),
      volatility: round.volatilityScore,
      timestamp: round.createdAt
    }));
}

export function buildHeatmap(rounds: RoundRecord[]): HeatmapCell[] {
  const recent = [...rounds]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-60);

  return Array.from({ length: 60 }, (_, index) => {
    const round = recent[index];
    const value = round ? clamp(Math.log(round.multiplier) / Math.log(12), 0, 1) : 0;
    return {
      row: Math.floor(index / 10),
      col: index % 10,
      value: roundNumber(value, 3),
      label: round ? `${round.multiplier.toFixed(2)}x` : "No round"
    };
  });
}

export function buildStreakFrequency(rounds: RoundRecord[]): StreakFrequency[] {
  const initial: Record<StreakType, StreakFrequency> = {
    low: { type: "low", count: 0, maxLength: 0 },
    mid: { type: "mid", count: 0, maxLength: 0 },
    high: { type: "high", count: 0, maxLength: 0 },
    mega: { type: "mega", count: 0, maxLength: 0 }
  };

  rounds.forEach((round) => {
    initial[round.streakType].count += 1;
    initial[round.streakType].maxLength = Math.max(
      initial[round.streakType].maxLength,
      round.streakLength
    );
  });

  return Object.values(initial);
}

export function getDisclaimer() {
  return DISCLAIMER;
}
