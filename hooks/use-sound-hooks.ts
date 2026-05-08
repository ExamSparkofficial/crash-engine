"use client";

import { useCallback, useMemo, useRef } from "react";

type SoundKind = "tick" | "crash" | "cashout";

function toneConfig(kind: SoundKind) {
  if (kind === "crash") return { frequency: 92, duration: 0.28, gain: 0.055, type: "sawtooth" };
  if (kind === "cashout") return { frequency: 760, duration: 0.12, gain: 0.035, type: "sine" };
  return { frequency: 440, duration: 0.045, gain: 0.018, type: "square" };
}

export function useSoundHooks() {
  const contextRef = useRef<AudioContext | null>(null);

  const play = useCallback((kind: SoundKind) => {
    if (typeof window === "undefined") return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    contextRef.current ??= new AudioContextClass();
    const context = contextRef.current;
    const config = toneConfig(kind);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;

    oscillator.type = config.type as OscillatorType;
    oscillator.frequency.setValueAtTime(config.frequency, now);
    if (kind === "crash") {
      oscillator.frequency.exponentialRampToValueAtTime(44, now + config.duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(config.gain, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + config.duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + config.duration + 0.02);
  }, []);

  const playTick = useCallback(() => play("tick"), [play]);
  const playCrash = useCallback(() => play("crash"), [play]);
  const playCashout = useCallback(() => play("cashout"), [play]);

  return useMemo(
    () => ({
      playTick,
      playCrash,
      playCashout
    }),
    [playCashout, playCrash, playTick]
  );
}
