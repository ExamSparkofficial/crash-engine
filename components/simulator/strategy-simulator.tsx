"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Calculator, Play, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { StrategyKind, StrategySimulationResult } from "@/lib/types";
import { DISCLAIMER } from "@/lib/constants";
import { formatPercent } from "@/lib/utils";

type FormState = {
  strategyName: StrategyKind;
  autoCashout: 1.5 | 2 | 3;
  baseBet: number;
  bankroll: number;
  maxRounds: number;
};

export function StrategySimulator() {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>({
    strategyName: "fixed-cashout",
    autoCashout: 2,
    baseBet: 10,
    bankroll: 1000,
    maxRounds: 120
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StrategySimulationResult | null>(null);

  async function runSimulation() {
    setLoading(true);
    const response = await fetch("/api/simulator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    }).catch(() => null);

    setLoading(false);
    if (!response?.ok) {
      toast({
        title: "Simulation failed",
        description: "Check the strategy inputs and try again.",
        variant: "destructive"
      });
      return;
    }

    const payload = (await response.json()) as { result: StrategySimulationResult };
    setResult(payload.result);
    toast({
      title: "Simulation complete",
      description: `${payload.result.strategyName} returned ${formatPercent(payload.result.roi)} ROI.`
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-cyan-200" />
            Strategy Simulator
          </CardTitle>
          <Badge variant="outline">{DISCLAIMER}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-5">
          <div className="space-y-2">
            <Label htmlFor="strategyName">Strategy</Label>
            <Select
              id="strategyName"
              value={form.strategyName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  strategyName: event.target.value as StrategyKind
                }))
              }
            >
              <option value="fixed-cashout">Fixed cashout</option>
              <option value="martingale">Martingale</option>
              <option value="fixed-bet">Fixed bet</option>
              <option value="dynamic-bankroll">Dynamic bankroll</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="autoCashout">Auto cashout</Label>
            <Select
              id="autoCashout"
              value={form.autoCashout}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  autoCashout: Number(event.target.value) as 1.5 | 2 | 3
                }))
              }
            >
              <option value={1.5}>1.5x</option>
              <option value={2}>2x</option>
              <option value={3}>3x</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="baseBet">Base bet</Label>
            <Input
              id="baseBet"
              type="number"
              min={1}
              value={form.baseBet}
              onChange={(event) =>
                setForm((current) => ({ ...current, baseBet: Number(event.target.value) }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bankroll">Bankroll</Label>
            <Input
              id="bankroll"
              type="number"
              min={10}
              value={form.bankroll}
              onChange={(event) =>
                setForm((current) => ({ ...current, bankroll: Number(event.target.value) }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxRounds">Rounds</Label>
            <Input
              id="maxRounds"
              type="number"
              min={10}
              max={1000}
              value={form.maxRounds}
              onChange={(event) =>
                setForm((current) => ({ ...current, maxRounds: Number(event.target.value) }))
              }
            />
          </div>
        </div>

        <Button onClick={() => void runSimulation()} disabled={loading}>
          <Play className="h-4 w-4" />
          {loading ? "Running" : "Run simulation"}
        </Button>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-24" />
            ))}
          </div>
        ) : result ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Metric
                label="Net P/L"
                value={`${result.netProfit >= 0 ? "+" : ""}${result.netProfit.toFixed(2)}`}
                positive={result.netProfit >= 0}
              />
              <Metric label="Win rate" value={formatPercent(result.winRate)} positive />
              <Metric label="ROI" value={formatPercent(result.roi)} positive={result.roi >= 0} />
              <Metric label="Max drawdown" value={formatPercent(result.maxDrawdown)} />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="h-[260px] rounded-lg border border-white/10 bg-white/5 p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={result.equityCurve}>
                    <defs>
                      <linearGradient id="equityFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.36} />
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
                    <XAxis dataKey="round" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: "#07111f", border: "1px solid rgba(255,255,255,.12)" }} />
                    <Area dataKey="profit" stroke="#22d3ee" fill="url(#equityFill)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="h-[260px] rounded-lg border border-white/10 bg-white/5 p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.equityCurve}>
                    <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
                    <XAxis dataKey="round" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: "#07111f", border: "1px solid rgba(255,255,255,.12)" }} />
                    <Line dataKey="drawdown" stroke="#fb7185" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  positive
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        {positive === undefined ? null : positive ? (
          <TrendingUp className="h-4 w-4 text-lime-200" />
        ) : (
          <TrendingDown className="h-4 w-4 text-rose-200" />
        )}
      </div>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}
