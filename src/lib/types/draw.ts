// ============================================
// InvestSovet — Draw Mode Types & Constants
// ============================================

import type { Candle } from './shared';

// --- Drawing ---
export interface DrawPoint {
  x: number; // 0-1
  y: number; // 0-1 (0=top=high price, 1=bottom=low price)
}

// --- Round State (server-side) ---
export interface DrawRoundState {
  roundNumber: number;
  maxRounds: number;
  drawingPoints: DrawPoint[] | null;
  generatedCandles: Candle[]; // all 20 candles (kept on server)
  visibleCandleCount: number;
  startingPrice: number;
  mmEarnings: number;
  liquidationCount: number;
}

// --- Constants ---
export const DRAW_CANDLES_PER_ROUND = 40;
export const DRAW_CANDLE_INTERVAL_MS = 1000;
export const DRAW_DRAWING_TIME_SEC = 15;
export const DRAW_MAX_ROUNDS = 8;
export const DRAW_MM_LIQUIDATION_PERCENT = 50;
export const DRAW_BASE_VOLATILITY = 0.0003; // 0.03% base wick size — tiny wicks, safe for all leverages
export const DRAW_SLOPE_FACTOR = 0.03;      // minimal slope amplification — wicks stay small
export const DRAW_PRICE_RANGE_PERCENT = 0.10; // Y range maps to ±10% of starting price
