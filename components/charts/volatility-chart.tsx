"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Waves } from "lucide-react";
import { ChartCard } from "@/components/charts/chart-card";
import type { ChartPoint } from "@/lib/types";

export function VolatilityChart({ data }: { data: ChartPoint[] }) {
  return (
    <ChartCard title="Volatility Graph" icon={<Waves className="h-4 w-4 text-amber-200" />}>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="volatilityFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.36} />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
            <XAxis dataKey="index" tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: "rgba(7,17,31,.96)",
                border: "1px solid rgba(255,255,255,.12)",
                borderRadius: 8
              }}
            />
            <Area
              type="monotone"
              dataKey="volatility"
              stroke="#fbbf24"
              strokeWidth={2}
              fill="url(#volatilityFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
