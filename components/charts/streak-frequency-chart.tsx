"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { ListTree } from "lucide-react";
import { ChartCard } from "@/components/charts/chart-card";
import type { StreakFrequency } from "@/lib/types";

const COLORS = {
  low: "#fb7185",
  mid: "#22d3ee",
  high: "#a3e635",
  mega: "#fbbf24"
};

export function StreakFrequencyChart({ data }: { data: StreakFrequency[] }) {
  return (
    <ChartCard title="Streak Frequency" icon={<ListTree className="h-4 w-4 text-rose-200" />}>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
            <XAxis dataKey="type" tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: "rgba(7,17,31,.96)",
                border: "1px solid rgba(255,255,255,.12)",
                borderRadius: 8
              }}
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {data.map((entry) => (
                <Cell key={entry.type} fill={COLORS[entry.type]} fillOpacity={0.84} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
