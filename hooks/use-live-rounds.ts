"use client";

import { useEffect, useMemo, useState } from "react";
import { getSocket } from "@/lib/socket-client";
import type {
  CollectorStatus,
  DashboardSnapshot,
  LiveRoundState,
  LiveLog,
  RoundCrashEvent,
  RoundEndEvent,
  RoundRecord,
  RoundStartEvent,
  RoundWaitingEvent,
  StatisticsRecord
} from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

type RealtimeState = {
  snapshot: DashboardSnapshot | null;
  rounds: RoundRecord[];
  stats: StatisticsRecord | null;
  logs: LiveLog[];
  status: CollectorStatus | null;
  liveRound: LiveRoundState | null;
  connected: boolean;
  loading: boolean;
};

export function useLiveRounds() {
  const { toast } = useToast();
  const [state, setState] = useState<RealtimeState>({
    snapshot: null,
    rounds: [],
    stats: null,
    logs: [],
    status: null,
    liveRound: null,
    connected: false,
    loading: true
  });

  useEffect(() => {
    let mounted = true;

    const handleConnect = () => {
      setState((current) => ({ ...current, connected: true }));
    };

    const handleDisconnect = () => {
      setState((current) => ({ ...current, connected: false }));
    };

    const handleSnapshot = (snapshot: DashboardSnapshot) => {
      setState((current) => ({
        ...current,
        snapshot,
        rounds: snapshot.rounds,
        stats: snapshot.stats,
        loading: false
      }));
    };

    const handleRoundBatch = ({ snapshot }: { rounds: RoundRecord[]; snapshot: DashboardSnapshot }) => {
      setState((current) => ({
        ...current,
        snapshot,
        rounds: snapshot.rounds,
        stats: snapshot.stats,
        loading: false
      }));
    };

    const handleStatsUpdate = (stats: StatisticsRecord) => {
      setState((current) => ({ ...current, stats }));
    };

    const handleCollectorStatus = (status: CollectorStatus) => {
      setState((current) => ({ ...current, status }));
    };

    const handleLiveState = (liveRound: LiveRoundState) => {
      setState((current) => ({ ...current, liveRound }));
    };

    const handleWaiting = (event: RoundWaitingEvent) => {
      setState((current) => ({
        ...current,
        liveRound: {
          roundId: event.roundId,
          state: "WAITING",
          multiplier: 1,
          elapsedMs: 0,
          waitingMs: event.waitingMs,
          crashResetMs: 2_000,
          startedAt: null,
          updatedAt: event.serverTime,
          crashedAt: null,
          crashMultiplier: null
        }
      }));
    };

    const handleStart = (event: RoundStartEvent) => {
      setState((current) => ({
        ...current,
        liveRound: {
          roundId: event.roundId,
          state: "RUNNING",
          multiplier: 1,
          elapsedMs: 0,
          waitingMs: current.liveRound?.waitingMs ?? 3_000,
          crashResetMs: current.liveRound?.crashResetMs ?? 2_000,
          startedAt: event.serverTime,
          updatedAt: event.serverTime,
          crashedAt: null,
          crashMultiplier: null
        }
      }));
    };

    const handleCrash = (event: RoundCrashEvent) => {
      setState((current) => ({
        ...current,
        liveRound: {
          roundId: event.roundId,
          state: "CRASHED",
          multiplier: event.multiplier,
          elapsedMs: event.elapsedMs,
          waitingMs: current.liveRound?.waitingMs ?? 3_000,
          crashResetMs: current.liveRound?.crashResetMs ?? 2_000,
          startedAt: current.liveRound?.startedAt ?? null,
          updatedAt: event.serverTime,
          crashedAt: event.serverTime,
          crashMultiplier: event.multiplier
        }
      }));
    };

    const handleEnd = (event: RoundEndEvent) => {
      setState((current) => ({
        ...current,
        liveRound: current.liveRound
          ? {
              ...current.liveRound,
              updatedAt: event.serverTime
            }
          : null
      }));
    };

    const handleLogs = (logs: LiveLog[]) => {
      setState((current) => ({ ...current, logs }));
    };

    const handleLog = (log: LiveLog) => {
      setState((current) => ({ ...current, logs: [log, ...current.logs].slice(0, 80) }));
    };

    fetch("/api/statistics", { cache: "no-store" })
      .then((response) => response.json())
      .then((snapshot: DashboardSnapshot) => {
        if (!mounted) return;
        handleSnapshot(snapshot);
      })
      .catch(() => {
        toast({
          title: "Initial data failed",
          description: "Realtime socket will keep trying to load the dashboard.",
          variant: "destructive"
        });
      });

    getSocket().then((socket) => {
      if (!mounted) return;
      socket.on("connect", handleConnect);
      socket.on("disconnect", handleDisconnect);
      socket.on("snapshot", handleSnapshot);
      socket.on("round:batch", handleRoundBatch);
      socket.on("stats:update", handleStatsUpdate);
      socket.on("collector:status", handleCollectorStatus);
      socket.on("live:state", handleLiveState);
      socket.on("ROUND_WAITING", handleWaiting);
      socket.on("ROUND_START", handleStart);
      socket.on("ROUND_CRASH", handleCrash);
      socket.on("ROUND_END", handleEnd);
      socket.on("collector:logs", handleLogs);
      socket.on("collector:log", handleLog);
    });

    return () => {
      mounted = false;
      getSocket().then((socket) => {
        socket.off("connect", handleConnect);
        socket.off("disconnect", handleDisconnect);
        socket.off("snapshot", handleSnapshot);
        socket.off("round:batch", handleRoundBatch);
        socket.off("stats:update", handleStatsUpdate);
        socket.off("collector:status", handleCollectorStatus);
        socket.off("live:state", handleLiveState);
        socket.off("ROUND_WAITING", handleWaiting);
        socket.off("ROUND_START", handleStart);
        socket.off("ROUND_CRASH", handleCrash);
        socket.off("ROUND_END", handleEnd);
        socket.off("collector:logs", handleLogs);
        socket.off("collector:log", handleLog);
      });
    };
  }, [toast]);

  return useMemo(() => state, [state]);
}
