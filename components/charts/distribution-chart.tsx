"use client";

import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Cell } from "recharts";
import { BarChart3 } from "lucide-react";
import { ChartCard } from "@/components/charts/chart-card";
import type { DistributionBucket } from "@/lib/types";
import { formatPercent } from "@/lib/utils";

const COLORS = ["#fb7185", "#22d3ee", "#a3e635", "#fbbf24", "#c084fc"];

export function DistributionChart({ data }: { data: DistributionBucket[] }) {
  return (
    <ChartCard title="Distribution Histogram" icon={<BarChart3 className="h-4 w-4 text-lime-200" />}>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: "rgba(7,17,31,.96)",
                border: "1px solid rgba(255,255,255,.12)",
                borderRadius: 8
              }}
              formatter={(value, name, props) => [
                `${Number(value)} rounds (${formatPercent(props.payload.rate)})`,
                "Frequency"
              ]}
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={entry.label} fill={COLORS[index % COLORS.length]} fillOpacity={0.82} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
