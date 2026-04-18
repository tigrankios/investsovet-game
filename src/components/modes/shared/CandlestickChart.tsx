'use client';

import type { Candle, LeaderboardEntry } from '@/lib/types';
import { formatPrice } from '@/lib/utils';

export function CandlestickChart({ candles, positions = [] }: { candles: Candle[]; positions?: LeaderboardEntry[] }) {
  if (candles.length === 0) return null;

  const width = 1200;
  const height = 500;
  const padding = { top: 20, right: 80, bottom: 20, left: 20 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVisible = 500;
  const visible = candles.slice(-maxVisible);

  const allHighs = visible.map((c) => c.high);
  const allLows = visible.map((c) => c.low);
  const maxPrice = Math.max(...allHighs);
  const minPrice = Math.min(...allLows);
  const priceRange = maxPrice - minPrice || 1;

  const candleWidth = Math.max(1, (chartW / visible.length) * 0.6);
  const gap = chartW / visible.length;

  const scaleY = (price: number) =>
    padding.top + chartH - ((price - minPrice) / priceRange) * chartH;

  const lastPrice = visible[visible.length - 1]?.close || 0;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      <rect x={0} y={0} width={width} height={height} fill="#0B0E17" rx={8} />

      {[0.25, 0.5, 0.75].map((pct) => {
        const price = minPrice + priceRange * pct;
        const y = scaleY(price);
        return (
          <g key={pct}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#1E2333" strokeWidth={1} />
            <text x={width - padding.right + 5} y={y + 4} fill="#7B8294" fontSize={11} fontFamily="monospace">
              {formatPrice(price)}
            </text>
          </g>
        );
      })}

      {visible.map((candle, i) => {
        const x = padding.left + i * gap + gap / 2;
        const isGreen = candle.close >= candle.open;
        const color = isGreen ? '#00E676' : '#FF1744';
        const bodyTop = scaleY(Math.max(candle.open, candle.close));
        const bodyBottom = scaleY(Math.min(candle.open, candle.close));
        const bodyHeight = Math.max(1, bodyBottom - bodyTop);

        return (
          <g key={i}>
            <line x1={x} y1={scaleY(candle.high)} x2={x} y2={scaleY(candle.low)} stroke={color} strokeWidth={1} />
            <rect x={x - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyHeight} fill={color} />
          </g>
        );
      })}

      <line
        x1={padding.left} y1={scaleY(lastPrice)}
        x2={width - padding.right} y2={scaleY(lastPrice)}
        stroke="#FFD740" strokeWidth={1} strokeDasharray="4,4"
      />
      <rect x={width - padding.right} y={scaleY(lastPrice) - 10} width={75} height={20} rx={4} fill="#FFD740" />
      <text
        x={width - padding.right + 37} y={scaleY(lastPrice) + 4}
        fill="#0B0E17" fontSize={11} fontFamily="'Outfit', monospace" textAnchor="middle" fontWeight="bold"
      >
        {formatPrice(lastPrice)}
      </text>

      {/* Position markers */}
      {positions.filter((p) => p.hasPosition && p.positionOpenedAt !== null && p.positionEntryPrice !== null).map((p, idx) => {
        const candleIdx = p.positionOpenedAt! - (candles.length - visible.length);
        if (candleIdx < 0 || candleIdx >= visible.length) return null;
        const x = padding.left + candleIdx * gap + gap / 2;
        const y = scaleY(p.positionEntryPrice!);
        const isLong = p.positionDirection === 'long';
        const color = isLong ? '#00E676' : '#FF1744';
        const arrow = isLong ? '\u25B2' : '\u25BC';
        const yOffset = idx * 18;
        return (
          <g key={p.nickname}>
            <line x1={x} y1={y} x2={width - padding.right} y2={y} stroke={color} strokeWidth={0.8} strokeDasharray="3,3" opacity={0.5} />
            <circle cx={x} cy={y} r={5} fill={color} />
            <text x={x + 8} y={y - 8 - yOffset} fill={color} fontSize={12} fontFamily="'Outfit', sans-serif" fontWeight="bold">
              {arrow} {p.nickname}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
