import WebSocket from "ws";
import type { Server } from "socket.io";
import { createRound, getDashboardSnapshot } from "@/lib/data/store";
import type {
  CollectorStatus,
  LiveLog,
  LiveRoundState,
  RoundLifecycleEvent,
  RoundRecord
} from "@/lib/types";
import { normalizeRoundPayload, parseJsonSafely } from "@/lib/security/validation";
import { roundNumber } from "@/lib/utils";
import { getIngestionMetrics, WebsocketIngestionClient } from "@/server/ingestion";

type CandidatePayload = Record<string, unknown>;

export class LiveDataCollector {
  private io: Server;
  private started = false;
  private socket: WebSocket | null = null;
  private ingestionClient: WebsocketIngestionClient | null = null;
  private waitingTimer: NodeJS.Timeout | null = null;
  private runningTimer: NodeJS.Timeout | null = null;
  private crashTimer: NodeJS.Timeout | null = null;
  private pollingTimer: NodeJS.Timeout | null = null;
  private flushTimer: NodeJS.Timeout | null = null;
  private buffer: RoundRecord[] = [];
  private logs: LiveLog[] = [];
  private currentLiveRound: LiveRoundState | null = null;
  private status: CollectorStatus = {
    mode: "idle",
    connected: false,
    source: "not started",
    lastMessageAt: null,
    reconnectAttempts: 0
  };

  constructor(io: Server) {
    this.io = io;
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.flushTimer = setInterval(() => void this.flush(), 650);

    if (process.env.CRASH_SOURCE_WS) {
      this.startIngestionWebSocket(process.env.CRASH_SOURCE_WS);
      return;
    }

    if (process.env.CRASH_SOURCE_POLL_URL) {
      this.startPolling(process.env.CRASH_SOURCE_POLL_URL);
      return;
    }

    this.startSimulationEngine();
  }

  stop() {
    this.socket?.close();
    this.ingestionClient?.stop();
    if (this.waitingTimer) clearTimeout(this.waitingTimer);
    if (this.runningTimer) clearInterval(this.runningTimer);
    if (this.crashTimer) clearTimeout(this.crashTimer);
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    if (this.flushTimer) clearInterval(this.flushTimer);
  }

  getStatus() {
    return {
      ...this.status,
      metrics: getIngestionMetrics()
    };
  }

  getLogs() {
    return this.logs;
  }

  getLiveRound() {
    return this.currentLiveRound;
  }

  async emitInitialSnapshot(socketId?: string) {
    const target = socketId ? this.io.to(socketId) : this.io;
    const snapshot = await getDashboardSnapshot();
    target.emit("snapshot", snapshot);
    target.emit("collector:status", this.getStatus());
    target.emit("collector:logs", this.logs);
    if (this.currentLiveRound) target.emit("live:state", this.currentLiveRound);
  }

  async ingest(payload: unknown) {
    const candidates = this.extractCandidates(payload);
    for (const candidate of candidates) {
      const normalized = normalizeRoundPayload(candidate);
      if (!normalized) continue;
      const round = await createRound(normalized);
      this.buffer.push(round);
      this.status.lastMessageAt = new Date().toISOString();
    }
  }

  private connectWebSocket(url: string) {
    this.status = {
      mode: "websocket",
      connected: false,
      source: url,
      lastMessageAt: null,
      reconnectAttempts: this.status.reconnectAttempts
    };
    this.addLog("info", `Connecting to authorized websocket source: ${url}`);
    this.io.emit("collector:status", this.status);

    this.socket = new WebSocket(url, {
      perMessageDeflate: false,
      handshakeTimeout: 8_000
    });

    this.socket.on("open", () => {
      this.status.connected = true;
      this.status.reconnectAttempts = 0;
      this.addLog("info", "Live websocket source connected.");
      this.io.emit("collector:status", this.status);
    });

    this.socket.on("message", (message) => {
      const text = message.toString();
      const parsed = parseJsonSafely(text);
      void this.ingest(parsed ?? { multiplier: Number(text) });
    });

    this.socket.on("close", () => {
      this.status.connected = false;
      this.addLog("warn", "Live websocket source disconnected.");
      this.io.emit("collector:status", this.status);
      this.reconnectOrFallback(url);
    });

    this.socket.on("error", (error) => {
      this.status.connected = false;
      this.addLog("error", `Websocket source error: ${error.message}`);
      this.io.emit("collector:status", this.status);
    });
  }

  private startIngestionWebSocket(url: string) {
    this.status = {
      mode: "websocket",
      connected: true,
      source: url,
      lastMessageAt: null,
      reconnectAttempts: this.status.reconnectAttempts
    };
    this.addLog("info", `Starting production ingestion pipeline for websocket source: ${url}`);
    this.io.emit("collector:status", this.getStatus());

    this.ingestionClient = new WebsocketIngestionClient({
      url,
      onRounds: async (rounds) => {
        this.buffer.push(...rounds);
        this.status.lastMessageAt = new Date().toISOString();
        this.io.emit("collector:status", this.getStatus());
      }
    });
    this.ingestionClient.start();
  }

  private reconnectOrFallback(url: string) {
    this.status.reconnectAttempts += 1;
    const delay = Math.min(30_000, 1_000 * 2 ** Math.min(this.status.reconnectAttempts, 5));

    if (process.env.CRASH_SOURCE_POLL_URL && this.status.reconnectAttempts >= 3) {
      this.addLog("warn", "Switching to fallback polling source after websocket retries.");
      this.startPolling(process.env.CRASH_SOURCE_POLL_URL);
      return;
    }

    setTimeout(() => this.connectWebSocket(url), delay);
  }

  private startPolling(url: string) {
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    this.status = {
      mode: "polling",
      connected: true,
      source: url,
      lastMessageAt: this.status.lastMessageAt,
      reconnectAttempts: this.status.reconnectAttempts
    };
    this.addLog("info", `Polling authorized source: ${url}`);
    this.io.emit("collector:status", this.status);

    const poll = async () => {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await this.ingest(await response.json());
        this.status.connected = true;
      } catch (error) {
        this.status.connected = false;
        this.addLog(
          "warn",
          `Polling source unavailable: ${error instanceof Error ? error.message : "unknown error"}`
        );
        if (!process.env.CRASH_SOURCE_WS) this.startSimulationEngine();
      } finally {
        this.io.emit("collector:status", this.status);
      }
    };

    void poll();
    this.pollingTimer = setInterval(
      () => void poll(),
      Number(process.env.CRASH_SOURCE_POLL_INTERVAL_MS ?? 5_000)
    );
  }

  private startSimulationEngine() {
    if (this.waitingTimer || this.runningTimer || this.crashTimer) return;
    this.status = {
      mode: "simulation",
      connected: true,
      source: "realistic crash simulation engine",
      lastMessageAt: this.status.lastMessageAt,
      reconnectAttempts: this.status.reconnectAttempts
    };
    this.addLog("info", "Using paced crash simulation until an authorized live source is configured.");
    this.io.emit("collector:status", this.status);
    this.beginWaitingPhase();
  }

  private beginWaitingPhase() {
    const roundId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date();
    this.currentLiveRound = {
      roundId,
      state: "WAITING",
      multiplier: 1,
      elapsedMs: 0,
      waitingMs: 3_000,
      crashResetMs: 2_000,
      startedAt: null,
      updatedAt: now.toISOString(),
      crashedAt: null,
      crashMultiplier: null
    };

    this.emitLifecycle({
      type: "ROUND_WAITING",
      roundId,
      waitingMs: 3_000,
      serverTime: now.toISOString()
    });
    this.io.emit("live:state", this.currentLiveRound);

    this.waitingTimer = setTimeout(() => {
      this.waitingTimer = null;
      this.beginRunningPhase(roundId);
    }, 3_000);
  }

  private beginRunningPhase(roundId: string) {
    const crashMultiplier = this.sampleCrashMultiplier();
    const runDurationMs = this.sampleRunDurationMs();
    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();

    this.currentLiveRound = {
      roundId,
      state: "RUNNING",
      multiplier: 1,
      elapsedMs: 0,
      waitingMs: 3_000,
      crashResetMs: 2_000,
      startedAt,
      updatedAt: startedAt,
      crashedAt: null,
      crashMultiplier: null
    };

    this.emitLifecycle({
      type: "ROUND_START",
      roundId,
      serverTime: startedAt
    });
    this.io.emit("live:state", this.currentLiveRound);

    this.runningTimer = setInterval(() => {
      const elapsedMs = Date.now() - startedAtMs;
      if (elapsedMs >= runDurationMs) {
        void this.crashRound(roundId, crashMultiplier, runDurationMs);
        return;
      }

      const multiplier = roundNumber(
        Math.exp((Math.log(crashMultiplier) * elapsedMs) / runDurationMs),
        2
      );
      this.currentLiveRound = {
        ...this.currentLiveRound!,
        multiplier,
        elapsedMs,
        updatedAt: new Date().toISOString()
      };
      this.emitLifecycle({
        type: "MULTIPLIER_UPDATE",
        roundId,
        multiplier,
        elapsedMs,
        serverTime: this.currentLiveRound.updatedAt
      });
    }, 50);
  }

  private async crashRound(roundId: string, crashMultiplier: number, elapsedMs: number) {
    if (this.runningTimer) {
      clearInterval(this.runningTimer);
      this.runningTimer = null;
    }

    const now = new Date();
    const multiplier = roundNumber(crashMultiplier, 2);
    this.currentLiveRound = {
      ...this.currentLiveRound!,
      state: "CRASHED",
      multiplier,
      elapsedMs,
      updatedAt: now.toISOString(),
      crashedAt: now.toISOString(),
      crashMultiplier: multiplier
    };

    this.emitLifecycle({
      type: "ROUND_CRASH",
      roundId,
      multiplier,
      elapsedMs,
      serverTime: now.toISOString()
    });
    this.io.emit("live:state", this.currentLiveRound);

    const round = await createRound({
      id: roundId,
      multiplier,
      createdAt: now
    });
    this.buffer.push(round);
    this.status.lastMessageAt = now.toISOString();

    this.crashTimer = setTimeout(() => {
      this.crashTimer = null;
      this.emitLifecycle({
        type: "ROUND_END",
        roundId,
        serverTime: new Date().toISOString()
      });
      this.beginWaitingPhase();
    }, 2_000);
  }

  private async flush() {
    if (!this.buffer.length) return;
    const rounds = this.buffer.splice(0, this.buffer.length);
    const snapshot = await getDashboardSnapshot();
    this.io.emit("round:batch", { rounds, snapshot });
    this.io.emit("stats:update", snapshot.stats);
  }

  private extractCandidates(payload: unknown): CandidatePayload[] {
    if (Array.isArray(payload)) return payload.flatMap((item) => this.extractCandidates(item));
    if (!payload || typeof payload !== "object") return [];

    const object = payload as CandidatePayload;
    const nested = ["data", "round", "latest", "payload", "result"]
      .map((key) => object[key])
      .filter(Boolean)
      .flatMap((value) => this.extractCandidates(value));

    const multiplier =
      object.multiplier ??
      object.crashPoint ??
      object.crash_point ??
      object.cashout ??
      object.value ??
      object.payout;

    if (multiplier === undefined) return nested;

    return [
      ...nested,
      {
        round_id: object.round_id ?? object.roundId ?? object.id,
        multiplier,
        timestamp: object.timestamp ?? object.createdAt ?? object.time
      }
    ];
  }

  private sampleRunDurationMs() {
    return Math.round(8_000 + Math.random() * 7_000);
  }

  private sampleCrashMultiplier() {
    const roll = Math.random();

    if (roll < 0.72) {
      return roundNumber(1.01 + Math.random() ** 1.35 * 1.99, 2);
    }

    if (roll < 0.93) {
      return roundNumber(3 + Math.random() ** 1.8 * 4, 2);
    }

    if (roll < 0.99) {
      return roundNumber(7 + Math.random() ** 2.1 * 18, 2);
    }

    return roundNumber(25 + Math.random() ** 2.8 * 175, 2);
  }

  private emitLifecycle(event: RoundLifecycleEvent) {
    this.io.emit(event.type, event);
    this.io.emit("round:lifecycle", event);
  }

  private addLog(level: LiveLog["level"], message: string) {
    const log = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      level,
      message,
      createdAt: new Date().toISOString()
    };
    this.logs.unshift(log);
    this.logs.splice(80);
    this.io.emit("collector:log", log);
  }
}
