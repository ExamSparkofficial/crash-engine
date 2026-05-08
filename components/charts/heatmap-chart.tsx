"use client";

import { Grid3X3 } from "lucide-react";
import { ChartCard } from "@/components/charts/chart-card";
import type { HeatmapCell } from "@/lib/types";

export function HeatmapChart({ data }: { data: HeatmapCell[] }) {
  return (
    <ChartCard title="Round Heatmap" icon={<Grid3X3 className="h-4 w-4 text-violet-200" />}>
      <div className="grid grid-cols-10 gap-1.5 pt-3">
        {data.map((cell, index) => (
          <div
            key={`${cell.row}-${cell.col}-${index}`}
            title={cell.label}
            className="aspect-square rounded-md border border-white/10 transition hover:scale-105"
            style={{
              background: `linear-gradient(135deg, rgba(34,211,238,${0.12 + cell.value * 0.32}), rgba(244,63,94,${0.06 + cell.value * 0.18}))`,
              boxShadow: cell.value > 0.72 ? "0 0 16px rgba(251,191,36,.18)" : undefined
            }}
          />
        ))}
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
        <span>Low</span>
        <span className="text-center">Mid</span>
        <span className="text-right">Spike</span>
      </div>
    </ChartCard>
  );
}
