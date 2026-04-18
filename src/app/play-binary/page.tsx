'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useBinaryGame } from '@/lib/useBinaryGame';
import { useGameModeRedirect } from '@/lib/useGameModeRedirect';
import { formatPrice } from '@/lib/utils';
import { RANDOM_NICKS } from '@/lib/constants';
import type { Candle } from '@/lib/types';
import { IconTrophy, IconSilver, IconBronze, IconFinish } from '@/components/icons';

const BET_PERCENTS = [10, 25, 50, 75, 100] as const;

export default function PlayBinaryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-white text-xl animate-pulse">Загрузка...</div>}>
      <PlayBinaryContent />
    </Suspense>
  );
}

function PlayBinaryContent() {
  const searchParams = useSearchParams();
  const roomFromUrl = searchParams.get('room') || '';

  const {
    gameState, playerState, leaderboard, countdown, candles, currentPrice,
    error, finalStats, roomClosed,
    joinRoom,
    binaryRound, myBet, betTimer, lastResult, eliminated, revealedBets,
    cancelMessage, initialCandleCount,
    placeBet,
  } = useBinaryGame();

  const [joined, setJoined] = useState(false);
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState(roomFromUrl);

  useGameModeRedirect(gameState, 'binary', roomCode);
  const [betPercent, setBetPercent] = useState(25);
  const [resultAnimating, setResultAnimating] = useState(false);

  // Auto-reconnect from session (only if no room in URL — avoids reusing nick across tabs)
  useEffect(() => {
    if (joined || roomFromUrl) return;
    const savedRoom = sessionStorage.getItem('investsovet_room');
    const savedNick = sessionStorage.getItem('investsovet_nick');
    if (savedRoom && savedNick) {
      setRoomCode(savedRoom);
      setNickname(savedNick);
      joinRoom(savedRoom, savedNick);
      setJoined(true);
    }
  }, [joined, joinRoom, roomFromUrl]);

  // Clear stale session on failed reconnect
  useEffect(() => {
    if (error && joined && !gameState) {
      sessionStorage.removeItem('investsovet_room');
      sessionStorage.removeItem('investsovet_nick');
      setJoined(false);
      setNickname('');
      setRoomCode(roomFromUrl);
    }
  }, [error, joined, gameState, roomFromUrl]);

  // Trigger result animation
  useEffect(() => {
    if (lastResult) {
      setResultAnimating(true);
      const t = setTimeout(() => setResultAnimating(false), 2000);
      return () => clearTimeout(t);
    }
  }, [lastResult]);

  const balance = playerState?.balance ?? 0;
  const betAmount = Math.floor(balance * betPercent / 100);

  // ─── JOIN SCREEN ───
  if (!joined) {
    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center p-6">
        <Link href="/" className="absolute top-4 left-4 text-sm text-text-secondary hover:text-white transition-colors">&larr; Назад</Link>
        <h1 className="text-4xl font-display font-black mb-2">
          <span className="font-display text-accent-green" style={{ textShadow: '0 0 30px rgba(0,230,118,0.4)' }}>INVEST</span>
          <span className="font-display text-accent-gold" style={{ textShadow: '0 0 30px rgba(255,215,64,0.4)' }}>SOVET</span>
        </h1>
        <p className="text-accent-gold/80 mb-8 font-display text-sm tracking-widest">BINARY OPTIONS</p>

        {error && (
          <div className="bg-accent-red/20 border border-accent-red/50 rounded-lg p-3 mb-4 text-accent-red text-center w-full max-w-sm">
            {error}
          </div>
        )}

        <div className="w-full max-w-sm space-y-4">
          <input
            type="text"
            placeholder="Код комнаты"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            className="w-full bg-surface border border-border rounded-xl px-4 py-4 text-center text-2xl font-display tracking-[0.3em] focus:border-accent-green focus:outline-none text-white"
            maxLength={6}
          />
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Никнейм"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-lg focus:border-accent-green focus:outline-none text-white"
              maxLength={16}
            />
            <button
              onClick={() => setNickname(RANDOM_NICKS[Math.floor(Math.random() * RANDOM_NICKS.length)])}
              className="bg-surface border border-border rounded-xl px-4 text-xl active:scale-95"
            >
              ?
            </button>
          </div>
          <button
            onClick={() => {
              if (!roomCode || !nickname) return;
              joinRoom(roomCode, nickname);
              setJoined(true);
            }}
            disabled={roomCode.length === 0 || nickname.length === 0}
            className="w-full bg-accent-green text-white font-display font-bold text-xl py-4 rounded-xl disabled:opacity-30 active:scale-95 transition-all glow-green"
          >
            ВОЙТИ
          </button>
        </div>
      </div>
    );
  }

  // ─── ROOM CLOSED ───
  if (roomClosed) {
    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center p-6">
        <h2 className="text-2xl font-display font-bold text-accent-red mb-4">Комната закрыта</h2>
        <p className="text-text-secondary mb-6">{roomClosed}</p>
        <Link href="/" className="bg-accent-green text-white font-display font-bold py-3 px-6 rounded-xl">
          На главную
        </Link>
      </div>
    );
  }

  // ─── LOBBY ───
  if (!gameState || gameState.phase === 'lobby') {
    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center p-6">
        <div className="text-2xl font-display font-bold text-accent-gold mb-4 animate-pulse tracking-widest">READY</div>
        <h2 className="text-2xl font-bold">{nickname}</h2>
        <p className="text-text-secondary mt-8 animate-shimmer text-lg">Ждём старта...</p>
        {gameState && <p className="text-text-muted mt-2">Игроков: {gameState.playerCount}</p>}
      </div>
    );
  }

  // ─── COUNTDOWN (3-2-1) ───
  if (gameState.phase === 'countdown') {
    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center">
        <p className="text-text-secondary text-lg">Раунд {gameState.roundNumber}</p>
        <p className="text-accent-gold text-xl">{gameState.ticker}</p>
        <div
          className="text-[120px] font-display font-black text-accent-gold animate-countdown leading-none mt-4"
          style={{ textShadow: '0 0 60px rgba(255,215,64,0.5)' }}
        >
          {countdown}
        </div>
      </div>
    );
  }

  // ─── ELIMINATED ───
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

  // ─── CANCEL MESSAGE (all bet same direction) ───
  // Shown as a full-screen flash before the next round's betting phase loads
  if (cancelMessage) {
    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center p-6">
        <div className="text-6xl mb-6">&#x1F504;</div>
        <h2 className="text-2xl font-display font-black text-accent-gold mb-3 text-center">{cancelMessage}</h2>
        <p className="text-text-secondary text-center">Новый график загружается...</p>
      </div>
    );
  }

  // ─── BINARY RESULT OVERLAY ───
  if (binaryRound?.phase === 'result' && lastResult && resultAnimating) {
    const won = lastResult.amount > 0;
    const winDirection = lastResult.direction;
    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Soft background glow */}
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

  // ─── BINARY REVEAL PHASE ───
  if (binaryRound?.phase === 'reveal' && revealedBets) {
    const totalPool = revealedBets.upPool + revealedBets.downPool;
    const upPct = totalPool > 0 ? (revealedBets.upPool / totalPool) * 100 : 50;
    const downPct = totalPool > 0 ? (revealedBets.downPool / totalPool) * 100 : 50;

    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center p-6">
        <h2 className="text-2xl font-display font-black text-accent-gold mb-8 animate-slide-up">
          СТАВКИ РАСКРЫТЫ!
        </h2>

        {/* Pool comparison bar */}
        <div className="w-full max-w-sm mb-6">
          <div className="flex justify-between text-sm font-mono mb-2">
            <span className="text-accent-green">\u25B2 UP ${revealedBets.upPool.toFixed(0)}</span>
            <span className="text-accent-red">\u25BC DOWN ${revealedBets.downPool.toFixed(0)}</span>
          </div>
          <div className="w-full h-4 rounded-full overflow-hidden flex bg-surface border border-border">
            <div
              className="h-full bg-accent-green transition-all duration-700"
              style={{ width: `${upPct}%` }}
            />
            <div
              className="h-full bg-accent-red transition-all duration-700"
              style={{ width: `${downPct}%` }}
            />
          </div>
        </div>

        {/* My bet highlighted */}
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

  // ─── BINARY WAITING PHASE (candles appearing) ───
  if (binaryRound?.phase === 'waiting') {
    const candleTarget = binaryRound.candleTarget;
    const candlesRevealed = Math.max(0, binaryRound.candles.length - initialCandleCount);
    const chartCandles = binaryRound.candles;

    return (
      <div className="min-h-screen bg-background text-white flex flex-col">
        {/* Header */}
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

        {/* Chart */}
        {chartCandles.length > 0 && (
          <div className="mx-2 mt-2 rounded-xl overflow-hidden" style={{ height: '40vw', maxHeight: '220px', minHeight: '140px' }}>
            <MiniChart candles={chartCandles} entryPrice={binaryRound.entryPrice} />
          </div>
        )}

        <div className="flex-1" />

        {/* My bet info */}
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

        {/* Candle progress */}
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

        {/* Pool comparison */}
        {revealedBets && (
          <div className="mx-4 mb-6 mt-2">
            <div className="flex justify-between text-sm font-mono">
              <span className="text-accent-green">\u25B2 ${revealedBets.upPool.toFixed(0)}</span>
              <span className="text-text-muted">vs</span>
              <span className="text-accent-red">\u25BC ${revealedBets.downPool.toFixed(0)}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── BINARY BETTING PHASE ───
  if (binaryRound?.phase === 'betting' && playerState) {
    const chartCandles = binaryRound.candles;

    return (
      <div className="min-h-screen bg-background text-white flex flex-col">
        {/* Header */}
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

        {/* Chart with entry price line */}
        {chartCandles.length > 0 && (
          <div className="mx-2 mt-2 rounded-xl overflow-hidden" style={{ height: '35vw', maxHeight: '200px', minHeight: '120px' }}>
            <MiniChart candles={chartCandles} entryPrice={binaryRound.entryPrice} />
          </div>
        )}

        <div className="flex-1" />

        {/* Timer — big countdown */}
        <div className="flex flex-col items-center mt-4 mb-2">
          <TimerCircle seconds={betTimer} maxSeconds={10} />
        </div>

        {myBet ? (
          /* Already bet — show confirmation */
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
          /* Bet controls */
          <div className="px-4 pb-6 space-y-4">
            {/* Bet size selector */}
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

            {/* UP / DOWN buttons */}
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

  // ─── FINISHED ───
  if (gameState.phase === 'finished') {
    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center p-4 overflow-y-auto">
        <div className="mt-6 mb-2"><IconFinish size={48} /></div>
        <h2 className="text-2xl font-display font-black text-accent-gold mb-4">ИГРА ОКОНЧЕНА</h2>

        {finalStats.length > 0 ? (
          <div className="w-full max-w-md space-y-3 mb-6">
            {finalStats.map((s) => (
              <div key={s.nickname} className={`rounded-xl p-4 ${s.rank === 1 ? 'bg-accent-gold/10 border border-accent-gold/30' : 'glass border border-border'}`}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xl font-bold flex items-center gap-1">
                    {s.rank === 1 ? <IconTrophy size={24} /> : s.rank === 2 ? <IconSilver size={24} /> : s.rank === 3 ? <IconBronze size={24} /> : `${s.rank}.`} {s.nickname}
                  </span>
                  <span className="text-xl font-mono font-bold text-accent-gold">${s.balance.toFixed(0)}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="text-text-secondary">Макс. баланс</span>
                  <span className="text-right font-mono text-accent-green">${s.maxBalance.toFixed(0)}</span>
                  <span className="text-text-secondary">Лучшая сделка</span>
                  <span className="text-right font-mono text-accent-green">+${s.bestTrade.toFixed(0)}</span>
                  <span className="text-text-secondary">Худшая сделка</span>
                  <span className="text-right font-mono text-accent-red">{s.worstTrade.toFixed(0)}$</span>
                  <span className="text-text-secondary">Сделок</span>
                  <span className="text-right font-mono">{s.totalTrades}</span>
                  <span className="text-text-secondary">Ликвидаций</span>
                  <span className="text-right font-mono text-accent-red">{s.liquidations}</span>
                </div>
              </div>
            ))}
          </div>
        ) : playerState && (
          <p className="text-2xl font-bold mt-4 mb-6">${playerState.balance.toFixed(0)}</p>
        )}

        <button
          onClick={() => {
            sessionStorage.removeItem('investsovet_room');
            sessionStorage.removeItem('investsovet_nick');
            window.location.href = '/play-binary';
          }}
          className="bg-surface-light text-white px-8 py-3 rounded-xl text-lg active:scale-95"
        >
          Новая игра
        </button>
      </div>
    );
  }

  // ─── FALLBACK LOADING ───
  return (
    <div className="min-h-screen bg-background text-white flex items-center justify-center">
      <p className="animate-pulse text-xl">Загрузка...</p>
    </div>
  );
}

// ─── TIMER CIRCLE COMPONENT ───
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
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1E2333"
          strokeWidth={stroke}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isUrgent ? '#FF1744' : '#FFD740'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
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

// ─── MINI CHART (copied from play/page.tsx, adapted for binary) ───
function MiniChart({ candles, entryPrice }: { candles: Candle[]; entryPrice?: number }) {
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
