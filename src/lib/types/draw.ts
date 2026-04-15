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
export const DRAW_CANDLES_PER_ROUND = 20;
export const DRAW_PREVIEW_CANDLES = 5;
export const DRAW_CANDLE_INTERVAL_MS = 1000;
export const DRAW_DRAWING_TIME_SEC = 10;
export const DRAW_PREVIEW_TIME_SEC = 2;
export const DRAW_MAX_ROUNDS = 12;
export const DRAW_MM_LIQUIDATION_PERCENT = 50;
export const DRAW_BASE_VOLATILITY = 0.0005; // 0.05% base wick size — safe for high leverage
export const DRAW_SLOPE_FACTOR = 0.15;      // wicks scale gently with slope
export const DRAW_PRICE_RANGE_PERCENT = 0.15; // Y range maps to ±15% of starting price — reasonable for 100x leverage
