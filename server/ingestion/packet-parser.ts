import { createHash } from "node:crypto";
import type { RawData } from "ws";
import { incrementMetric, recordPacket } from "./metrics-registry";
import type { PacketDirection, ParsedPacket } from "./types";

type ParseOptions = {
  maxTextPreviewBytes?: number;
};

export class PacketParser {
  private readonly maxTextPreviewBytes: number;

  constructor(options: ParseOptions = {}) {
    this.maxTextPreviewBytes = options.maxTextPreviewBytes ?? 64_000;
  }

  parse(payload: RawData | string | Buffer, direction: PacketDirection, url?: string): ParsedPacket {
    recordPacket();
    const receivedAt = new Date();
    const bytes = this.toBuffer(payload);
    const hash = createHash("sha256").update(bytes).digest("hex");

    if (bytes.length === 0) {
      return {
        id: `${receivedAt.getTime()}_${hash.slice(0, 10)}`,
        direction,
        url,
        receivedAt,
        format: "empty",
        text: "",
        json: null,
        byteLength: 0,
        hash
      };
    }

    const text = this.decodeText(bytes);
    const json = this.tryParseJson(text);
    const format = json !== null ? "json" : this.looksBinary(text) ? "binary" : "text";
    if (format === "binary" && !text.trim()) incrementMetric("parserFailures");

    return {
      id: `${receivedAt.getTime()}_${hash.slice(0, 10)}`,
      direction,
      url,
      receivedAt,
      format,
      text: text.slice(0, this.maxTextPreviewBytes),
      json,
      byteLength: bytes.length,
      hash
    };
  }

  private toBuffer(payload: RawData | string | Buffer) {
    if (Buffer.isBuffer(payload)) return payload;
    if (Array.isArray(payload)) return Buffer.concat(payload);
    if (payload instanceof ArrayBuffer) return Buffer.from(payload);
    if (ArrayBuffer.isView(payload)) {
      return Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength);
    }
    return Buffer.from(String(payload));
  }

  private decodeText(bytes: Buffer) {
    return bytes.toString("utf8").replace(/\u0000/g, "").replace(/[^\x09\x0A\x0D\x20-\x7E]+/g, "");
  }

  private tryParseJson(text: string) {
    const trimmed = text.trim();
    if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) return null;
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      incrementMetric("parserFailures");
      return null;
    }
  }

  private looksBinary(text: string) {
    const sample = text.slice(0, 128);
    if (!sample) return true;
    const printable = sample.replace(/[^\x20-\x7E]/g, "").length;
    return printable / sample.length < 0.6;
  }
}
