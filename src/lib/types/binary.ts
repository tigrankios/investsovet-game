// ============================================
// InvestSovet — Binary Options Mode Types
// ============================================

import type { Candle } from './shared';

// --- Direction ---
export type BinaryDirection = 'up' | 'down';

// --- Binary Bet ---
export interface BinaryBet {
  playerId: string;
  nickname?: string;
  direction: BinaryDirection;
  amount: number;
  percent?: number;
}

// --- Binary Round State (sent to client) ---
export interface BinaryRoundState {
  roundNumber: number;
  totalRounds: number;
  phase: BinaryPhase;
  entryPrice: number;
  candles: Candle[];
  candleTarget: number; // how many candles will be revealed
  ticker: string;
}

export type BinaryPhase =
  | 'betting'    // players choose UP/DOWN
  | 'reveal'     // bets are revealed (1s)
  | 'waiting'    // candles appear one by one
  | 'result';    // win/loss shown (2s)

// --- Binary Result (per round) ---
export interface BinaryRoundResult {
  direction: BinaryDirection; // winning direction
  finalPrice: number;
  entryPrice: number;
  payouts: BinaryPayout[];
}

export interface BinaryPayout {
  playerId: string;
  nickname: string;
  direction: BinaryDirection;
  betAmount: number;
  won: boolean;
  payout: number; // positive = won, negative = lost
  newBalance: number;
}

// --- Revealed bets (shown during reveal phase) ---
export interface BinaryRevealedBets {
  bets: BinaryBet[];
  upPool: number;
  downPool: number;
}

// --- Server-side round state (full, not sent to client) ---
export interface BinaryRoundStateServer {
  roundNumber: number;
  ticker: string;
  /** All candles: first BINARY_CHART_HISTORY are visible, next BINARY_CANDLES_COUNT are hidden */
  allCandles: Candle[];
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
