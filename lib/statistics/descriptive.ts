import { roundNumber } from "@/lib/utils";

export function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function movingAverage(values: number[], window: number) {
  return values.map((_, index) => roundNumber(mean(values.slice(Math.max(0, index - window + 1), index + 1)), 4));
}

export function rollingStandardDeviation(values: number[], window: number) {
  return values.map((_, index) =>
    roundNumber(standardDeviation(values.slice(Math.max(0, index - window + 1), index + 1)), 4)
  );
}

export function entropy(values: number[], bucketSize = 1) {
  if (!values.length) return 0;
  const buckets = new Map<number, number>();
  values.forEach((value) => {
    const bucket = Math.floor(value / bucketSize);
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  });
  const total = values.length;
  const score = [...buckets.values()].reduce((sum, count) => {
    const p = count / total;
    return sum - p * Math.log2(p);
  }, 0);
  return roundNumber(score, 4);
}

export function slope(values: number[]) {
  if (values.length < 2) return 0;
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = mean(values);
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, index) => {
    numerator += (index - xMean) * (value - yMean);
    denominator += (index - xMean) ** 2;
  });
  return denominator === 0 ? 0 : numerator / denominator;
}
