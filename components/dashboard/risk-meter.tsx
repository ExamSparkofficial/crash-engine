"use client";

import { motion } from "framer-motion";
import { Gauge } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { StatisticsRecord } from "@/lib/types";
import { cn, formatPercent } from "@/lib/utils";

function riskScore(stats: StatisticsRecord | null) {
  if (!stats) return 0;
  const labelWeight =
    stats.riskLevel === "Low Risk" ? 25 : stats.riskLevel === "Medium Risk" ? 58 : 86;
  return Math.min(100, Math.max(0, labelWeight + stats.volatilityIndex * 0.12));
}

export function RiskMeter({ stats }: { stats: StatisticsRecord | null }) {
  const score = riskScore(stats);
  const rotation = -72 + score * 1.44;
  const variant =
    stats?.riskLevel === "Low Risk"
      ? "success"
      : stats?.riskLevel === "Medium Risk"
        ? "warning"
        : "danger";

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-cyan-200" />
            Risk Meter
          </CardTitle>
          <Badge variant={variant}>{stats?.riskLevel ?? "Loading"}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative mx-auto h-40 max-w-[320px]">
          <div className="absolute bottom-0 left-1/2 h-32 w-64 -translate-x-1/2 overflow-hidden rounded-t-full">
            <div className="absolute inset-0 rounded-t-full border-[18px] border-b-0 border-cyan-400/18" />
            <div className="absolute inset-0 rounded-t-full border-[18px] border-b-0 border-lime-300/18 [clip-path:polygon(0_0,38%_0,50%_100%,0_100%)]" />
            <div className="absolute inset-0 rounded-t-full border-[18px] border-b-0 border-amber-300/22 [clip-path:polygon(32%_0,70%_0,50%_100%)]" />
            <div className="absolute inset-0 rounded-t-full border-[18px] border-b-0 border-rose-400/26 [clip-path:polygon(64%_0,100%_0,100%_100%,50%_100%)]" />
          </div>
          <motion.div
            className="absolute bottom-4 left-1/2 h-1 w-28 origin-left rounded-full bg-cyan-100 shadow-glow"
            animate={{ rotate: rotation }}
            transition={{ type: "spring", stiffness: 90, damping: 14 }}
          />
          <div className="absolute bottom-0 left-1/2 h-8 w-8 -translate-x-1/2 rounded-full border border-white/20 bg-[#07111f]" />
        </div>
        <div className="space-y-4">
          <Progress value={score} />
          <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
            <div className={cn(score < 34 && "text-lime-200")}>Low</div>
            <div className={cn(score >= 34 && score < 68 && "text-amber-200")}>Medium</div>
            <div className={cn(score >= 68 && "text-rose-200")}>High Volatility</div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-muted-foreground">Under 2x</p>
              <p className="mt-1 font-semibold">{formatPercent(stats?.probabilityUnder2x ?? 0)}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-muted-foreground">Over 10x</p>
              <p className="mt-1 font-semibold">{formatPercent(stats?.probabilityOver10x ?? 0)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
