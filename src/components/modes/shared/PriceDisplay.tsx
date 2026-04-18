'use client';

import type { Candle } from '@/lib/types';
import { formatPrice } from '@/lib/utils';

export function PriceDisplay({ price, candles }: { price: number; candles: Candle[] }) {
  const prevPrice = candles.length >= 2 ? candles[candles.length - 2]?.close : price;
  const isUp = price >= prevPrice;
  const change = candles.length >= 2
    ? ((price - candles[0].open) / candles[0].open * 100).toFixed(2)
    : '0.00';
  const isPositive = Number(change) >= 0;

  return (
    <div className="flex items-center gap-3">
      <span className={`text-3xl font-mono font-bold ${isUp ? 'text-accent-green' : 'text-accent-red'}`}>
        {formatPrice(price)}
      </span>
      <span className={`text-lg font-mono ${isPositive ? 'text-accent-green' : 'text-accent-red'}`}>
        {isPositive ? '+' : ''}{change}%
      </span>
    </div>
  );
}
