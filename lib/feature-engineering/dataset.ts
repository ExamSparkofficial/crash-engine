import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db/prisma";
import type { RoundRecord } from "@/lib/types";
import { roundNumber } from "@/lib/utils";
import { entropy, mean, standardDeviation, slope } from "@/lib/statistics/descriptive";

export type MlFeatureRow = {
  round_id: string;
  timestamp: string;
  multiplier: number;
  prev_1: number;
  prev_2: number;
  prev_3: number;
  prev_5: number;
  streak_under_2x: number;
  streak_over_10x: number;
  rolling_volatility_25: number;
  rolling_entropy_50: number;
  ma10: number;
  ma25: number;
  ma50: number;
  bucket_under_2x: number;
  bucket_2x_5x: number;
  bucket_5x_10x: number;
  bucket_over_10x: number;
  momentum_score: number;
  trend_signal: number;
};

export function buildFeatureRows(rounds: RoundRecord[]): MlFeatureRow[] {
  const ordered = [...rounds].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return ordered.map((round, index) => {
    const previous = ordered.slice(Math.max(0, index - 100), index).map((item) => item.multiplier);
    const recent25 = previous.slice(-25);
    const recent50 = previous.slice(-50);
    const prev = (offset: number) => ordered[index - offset]?.multiplier ?? 0;
    const streakUnder2 = countTrailing(previous, (value) => value < 2);
    const streakOver10 = countTrailing(previous, (value) => value >= 10);
    const ma10 = mean(previous.slice(-10));
    const ma25 = mean(previous.slice(-25));
    const ma50 = mean(previous.slice(-50));
    const trend = slope(previous.slice(-40));

    return {
      round_id: round.roundId ?? round.id,
      timestamp: round.createdAt,
      multiplier: round.multiplier,
      prev_1: prev(1),
      prev_2: prev(2),
      prev_3: prev(3),
      prev_5: prev(5),
      streak_under_2x: streakUnder2,
      streak_over_10x: streakOver10,
      rolling_volatility_25: roundNumber(standardDeviation(recent25.map((value) => Math.log(Math.max(value, 1.01)))), 6),
      rolling_entropy_50: entropy(recent50, 1),
      ma10: roundNumber(ma10, 4),
      ma25: roundNumber(ma25, 4),
      ma50: roundNumber(ma50, 4),
      bucket_under_2x: round.multiplier < 2 ? 1 : 0,
      bucket_2x_5x: round.multiplier >= 2 && round.multiplier < 5 ? 1 : 0,
      bucket_5x_10x: round.multiplier >= 5 && round.multiplier < 10 ? 1 : 0,
      bucket_over_10x: round.multiplier >= 10 ? 1 : 0,
      momentum_score: roundNumber((round.multiplier - ma10) / Math.max(1, standardDeviation(previous.slice(-10))), 4),
      trend_signal: roundNumber(trend, 6)
    };
  });
}

export function toCsv(rows: MlFeatureRow[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]) as Array<keyof MlFeatureRow>;
  const body = rows.map((row) =>
    headers
      .map((header) => {
        const value = row[header];
        return typeof value === "string" ? `"${value.replace(/"/g, '""')}"` : String(value);
      })
      .join(",")
  );
  return [headers.join(","), ...body].join("\n");
}

export async function writeDatasetSnapshot(rows: MlFeatureRow[], format: "csv" | "parquet", name?: string) {
  const snapshotName = name ?? `dataset-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const directory = path.join(process.cwd(), "datasets");
  await mkdir(directory, { recursive: true });
  const filePath = path.join(directory, `${snapshotName}.${format === "csv" ? "csv" : "parquet.json"}`);

  if (format === "csv") {
    await writeFile(filePath, toCsv(rows), "utf8");
  } else {
    await writeFile(
      filePath,
      JSON.stringify(
        {
          format: "parquet-compatible-json",
          note: "Install a Parquet writer such as parquetjs-lite or run the analytics-service export job to materialize binary Parquet.",
          rows
        },
        null,
        2
      ),
      "utf8"
    );
  }

  if (prisma) {
    await prisma.datasetSnapshot.create({
      data: {
        name: snapshotName,
        format,
        path: filePath,
        rows: rows.length
      }
    });
  }

  return { name: snapshotName, format, path: filePath, rows: rows.length };
}

function countTrailing(values: number[], predicate: (value: number) => boolean) {
  let count = 0;
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (!predicate(values[index])) break;
    count += 1;
  }
  return count;
}
