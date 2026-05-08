import type { IngestionMetrics } from "./types";

const metrics: IngestionMetrics = {
  startedAt: new Date(),
  packetsReceived: 0,
  packetsDeduped: 0,
  packetsIgnored: 0,
  parserFailures: 0,
  extractedRounds: 0,
  insertedRounds: 0,
  duplicateRounds: 0,
  reconnectCount: 0,
  dbInsertLatencyMs: 0,
  lastPacketAt: null,
  lastRoundAt: null,
  activeBrowserUptimeMs: 0
};

const recentPacketTimes: number[] = [];
const recentRoundTimes: number[] = [];

function trimWindow(values: number[], now: number, windowMs: number) {
  while (values.length && now - values[0] > windowMs) values.shift();
}

export function recordPacket() {
  const now = Date.now();
  metrics.packetsReceived += 1;
  metrics.lastPacketAt = new Date(now);
  recentPacketTimes.push(now);
  trimWindow(recentPacketTimes, now, 60_000);
}

export function recordRound(count = 1) {
  const now = Date.now();
  metrics.extractedRounds += count;
  metrics.lastRoundAt = new Date(now);
  for (let index = 0; index < count; index += 1) recentRoundTimes.push(now);
  trimWindow(recentRoundTimes, now, 60_000);
}

export function updateMetrics(patch: Partial<IngestionMetrics>) {
  Object.assign(metrics, patch);
}

export function incrementMetric<K extends keyof IngestionMetrics>(
  key: K,
  amount = 1
) {
  const current = metrics[key];
  if (typeof current === "number") {
    metrics[key] = (current + amount) as IngestionMetrics[K];
  }
}

export function getIngestionMetrics() {
  const now = Date.now();
  trimWindow(recentPacketTimes, now, 60_000);
  trimWindow(recentRoundTimes, now, 60_000);
  return {
    ...metrics,
    packetsPerSecond: Number((recentPacketTimes.length / 60).toFixed(2)),
    roundsPerMinute: recentRoundTimes.length,
    uptimeSeconds: Math.round((now - metrics.startedAt.getTime()) / 1000)
  };
}
