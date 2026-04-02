// ============================================
// InvestSovet — Binary Options Mode Types
// ============================================

import type { Candle } from './shared';

// --- Direction ---
export type BinaryDirection = 'up' | 'down';

// --- Binary Bet ---
export interface BinaryBet {
  playerId: string;
  nickname: string;
  direction: BinaryDirection;
  amount: number;
  percent: number;
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
