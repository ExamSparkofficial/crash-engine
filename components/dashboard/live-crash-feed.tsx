"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock3, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RoundRecord } from "@/lib/types";
import { cn, formatMultiplier } from "@/lib/utils";

function toneForMultiplier(multiplier: number) {
  if (multiplier < 2) return "text-rose-200 border-rose-400/20 bg-rose-500/10";
  if (multiplier < 5) return "text-cyan-100 border-cyan-400/20 bg-cyan-500/10";
  if (multiplier < 10) return "text-lime-100 border-lime-400/20 bg-lime-500/10";
  return "text-amber-100 border-amber-400/20 bg-amber-500/10 shadow-glow";
}

export function LiveCrashFeed({ rounds }: { rounds: RoundRecord[] }) {
  const listRef = useRef<HTMLDivElement>(null);
  const latestRoundId = rounds[0]?.id;

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [latestRoundId]);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-lime-200" />
            Live Crash Feed
          </CardTitle>
          <Badge variant="success">{rounds.length} rounds</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={listRef} className="scrollbar-thin h-[420px] space-y-2 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {rounds.slice(0, 60).map((round) => (
              <motion.div
                key={round.id}
                initial={{ opacity: 0, scale: 0.98, x: -8 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className={cn(
                  "rounded-lg border px-3 py-2 transition",
                  toneForMultiplier(round.multiplier)
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-lg font-semibold">{formatMultiplier(round.multiplier)}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock3 className="h-3.5 w-3.5" />
                    {new Date(round.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{round.id.slice(0, 18)}</span>
                  <span>
                    {round.streakType} streak {round.streakLength}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
