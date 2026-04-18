'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSocket } from '@/lib/useGame';
import type {
  ClientGameState, ClientPlayerState, LeaderboardEntry, Candle,
  BinaryDirection, BinaryBet, BinaryRoundState, BinaryPayout,
  BinaryRevealedBets, BinaryRoundResult,
} from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import { BinaryMiniChart } from '@/components/charts/MiniChart';

const BET_PERCENTS = [10, 25, 50, 75, 100] as const;

interface BinaryPlayProps {
  gameState: ClientGameState;
  playerState: ClientPlayerState;
  leaderboard: LeaderboardEntry[];
  candles: Candle[];
  currentPrice: number;
  nickname: string;
}

export function BinaryPlay({
  gameState, playerState, leaderboard, candles, currentPrice, nickname,
}: BinaryPlayProps) {
  // Binary-specific state (from useBinaryGame)
  const [binaryRound, setBinaryRound] = useState<BinaryRoundState | null>(null);
  const [myBet, setMyBet] = useState<BinaryBet | null>(null);
  const [betTimer, setBetTimer] = useState<number>(0);
  const [lastResult, setLastResult] = useState<{ direction: BinaryDirection; amount: number } | null>(null);
  const [eliminated, setEliminated] = useState(false);
  const [revealedBets, setRevealedBets] = useState<BinaryRevealedBets | null>(null);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);
  const [initialCandleCount, setInitialCandleCount] = useState(0);
  const [betPercent, setBetPercent] = useState(25);
  const [resultAnimating, setResultAnimating] = useState(false);

  // Binary-specific socket listeners
  useEffect(() => {
    const socket = getSocket();

    socket.on('binaryRound', (round: BinaryRoundState) => {
      setBinaryRound(round);
      setInitialCandleCount(round.candles.length);
      setMyBet(null);
      setLastResult(null);
      setRevealedBets(null);
      setCancelMessage(null);
    });

    socket.on('binaryReveal', (data: BinaryRevealedBets) => {
      setRevealedBets(data);
    });

    socket.on('binaryCandle', ({ candle }: { candle: Candle }) => {
      setBinaryRound((prev) => {
        if (!prev) return prev;
        return { ...prev, candles: [...prev.candles, candle] };
      });
    });

    socket.on('binaryResult', (result: BinaryRoundResult) => {
      const myId = socket.id;
      const myPayout = result.payouts.find((p: BinaryPayout) => p.playerId === myId);
      if (myPayout) {
        setLastResult({ direction: result.direction, amount: myPayout.payout });
      }
      setBinaryRound((prev) => {
        if (!prev) return prev;
        return { ...prev, phase: 'result' };
      });
    });

    socket.on('playerEliminated', ({ playerId }: { playerId: string }) => {
      if (playerId === socket.id) {
        setEliminated(true);
      }
    });

    socket.on('betTimer', (seconds: number) => {
      setBetTimer(seconds);
    });

    socket.on('binaryRoundCancelled', (data: { message: string }) => {
      setMyBet(null);
      setCancelMessage(data.message);
      setTimeout(() => setCancelMessage(null), 3000);
    });

    return () => {
      socket.off('binaryRound');
      socket.off('binaryReveal');
      socket.off('binaryCandle');
      socket.off('binaryResult');
      socket.off('playerEliminated');
      socket.off('betTimer');
      socket.off('binaryRoundCancelled');
    };
  }, []);

  // Trigger result animation
  useEffect(() => {
    if (lastResult) {
      setResultAnimating(true);
      const t = setTimeout(() => setResultAnimating(false), 2000);
      return () => clearTimeout(t);
    }
  }, [lastResult]);

  const placeBet = useCallback((direction: BinaryDirection, percent: number) => {
    const socket = getSocket();
    socket.emit('placeBet', { direction, percent });
    const balance = playerState?.balance ?? 0;
    const amount = Math.floor(balance * percent / 100);
    setMyBet({
      playerId: socket.id ?? '',
      nickname: '',
      direction,
      amount,
      percent,
    });
  }, [playerState?.balance]);

  const balance = playerState?.balance ?? 0;
  const betAmount = Math.floor(balance * betPercent / 100);

  // --- ELIMINATED ---
  if (eliminated) {
    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center p-6">
        <div className="text-6xl mb-4">&#x1F480;</div>
        <h2 className="text-3xl font-display font-black text-accent-red mb-4">ВЫ ВЫБЫЛИ!</h2>
        <p className="text-text-secondary text-lg mb-2">Финальный баланс</p>
        <p className="text-4xl font-mono font-bold text-accent-gold">${balance.toFixed(0)}</p>
        <p className="text-text-muted mt-6">Ожидайте конца игры...</p>
      </div>
    );
  }

  // --- CANCEL MESSAGE (all bet same direction) ---
  if (cancelMessage) {
    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center p-6">
        <div className="text-6xl mb-6">&#x1F504;</div>
        <h2 className="text-2xl font-display font-black text-accent-gold mb-3 text-center">{cancelMessage}</h2>
        <p className="text-text-secondary text-center">Новый график загружается...</p>
      </div>
    );
  }

  // --- BINARY RESULT OVERLAY ---
  if (binaryRound?.phase === 'result' && lastResult && resultAnimating) {
    const won = lastResult.amount > 0;
    const winDirection = lastResult.direction;
    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div
          className={`absolute inset-0 transition-opacity duration-500 ${won ? 'bg-accent-green/10' : 'bg-accent-red/10'}`}
          style={{ animation: 'fadeGlow 2s ease-in-out' }}
        />
        <div className="relative z-10 text-center" style={{ animation: 'resultScaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
          <div className={`text-6xl font-display font-black mb-4 ${winDirection === 'up' ? 'text-accent-green' : 'text-accent-red'}`}>
            {winDirection === 'up' ? '\u25B2 UP' : '\u25BC DOWN'} WINS
          </div>
          <div className={`text-5xl font-mono font-black mb-6 ${won ? 'text-accent-green' : 'text-accent-red'}`}>
            {lastResult.amount >= 0 ? '+' : ''}{lastResult.amount.toFixed(0)}$
          </div>
          <div className="text-text-secondary text-lg">
            Баланс: <span className="font-mono text-accent-gold font-bold">${balance.toFixed(0)}</span>
          </div>
        </div>
      </div>
    );
  }

  // --- BINARY REVEAL PHASE ---
  if (binaryRound?.phase === 'reveal' && revealedBets) {
    const totalPool = revealedBets.upPool + revealedBets.downPool;
    const upPct = totalPool > 0 ? (revealedBets.upPool / totalPool) * 100 : 50;
    const downPct = totalPool > 0 ? (revealedBets.downPool / totalPool) * 100 : 50;

    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center p-6">
        <h2 className="text-2xl font-display font-black text-accent-gold mb-8 animate-slide-up">
          СТАВКИ РАСКРЫТЫ!
        </h2>
        <div className="w-full max-w-sm mb-6">
          <div className="flex justify-between text-sm font-mono mb-2">
            <span className="text-accent-green">{'\u25B2'} UP ${revealedBets.upPool.toFixed(0)}</span>
            <span className="text-accent-red">{'\u25BC'} DOWN ${revealedBets.downPool.toFixed(0)}</span>
          </div>
          <div className="w-full h-4 rounded-full overflow-hidden flex bg-surface border border-border">
            <div className="h-full bg-accent-green transition-all duration-700" style={{ width: `${upPct}%` }} />
            <div className="h-full bg-accent-red transition-all duration-700" style={{ width: `${downPct}%` }} />
          </div>
        </div>
        {myBet && (
          <div className={`rounded-xl px-6 py-3 border ${
            myBet.direction === 'up'
              ? 'bg-accent-green/10 border-accent-green/40 text-accent-green'
              : 'bg-accent-red/10 border-accent-red/40 text-accent-red'
          }`}>
            <span className="font-display font-bold">
              Моя ставка: {myBet.direction === 'up' ? '\u25B2 UP' : '\u25BC DOWN'} ${myBet.amount.toFixed(0)}
            </span>
          </div>
        )}
      </div>
    );
  }

  // --- BINARY WAITING PHASE (candles appearing) ---
  if (binaryRound?.phase === 'waiting') {
    const candleTarget = binaryRound.candleTarget;
    const candlesRevealed = Math.max(0, binaryRound.candles.length - initialCandleCount);
    const chartCandles = binaryRound.candles;

    return (
      <div className="min-h-screen bg-background text-white flex flex-col">
        <div className="px-4 pt-4 pb-2">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-text-secondary text-xs uppercase">Баланс</p>
              <p className="text-2xl font-mono font-bold">${balance.toFixed(0)}</p>
            </div>
            <div className="text-right">
              <p className="text-text-secondary text-xs uppercase">Раунд</p>
              <p className="text-lg font-display font-bold text-accent-gold">
                {binaryRound.roundNumber}/{binaryRound.totalRounds}
              </p>
            </div>
          </div>
        </div>

        {chartCandles.length > 0 && (
          <div className="mx-2 mt-2 rounded-xl overflow-hidden" style={{ height: '40vw', maxHeight: '220px', minHeight: '140px' }}>
            <BinaryMiniChart candles={chartCandles} entryPrice={binaryRound.entryPrice} />
          </div>
        )}

        <div className="flex-1" />

        {myBet && (
          <div className="mx-4 mt-4">
            <div className={`rounded-xl px-4 py-3 border ${
              myBet.direction === 'up'
                ? 'bg-accent-green/10 border-accent-green/30'
                : 'bg-accent-red/10 border-accent-red/30'
            }`}>
              <p className={`font-display font-bold ${myBet.direction === 'up' ? 'text-accent-green' : 'text-accent-red'}`}>
                Моя ставка: {myBet.direction === 'up' ? '\u25B2 UP' : '\u25BC DOWN'} ${myBet.amount.toFixed(0)}
              </p>
            </div>
          </div>
        )}

        <div className="mx-4 mt-3 mb-2">
          <div className="flex items-center justify-between text-sm text-text-secondary mb-1.5">
            <span>Свечи</span>
            <span className="font-mono">{candlesRevealed}/{candleTarget}</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-surface border border-border overflow-hidden">
            <div
              className="h-full bg-accent-gold rounded-full transition-all duration-500"
              style={{ width: `${candleTarget > 0 ? (candlesRevealed / candleTarget) * 100 : 0}%` }}
            />
          </div>
        </div>

        {revealedBets && (
          <div className="mx-4 mb-6 mt-2">
            <div className="flex justify-between text-sm font-mono">
              <span className="text-accent-green">{'\u25B2'} ${revealedBets.upPool.toFixed(0)}</span>
              <span className="text-text-muted">vs</span>
              <span className="text-accent-red">{'\u25BC'} ${revealedBets.downPool.toFixed(0)}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- BINARY BETTING PHASE ---
  if (binaryRound?.phase === 'betting') {
    const chartCandles = binaryRound.candles;

    return (
      <div className="min-h-screen bg-background text-white flex flex-col">
        <div className="px-4 pt-4 pb-2">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-text-secondary text-xs uppercase">Баланс</p>
              <p className="text-3xl font-mono font-black">${balance.toFixed(0)}</p>
            </div>
            <div className="text-right">
              <p className="text-text-secondary text-xs uppercase">Раунд</p>
              <p className="text-lg font-display font-bold text-accent-gold">
                {binaryRound.roundNumber}/{binaryRound.totalRounds}
              </p>
            </div>
          </div>
        </div>

        {chartCandles.length > 0 && (
          <div className="mx-2 mt-2 rounded-xl overflow-hidden" style={{ height: '35vw', maxHeight: '200px', minHeight: '120px' }}>
            <BinaryMiniChart candles={chartCandles} entryPrice={binaryRound.entryPrice} />
          </div>
        )}

        <div className="flex-1" />

        <div className="flex flex-col items-center mt-4 mb-2">
          <TimerCircle seconds={betTimer} maxSeconds={10} />
        </div>

        {myBet ? (
          <div className="px-4 pb-8">
            <div className={`rounded-2xl px-6 py-6 text-center border-2 ${
              myBet.direction === 'up'
                ? 'bg-accent-green/10 border-accent-green/40'
                : 'bg-accent-red/10 border-accent-red/40'
            }`}>
              <p className={`text-3xl font-display font-black ${myBet.direction === 'up' ? 'text-accent-green' : 'text-accent-red'}`}>
                {myBet.direction === 'up' ? '\u25B2 UP' : '\u25BC DOWN'}
              </p>
              <p className="text-xl font-mono font-bold text-text-primary mt-2">${myBet.amount.toFixed(0)}</p>
              <p className="text-text-secondary text-sm mt-1">Ставка принята</p>
            </div>
          </div>
        ) : (
          <div className="px-4 pb-6 space-y-4">
            <div>
              <div className="flex justify-between text-sm text-text-secondary mb-1.5">
                <span>Ставка</span>
                <span className="font-mono text-accent-gold font-bold">${betAmount.toLocaleString()}</span>
              </div>
              <div className="flex gap-1.5">
                {BET_PERCENTS.map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setBetPercent(pct)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all active:scale-95 ${
                      betPercent === pct
                        ? 'bg-accent-gold text-black'
                        : 'bg-surface text-text-secondary border border-border'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => placeBet('up', betPercent)}
                disabled={betAmount <= 0}
                className="bg-accent-green text-white font-display font-black text-2xl py-8 rounded-2xl active:scale-95 transition-all disabled:opacity-30 glow-green animate-glow-pulse"
              >
                <span className="flex flex-col items-center gap-1">
                  <span className="text-3xl">{'\u25B2'}</span>
                  UP
                </span>
              </button>
              <button
                onClick={() => placeBet('down', betPercent)}
                disabled={betAmount <= 0}
                className="bg-accent-red text-white font-display font-black text-2xl py-8 rounded-2xl active:scale-95 transition-all disabled:opacity-30 glow-red"
                style={{ animation: 'glow-pulse-red 2s ease-in-out infinite' }}
              >
                <span className="flex flex-col items-center gap-1">
                  <span className="text-3xl">{'\u25BC'}</span>
                  DOWN
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Fallback — no active binary round yet, show waiting
  return (
    <div className="min-h-screen bg-background text-white flex items-center justify-center">
      <p className="animate-pulse text-xl">Загрузка...</p>
    </div>
  );
}

// --- TIMER CIRCLE COMPONENT ---
function TimerCircle({ seconds, maxSeconds }: { seconds: number; maxSeconds: number }) {
  const size = 80;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = maxSeconds > 0 ? seconds / maxSeconds : 0;
  const dashOffset = circumference * (1 - progress);
  const isUrgent = seconds <= 3;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1E2333" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={isUrgent ? '#FF1744' : '#FFD740'}
          strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={dashOffset}
          className="transition-all duration-1000 linear"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-3xl font-display font-black ${isUrgent ? 'text-accent-red animate-pulse' : 'text-accent-gold'}`}>
          {seconds}
        </span>
      </div>
    </div>
  );
}
