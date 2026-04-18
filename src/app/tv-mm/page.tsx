'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useGame, getSocket } from '@/lib/useGame';
import { QRCodeSVG } from 'qrcode.react';
import { BONUS_TITLES } from '@/lib/types';
import type { Candle, LeaderboardEntry } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import { IconChart, IconTrophy, IconSilver, IconBronze, IconCrown, IconFinish, BONUS_ICON_MAP } from '@/components/icons';

const MUSIC_URL = 'https://cdn.pixabay.com/audio/2022/10/25/audio_33f9de5e3a.mp3';

export default function TVMMPage() {
  const {
    gameState, leaderboard, countdown, roundResult, candles, currentPrice,
    liquidationAlert, bonusData, finalStats, roomClosed,
    createRoom, startGame, selectGameMode, returnToLobby, closeRoom,
  } = useGame();

  // MM-specific state (previously from useMarketMakerGame)
  const [mmResult, setMmResult] = useState<{ mmWon: boolean; mmBalance: number; tradersAvg: number; mmNickname: string } | null>(null);
  const [mmLeverAlert, setMmLeverAlert] = useState('');

  useEffect(() => {
    const socket = getSocket();

    socket.on('mmLeverUsed', ({ lever, duration }: { lever: string; duration: number }) => {
      const names: Record<string, string> = {
        commission: 'КОМИССИЯ x3',
        freeze: 'ЗАМОРОЗКА',
        squeeze: 'СЖАТИЕ',
      };
      setMmLeverAlert(`${names[lever] || lever} (${duration}s)`);
      setTimeout(() => setMmLeverAlert(''), duration * 1000);
    });

    socket.on('mmInactivityPenalty', () => {
      setMmLeverAlert('ММ БЕЗДЕЙСТВУЕТ! +$200 бонус!');
      setTimeout(() => setMmLeverAlert(''), 3000);
    });

    socket.on('marketMakerResult', (data: { mmWon: boolean; mmBalance: number; tradersAvg: number; mmNickname: string }) => setMmResult(data));

    return () => {
      socket.off('mmLeverUsed');
      socket.off('mmInactivityPenalty');
      socket.off('marketMakerResult');
    };
  }, []);
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Redirect on room closed
  useEffect(() => {
    if (roomClosed) {
      const t = setTimeout(() => router.push('/'), 3000);
      return () => clearTimeout(t);
    }
  }, [roomClosed, router]);

  // Auto-create market_maker room on mount
  useEffect(() => {
    if (!gameState) {
      createRoom('market_maker');
    }
  }, []);

  // Music
  useEffect(() => {
    if (!gameState) return;
    if (gameState.phase === 'trading' || gameState.phase === 'countdown') {
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

  if (!gameState) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-accent-green text-4xl font-display animate-pulse">Загрузка...</div>
      </div>
    );
  }

  if (roomClosed) {
    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center">
        <h2 className="text-3xl font-display font-bold text-accent-red mb-4">Комната закрыта</h2>
        <p className="text-text-secondary">{roomClosed}</p>
        <p className="text-text-muted mt-4">Перенаправление на главную...</p>
      </div>
    );
  }

  const { phase, roomCode, ticker, playerNames } = gameState;
  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/play?room=${roomCode}`
    : '';

  // --- LOBBY ---
  if (phase === 'lobby') {
    return (
      <div className="h-screen bg-background text-white flex flex-col relative">
        <Link href="/" className="absolute top-4 left-4 text-sm text-text-secondary hover:text-white transition-colors z-10">&larr; Назад</Link>
        <button
          onClick={closeRoom}
          className="absolute top-4 right-4 text-sm text-text-muted hover:text-accent-red transition-colors"
        >
          Закрыть комнату
        </button>
        <header className="text-center py-8">
          <h1 className="text-7xl font-display font-black tracking-tight">
            <span className="font-display text-accent-green" style={{ textShadow: '0 0 40px rgba(0,230,118,0.4)' }}>INVEST</span>
            <span className="font-display text-accent-gold" style={{ textShadow: '0 0 40px rgba(255,215,64,0.4)' }}>SOVET</span>
          </h1>
          <p className="text-accent-gold text-xl mt-2 inline-flex items-center gap-1">
            <IconCrown size={16} /> Режим: Маркет-Мейкер
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
            {playerNames.length > 0 && (
              <p className="text-accent-gold/70 text-sm mt-4">Случайный игрок станет Маркет-Мейкером</p>
            )}

            {/* Mode selector */}
            <div className="mt-6">
              <p className="text-text-secondary text-sm font-semibold uppercase tracking-wider mb-2">Режим</p>
              <div className="flex gap-2 flex-wrap">
                {([
                  { mode: 'classic' as const, label: 'Классика', color: 'from-accent-gold to-amber-500' },
                  { mode: 'market_maker' as const, label: 'Маркет-Мейкер', color: 'from-accent-purple to-purple-500' },
                  { mode: 'binary' as const, label: 'Бинарные', color: 'from-accent-gold to-orange-500' },
                  { mode: 'draw' as const, label: 'Нарисуй график', color: 'from-accent-purple to-violet-500' },
                ]).map(({ mode, label, color }) => (
                  <button
                    key={mode}
                    onClick={() => selectGameMode(mode)}
                    className={`px-4 py-2 rounded-lg font-display font-bold text-sm transition-all ${
                      gameState.gameMode === mode
                        ? `bg-gradient-to-r ${color} text-white scale-105`
                        : 'bg-surface border border-border text-text-secondary hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <footer className="text-center py-6">
          {playerNames.length >= 1 ? (
            <button
              onClick={startGame}
              className="bg-accent-green text-white font-display font-bold text-2xl px-12 py-4 rounded-xl hover:bg-accent-green/90 transition-all hover:scale-105 active:scale-95 glow-green animate-glow-pulse"
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
        <p className="text-text-secondary text-3xl mb-2">Раунд {gameState.roundNumber}</p>
        <p className="text-accent-gold text-2xl mb-4">{ticker}</p>
        {gameState.marketMakerNickname && (
          <p className="text-accent-gold text-3xl font-bold mb-4 animate-pulse flex items-center justify-center gap-2">
            <IconCrown size={20} /> МАРКЕТ-МЕЙКЕР: {gameState.marketMakerNickname}
          </p>
        )}
        <div className="text-[200px] font-display font-black text-accent-green animate-countdown leading-none" style={{ textShadow: '0 0 80px rgba(0,230,118,0.5)' }}>
          {countdown}
        </div>
      </div>
    );
  }

  // --- TRADING ---
  if (phase === 'trading') {
    return (
      <div className="h-screen bg-background flex flex-col text-white">
        {/* Liquidation alert */}
        {liquidationAlert && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-accent-red text-white font-bold text-2xl px-8 py-3 rounded-xl z-50 animate-alert">
            {liquidationAlert}
          </div>
        )}

        {/* MM Lever alert */}
        {mmLeverAlert && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-accent-gold text-black font-bold text-2xl px-8 py-3 rounded-xl z-50 animate-alert">
            {mmLeverAlert}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border">
          <div className="flex items-center gap-4">
            <span className="text-text-secondary text-lg">R{gameState.roundNumber}</span>
            <span className="text-xl font-bold text-accent-gold">{ticker}</span>
            <PriceDisplay price={currentPrice} candles={candles} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-accent-gold text-sm font-mono font-bold mr-3">
              ${gameState.mmBalance.toFixed(0)}
            </span>
            <span className="text-accent-gold text-sm font-bold mr-3 inline-flex items-center gap-1"><IconCrown size={14} /> MM: {gameState.marketMakerNickname}</span>
            <span className="w-2 h-2 bg-accent-green rounded-full animate-pulse" />
            <span className="text-text-secondary text-sm">LIVE</span>
          </div>
        </div>

        {/* MM Active Effects */}
        {gameState.mmLevers && (
          <div className="flex gap-2 px-6 py-1">
            {gameState.mmLevers.commission.active && (
              <span className="bg-accent-red/20 border border-accent-red/50 rounded px-3 py-1 text-accent-red text-sm font-bold animate-pulse">
                КОМИССИЯ x3 ({gameState.mmLevers.commission.ticksLeft}s)
              </span>
            )}
            {gameState.mmLevers.freeze.active && (
              <span className="bg-blue-600/20 border border-blue-500/50 rounded px-3 py-1 text-blue-400 text-sm font-bold animate-pulse">
                ЗАМОРОЗКА ({gameState.mmLevers.freeze.ticksLeft}s)
              </span>
            )}
            {gameState.mmLevers.squeeze.active && (
              <span className="bg-accent-gold/20 border border-accent-gold/50 rounded px-3 py-1 text-accent-gold text-sm font-bold animate-pulse">
                СЖАТИЕ ({gameState.mmLevers.squeeze.ticksLeft}s)
              </span>
            )}
          </div>
        )}

        {/* Chart + Leaderboard */}
        <div className="flex-1 flex">
          <div className="flex-1 p-4 relative">
            {gameState.blindActive ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/95 rounded-xl">
                <span className="text-[120px] leading-none mb-4">🙈</span>
                <p className="text-5xl font-display font-black text-accent-gold animate-pulse">СЛЕПОЙ ТРЕЙД!</p>
              </div>
            ) : null}
            <CandlestickChart candles={candles} positions={leaderboard} />
          </div>
          <div className="w-[500px] border-l border-border p-6 overflow-y-auto">
            <h3 className="text-text-secondary text-xl font-display font-bold mb-5 uppercase tracking-wider">Лидерборд</h3>
            <div className="space-y-3">
              {leaderboard.map((entry, i) => (
                <LeaderboardRow key={entry.nickname} entry={entry} rank={i + 1} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- BONUS ---
  if (phase === 'bonus') {
    const timer = bonusData?.timer ?? gameState.bonusTimer;
    const bonusType = bonusData?.bonusType ?? gameState.bonusType;
    const bonusResults = bonusData?.results || [];

    return (
      <div className="h-screen bg-background text-white flex flex-col items-center justify-center">
        <div className="mb-2">{BONUS_ICON_MAP[bonusType || 'slots']?.({ size: 48 })}</div>
        <h1 className="text-6xl font-display font-black text-accent-gold mb-2">{BONUS_TITLES[bonusType || 'slots']}</h1>
        <p className="text-text-secondary text-xl mb-4">
          {bonusType === 'wheel' ? 'Игроки крутят колесо...' : bonusType === 'lootbox' ? 'Игроки выбирают коробки...' : bonusType === 'loto' ? 'Игроки выбирают числа...' : 'Игроки крутят барабаны...'}
        </p>
        <p className="text-accent-gold text-4xl font-mono font-bold mb-8">{timer}с</p>

        {bonusResults.length > 0 && (
          <div className="w-full max-w-2xl space-y-3">
            {bonusResults.map(({ nickname, result }) => {
              const { winAmount, multiplier } = result.result;
              let detail = '';
              if (result.type === 'slots') {
                detail = result.result.reels.join(' ');
              } else if (result.type === 'wheel') {
                detail = `Сектор: ${multiplier > 0 ? `x${multiplier}` : 'BUST'}`;
              } else if (result.type === 'lootbox') {
                detail = `Коробка ${result.result.chosenIndex + 1}: ${multiplier > 0 ? `x${multiplier}` : 'BUST'}`;
              } else if (result.type === 'loto') {
                detail = `${result.result.matches}/5 совпадений`;
              }

              return (
                <div key={nickname} className="flex items-center justify-between glass rounded-xl px-6 py-4">
                  <span className="text-xl font-bold">{nickname}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-xl text-text-primary">{detail}</span>
                    <span className={`text-xl font-mono font-bold ${winAmount >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                      {winAmount >= 0 ? '+' : ''}{winAmount.toFixed(0)}$
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {bonusResults.length === 0 && (
          <p className="text-text-muted text-2xl animate-pulse">Ждём ставки...</p>
        )}
      </div>
    );
  }

  // --- FINISHED ---
  if (phase === 'finished') {
    const stats = finalStats.length > 0 ? finalStats : leaderboard.map((e, i) => ({
      nickname: e.nickname, rank: i + 1, balance: e.balance,
      maxBalance: e.balance, worstTrade: 0, bestTrade: 0, totalTrades: 0, liquidations: 0,
      role: e.role,
    }));
    return (
      <div className="h-screen bg-background text-white flex flex-col items-center justify-center overflow-y-auto">
        {/* Market Maker Result */}
        {mmResult && (
          <div className={`w-full max-w-3xl mb-6 mt-4 rounded-2xl p-6 text-center border-2 ${mmResult.mmWon ? 'bg-accent-gold/10 border-accent-gold/50' : 'bg-accent-green/10 border-accent-green/50'}`}>
            <h2 className="text-4xl font-display font-black mb-3 flex items-center justify-center gap-2">
              {mmResult.mmWon ? <><IconCrown size={24} /> МАРКЕТ-МЕЙКЕР ПОБЕДИЛ!</> : 'ТРЕЙДЕРЫ ПОБЕДИЛИ!'}
            </h2>
            <div className="flex justify-center gap-12 text-xl">
              <div>
                <span className="text-accent-gold font-bold inline-flex items-center gap-1"><IconCrown size={14} /> {mmResult.mmNickname}</span>
                <span className="font-mono ml-2">${mmResult.mmBalance.toFixed(0)}</span>
              </div>
              <span className="text-text-secondary">vs</span>
              <div>
                <span className="text-accent-green font-bold">Трейдеры (avg)</span>
                <span className="font-mono ml-2">${mmResult.tradersAvg.toFixed(0)}</span>
              </div>
            </div>
          </div>
        )}

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
                <th className="pb-3 text-right">Сделки</th>
                <th className="pb-3 text-right">Ликв.</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => {
                const isMM = s.role === 'market_maker';
                return (
                  <tr key={s.nickname} className={`border-t border-border ${s.rank === 1 ? 'text-accent-gold text-xl' : 'text-lg'} ${isMM ? 'bg-accent-gold/5' : ''}`}>
                    <td className="py-4 font-bold">{s.rank === 1 ? <IconTrophy size={24} /> : s.rank === 2 ? <IconSilver size={24} /> : s.rank === 3 ? <IconBronze size={24} /> : s.rank}</td>
                    <td className="py-4 font-bold">
                      <span className="inline-flex items-center gap-1">{isMM && <IconCrown size={14} />}{s.nickname}</span>
                    </td>
                    <td className="py-4 text-right font-mono font-bold">${s.balance.toFixed(0)}</td>
                    <td className="py-4 text-right font-mono text-accent-green">${s.maxBalance.toFixed(0)}</td>
                    <td className="py-4 text-right font-mono text-accent-green">+{s.bestTrade.toFixed(0)}</td>
                    <td className="py-4 text-right font-mono text-accent-red">{s.worstTrade.toFixed(0)}</td>
                    <td className="py-4 text-right font-mono">{s.totalTrades}</td>
                    <td className="py-4 text-right font-mono text-accent-red">{s.liquidations}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button
          onClick={returnToLobby}
          className="mt-6 bg-gradient-to-r from-accent-gold to-amber-500 text-background font-display font-bold text-xl py-4 px-8 rounded-xl hover:scale-105 transition-all"
        >
          В ЛОББИ
        </button>
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

function PriceDisplay({ price, candles }: { price: number; candles: Candle[] }) {
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

function CandlestickChart({ candles, positions = [] }: { candles: Candle[]; positions?: LeaderboardEntry[] }) {
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
        const arrow = isLong ? '▲' : '▼';
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

function LeaderboardRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const rankDisplay = rank === 1 ? <IconTrophy size={24} /> : rank === 2 ? <IconSilver size={24} /> : rank === 3 ? <IconBronze size={24} /> : `${rank}`;
  const medalColors = ['text-accent-gold', 'text-text-secondary', 'text-amber-400'];
  const rankColor = rank <= 3 ? medalColors[rank - 1] : 'text-text-muted';
  const isMM = entry.role === 'market_maker';

  return (
    <div className={`flex items-center gap-4 rounded-xl px-5 py-3 ${isMM ? 'bg-accent-gold/10 border border-accent-gold/30' : 'glass'}`}>
      <span className={`font-bold text-2xl w-10 text-center ${rankColor}`}>{rankDisplay}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {isMM && <IconCrown size={16} />}
          <p className="text-white font-semibold text-xl truncate">{entry.nickname}</p>
          {entry.hasPosition && (
            <span className={`text-sm px-2 py-0.5 rounded font-bold ${entry.positionDirection === 'long' ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-red/20 text-accent-red'}`}>
              {entry.positionDirection === 'long' ? 'LONG' : 'SHORT'}
              {entry.positionLeverage && entry.positionLeverage > 1 ? ` x${entry.positionLeverage}` : ''}
            </span>
          )}
        </div>
      </div>
      <div className="text-right">
        <p className="font-mono font-bold text-xl text-white">${entry.balance.toFixed(0)}</p>
        <p className={`font-mono text-sm ${entry.totalPnl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
          {entry.totalPnl >= 0 ? '+' : ''}{entry.totalPnl.toFixed(0)}$
        </p>
      </div>
    </div>
  );
}
