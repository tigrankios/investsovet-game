import type { Candle } from '../types';
import type { DrawPoint, DrawRoundState } from '../types/draw';
import {
  DRAW_CANDLES_PER_ROUND,
  DRAW_MAX_ROUNDS,
  DRAW_BASE_VOLATILITY,
  DRAW_SLOPE_FACTOR,
  DRAW_PRICE_RANGE_PERCENT,
} from '../types/draw';

// --- Map Y coordinate to price ---
// y=0 -> top = high price = startingPrice * (1 + RANGE)
// y=1 -> bottom = low price = startingPrice * (1 - RANGE)
function mapYToPrice(y: number, startingPrice: number): number {
  const high = startingPrice * (1 + DRAW_PRICE_RANGE_PERCENT);
  const low = startingPrice * (1 - DRAW_PRICE_RANGE_PERCENT);
  return high - y * (high - low);
}

// --- Resample a path of points to N evenly spaced points along X ---
function resamplePoints(points: DrawPoint[], count: number): DrawPoint[] {
  if (count <= 1) return points.length > 0 ? [points[0]] : [{ x: 0.5, y: 0.5 }];
  if (points.length === 0) return [];
  if (points.length === 1) {
    return Array.from({ length: count }, () => ({ ...points[0] }));
  }

  // Sort by X
  const sorted = [...points].sort((a, b) => a.x - b.x);

  const result: DrawPoint[] = [];
  for (let i = 0; i < count; i++) {
    const targetX = i / (count - 1);

    // Find the two surrounding points
    let left = sorted[0];
    let right = sorted[sorted.length - 1];
    for (let j = 0; j < sorted.length - 1; j++) {
      if (sorted[j].x <= targetX && sorted[j + 1].x >= targetX) {
        left = sorted[j];
        right = sorted[j + 1];
        break;
      }
    }

    // Linear interpolation
    const range = right.x - left.x;
    const t = range === 0 ? 0 : (targetX - left.x) / range;
    result.push({
      x: targetX,
      y: left.y + t * (right.y - left.y),
    });
  }

  return result;
}

// --- Generate candles from drawing points ---
export function generateCandlesFromDrawing(
  points: DrawPoint[],
  startingPrice: number,
  candleCount: number = DRAW_CANDLES_PER_ROUND,
): Candle[] {
  if (candleCount < 1) return [];
  // Resample to candleCount+1 points (we need endpoints for each candle)
  const resampled = resamplePoints(points, candleCount + 1);
  const candles: Candle[] = [];
  const now = Date.now();

  for (let i = 0; i < candleCount; i++) {
    const open = mapYToPrice(resampled[i].y, startingPrice);
    const close = mapYToPrice(resampled[i + 1].y, startingPrice);
    const slope = Math.abs(close - open) / startingPrice;
    const volatility = startingPrice * (DRAW_BASE_VOLATILITY + slope * DRAW_SLOPE_FACTOR);
    const high = Math.max(open, close) + Math.random() * volatility;
    const low = Math.min(open, close) - Math.random() * volatility;

    candles.push({
      open,
      high,
      low,
      close,
      time: Math.floor((now + i * 1000) / 1000),
    });
  }

  return candles;
}

// --- Generate random fallback candles if MM doesn't draw ---
export function generateRandomDrawCandles(startingPrice: number): Candle[] {
  // Generate a random walk as a set of points
  const pointCount = DRAW_CANDLES_PER_ROUND + 1;
  const points: DrawPoint[] = [];

  let y = 0.5; // start at middle
  for (let i = 0; i < pointCount; i++) {
    points.push({ x: i / (pointCount - 1), y: Math.max(0, Math.min(1, y)) });
    y += (Math.random() - 0.5) * 0.15;
  }

  return generateCandlesFromDrawing(points, startingPrice);
}

// --- Create initial draw round state ---
export function createDrawRoundState(roundNumber: number): DrawRoundState {
  return {
    roundNumber,
    maxRounds: DRAW_MAX_ROUNDS,
    drawingPoints: null,
    generatedCandles: [],
    visibleCandleCount: 0,
    startingPrice: 0,
    mmEarnings: 0,
    liquidationCount: 0,
  };
}
