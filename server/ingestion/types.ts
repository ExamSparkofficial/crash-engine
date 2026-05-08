import type { JsonValue } from "@prisma/client/runtime/library";

export type PacketDirection = "sent" | "received";

export type ParsedPacket = {
  id: string;
  direction: PacketDirection;
  url?: string;
  receivedAt: Date;
  format: "json" | "text" | "binary" | "empty" | "malformed";
  text: string;
  json: unknown | null;
  byteLength: number;
  hash: string;
  error?: string;
};

export type EventKind = "heartbeat" | "round" | "cashout" | "noise" | "malformed";

export type ClassifiedPacket = ParsedPacket & {
  eventKind: EventKind;
  reason: string;
};

export type NormalizedRoundEvent = {
  roundId?: string;
  multiplier?: number;
  players?: number;
  bets?: number;
  cashouts?: number;
  volatility?: number;
  timestamp: Date;
  eventType: EventKind;
  source?: string;
  rawPayload?: JsonValue;
};

export type IngestionMetrics = {
  startedAt: Date;
  packetsReceived: number;
  packetsDeduped: number;
  packetsIgnored: number;
  parserFailures: number;
  extractedRounds: number;
  insertedRounds: number;
  duplicateRounds: number;
  reconnectCount: number;
  dbInsertLatencyMs: number;
  lastPacketAt: Date | null;
  lastRoundAt: Date | null;
  activeBrowserUptimeMs: number;
};
