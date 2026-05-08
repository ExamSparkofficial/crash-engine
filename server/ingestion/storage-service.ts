import { mkdir, rename, stat, appendFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { classifyStreak, calculateVolatilityScore } from "@/lib/analytics/statistics";
import { roundNumber } from "@/lib/utils";
import type { RoundRecord } from "@/lib/types";
import { incrementMetric, updateMetrics } from "./metrics-registry";
import { createLogger } from "./structured-logger";
import type { NormalizedRoundEvent } from "./types";

type StorageOptions = {
  batchSize?: number;
  flushIntervalMs?: number;
  retryAttempts?: number;
  backupNdjsonPath?: string;
  rotateBytes?: number;
  onFlush?: (rounds: RoundRecord[]) => void | Promise<void>;
};

const DEFAULT_BACKUP_PATH = path.join(process.cwd(), "logs", "ingestion-backup.ndjson");

export class StorageService {
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly retryAttempts: number;
  private readonly backupNdjsonPath: string | null;
  private readonly rotateBytes: number;
  private readonly onFlush?: StorageOptions["onFlush"];
  private readonly logger = createLogger("ingestion:storage");
  private readonly seen = new Map<string, number>();
  private queue: NormalizedRoundEvent[] = [];
  private flushing = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(options: StorageOptions = {}) {
    this.batchSize = options.batchSize ?? 100;
    this.flushIntervalMs = options.flushIntervalMs ?? 1_000;
    this.retryAttempts = options.retryAttempts ?? 3;
    this.backupNdjsonPath =
      process.env.INGESTION_BACKUP_NDJSON === "false"
        ? null
        : (options.backupNdjsonPath ?? DEFAULT_BACKUP_PATH);
    this.rotateBytes = options.rotateBytes ?? 25 * 1024 * 1024;
    this.onFlush = options.onFlush;
  }

  start() {
    if (!this.timer) this.timer = setInterval(() => void this.flush(), this.flushIntervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async enqueue(events: NormalizedRoundEvent[]) {
    const fresh = events.filter((event) => !this.markDuplicate(event));
    if (!fresh.length) return [];

    this.queue.push(...fresh);
    if (this.queue.length >= this.batchSize) return this.flush();
    return [];
  }

  async flush(): Promise<RoundRecord[]> {
    if (this.flushing || !this.queue.length) return [];
    this.flushing = true;
    const events = this.queue.splice(0, this.batchSize);
    const started = performance.now();

    try {
      await this.writeBackup(events);
      const db = prisma;
      if (!db) {
        this.logger.warn("DATABASE_URL missing; batch persisted only to backup log.", {
          eventCount: events.length
        });
        const rounds = events.filter((event) => event.multiplier !== undefined).map((event) => this.toRoundRecord(event));
        await this.onFlush?.(rounds);
        return rounds;
      }

      const data = events.map((event) => this.toCreateManyInput(event));
      await this.retry(() =>
        db.round.createMany({
          data,
          skipDuplicates: true
        })
      );

      const inserted = data.length;
      incrementMetric("insertedRounds", inserted);
      updateMetrics({ dbInsertLatencyMs: Math.round(performance.now() - started) });
      const rounds = events.filter((event) => event.multiplier !== undefined).map((event) => this.toRoundRecord(event));
      await this.onFlush?.(rounds);
      return rounds;
    } catch (error) {
      this.queue.unshift(...events);
      this.logger.error("Round batch insert failed; batch returned to queue.", {
        error: error instanceof Error ? error.message : "unknown",
        eventCount: events.length
      });
      return [];
    } finally {
      this.flushing = false;
      this.compactSeen();
    }
  }

  private markDuplicate(event: NormalizedRoundEvent) {
    const key = event.roundId ?? `${event.timestamp.getTime()}_${event.multiplier ?? "state"}`;
    if (this.seen.has(key)) {
      incrementMetric("duplicateRounds");
      return true;
    }
    this.seen.set(key, Date.now());
    return false;
  }

  private compactSeen() {
    if (this.seen.size < 20_000) return;
    const cutoff = Date.now() - 6 * 60 * 60 * 1000;
    for (const [key, timestamp] of this.seen) {
      if (timestamp < cutoff) this.seen.delete(key);
    }
  }

  private async retry<T>(operation: () => Promise<T>) {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.retryAttempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, attempt * 250));
      }
    }
    throw lastError;
  }

  private toCreateManyInput(event: NormalizedRoundEvent): Prisma.RoundCreateManyInput {
    const record = this.toRoundRecord(event);
    return {
      id: event.roundId ?? undefined,
      roundId: event.roundId,
      multiplier: event.multiplier === undefined ? null : roundNumber(event.multiplier, 2),
      players: event.players,
      bets: event.bets,
      cashouts: event.cashouts,
      volatility: event.volatility,
      rawPayload:
        event.rawPayload === undefined
          ? undefined
          : event.rawPayload === null
            ? Prisma.JsonNull
            : (event.rawPayload as Prisma.InputJsonValue),
      eventType: event.eventType,
      source: event.source,
      createdAt: event.timestamp,
      volatilityScore: record.volatilityScore,
      streakType: record.streakType,
      streakLength: record.streakLength
    };
  }

  private toRoundRecord(event: NormalizedRoundEvent): RoundRecord {
    const multiplier = roundNumber(event.multiplier ?? 1, 2);
    const streakType = classifyStreak(multiplier);
    return {
      id: event.roundId ?? `round_${event.timestamp.getTime()}`,
      roundId: event.roundId,
      multiplier,
      players: event.players,
      bets: event.bets,
      cashouts: event.cashouts,
      createdAt: event.timestamp.toISOString(),
      volatilityScore: calculateVolatilityScore([{ multiplier } as RoundRecord]),
      volatility: event.volatility,
      streakType,
      streakLength: 1
    };
  }

  private async writeBackup(events: NormalizedRoundEvent[]) {
    if (!this.backupNdjsonPath || !events.length) return;
    await mkdir(path.dirname(this.backupNdjsonPath), { recursive: true });
    await this.rotateBackupIfNeeded();
    const lines = events.map((event) => JSON.stringify(event)).join("\n") + "\n";
    await appendFile(this.backupNdjsonPath, lines, "utf8");
  }

  private async rotateBackupIfNeeded() {
    if (!this.backupNdjsonPath) return;
    const size = await stat(this.backupNdjsonPath).then((file) => file.size).catch(() => 0);
    if (size < this.rotateBytes) return;
    const rotated = `${this.backupNdjsonPath}.${new Date().toISOString().replace(/[:.]/g, "-")}`;
    await rename(this.backupNdjsonPath, rotated).catch(() => undefined);
  }
}
