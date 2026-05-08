import WebSocket from "ws";
import { EventClassifier } from "./event-classifier";
import { incrementMetric, recordRound, updateMetrics } from "./metrics-registry";
import { PacketParser } from "./packet-parser";
import { ReconnectManager } from "./reconnect-manager";
import { RoundExtractor } from "./round-extractor";
import { StorageService } from "./storage-service";
import { createLogger } from "./structured-logger";
import type { NormalizedRoundEvent, PacketDirection } from "./types";
import type { RoundRecord } from "@/lib/types";

type WebsocketClientOptions = {
  url: string;
  storage?: StorageService;
  onRounds?: (rounds: RoundRecord[]) => void | Promise<void>;
  onEvents?: (events: NormalizedRoundEvent[]) => void | Promise<void>;
};

export class WebsocketIngestionClient {
  private socket: WebSocket | null = null;
  private readonly parser = new PacketParser();
  private readonly classifier = new EventClassifier();
  private readonly extractor = new RoundExtractor();
  private readonly reconnect = new ReconnectManager();
  private readonly storage: StorageService;
  private readonly logger = createLogger("ingestion:websocket");
  private readonly url: string;
  private readonly onRounds?: WebsocketClientOptions["onRounds"];
  private readonly onEvents?: WebsocketClientOptions["onEvents"];
  private closed = false;

  constructor(options: WebsocketClientOptions) {
    this.url = options.url;
    this.storage = options.storage ?? new StorageService({ onFlush: options.onRounds });
    this.onRounds = options.onRounds;
    this.onEvents = options.onEvents;
  }

  start() {
    this.closed = false;
    this.storage.start();
    this.connect();
  }

  stop() {
    this.closed = true;
    this.reconnect.reset();
    this.storage.stop();
    this.socket?.close();
    this.socket = null;
  }

  private connect() {
    if (this.closed) return;
    this.logger.info("Connecting websocket ingestion source.", { url: this.url });
    this.socket = new WebSocket(this.url, {
      perMessageDeflate: false,
      handshakeTimeout: 10_000,
      maxPayload: Number(process.env.INGESTION_MAX_WS_PAYLOAD_BYTES ?? 512_000)
    });

    this.socket.on("open", () => {
      this.reconnect.reset();
      this.logger.info("Websocket ingestion source connected.", { url: this.url });
    });

    this.socket.on("message", (payload) => void this.handlePacket(payload, "received"));

    this.socket.on("ping", () => updateMetrics({ lastPacketAt: new Date() }));
    this.socket.on("pong", () => updateMetrics({ lastPacketAt: new Date() }));

    this.socket.on("close", (code, reason) => {
      this.logger.warn("Websocket ingestion source closed.", {
        code,
        reason: reason.toString()
      });
      if (!this.closed) this.reconnect.schedule(() => this.connect());
    });

    this.socket.on("error", (error) => {
      this.logger.error("Websocket ingestion error.", { error: error.message });
    });
  }

  private async handlePacket(payload: WebSocket.RawData, direction: PacketDirection) {
    const packet = this.parser.parse(payload, direction, this.url);
    const classified = this.classifier.classify(packet);

    if (classified.eventKind === "heartbeat") return;
    if (classified.eventKind === "noise") {
      incrementMetric("packetsIgnored");
      return;
    }

    const events = this.extractor.extract(classified);
    if (!events.length) return;

    recordRound(events.length);
    await this.onEvents?.(events);
    await this.storage.enqueue(events);
  }
}
