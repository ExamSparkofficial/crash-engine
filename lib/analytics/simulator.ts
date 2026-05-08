import type {
  EquityPoint,
  RoundRecord,
  StrategySimulationInput,
  StrategySimulationResult
} from "@/lib/types";
import { clamp, roundNumber } from "@/lib/utils";

function normalizeInput(input: StrategySimulationInput): StrategySimulationInput {
  return {
    strategyName: input.strategyName,
    autoCashout: input.autoCashout,
    baseBet: clamp(Number(input.baseBet) || 10, 1, 10_000),
    bankroll: clamp(Number(input.bankroll) || 1_000, 10, 1_000_000),
    maxRounds: clamp(Number(input.maxRounds) || 100, 10, 1_000)
  };
}

export function runStrategySimulation(
  rounds: RoundRecord[],
  input: StrategySimulationInput
): StrategySimulationResult {
  const config = normalizeInput(input);
  const history = [...rounds]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-config.maxRounds);

  let bankroll = config.bankroll;
  let currentBet = config.baseBet;
  let peakBankroll = bankroll;
  let wins = 0;
  let totalLoss = 0;
  let totalProfit = 0;
  const equityCurve: EquityPoint[] = [];

  history.forEach((round, index) => {
    const dynamicBet =
      config.strategyName === "dynamic-bankroll"
        ? clamp(bankroll * 0.02, config.baseBet * 0.25, config.baseBet * 4)
        : currentBet;
    const bet = Math.min(dynamicBet, bankroll);

    if (bet <= 0) return;

    const won = round.multiplier >= config.autoCashout;
    const delta = won ? bet * (config.autoCashout - 1) : -bet;
    bankroll += delta;
    peakBankroll = Math.max(peakBankroll, bankroll);

    if (won) {
      wins += 1;
      totalProfit += delta;
      currentBet = config.baseBet;
    } else {
      totalLoss += Math.abs(delta);
      currentBet =
        config.strategyName === "martingale"
          ? clamp(currentBet * 2, config.baseBet, config.baseBet * 16)
          : config.baseBet;
    }

    const drawdown = peakBankroll === 0 ? 0 : (peakBankroll - bankroll) / peakBankroll;
    equityCurve.push({
      round: index + 1,
      profit: roundNumber(bankroll - config.bankroll, 2),
      bankroll: roundNumber(bankroll, 2),
      drawdown: roundNumber(drawdown, 4)
    });
  });

  const netProfit = bankroll - config.bankroll;
  const maxDrawdown = equityCurve.reduce((max, point) => Math.max(max, point.drawdown), 0);

  return {
    strategyName: config.strategyName,
    totalProfit: roundNumber(totalProfit, 2),
    totalLoss: roundNumber(totalLoss, 2),
    netProfit: roundNumber(netProfit, 2),
    winRate: history.length ? roundNumber(wins / history.length, 4) : 0,
    roi: config.bankroll ? roundNumber(netProfit / config.bankroll, 4) : 0,
    maxDrawdown: roundNumber(maxDrawdown, 4),
    finalBankroll: roundNumber(bankroll, 2),
    equityCurve
  };
}
