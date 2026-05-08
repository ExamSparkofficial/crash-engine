import type { JsonValue } from "@prisma/client/runtime/library";
import type { ClassifiedPacket, NormalizedRoundEvent } from "./types";

type PlainObject = Record<string, unknown>;

const ROUND_ID_KEYS = ["roundId", "round_id", "round", "gameId", "game_id", "id"];
const MULTIPLIER_KEYS = [
  "multiplier",
  "crashPoint",
  "crash_point",
  "cashoutMultiplier",
  "cashout_multiplier",
  "payout",
  "coef",
  "value"
];
const PLAYERS_KEYS = ["players", "playersCount", "players_count", "online", "activePlayers"];
const BET_KEYS = ["bets", "betsCount", "BetsCount", "bets_count", "betCount", "totalBets"];
const CASHOUT_KEYS = ["cashouts", "cashoutsCount", "cashoutCount", "cash_outs", "cashedOut"];
const TIMESTAMP_KEYS = ["timestamp", "ts", "time", "createdAt", "serverTime"];

export class RoundExtractor {
  extract(packet: ClassifiedPacket): NormalizedRoundEvent[] {
    if (packet.eventKind === "heartbeat" || packet.eventKind === "noise") return [];

    const roots = packet.json ? [packet.json] : [this.extractRegexCandidate(packet.text)];
    const candidates = roots.flatMap((root) => this.walk(root)).filter(Boolean);
    const events = candidates
      .map((candidate) => this.normalize(candidate as PlainObject, packet))
      .filter((event): event is NormalizedRoundEvent => Boolean(event));

    return this.coalesce(events);
  }

  private normalize(candidate: PlainObject, packet: ClassifiedPacket): NormalizedRoundEvent | null {
    const multiplier = this.pickNumber(candidate, MULTIPLIER_KEYS);
    const players = this.pickInteger(candidate, PLAYERS_KEYS);
    const bets = this.pickInteger(candidate, BET_KEYS);
    const cashouts = this.pickInteger(candidate, CASHOUT_KEYS);
    const roundId = this.pickString(candidate, ROUND_ID_KEYS);

    if (
      multiplier === undefined &&
      players === undefined &&
      bets === undefined &&
      cashouts === undefined
    ) {
      return null;
    }

    if (multiplier !== undefined && (multiplier < 1 || multiplier > 1_000_000)) return null;

    return {
      roundId,
      multiplier,
      players,
      bets,
      cashouts,
      volatility: multiplier === undefined ? undefined : Number(Math.log(Math.max(multiplier, 1.01)).toFixed(6)),
      timestamp: this.pickDate(candidate, TIMESTAMP_KEYS) ?? packet.receivedAt,
      eventType: packet.eventKind,
      source: packet.url,
      rawPayload: this.toJsonValue(candidate)
    };
  }

  private walk(value: unknown, depth = 0): PlainObject[] {
    if (depth > 5 || value == null) return [];
    if (Array.isArray(value)) return value.flatMap((item) => this.walk(item, depth + 1));
    if (typeof value !== "object") return [];

    const object = value as PlainObject;
    const hasRelevantKey = [...MULTIPLIER_KEYS, ...PLAYERS_KEYS, ...BET_KEYS, ...CASHOUT_KEYS].some(
      (key) => object[key] !== undefined
    );
    const nested = Object.values(object).flatMap((item) => this.walk(item, depth + 1));
    return hasRelevantKey ? [object, ...nested] : nested;
  }

  private extractRegexCandidate(text: string): PlainObject {
    return {
      roundId: this.matchString(text, /round(?:_|-)?id["'\s:=]+([a-z0-9_-]+)/i),
      multiplier: this.matchNumber(text, /(?:multiplier|crash(?:Point|_point)?|payout|coef)["'\s:=]+([0-9]+(?:\.[0-9]+)?)/i),
      players: this.matchNumber(text, /(?:playersCount|players_count|players)["'\s:=]+([0-9]+)/i),
      bets: this.matchNumber(text, /(?:BetsCount|betsCount|bets_count|bets)["'\s:=]+([0-9]+)/i),
      cashouts: this.matchNumber(text, /(?:cashouts|cashoutCount|cash_outs)["'\s:=]+([0-9]+)/i),
      timestamp: this.matchNumber(text, /(?:timestamp|ts|time)["'\s:=]+([0-9]{10,13})/i)
    };
  }

  private coalesce(events: NormalizedRoundEvent[]) {
    const byKey = new Map<string, NormalizedRoundEvent>();
    for (const event of events) {
      const key = event.roundId ?? `${event.timestamp.getTime()}_${event.multiplier ?? "state"}`;
      const existing = byKey.get(key);
      byKey.set(key, {
        ...existing,
        ...event,
        players: event.players ?? existing?.players,
        bets: event.bets ?? existing?.bets,
        cashouts: event.cashouts ?? existing?.cashouts,
        rawPayload: event.rawPayload ?? existing?.rawPayload
      });
    }
    return [...byKey.values()];
  }

  private pickString(object: PlainObject, keys: string[]) {
    for (const key of keys) {
      const value = object[key];
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number" && Number.isFinite(value)) return String(value);
    }
    return undefined;
  }

  private pickNumber(object: PlainObject, keys: string[]) {
    for (const key of keys) {
      const value = object[key];
      const number = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace("x", "")) : NaN;
      if (Number.isFinite(number)) return number;
    }
    return undefined;
  }

  private pickInteger(object: PlainObject, keys: string[]) {
    const value = this.pickNumber(object, keys);
    return value === undefined ? undefined : Math.max(0, Math.round(value));
  }

  private pickDate(object: PlainObject, keys: string[]) {
    const value = this.pickNumber(object, keys);
    if (value === undefined) return null;
    const epochMs = value < 10_000_000_000 ? value * 1000 : value;
    const date = new Date(epochMs);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private matchNumber(text: string, pattern: RegExp) {
    const match = text.match(pattern);
    return match ? Number(match[1]) : undefined;
  }

  private matchString(text: string, pattern: RegExp) {
    return text.match(pattern)?.[1];
  }

  private toJsonValue(value: unknown): JsonValue | undefined {
    try {
      return JSON.parse(JSON.stringify(value)) as JsonValue;
    } catch {
      return undefined;
    }
  }
}
