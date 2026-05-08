import type { Server, Socket } from "socket.io";
import { databaseHealth, getDashboardSnapshot } from "@/lib/data/store";
import { normalizeRoundPayload } from "@/lib/security/validation";
import { LiveDataCollector } from "@/server/collector";

let collector: LiveDataCollector | null = null;
const manualHits = new Map<string, { count: number; resetAt: number }>();

function rateLimitSocket(socket: Socket) {
  const now = Date.now();
  const current = manualHits.get(socket.id);
  if (!current || current.resetAt < now) {
    manualHits.set(socket.id, { count: 1, resetAt: now + 60_000 });
    return false;
  }

  current.count += 1;
  return current.count > 30;
}

export function attachRealtimeServer(io: Server) {
  collector ??= new LiveDataCollector(io);
  collector.start();

  io.on("connection", (socket) => {
    void collector?.emitInitialSnapshot(socket.id);

    socket.on("round:manual", async (payload, ack?: (response: unknown) => void) => {
      if (rateLimitSocket(socket)) {
        ack?.({ ok: false, error: "Socket rate limit exceeded." });
        return;
      }

      const normalized = normalizeRoundPayload(payload);
      if (!normalized) {
        ack?.({ ok: false, error: "Invalid round payload." });
        return;
      }

      await collector?.ingest(payload);
      ack?.({ ok: true });
    });

    socket.on("admin:health", async (ack?: (response: unknown) => void) => {
      const [database, snapshot] = await Promise.all([databaseHealth(), getDashboardSnapshot(50)]);
      ack?.({
        database,
        collector: collector?.getStatus(),
        liveRound: collector?.getLiveRound(),
        roundsTracked: snapshot.rounds.length,
        timestamp: new Date().toISOString()
      });
    });
  });

  return collector;
}

export function getCollector() {
  return collector;
}
