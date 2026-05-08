"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Plane, Radio, TimerReset } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useSoundHooks } from "@/hooks/use-sound-hooks";
import { getSocket } from "@/lib/socket-client";
import type {
  GameState,
  LiveRoundState,
  MultiplierUpdateEvent,
  RoundCrashEvent,
  RoundStartEvent,
  RoundWaitingEvent
} from "@/lib/types";
import { cn } from "@/lib/utils";

type FlightPoint = {
  x: number;
  y: number;
};

function multiplierColor(multiplier: number, state: GameState) {
  if (state === "CRASHED") return "#fb7185";
  if (multiplier >= 10) return "#fbbf24";
  if (multiplier >= 3) return "#a3e635";
  if (multiplier >= 2) return "#67e8f9";
  return "#e2e8f0";
}

function formatMultiplier(multiplier: number) {
  return `${multiplier.toFixed(multiplier >= 10 ? 1 : 2)}x`;
}

export const LiveFlightStage = memo(function LiveFlightStage({
  initialLiveRound
}: {
  initialLiveRound: LiveRoundState | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const multiplierRef = useRef<HTMLDivElement>(null);
  const sublineRef = useRef<HTMLDivElement>(null);
  const pointsRef = useRef<FlightPoint[]>([]);
  const animationRef = useRef<number | null>(null);
  const runningStartMsRef = useRef<number>(0);
  const waitingEndsAtRef = useRef<number>(0);
  const displayedMultiplierRef = useRef(1);
  const targetMultiplierRef = useRef(1);
  const elapsedMsRef = useRef(0);
  const lastTickSecondRef = useRef<number | null>(null);
  const cashoutHookPlayedRef = useRef(false);
  const crashFlashUntilRef = useRef(0);
  const stateRef = useRef<GameState>(initialLiveRound?.state ?? "WAITING");
  const [phase, setPhase] = useState<GameState>(initialLiveRound?.state ?? "WAITING");
  const [roundId, setRoundId] = useState(initialLiveRound?.roundId ?? "loading");
  const { playTick, playCrash, playCashout } = useSoundHooks();

  const initialRoundId = initialLiveRound?.roundId;
  const initialRoundState = initialLiveRound?.state;

  useEffect(() => {
    if (!initialLiveRound) return;
    stateRef.current = initialLiveRound.state;
    setPhase(initialLiveRound.state);
    setRoundId(initialLiveRound.roundId);
    displayedMultiplierRef.current = initialLiveRound.multiplier;
    targetMultiplierRef.current = initialLiveRound.multiplier;
    elapsedMsRef.current = initialLiveRound.elapsedMs;
  }, [initialLiveRound, initialRoundId, initialRoundState]);

  useEffect(() => {
    let mounted = true;

    const handleWaiting = (event: RoundWaitingEvent) => {
      stateRef.current = "WAITING";
      setPhase("WAITING");
      setRoundId(event.roundId);
      waitingEndsAtRef.current = performance.now() + event.waitingMs;
      displayedMultiplierRef.current = 1;
      targetMultiplierRef.current = 1;
      elapsedMsRef.current = 0;
      pointsRef.current = [];
      lastTickSecondRef.current = null;
      cashoutHookPlayedRef.current = false;
    };

    const handleStart = (event: RoundStartEvent) => {
      stateRef.current = "RUNNING";
      setPhase("RUNNING");
      setRoundId(event.roundId);
      runningStartMsRef.current = performance.now();
      displayedMultiplierRef.current = 1;
      targetMultiplierRef.current = 1;
      elapsedMsRef.current = 0;
      pointsRef.current = [];
      cashoutHookPlayedRef.current = false;
    };

    const handleUpdate = (event: MultiplierUpdateEvent) => {
      targetMultiplierRef.current = event.multiplier;
      elapsedMsRef.current = event.elapsedMs;
    };

    const handleCrash = (event: RoundCrashEvent) => {
      stateRef.current = "CRASHED";
      setPhase("CRASHED");
      targetMultiplierRef.current = event.multiplier;
      displayedMultiplierRef.current = event.multiplier;
      elapsedMsRef.current = event.elapsedMs;
      crashFlashUntilRef.current = performance.now() + 700;
      playCrash();
    };

    getSocket().then((socket) => {
      if (!mounted) return;
      socket.on("ROUND_WAITING", handleWaiting);
      socket.on("ROUND_START", handleStart);
      socket.on("MULTIPLIER_UPDATE", handleUpdate);
      socket.on("ROUND_CRASH", handleCrash);
    });

    return () => {
      mounted = false;
      getSocket().then((socket) => {
        socket.off("ROUND_WAITING", handleWaiting);
        socket.off("ROUND_START", handleStart);
        socket.off("MULTIPLIER_UPDATE", handleUpdate);
        socket.off("ROUND_CRASH", handleCrash);
      });
    };
  }, [playCrash]);

  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  useEffect(() => {
    const render = () => {
      const canvas = canvasRef.current;
      const multiplierNode = multiplierRef.current;
      const sublineNode = sublineRef.current;
      const planeNode = planeRef.current;

      if (canvas && multiplierNode && sublineNode) {
        const state = stateRef.current;
        const target = targetMultiplierRef.current;
        const current =
          state === "RUNNING"
            ? displayedMultiplierRef.current + (target - displayedMultiplierRef.current) * 0.22
            : target;
        displayedMultiplierRef.current = current;

        if (state === "RUNNING" && current >= 2 && !cashoutHookPlayedRef.current) {
          cashoutHookPlayedRef.current = true;
          playCashout();
        }

        if (state === "WAITING") {
          const remainingMs = Math.max(0, waitingEndsAtRef.current - performance.now());
          const second = Math.ceil(remainingMs / 1000);
          if (second > 0 && second !== lastTickSecondRef.current) {
            lastTickSecondRef.current = second;
            playTick();
          }
          sublineNode.textContent = `Next round in ${(remainingMs / 1000).toFixed(1)}s`;
        } else if (state === "RUNNING") {
          sublineNode.textContent = `Flight time ${(elapsedMsRef.current / 1000).toFixed(1)}s`;
        } else {
          sublineNode.textContent = `Crashed at ${formatMultiplier(target)}`;
        }

        multiplierNode.textContent = state === "WAITING" ? "1.00x" : formatMultiplier(current);
        const color = multiplierColor(current, state);
        multiplierNode.style.color = color;
        multiplierNode.style.textShadow = `0 0 28px ${color}66`;

        drawFlight(canvas, current, state, elapsedMsRef.current, pointsRef.current, crashFlashUntilRef.current);
        positionPlane(canvas, planeNode, pointsRef.current, state);
      }

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [playCashout, playTick]);

  return (
    <Card className="overflow-hidden">
      <CardContent className="relative min-h-[430px] p-0">
        <div className="absolute left-4 top-4 z-20 flex flex-wrap items-center gap-2">
          <Badge
            variant={phase === "RUNNING" ? "success" : phase === "CRASHED" ? "danger" : "warning"}
            className="gap-1.5"
          >
            <Radio className="h-3.5 w-3.5" />
            {phase}
          </Badge>
          <Badge variant="outline">Round {roundId.slice(-8)}</Badge>
        </div>

        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        <div
          ref={planeRef}
          className={cn(
            "pointer-events-none absolute left-0 top-0 z-10 flex h-12 w-12 items-center justify-center rounded-full border border-cyan-200/20 bg-cyan-400/10 text-cyan-100 shadow-glow transition-opacity",
            phase === "WAITING" && "opacity-45",
            phase === "CRASHED" && "border-rose-300/30 bg-rose-500/15 text-rose-100 shadow-danger"
          )}
        >
          <Plane className="h-6 w-6" />
        </div>

        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center">
          <div
            ref={multiplierRef}
            className="text-[clamp(4rem,14vw,10rem)] font-black leading-none tracking-normal transition-colors"
          >
            1.00x
          </div>
          <div ref={sublineRef} className="mt-4 text-sm uppercase text-muted-foreground">
            Synchronizing realtime engine
          </div>
        </div>

        <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 rounded-md border border-white/10 bg-[#07111f]/78 px-3 py-2 text-xs text-muted-foreground backdrop-blur">
          <TimerReset className="h-3.5 w-3.5 text-cyan-200" />
          3s wait / 8-15s flight / 2s reset
        </div>
      </CardContent>
    </Card>
  );
});

function drawFlight(
  canvas: HTMLCanvasElement,
  multiplier: number,
  state: GameState,
  elapsedMs: number,
  points: FlightPoint[],
  crashFlashUntil: number
) {
  const context = canvas.getContext("2d");
  if (!context) return;

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "rgba(34,211,238,0.10)");
  gradient.addColorStop(0.55, "rgba(7,17,31,0.08)");
  gradient.addColorStop(1, "rgba(244,63,94,0.08)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "rgba(148,163,184,0.08)";
  context.lineWidth = 1;
  for (let x = 0; x < width; x += 42) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = 0; y < height; y += 42) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  const progress = Math.min(1, elapsedMs / 15_000);
  const x = 34 + progress * (width - 84);
  const normalizedY = Math.min(1, Math.log(Math.max(multiplier, 1)) / Math.log(12));
  const y = height - 44 - normalizedY * (height - 105);

  if (state === "RUNNING") {
    const last = points[points.length - 1];
    if (!last || Math.abs(last.x - x) > 1.8 || Math.abs(last.y - y) > 1.8) {
      points.push({ x, y });
      if (points.length > 360) points.shift();
    }
  }

  context.beginPath();
  context.moveTo(30, height - 38);
  points.forEach((point, index) => {
    if (index === 0) context.lineTo(point.x, point.y);
    else {
      const previous = points[index - 1];
      context.quadraticCurveTo(previous.x, previous.y, (previous.x + point.x) / 2, (previous.y + point.y) / 2);
    }
  });

  context.lineWidth = 4;
  context.lineCap = "round";
  context.strokeStyle = state === "CRASHED" ? "#fb7185" : "#22d3ee";
  context.shadowBlur = 18;
  context.shadowColor = state === "CRASHED" ? "rgba(251,113,133,0.75)" : "rgba(34,211,238,0.55)";
  context.stroke();
  context.shadowBlur = 0;

  const fill = context.createLinearGradient(0, 0, 0, height);
  fill.addColorStop(0, state === "CRASHED" ? "rgba(251,113,133,0.26)" : "rgba(34,211,238,0.22)");
  fill.addColorStop(1, "rgba(34,211,238,0)");
  context.lineTo(points[points.length - 1]?.x ?? 30, height - 38);
  context.lineTo(30, height - 38);
  context.closePath();
  context.fillStyle = fill;
  context.fill();

  if (state === "CRASHED" || performance.now() < crashFlashUntil) {
    context.fillStyle = "rgba(244,63,94,0.16)";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "rgba(251,113,133,0.75)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(width * 0.18, height * 0.18);
    context.lineTo(width * 0.84, height * 0.78);
    context.moveTo(width * 0.84, height * 0.18);
    context.lineTo(width * 0.18, height * 0.78);
    context.stroke();
  }
}

function positionPlane(
  canvas: HTMLCanvasElement,
  planeNode: HTMLDivElement | null,
  points: FlightPoint[],
  state: GameState
) {
  if (!planeNode) return;
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;
  const last = points[points.length - 1] ?? { x: 34, y: height - 44 };
  const x = Math.min(width - 62, Math.max(16, last.x - 24));
  const y = Math.min(height - 62, Math.max(18, last.y - 24));
  const rotation = state === "CRASHED" ? 128 : state === "WAITING" ? -4 : -18;
  const drop = state === "CRASHED" ? 34 : 0;
  planeNode.style.transform = `translate3d(${x}px, ${y + drop}px, 0) rotate(${rotation}deg)`;
}
