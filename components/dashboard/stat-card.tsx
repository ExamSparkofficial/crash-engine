"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "cyan",
  loading
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: "cyan" | "lime" | "rose" | "amber" | "violet";
  loading?: boolean;
}) {
  const tones = {
    cyan: "text-cyan-200 bg-cyan-400/12 border-cyan-300/20",
    lime: "text-lime-200 bg-lime-400/12 border-lime-300/20",
    rose: "text-rose-200 bg-rose-400/12 border-rose-300/20",
    amber: "text-amber-200 bg-amber-400/12 border-amber-300/20",
    violet: "text-violet-200 bg-violet-400/12 border-violet-300/20"
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="h-full overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs uppercase text-muted-foreground">{label}</p>
              {loading ? (
                <Skeleton className="mt-3 h-8 w-24" />
              ) : (
                <p className="mt-2 text-2xl font-semibold tracking-normal">{value}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
            </div>
            <div className={cn("rounded-md border p-2", tones[tone])}>
              <Icon className="h-5 w-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
