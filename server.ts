import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { attachRealtimeServer } from "@/server/websocket";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function allowedOrigins() {
  return (process.env.SOCKET_ALLOWED_ORIGINS ?? process.env.NEXT_PUBLIC_APP_URL ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

await app.prepare();

const httpServer = createServer((request, response) => {
  void handle(request, response);
});

const io = new Server(httpServer, {
  path: "/socket.io",
  cors: {
    origin(origin, callback) {
      const configured = allowedOrigins();
      if (!origin || configured.length === 0 || configured.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Socket origin not allowed."));
    },
    credentials: true
  },
  maxHttpBufferSize: 64_000,
  pingTimeout: 20_000,
  pingInterval: 25_000
});

attachRealtimeServer(io);

httpServer.listen(port, hostname, () => {
  console.log(`CrashPulse AI ready on http://localhost:${port}`);
});

function shutdown(signal: string) {
  console.log(`Received ${signal}. Closing realtime server.`);
  io.close();
  httpServer.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
