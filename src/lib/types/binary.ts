// ============================================
// InvestSovet — Binary Options Types & Constants
// ============================================

// --- Binary Bet ---
export type BinaryDirection = 'up' | 'down';

export interface BinaryBet {
  playerId: string;
  direction: BinaryDirection;
  amount: number;
}

export interface BinaryRoundState {
  roundNumber: number;
  ticker: string;
  /** All candles: first BINARY_CHART_HISTORY are visible, next BINARY_CANDLES_COUNT are hidden */
  allCandles: import('./shared').Candle[];
  /** Price at the moment betting closes (last visible candle's close) */
  entryPrice: number;
  /** Bets placed this round */
  bets: BinaryBet[];
  /** Pool totals */
  upPool: number;
  downPool: number;
  /** How many future candles have been revealed so far (0..5) */
  revealedCount: number;
  /** Eliminated player IDs (balance <= 0) */
  eliminatedPlayerIds: Set<string>;
}

export interface BinaryPayoutEntry {
  playerId: string;
  nickname: string;
  betDirection: BinaryDirection;
  betAmount: number;
  payout: number;      // net gain/loss
  newBalance: number;
}

export interface BinaryRoundResult {
  result: BinaryDirection;
  entryPrice: number;
  finalPrice: number;
  payouts: BinaryPayoutEntry[];
}

// --- Constants ---
export const BINARY_CHART_HISTORY = 20;   // visible candles for display
export const BINARY_CANDLES_COUNT = 5;    // future candles revealed one by one
export const BINARY_TOTAL_CANDLES = BINARY_CHART_HISTORY + BINARY_CANDLES_COUNT; // 25
export const BINARY_BET_TIME_SEC = 5;     // seconds to place a bet
export const BINARY_REVEAL_DELAY_SEC = 1; // delay before reveal starts
export const BINARY_CANDLE_INTERVAL_SEC = 1; // interval between candle reveals
export const BINARY_RESULT_DELAY_SEC = 2; // delay after result before next round
export const BINARY_DEFAULT_BET_PERCENT = 10; // auto-bet: 10% of balance
export const BINARY_MAX_ROUNDS = 10;      // max rounds before game ends
