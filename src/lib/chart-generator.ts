import type { Candle } from './types';

const TICKERS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'BNBUSDT', 'XRPUSDT', 'AVAXUSDT'];

// Человекочитаемые названия
export const TICKER_LABELS: Record<string, string> = {
  'BTCUSDT': 'BTC/USDT',
  'ETHUSDT': 'ETH/USDT',
  'SOLUSDT': 'SOL/USDT',
  'DOGEUSDT': 'DOGE/USDT',
  'BNBUSDT': 'BNB/USDT',
  'XRPUSDT': 'XRP/USDT',
  'AVAXUSDT': 'AVAX/USDT',
};

export function getRandomTicker(): string {
  return TICKERS[Math.floor(Math.random() * TICKERS.length)];
}

/**
 * Загружает реальные исторические свечи с Binance.
 * Выбирает случайный период из прошлого.
 * interval = '1m' (1 минута реальных данных = 1 секунда в игре)
 */
export async function fetchHistoricalCandles(ticker: string, count: number): Promise<Candle[]> {
  try {
    // Случайный период: от 1 года назад до 1 месяца назад
    const now = Date.now();
    const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
    const randomStart = oneYearAgo + Math.floor(Math.random() * (oneMonthAgo - oneYearAgo));

    const url = `https://api.binance.com/api/v3/klines?symbol=${ticker}&interval=1m&startTime=${randomStart}&limit=${count}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Binance API error: ${response.status}`);

    const data = await response.json();

    return data.map((k: unknown[]) => ({
      open: parseFloat(k[1] as string),
      high: parseFloat(k[2] as string),
      low: parseFloat(k[3] as string),
      close: parseFloat(k[4] as string),
      time: Math.floor((k[0] as number) / 1000),
    }));
  } catch (err) {
    console.error('[Chart] Failed to fetch from Binance, generating fallback:', err);
    return generateFallbackCandles(ticker, count);
  }
}

/**
 * Фоллбэк — генерация свечей если Binance недоступен
 */
function generateFallbackCandles(ticker: string, count: number): Candle[] {
  const basePrices: Record<string, number> = {
    'BTCUSDT': 45000, 'ETHUSDT': 2800, 'SOLUSDT': 120,
    'DOGEUSDT': 0.12, 'BNBUSDT': 380, 'XRPUSDT': 0.65, 'AVAXUSDT': 38,
  };

  const candles: Candle[] = [];
  let price = (basePrices[ticker] || 100) * (0.9 + Math.random() * 0.2);
  let trendDir = Math.random() > 0.5 ? 1 : -1;
  let trendLen = 10 + Math.floor(Math.random() * 20);
  let trendCount = 0;
  const time0 = Math.floor(Date.now() / 1000) - count;

  for (let i = 0; i < count; i++) {
    trendCount++;
    if (trendCount >= trendLen) {
      trendDir = Math.random() > 0.4 ? -trendDir : trendDir;
      trendLen = 10 + Math.floor(Math.random() * 25);
      trendCount = 0;
    }

    const isVolatile = Math.random() < 0.08;
    const volMult = isVolatile ? (3 + Math.random() * 5) : 1;
    const baseVol = price * 0.003;
    const vol = baseVol * volMult;
    const noise = (Math.random() - 0.5 + trendDir * 0.55) * vol;

    const open = price;
    price = Math.max(price * 0.5, price + noise);
    const close = price;
    const high = Math.max(open, close) + Math.random() * vol * 0.5;
    const low = Math.min(open, close) - Math.random() * vol * 0.5;

    candles.push({ open, high, low, close, time: time0 + i * 60 });
  }
  return candles;
}
