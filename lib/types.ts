export type StreakType = "low" | "mid" | "high" | "mega";

export type RoundRecord = {
  id: string;
  roundId?: string | null;
  multiplier: number;
  players?: number | null;
  bets?: number | null;
  cashouts?: number | null;
  volatility?: number | null;
  createdAt: string;
  volatilityScore: number;
  streakType: StreakType;
  streakLength: number;
};

export type StatisticsRecord = {
  id: string;
  avg10: number;
  avg25: number;
  avg50: number;
  avg100: number;
  lowCrashRate: number;
  highCrashRate: number;
  volatilityIndex: number;
  entropyScore: number;
  lowStreakCount: number;
  probabilityUnder2x: number;
  probabilityOver5x: number;
  probabilityOver10x: number;
  trendScore: number;
  riskScore: number;
  riskLevel: "Low Risk" | "Medium Risk" | "High Volatility";
  updatedAt: string;
};

export type DistributionBucket = {
  label: string;
  min: number;
  max: number | null;
  count: number;
  rate: number;
};

export type ChartPoint = {
  index: number;
  roundId: string;
  multiplier: number;
  volatility: number;
  timestamp: string;
};

export type HeatmapCell = {
  row: number;
  col: number;
  value: number;
  label: string;
};

export type StreakFrequency = {
  type: StreakType;
  count: number;
  maxLength: number;
};

export type DashboardSnapshot = {
  rounds: RoundRecord[];
  stats: StatisticsRecord;
  distribution: DistributionBucket[];
  heatmap: HeatmapCell[];
  streaks: StreakFrequency[];
  charts: ChartPoint[];
};

export type GameState = "WAITING" | "RUNNING" | "CRASHED";

export type LiveRoundState = {
  roundId: string;
  state: GameState;
  multiplier: number;
  elapsedMs: number;
  waitingMs: number;
  crashResetMs: number;
  startedAt: string | null;
  updatedAt: string;
  crashedAt: string | null;
  crashMultiplier: number | null;
};

export type RoundWaitingEvent = {
  type: "ROUND_WAITING";
  roundId: string;
  waitingMs: number;
  serverTime: string;
};

export type RoundStartEvent = {
  type: "ROUND_START";
  roundId: string;
  serverTime: string;
};

export type MultiplierUpdateEvent = {
  type: "MULTIPLIER_UPDATE";
  roundId: string;
  multiplier: number;
  elapsedMs: number;
  serverTime: string;
};

export type RoundCrashEvent = {
  type: "ROUND_CRASH";
  roundId: string;
  multiplier: number;
  elapsedMs: number;
  serverTime: string;
};

export type RoundEndEvent = {
  type: "ROUND_END";
  roundId: string;
  serverTime: string;
};

export type RoundLifecycleEvent =
  | RoundWaitingEvent
  | RoundStartEvent
  | MultiplierUpdateEvent
  | RoundCrashEvent
  | RoundEndEvent;

export type StrategyKind =
  | "fixed-cashout"
  | "martingale"
  | "fixed-bet"
  | "dynamic-bankroll";

export type StrategySimulationInput = {
  strategyName: StrategyKind;
  autoCashout: 1.5 | 2 | 3;
  baseBet: number;
  bankroll: number;
  maxRounds: number;
};

export type EquityPoint = {
  round: number;
  profit: number;
  bankroll: number;
  drawdown: number;
};

export type StrategySimulationResult = {
  strategyName: string;
  totalProfit: number;
  totalLoss: number;
  netProfit: number;
  winRate: number;
  roi: number;
  maxDrawdown: number;
  finalBankroll: number;
  equityCurve: EquityPoint[];
};

export type CollectorStatus = {
  mode: "websocket" | "polling" | "simulation" | "synthetic" | "idle";
  connected: boolean;
  source: string;
  lastMessageAt: string | null;
  reconnectAttempts: number;
  metrics?: Record<string, unknown>;
};

export type LiveLog = {
  id: string;
  level: "info" | "warn" | "error";
  message: string;
  createdAt: string;
};
