import { chromium, type BrowserContext } from "playwright";
import { EventClassifier, PacketParser, RoundExtractor, StorageService } from "@/server/ingestion";
import { createLogger } from "@/server/ingestion/structured-logger";
import type { PacketDirection } from "@/server/ingestion/types";

const logger = createLogger("ingestion:playwright");
const targetUrl = process.env.AVIATOR_TARGET_URL ?? "https://1win.com/casino/play/v_spribe:aviator";
const userDataDir = process.env.PLAYWRIGHT_USER_DATA_DIR ?? "./.playwright-profile";

const parser = new PacketParser();
const classifier = new EventClassifier();
const extractor = new RoundExtractor();
const storage = new StorageService({
  batchSize: Number(process.env.INGESTION_BATCH_SIZE ?? 100),
  flushIntervalMs: Number(process.env.INGESTION_FLUSH_INTERVAL_MS ?? 1_000),
  onFlush(rounds) {
    logger.info("Stored extracted browser websocket rounds.", { count: rounds.length });
  }
});

async function handleFrame(payload: string | Buffer, direction: PacketDirection, url: string) {
  const parsed = parser.parse(payload, direction, url);
  const classified = classifier.classify(parsed);
  const events = extractor.extract(classified);
  if (events.length) await storage.enqueue(events);
}

async function launchPersistentContext(): Promise<BrowserContext> {
  return chromium.launchPersistentContext(userDataDir, {
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
    headless: process.env.PLAYWRIGHT_HEADLESS === "true",
    viewport: null,
    args: ["--start-maximized"]
  });
}

async function main() {
  storage.start();
  let context = await launchPersistentContext();
  let page = context.pages()[0] ?? (await context.newPage());

  page.on("websocket", (socket) => {
    const url = socket.url();
    logger.info("Browser websocket attached.", { url });
    socket.on("framesent", (frame) => void handleFrame(frame.payload, "sent", url));
    socket.on("framereceived", (frame) => void handleFrame(frame.payload, "received", url));
    socket.on("close", () => logger.warn("Browser websocket closed.", { url }));
  });

  context.on("close", async () => {
    logger.warn("Browser context closed; relaunching persistent session.");
    context = await launchPersistentContext();
    page = context.pages()[0] ?? (await context.newPage());
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
  });

  await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
  logger.info("Playwright ingestion page loaded.", { targetUrl, userDataDir });
}

process.on("SIGINT", () => {
  storage.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  storage.stop();
  process.exit(0);
});

void main().catch((error) => {
  logger.error("Playwright ingestion failed.", {
    error: error instanceof Error ? error.message : "unknown"
  });
  process.exit(1);
});
