import type { ClassifiedPacket, ParsedPacket } from "./types";

const HEARTBEAT_PATTERNS = [/^2$/, /^3$/, /ping/i, /pong/i, /heartbeat/i, /keepalive/i];
const ROUND_PATTERNS = [
  /multiplier/i,
  /crash(Point|_point)?/i,
  /round(_id|Id)?/i,
  /betsCount/i,
  /playersCount/i,
  /cashout/i,
  /payout/i
];
const NOISE_PATTERNS = [
  /data:image/i,
  /avatar/i,
  /profile.?image/i,
  /\.(png|jpe?g|webp|gif|svg|css|woff2?)/i,
  /sprite/i,
  /asset/i,
  /locale/i,
  /translation/i
];

export class EventClassifier {
  classify(packet: ParsedPacket): ClassifiedPacket {
    if (packet.format === "malformed") {
      return { ...packet, eventKind: "malformed", reason: packet.error ?? "malformed packet" };
    }

    const text = packet.text.trim();
    if (!text) return { ...packet, eventKind: "noise", reason: "empty payload" };

    if (HEARTBEAT_PATTERNS.some((pattern) => pattern.test(text))) {
      return { ...packet, eventKind: "heartbeat", reason: "heartbeat packet" };
    }

    if (NOISE_PATTERNS.some((pattern) => pattern.test(text))) {
      return { ...packet, eventKind: "noise", reason: "asset or profile payload" };
    }

    if (/cashout/i.test(text)) {
      return { ...packet, eventKind: "cashout", reason: "cashout telemetry" };
    }

    if (ROUND_PATTERNS.some((pattern) => pattern.test(text))) {
      return { ...packet, eventKind: "round", reason: "round telemetry" };
    }

    return { ...packet, eventKind: "noise", reason: "no round analytics markers" };
  }
}
