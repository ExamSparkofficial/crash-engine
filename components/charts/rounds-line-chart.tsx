"use client";

import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Activity } from "lucide-react";
import { ChartCard } from "@/components/charts/chart-card";
import type { ChartPoint } from "@/lib/types";
import { formatMultiplier } from "@/lib/utils";

export function RoundsLineChart({ data }: { data: ChartPoint[] }) {
  return (
    <ChartCard title="Last 100 Rounds" icon={<Activity className="h-4 w-4 text-cyan-200" />}>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
            <XAxis dataKey="index" tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: "rgba(7,17,31,.96)",
                border: "1px solid rgba(255,255,255,.12)",
                borderRadius: 8
              }}
              formatter={(value) => formatMultiplier(Number(value))}
              labelFormatter={(label) => `Round ${label}`}
            />
            <Line
              type="monotone"
              dataKey="multiplier"
              stroke="#22d3ee"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, fill: "#bef264", stroke: "#07111f" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
