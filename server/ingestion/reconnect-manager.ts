import { createLogger } from "./structured-logger";
import { incrementMetric } from "./metrics-registry";

type ReconnectOptions = {
  baseDelayMs?: number;
  maxDelayMs?: number;
  maxAttempts?: number;
  jitterRatio?: number;
};

export class ReconnectManager {
  private attempts = 0;
  private timer: NodeJS.Timeout | null = null;
  private readonly options: Required<ReconnectOptions>;
  private readonly logger = createLogger("ingestion:reconnect");

  constructor(options: ReconnectOptions = {}) {
    this.options = {
      baseDelayMs: options.baseDelayMs ?? 1_000,
      maxDelayMs: options.maxDelayMs ?? 30_000,
      maxAttempts: options.maxAttempts ?? Number.POSITIVE_INFINITY,
      jitterRatio: options.jitterRatio ?? 0.2
    };
  }

  reset() {
    this.attempts = 0;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  schedule(connect: () => void) {
    if (this.timer) return;
    if (this.attempts >= this.options.maxAttempts) {
      this.logger.error("Reconnect attempts exhausted.", { attempts: this.attempts });
      return;
    }

    this.attempts += 1;
    incrementMetric("reconnectCount");
    const exponential = this.options.baseDelayMs * 2 ** Math.min(this.attempts - 1, 8);
    const capped = Math.min(this.options.maxDelayMs, exponential);
    const jitter = capped * this.options.jitterRatio * Math.random();
    const delayMs = Math.round(capped + jitter);

    this.logger.warn("Scheduling websocket reconnect.", { attempts: this.attempts, delayMs });
    this.timer = setTimeout(() => {
      this.timer = null;
      connect();
    }, delayMs);
  }
}
