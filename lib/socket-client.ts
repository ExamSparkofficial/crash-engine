import type { Socket } from "socket.io-client";

let socket: Socket | null = null;

export async function getSocket() {
  if (socket) return socket;
  const { io } = await import("socket.io-client");
  socket = io({
    path: "/socket.io",
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 700,
    timeout: 8_000
  });

  return socket;
}
