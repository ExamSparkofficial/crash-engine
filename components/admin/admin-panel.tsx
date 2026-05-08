"use client";

import { useEffect, useState } from "react";
import { Database, RefreshCcw, ServerCog, TerminalSquare, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { CollectorStatus, LiveLog } from "@/lib/types";
import { getSocket } from "@/lib/socket-client";
import { cn } from "@/lib/utils";

type HealthPayload = {
  database?: {
    ok: boolean;
    provider: string;
    latencyMs: number;
    message: string;
    roundCount?: number;
    strategyCount?: number;
  };
  collector?: CollectorStatus;
  roundsTracked?: number;
  timestamp?: string;
};

export function AdminPanel({
  logs,
  status
}: {
  logs: LiveLog[];
  status: CollectorStatus | null;
}) {
  const [health, setHealth] = useState<HealthPayload | null>(null);

  async function refreshHealth() {
    const socket = await getSocket();
    socket.emit("admin:health", (payload: HealthPayload) => setHealth(payload));
  }

  useEffect(() => {
    void refreshHealth();
    const timer = window.setInterval(() => void refreshHealth(), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  const database = health?.database;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <ServerCog className="h-4 w-4 text-cyan-200" />
            Admin Analytics Panel
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => void refreshHealth()}>
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-lime-200" />
                <p className="font-medium">WebSocket Monitor</p>
              </div>
              <Badge variant={status?.connected ? "success" : "danger"}>
                {status?.connected ? "Connected" : "Disconnected"}
              </Badge>
            </div>
            <Separator className="my-3" />
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Mode</dt>
                <dd className="font-medium">{status?.mode ?? "unknown"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Reconnects</dt>
                <dd className="font-medium">{status?.reconnectAttempts ?? 0}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">Source</dt>
                <dd className="break-all font-medium">{status?.source ?? "pending"}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-cyan-200" />
                <p className="font-medium">Database Monitor</p>
              </div>
              <Badge variant={database?.ok ? "success" : "warning"}>
                {database?.provider ?? "checking"}
              </Badge>
            </div>
            <Separator className="my-3" />
            <p className="text-sm text-muted-foreground">{database?.message ?? "Loading health."}</p>
            <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
              <Metric label="Latency" value={`${database?.latencyMs ?? 0}ms`} />
              <Metric label="Rounds" value={`${database?.roundCount ?? health?.roundsTracked ?? 0}`} />
              <Metric label="Strategies" value={`${database?.strategyCount ?? 0}`} />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-[#030712]/70 p-4">
          <div className="mb-3 flex items-center gap-2">
            <TerminalSquare className="h-4 w-4 text-amber-200" />
            <p className="font-medium">Live Logs</p>
          </div>
          <div className="scrollbar-thin h-[360px] space-y-2 overflow-y-auto pr-1 font-mono text-xs">
            {logs.length ? (
              logs.map((log) => (
                <div
                  key={log.id}
                  className={cn(
                    "rounded-md border px-3 py-2",
                    log.level === "error"
                      ? "border-rose-400/20 bg-rose-500/8 text-rose-100"
                      : log.level === "warn"
                        ? "border-amber-400/20 bg-amber-500/8 text-amber-100"
                        : "border-cyan-400/15 bg-cyan-500/6 text-cyan-100"
                  )}
                >
                  <span className="text-muted-foreground">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </span>{" "}
                  {log.message}
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No runtime logs yet.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/5 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
