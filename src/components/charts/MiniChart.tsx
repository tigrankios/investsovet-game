'use client';

import type { Candle, LeaderboardEntry } from '@/lib/types';
import { formatPrice } from '@/lib/utils';

/**
 * MiniChart with positions — used by Classic, Market Maker, and Draw modes.
 */
export function MiniChart({ candles, positions = [] }: { candles: Candle[]; positions?: LeaderboardEntry[] }) {
  if (candles.length === 0) return null;

  const width = 600;
  const height = 220;
  const pad = { top: 10, right: 50, bottom: 10, left: 10 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const maxCandles = Math.min(candles.length, Math.floor(chartW / 4));
  const visible = candles.slice(-maxCandles);
  const visibleOffset = candles.length - visible.length;
  const maxP = Math.max(...visible.map((c) => c.high));
  const minP = Math.min(...visible.map((c) => c.low));
  const range = maxP - minP || 1;

  const gap = chartW / visible.length;
  const candleW = Math.max(2, gap * 0.65);
  const scaleY = (p: number) => pad.top + chartH - ((p - minP) / range) * chartH;

  const lastPrice = visible[visible.length - 1]?.close || 0;
  const lastPriceY = scaleY(lastPrice);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      <rect x={0} y={0} width={width} height={height} fill="#0B0E17" rx={8} />

      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((pct) => {
        const price = minP + range * pct;
        const y = scaleY(price);
        return (
          <g key={pct}>
            <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#1E2333" strokeWidth={0.5} />
            <text x={width - pad.right + 4} y={y + 3} fill="#4A5168" fontSize={8} fontFamily="monospace">{formatPrice(price)}</text>
          </g>
        );
      })}

      {/* Candles */}
      {visible.map((c, i) => {
        const x = pad.left + i * gap + gap / 2;
        const isGreen = c.close >= c.open;
        const color = isGreen ? '#00E676' : '#FF1744';
        const bodyTop = scaleY(Math.max(c.open, c.close));
        const bodyBot = scaleY(Math.min(c.open, c.close));
        return (
          <g key={i}>
            <line x1={x} y1={scaleY(c.high)} x2={x} y2={scaleY(c.low)} stroke={color} strokeWidth={1} />
            <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={Math.max(1, bodyBot - bodyTop)} fill={color} />
          </g>
        );
      })}

      {/* Current price line + label */}
      <line x1={pad.left} y1={lastPriceY} x2={width - pad.right} y2={lastPriceY} stroke="#FFD740" strokeWidth={1} strokeDasharray="3,3" />
      <rect x={width - pad.right} y={lastPriceY - 8} width={60} height={16} rx={3} fill="#FFD740" />
      <text x={width - pad.right + 30} y={lastPriceY + 4} fill="#0B0E17" fontSize={9} fontFamily="monospace" textAnchor="middle" fontWeight="bold">
        {formatPrice(lastPrice)}
      </text>

      {/* Position markers */}
      {positions.filter((p) => p.hasPosition && p.positionOpenedAt !== null && p.positionEntryPrice !== null).map((p, idx) => {
        const candleIdx = p.positionOpenedAt! - visibleOffset;
        if (candleIdx < 0 || candleIdx >= visible.length) return null;
        const x = pad.left + candleIdx * gap + gap / 2;
        const y = scaleY(p.positionEntryPrice!);
        const isLong = p.positionDirection === 'long';
        const color = isLong ? '#00E676' : '#FF1744';
        const labelY = Math.max(16, Math.min(height - 8, y - 12 - idx * 16));
        return (
          <g key={p.nickname}>
            <line x1={x} y1={y} x2={width - pad.right} y2={y} stroke={color} strokeWidth={0.8} strokeDasharray="3,2" opacity={0.5} />
            <circle cx={x} cy={y} r={4} fill={color} stroke="#0B0E17" strokeWidth={1.5} />
            <rect x={x + 6} y={labelY - 8} width={p.nickname.length * 6 + 20} height={14} rx={3} fill={color} opacity={0.15} />
            <text x={x + 10} y={labelY + 3} fill={color} fontSize={10} fontWeight="bold">
              {isLong ? '\u25B2' : '\u25BC'} {p.nickname}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * MiniChart with entry price line — used by Binary mode.
 */
export function BinaryMiniChart({ candles, entryPrice }: { candles: Candle[]; entryPrice?: number }) {
  if (candles.length === 0) return null;

  const width = 600;
  const height = 220;
  const pad = { top: 10, right: 50, bottom: 10, left: 10 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const maxCandles = Math.min(candles.length, Math.floor(chartW / 4));
  const visible = candles.slice(-maxCandles);
  const maxP = Math.max(...visible.map((c) => c.high));
  const minP = Math.min(...visible.map((c) => c.low));
  const range = maxP - minP || 1;

  const gap = chartW / visible.length;
  const candleW = Math.max(2, gap * 0.65);
  const scaleY = (p: number) => pad.top + chartH - ((p - minP) / range) * chartH;

  const lastPrice = visible[visible.length - 1]?.close || 0;
  const lastPriceY = scaleY(lastPrice);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      <rect x={0} y={0} width={width} height={height} fill="#0B0E17" rx={8} />

      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((pct) => {
        const price = minP + range * pct;
        const y = scaleY(price);
        return (
          <g key={pct}>
            <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#1E2333" strokeWidth={0.5} />
            <text x={width - pad.right + 4} y={y + 3} fill="#4A5168" fontSize={8} fontFamily="monospace">{formatPrice(price)}</text>
          </g>
        );
      })}

      {/* Candles */}
      {visible.map((c, i) => {
        const x = pad.left + i * gap + gap / 2;
        const isGreen = c.close >= c.open;
        const color = isGreen ? '#00E676' : '#FF1744';
        const bodyTop = scaleY(Math.max(c.open, c.close));
        const bodyBot = scaleY(Math.min(c.open, c.close));
        return (
          <g key={i}>
            <line x1={x} y1={scaleY(c.high)} x2={x} y2={scaleY(c.low)} stroke={color} strokeWidth={1} />
            <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={Math.max(1, bodyBot - bodyTop)} fill={color} />
          </g>
        );
      })}

      {/* Entry price line (dashed, gold) */}
      {entryPrice !== undefined && entryPrice >= minP && entryPrice <= maxP && (
        <>
          <line
            x1={pad.left}
            y1={scaleY(entryPrice)}
            x2={width - pad.right}
            y2={scaleY(entryPrice)}
            stroke="#FFD740"
            strokeWidth={1}
            strokeDasharray="6,4"
            opacity={0.7}
          />
          <text
            x={pad.left + 4}
            y={scaleY(entryPrice) - 4}
            fill="#FFD740"
            fontSize={9}
            fontFamily="monospace"
            opacity={0.8}
          >
            ENTRY {formatPrice(entryPrice)}
          </text>
        </>
      )}

      {/* Current price line + label */}
      <line x1={pad.left} y1={lastPriceY} x2={width - pad.right} y2={lastPriceY} stroke="#B388FF" strokeWidth={1} strokeDasharray="3,3" />
      <rect x={width - pad.right} y={lastPriceY - 8} width={60} height={16} rx={3} fill="#B388FF" />
      <text x={width - pad.right + 30} y={lastPriceY + 4} fill="#0B0E17" fontSize={9} fontFamily="monospace" textAnchor="middle" fontWeight="bold">
        {formatPrice(lastPrice)}
      </text>
    </svg>
  );
}
