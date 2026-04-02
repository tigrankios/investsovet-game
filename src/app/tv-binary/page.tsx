'use client';

import { useEffect, useState, useRef } from 'react';
import { useGame, getSocket } from '@/lib/useGame';
import { QRCodeSVG } from 'qrcode.react';
import type { Candle, LeaderboardEntry } from '@/lib/types';
import type { BinaryBet, BinaryDirection, BinaryRoundState, BinaryRoundResult, BinaryPayout, BinaryRevealedBets } from '@/lib/types/binary';
import { BINARY_MAX_ROUNDS } from '@/lib/types/binary';
import { formatPrice } from '@/lib/utils';
import { IconTrophy, IconSilver, IconBronze, IconDice } from '@/components/icons';

const MUSIC_URL = 'https://cdn.pixabay.com/audio/2022/10/25/audio_33f9de5e3a.mp3';

export default function TVBinaryPage() {
  const {
    gameState, leaderboard, finalStats,
    createRoom, startGame,
  } = useGame();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Binary-specific state
  const [binaryRound, setBinaryRound] = useState<BinaryRoundState | null>(null);
  const [revealedBets, setRevealedBets] = useState<BinaryBet[]>([]);
  const [upPool, setUpPool] = useState(0);
  const [downPool, setDownPool] = useState(0);
  const [binaryCandles, setBinaryCandles] = useState<Candle[]>([]);
  const [candlesRevealed, setCandlesRevealed] = useState(0);
  const [resultData, setResultData] = useState<BinaryRoundResult | null>(null);
  const [eliminatedAlert, setEliminatedAlert] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [cancelMessage, setCancelMessage] = useState('');

  // Listen for binary-specific socket events
  useEffect(() => {
    const socket = getSocket();

    socket.on('binaryRound', (round: BinaryRoundState) => {
      setBinaryRound(round);
      setBinaryCandles(round.candles);
      setCandlesRevealed(0);
      setRevealedBets([]);
      setUpPool(0);
      setDownPool(0);
      setResultData(null);
      setCancelMessage('');
    });

    socket.on('binaryReveal', (data: BinaryRevealedBets) => {
      setRevealedBets(data.bets);
      setUpPool(data.upPool);
      setDownPool(data.downPool);
    });

    socket.on('binaryCandle', ({ candle }: { candle: Candle }) => {
      setBinaryCandles(prev => [...prev, candle]);
      setCandlesRevealed(prev => prev + 1);
    });

    socket.on('binaryResult', (result: BinaryRoundResult) => {
      setResultData(result);
    });

    socket.on('playerEliminated', ({ playerId }: { playerId: string }) => {
      // Look up nickname from leaderboard or revealed bets
      const name = playerId;
      setEliminatedAlert(`${name} ВЫБЫЛ!`);
      setTimeout(() => setEliminatedAlert(''), 3000);
    });

    socket.on('binaryRoundCancelled', (data: { message: string }) => {
      setCancelMessage(data.message || 'Все поставили одинаково — переигровка!');
      setTimeout(() => setCancelMessage(''), 3000);
    });

    socket.on('betTimer', (seconds: number) => {
      setCountdown(seconds);
    });

    socket.on('countdown', (sec: number) => {
      setCountdown(sec);
    });

    return () => {
      socket.off('binaryRound');
      socket.off('binaryReveal');
      socket.off('binaryCandle');
      socket.off('binaryResult');
      socket.off('playerEliminated');
      socket.off('binaryRoundCancelled');
      socket.off('betTimer');
      socket.off('countdown');
    };
  }, []);

  // Music during active phases
  useEffect(() => {
    if (!gameState) return;
    const activePhasesForMusic = ['binary_betting', 'binary_reveal', 'binary_waiting'];
    if (activePhasesForMusic.includes(gameState.phase)) {
      if (!audioRef.current) {
        audioRef.current = new Audio(MUSIC_URL);
        audioRef.current.loop = true;
        audioRef.current.volume = 0.3;
      }
      audioRef.current.play().catch(() => {});
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  }, [gameState?.phase]);

  // Auto-create binary room
  useEffect(() => {
    if (!gameState) {
      createRoom('binary');
    }
  }, [gameState, createRoom]);

  if (!gameState) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-accent-gold text-4xl font-display animate-pulse">Загрузка...</div>
      </div>
    );
  }

  const { phase, roomCode, playerNames } = gameState;
  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/play-binary?room=${roomCode}`
    : '';

  const totalPlayers = leaderboard.length || playerNames.length;
  const entryPrice = binaryRound?.entryPrice ?? 0;
  const ticker = binaryRound?.ticker ?? gameState.ticker ?? '';
  const roundNumber = binaryRound?.roundNumber ?? gameState.roundNumber ?? 0;
  const maxRounds = binaryRound?.totalRounds ?? BINARY_MAX_ROUNDS;
  const totalCandles = binaryRound?.candleTarget ?? 5;

  // --- LOBBY ---
  if (phase === 'lobby') {
    return (
      <div className="h-screen bg-background text-white flex flex-col">
        <header className="text-center py-8">
          <h1 className="text-7xl font-display font-black tracking-tight">
            <span className="font-display text-accent-green" style={{ textShadow: '0 0 40px rgba(0,230,118,0.4)' }}>INVEST</span>
            <span className="font-display text-accent-gold" style={{ textShadow: '0 0 40px rgba(255,215,64,0.4)' }}>SOVET</span>
          </h1>
          <p className="text-accent-gold text-xl mt-2 inline-flex items-center gap-2">
            <IconDice size={20} /> Режим: Бинарные Опционы
          </p>
        </header>

        <div className="flex-1 flex items-center justify-center gap-16 px-8">
          <div className="flex flex-col items-center gap-4">
            <div className="bg-white p-4 rounded-2xl">
              <QRCodeSVG value={joinUrl} size={220} />
            </div>
            <p className="text-5xl font-display font-mono font-bold text-accent-gold tracking-widest">{roomCode}</p>
            <p className="text-text-muted text-sm">Отсканируй QR или введи код</p>
          </div>

          <div className="glass border border-border rounded-2xl p-8 min-w-80">
            <h3 className="text-text-secondary text-lg mb-4">Игроки ({playerNames.length})</h3>
            {playerNames.length === 0 ? (
              <p className="text-text-muted animate-pulse">Ждём игроков...</p>
            ) : (
              <ul className="space-y-2">
                {playerNames.map((name) => (
                  <li key={name} className="text-xl text-white flex items-center gap-2">
                    <span className="text-accent-green">●</span> {name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <footer className="text-center py-6">
          {playerNames.length >= 1 ? (
            <button
              onClick={startGame}
              className="bg-accent-gold text-black font-display font-bold text-2xl px-12 py-4 rounded-xl hover:bg-accent-gold/90 transition-all hover:scale-105 active:scale-95 glow-gold animate-glow-pulse"
            >
              СТАРТ
            </button>
          ) : (
            <p className="text-text-muted text-xl">Минимум 1 игрок</p>
          )}
        </footer>
      </div>
    );
  }

  // --- COUNTDOWN ---
  if (phase === 'countdown') {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center">
        <p className="text-text-secondary text-3xl mb-2">Раунд {roundNumber}</p>
        <p className="text-accent-gold text-2xl mb-4">{ticker}</p>
        <div className="text-[200px] font-display font-black text-accent-gold animate-countdown leading-none" style={{ textShadow: '0 0 80px rgba(255,215,64,0.5)' }}>
          {countdown}
        </div>
      </div>
    );
  }

  // --- BINARY BETTING ---
  if (phase === 'binary_betting') {
    return (
      <div className="h-screen bg-background flex flex-col text-white">
        {/* Cancelled alert */}
        {cancelMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-accent-gold text-black font-bold text-2xl px-8 py-3 rounded-xl z-50 animate-alert">
            {cancelMessage}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border">
          <div className="flex items-center gap-4">
            <span className="text-accent-gold font-display font-bold text-lg tracking-wider">БИНАРНЫЕ ОПЦИОНЫ</span>
            <span className="text-text-secondary text-lg font-mono">R{roundNumber}/{maxRounds}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-surface-light px-4 py-2 rounded-lg">
              <span className="text-text-secondary text-sm">ТАЙМЕР</span>
              <span className="text-accent-gold text-3xl font-mono font-black" style={{ textShadow: '0 0 20px rgba(255,215,64,0.4)' }}>
                {countdown}с
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-accent-gold">{ticker}</span>
              {entryPrice > 0 && (
                <span className="text-lg font-mono text-text-secondary">{formatPrice(entryPrice)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Chart + Sidebar */}
        <div className="flex-1 flex">
          <div className="flex-1 p-4">
            <BinaryCandlestickChart
              candles={binaryCandles}
              entryPrice={entryPrice}
            />
          </div>
          <div className="w-[400px] border-l border-border p-6 overflow-y-auto flex flex-col">
            <h3 className="text-text-secondary text-xl font-display font-bold mb-5 uppercase tracking-wider">Лидерборд</h3>
            <div className="space-y-2 flex-1">
              {leaderboard.map((entry, i) => (
                <div key={entry.nickname} className="flex items-center gap-3 rounded-xl px-4 py-2.5 glass">
                  <span className="font-bold text-xl w-8 text-center text-text-muted">{i + 1}</span>
                  <p className="text-white font-semibold text-lg truncate flex-1">{entry.nickname}</p>
                  <p className="font-mono font-bold text-lg text-white">${entry.balance.toFixed(0)}</p>
                </div>
              ))}
            </div>

            {/* Player count */}
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary text-lg">Игроки:</span>
                <span className="text-accent-gold text-xl font-mono font-bold">
                  {totalPlayers}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- BINARY REVEAL + WAITING ---
  if (phase === 'binary_reveal' || phase === 'binary_waiting') {
    const totalPool = upPool + downPool;
    const upPct = totalPool > 0 ? (upPool / totalPool) * 100 : 50;
    const downPct = totalPool > 0 ? (downPool / totalPool) * 100 : 50;
    const upBets = revealedBets.filter(b => b.direction === 'up');
    const downBets = revealedBets.filter(b => b.direction === 'down');

    return (
      <div className="h-screen bg-background flex flex-col text-white">
        {/* Eliminated alert */}
        {eliminatedAlert && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-accent-red text-white font-bold text-2xl px-8 py-3 rounded-xl z-50 animate-alert">
            {eliminatedAlert}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border">
          <div className="flex items-center gap-4">
            <span className="text-accent-gold font-display font-bold text-lg tracking-wider">БИНАРНЫЕ ОПЦИОНЫ</span>
            <span className="text-text-secondary text-lg font-mono">R{roundNumber}/{maxRounds}</span>
          </div>
          <div className="flex items-center gap-4">
            {/* Candle progress */}
            <div className="flex items-center gap-2 bg-surface-light px-4 py-2 rounded-lg">
              <span className="text-text-secondary text-sm">Свечей:</span>
              <div className="flex gap-1">
                {Array.from({ length: totalCandles }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-4 rounded-sm transition-all duration-300 ${
                      i < candlesRevealed ? 'bg-accent-gold' : 'bg-surface-light border border-border-light'
                    }`}
                  />
                ))}
              </div>
              <span className="text-accent-gold font-mono font-bold text-lg">{candlesRevealed}/{totalCandles}</span>
            </div>
            <span className="text-xl font-bold text-accent-gold">{ticker}</span>
          </div>
        </div>

        {/* Chart + Sidebar */}
        <div className="flex-1 flex">
          <div className="flex-1 p-4 relative">
            <BinaryCandlestickChart
              candles={binaryCandles}
              entryPrice={entryPrice}
            />

            {/* Pool bar overlay at bottom of chart */}
            <div className="absolute bottom-6 left-8 right-8">
              <div className="glass-strong rounded-xl p-3">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-accent-green font-bold text-sm">UP ${upPool.toLocaleString()}</span>
                  <div className="flex-1" />
                  <span className="text-accent-red font-bold text-sm">DOWN ${downPool.toLocaleString()}</span>
                </div>
                <div className="h-3 bg-surface rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-accent-green transition-all duration-700 rounded-l-full"
                    style={{ width: `${upPct}%` }}
                  />
                  <div
                    className="h-full bg-accent-red transition-all duration-700 rounded-r-full"
                    style={{ width: `${downPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar: Bets grouped by direction */}
          <div className="w-[400px] border-l border-border p-6 overflow-y-auto flex flex-col">
            <h3 className="text-text-secondary text-xl font-display font-bold mb-5 uppercase tracking-wider">Ставки</h3>

            {/* UP group */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-accent-green text-2xl font-bold">&#9650; UP</span>
                <span className="text-accent-green font-mono font-bold text-lg">${upPool.toLocaleString()}</span>
              </div>
              <div className="space-y-1 ml-4">
                {upBets.map(bet => (
                  <div key={bet.playerId} className="flex items-center justify-between text-lg">
                    <span className="text-white">{bet.nickname}</span>
                    <span className="font-mono text-accent-green">${bet.amount.toLocaleString()}</span>
                  </div>
                ))}
                {upBets.length === 0 && <p className="text-text-muted text-sm">Нет ставок</p>}
              </div>
            </div>

            {/* DOWN group */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-accent-red text-2xl font-bold">&#9660; DOWN</span>
                <span className="text-accent-red font-mono font-bold text-lg">${downPool.toLocaleString()}</span>
              </div>
              <div className="space-y-1 ml-4">
                {downBets.map(bet => (
                  <div key={bet.playerId} className="flex items-center justify-between text-lg">
                    <span className="text-white">{bet.nickname}</span>
                    <span className="font-mono text-accent-red">${bet.amount.toLocaleString()}</span>
                  </div>
                ))}
                {downBets.length === 0 && <p className="text-text-muted text-sm">Нет ставок</p>}
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary text-lg">Банк:</span>
                <span className="text-accent-gold text-2xl font-mono font-black">${totalPool.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- BINARY RESULT ---
  if (phase === 'binary_result' && resultData) {
    const isUp = resultData.direction === 'up';
    const glowColor = isUp ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 23, 68, 0.15)';
    const textColor = isUp ? 'text-accent-green' : 'text-accent-red';
    const arrow = isUp ? '▲' : '▼';
    const label = isUp ? 'UP WINS' : 'DOWN WINS';

    return (
      <div className="h-screen bg-background flex flex-col text-white relative">
        {/* Glow overlay */}
        <div
          className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-500"
          style={{ backgroundColor: glowColor }}
        />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border relative z-10">
          <div className="flex items-center gap-4">
            <span className="text-accent-gold font-display font-bold text-lg tracking-wider">БИНАРНЫЕ ОПЦИОНЫ</span>
            <span className="text-text-secondary text-lg font-mono">R{roundNumber}/{maxRounds}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-accent-gold">{ticker}</span>
          </div>
        </div>

        {/* Chart + Sidebar */}
        <div className="flex-1 flex relative z-10">
          <div className="flex-1 p-4 relative flex items-center justify-center">
            {/* Chart in background */}
            <div className="absolute inset-4 opacity-30">
              <BinaryCandlestickChart
                candles={binaryCandles}
                entryPrice={entryPrice}
              />
            </div>

            {/* Big result text */}
            <div className="relative z-10 text-center">
              <div className={`text-[120px] font-display font-black ${textColor} leading-none`} style={{ textShadow: `0 0 60px ${isUp ? 'rgba(0,230,118,0.5)' : 'rgba(255,23,68,0.5)'}` }}>
                {arrow}
              </div>
              <div className={`text-6xl font-display font-black ${textColor} mt-2`} style={{ textShadow: `0 0 40px ${isUp ? 'rgba(0,230,118,0.4)' : 'rgba(255,23,68,0.4)'}` }}>
                {label}
              </div>
              <div className="text-text-secondary text-2xl font-mono mt-4">
                {formatPrice(entryPrice)} → {formatPrice(resultData.finalPrice)}
              </div>
            </div>
          </div>

          {/* Sidebar: Payouts */}
          <div className="w-[400px] border-l border-border p-6 overflow-y-auto relative z-10">
            <h3 className="text-text-secondary text-xl font-display font-bold mb-5 uppercase tracking-wider">Результаты</h3>
            <div className="space-y-2">
              {[...resultData.payouts]
                .sort((a, b) => b.payout - a.payout)
                .map(p => (
                  <div key={p.nickname} className="flex items-center justify-between glass rounded-xl px-4 py-3">
                    <span className="text-lg font-semibold text-white">{p.nickname}</span>
                    <span className={`text-xl font-mono font-bold ${p.payout >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                      {p.payout >= 0 ? '+' : ''}{p.payout.toLocaleString()}$
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- FINISHED ---
  if (phase === 'finished') {
    const stats = finalStats.length > 0
      ? finalStats
      : leaderboard.map((e, i) => ({
          nickname: e.nickname, rank: i + 1, balance: e.balance,
          maxBalance: e.balance, worstTrade: 0, bestTrade: 0, totalTrades: 0, liquidations: 0,
          role: 'trader' as const,
        }));

    return (
      <div className="h-screen bg-background text-white flex flex-col items-center justify-center overflow-y-auto">
        <h1 className="text-6xl font-display font-black text-accent-gold mb-6">ИГРА ОКОНЧЕНА</h1>

        <div className="w-full max-w-3xl px-4">
          <table className="w-full text-left">
            <thead>
              <tr className="text-text-secondary text-sm">
                <th className="pb-3">#</th>
                <th className="pb-3">Игрок</th>
                <th className="pb-3 text-right">Баланс</th>
                <th className="pb-3 text-right">Макс.</th>
                <th className="pb-3 text-right">Лучшая</th>
                <th className="pb-3 text-right">Худшая</th>
                <th className="pb-3 text-right">Раунды</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.nickname} className={`border-t border-border ${s.rank === 1 ? 'text-accent-gold text-xl' : 'text-lg'}`}>
                  <td className="py-4 font-bold">{s.rank === 1 ? <IconTrophy size={24} /> : s.rank === 2 ? <IconSilver size={24} /> : s.rank === 3 ? <IconBronze size={24} /> : s.rank}</td>
                  <td className="py-4 font-bold">{s.nickname}</td>
                  <td className="py-4 text-right font-mono font-bold">${s.balance.toFixed(0)}</td>
                  <td className="py-4 text-right font-mono text-accent-green">${s.maxBalance.toFixed(0)}</td>
                  <td className="py-4 text-right font-mono text-accent-green">+{s.bestTrade.toFixed(0)}</td>
                  <td className="py-4 text-right font-mono text-accent-red">{s.worstTrade.toFixed(0)}</td>
                  <td className="py-4 text-right font-mono">{s.totalTrades}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // --- Fallback: result phase without data yet ---
  if (phase === 'binary_result') {
    return (
      <div className="h-screen bg-background flex items-center justify-center text-white">
        <div className="text-accent-gold text-4xl font-display animate-pulse">Подсчёт результатов...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex items-center justify-center text-white text-2xl">
      Загрузка...
    </div>
  );
}

// --- Components ---

function BinaryCandlestickChart({ candles, entryPrice }: { candles: Candle[]; entryPrice: number }) {
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
  // Include entryPrice in range so the line is always visible
  const maxPrice = Math.max(...allHighs, entryPrice);
  const minPrice = Math.min(...allLows, entryPrice);
  const priceRange = maxPrice - minPrice || 1;

  const candleWidth = Math.max(1, (chartW / visible.length) * 0.6);
  const gap = chartW / visible.length;

  const scaleY = (price: number) =>
    padding.top + chartH - ((price - minPrice) / priceRange) * chartH;

  const lastPrice = visible[visible.length - 1]?.close || 0;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      <rect x={0} y={0} width={width} height={height} fill="#0B0E17" rx={8} />

      {/* Grid lines */}
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

      {/* Candles */}
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

      {/* Entry price line (dashed, gold/amber) */}
      {entryPrice > 0 && (
        <>
          <line
            x1={padding.left} y1={scaleY(entryPrice)}
            x2={width - padding.right} y2={scaleY(entryPrice)}
            stroke="#FFD740" strokeWidth={1.5} strokeDasharray="8,4"
            opacity={0.8}
          />
          <rect x={width - padding.right} y={scaleY(entryPrice) - 12} width={80} height={24} rx={4} fill="#FFD740" />
          <text
            x={width - padding.right + 40} y={scaleY(entryPrice) + 4}
            fill="#0B0E17" fontSize={11} fontFamily="'Outfit', monospace" textAnchor="middle" fontWeight="bold"
          >
            {formatPrice(entryPrice)}
          </text>
        </>
      )}

      {/* Current price label (if different from entry) */}
      {lastPrice > 0 && Math.abs(lastPrice - entryPrice) > 0.001 && (
        <>
          <line
            x1={padding.left} y1={scaleY(lastPrice)}
            x2={width - padding.right} y2={scaleY(lastPrice)}
            stroke={lastPrice >= entryPrice ? '#00E676' : '#FF1744'} strokeWidth={1} strokeDasharray="4,4"
            opacity={0.5}
          />
          <rect
            x={width - padding.right}
            y={scaleY(lastPrice) - 10}
            width={80} height={20} rx={4}
            fill={lastPrice >= entryPrice ? '#00E676' : '#FF1744'}
          />
          <text
            x={width - padding.right + 40} y={scaleY(lastPrice) + 4}
            fill="#0B0E17" fontSize={10} fontFamily="'Outfit', monospace" textAnchor="middle" fontWeight="bold"
          >
            {formatPrice(lastPrice)}
          </text>
        </>
      )}
    </svg>
  );
}
