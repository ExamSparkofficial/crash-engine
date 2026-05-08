"use client";

import { motion } from "framer-motion";
import { Flame, Percent, Sigma, TrendingUp, Waves } from "lucide-react";
import { AdminPanel } from "@/components/admin/admin-panel";
import { DistributionChart } from "@/components/charts/distribution-chart";
import { HeatmapChart } from "@/components/charts/heatmap-chart";
import { RoundsLineChart } from "@/components/charts/rounds-line-chart";
import { StreakFrequencyChart } from "@/components/charts/streak-frequency-chart";
import { VolatilityChart } from "@/components/charts/volatility-chart";
import { DashboardHeader } from "@/components/dashboard/header";
import { LiveFlightStage } from "@/components/dashboard/live-flight-stage";
import { LiveCrashFeed } from "@/components/dashboard/live-crash-feed";
import { ProbabilityNotice } from "@/components/dashboard/probability-notice";
import { RiskMeter } from "@/components/dashboard/risk-meter";
import { StatCard } from "@/components/dashboard/stat-card";
import { StrategySimulator } from "@/components/simulator/strategy-simulator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLiveRounds } from "@/hooks/use-live-rounds";
import { formatMultiplier, formatPercent } from "@/lib/utils";

export function DashboardShell() {
  const { snapshot, rounds, stats, logs, status, liveRound, connected, loading } = useLiveRounds();
  const charts = snapshot?.charts ?? [];

  return (
    <div className="min-h-screen">
      <div className="grid-fade pointer-events-none fixed inset-0 opacity-80" />
      <DashboardHeader connected={connected} status={status} />

      <main className="container relative z-10 space-y-6 py-6">
        <ProbabilityNotice />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Average multiplier"
            value={formatMultiplier(stats?.avg50 ?? 0)}
            detail={`MA10 ${formatMultiplier(stats?.avg10 ?? 0)} / MA100 ${formatMultiplier(stats?.avg100 ?? 0)}`}
            icon={Sigma}
            tone="cyan"
            loading={loading}
          />
          <StatCard
            label="Current volatility"
            value={`${(stats?.volatilityIndex ?? 0).toFixed(1)}`}
            detail={stats?.riskLevel ?? "Calculating risk"}
            icon={Waves}
            tone="amber"
            loading={loading}
          />
          <StatCard
            label="Low streak count"
            value={`${stats?.lowStreakCount ?? 0}`}
            detail="Consecutive rounds under 2x"
            icon={Flame}
            tone="rose"
            loading={loading}
          />
          <StatCard
            label="Probability score"
            value={formatPercent(1 - (stats?.probabilityUnder2x ?? 0))}
            detail="Chance estimate for avoiding <2x"
            icon={Percent}
            tone="lime"
            loading={loading}
          />
          <StatCard
            label="Trend score"
            value={`${(stats?.trendScore ?? 0).toFixed(0)}/100`}
            detail="Momentum adjusted for volatility"
            icon={TrendingUp}
            tone="violet"
            loading={loading}
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-[380px_1fr]">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <LiveCrashFeed rounds={rounds} />
          </motion.div>

          <div className="space-y-5">
            <LiveFlightStage initialLiveRound={liveRound} />
            <RiskMeter stats={stats} />
            <Tabs defaultValue="charts">
              <TabsList>
                <TabsTrigger value="charts">Charts</TabsTrigger>
                <TabsTrigger value="simulator">Simulator</TabsTrigger>
                <TabsTrigger value="admin">Admin</TabsTrigger>
              </TabsList>

              <TabsContent value="charts" className="grid gap-5 lg:grid-cols-2">
                <RoundsLineChart data={charts} />
                <DistributionChart data={snapshot?.distribution ?? []} />
                <HeatmapChart data={snapshot?.heatmap ?? []} />
                <VolatilityChart data={charts} />
                <div className="lg:col-span-2">
                  <StreakFrequencyChart data={snapshot?.streaks ?? []} />
                </div>
              </TabsContent>

              <TabsContent value="simulator">
                <StrategySimulator />
              </TabsContent>

              <TabsContent value="admin">
                <AdminPanel logs={logs} status={status} />
              </TabsContent>
            </Tabs>
          </div>
        </section>
      </main>
    </div>
  );
}
