// ============================================
// InvestSovet — Binary Options Types & Constants
// ============================================

import type { Candle } from './shared';

// --- Binary Direction ---
export type BinaryDirection = 'up' | 'down';

// --- Constants ---
export const BINARY_MAX_ROUNDS = 20;
export const BINARY_BET_TIMER_SEC = 5;
export const BINARY_REVEAL_SEC = 1;
export const BINARY_CANDLES_COUNT = 5;
export const BINARY_RESULT_SEC = 2;
export const BINARY_CHART_HISTORY = 20; // historical candles shown
export const BINARY_AUTO_BET_PERCENT = 10;

// --- Binary Bet ---
export interface BinaryBet {
  playerId: string;
  nickname: string;
  direction: BinaryDirection;
  amount: number;
}

// --- Binary Round State ---
export interface BinaryRoundState {
  roundNumber: number;
  maxRounds: number;
  ticker: string;
  candles: Candle[];
  entryPrice: number;
  bets: BinaryBet[];
  result: BinaryDirection | null;
  candlesRevealed: number;
  finalPrice: number | null;
  upPool: number;
  downPool: number;
}

// --- Binary Player State ---
export interface BinaryPlayerState {
  balance: number;
  myBet: BinaryBet | null;
  eliminated: boolean;
  lastWin: number | null;
}
