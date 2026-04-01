'use client';

import { useEffect, useRef } from 'react';
import { useGame } from '@/lib/useGame';
import { QRCodeSVG } from 'qrcode.react';
import type { Candle, LeaderboardEntry } from '@/lib/types';

// Эпичная музыка — бесплатные треки
const MUSIC_URL = 'https://cdn.pixabay.com/audio/2022/10/25/audio_33f9de5e3a.mp3'; // epic cinematic

export default function TVPage() {
  const {
    gameState, leaderboard, countdown, roundResult, candles, currentPrice,
    voteData, liquidationAlert, bonusData, finalStats,
    createRoom, startGame,
  } = useGame();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!gameState) createRoom();
  }, [gameState, createRoom]);

  // Музыка
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
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-green-400 text-4xl animate-pulse">Загрузка...</div>
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
      <div className="h-screen bg-black text-white flex flex-col">
        <header className="text-center py-8">
          <h1 className="text-7xl font-black tracking-tight">
            <span className="text-green-400">INVEST</span>
            <span className="text-yellow-400">SOVET</span>
          </h1>
          <p className="text-gray-500 text-xl mt-2">Trading Arena</p>
        </header>

        <div className="flex-1 flex items-center justify-center gap-16 px-8">
          <div className="flex flex-col items-center gap-4">
            <div className="bg-white p-4 rounded-2xl">
              <QRCodeSVG value={joinUrl} size={220} />
            </div>
            <p className="text-5xl font-mono font-bold text-yellow-400 tracking-widest">{roomCode}</p>
            <p className="text-gray-600 text-sm">Отсканируй QR или введи код</p>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 min-w-80">
            <h3 className="text-gray-400 text-lg mb-4">Игроки ({playerNames.length})</h3>
            {playerNames.length === 0 ? (
              <p className="text-gray-600 animate-pulse">Ждём игроков...</p>
            ) : (
              <ul className="space-y-2">
                {playerNames.map((name) => (
                  <li key={name} className="text-xl text-white flex items-center gap-2">
                    <span className="text-green-400">●</span> {name}
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
              className="bg-green-500 text-black font-bold text-2xl px-12 py-4 rounded-xl hover:bg-green-400 transition-all hover:scale-105 active:scale-95"
            >
              СТАРТ
            </button>
          ) : (
            <p className="text-gray-600 text-xl">Минимум 1 игрок</p>
          )}
        </footer>
      </div>
    );
  }

  // --- COUNTDOWN ---
  if (phase === 'countdown') {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center">
        <p className="text-gray-400 text-3xl mb-2">Раунд {gameState.roundNumber}</p>
        <p className="text-yellow-400 text-2xl mb-4">{ticker}</p>
        <div className="text-[200px] font-black text-green-400 animate-pulse leading-none">
          {countdown}
        </div>
      </div>
    );
  }

  // --- TRADING ---
  if (phase === 'trading') {
    return (
      <div className="h-screen bg-black flex flex-col text-white">
        {/* Ликвидация алерт */}
        {liquidationAlert && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white font-bold text-2xl px-8 py-3 rounded-xl z-50 animate-bounce">
            {liquidationAlert}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800">
          <div className="flex items-center gap-4">
            <span className="text-gray-500 text-lg">R{gameState.roundNumber}</span>
            <span className="text-xl font-bold text-yellow-400">{ticker}</span>
            <PriceDisplay price={currentPrice} candles={candles} />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-gray-400 text-sm">LIVE</span>
          </div>
        </div>

        {/* Chart + Leaderboard */}
        <div className="flex-1 flex">
          <div className="flex-1 p-4">
            <CandlestickChart candles={candles} positions={leaderboard} />
          </div>
          <div className="w-[500px] border-l border-gray-800 p-6 overflow-y-auto">
            <h3 className="text-gray-400 text-xl font-bold mb-5 uppercase tracking-wider">Лидерборд</h3>
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
    const timer = bonusData?.timer || gameState.bonusTimer;
    const bonusType = bonusData?.bonusType || gameState.bonusType;
    const bonusResults = bonusData?.results || [];

    const BONUS_TITLES: Record<string, string> = {
      wheel: 'КОЛЕСО ФОРТУНЫ',
      slots: 'СЛОТ-МАШИНА',
      lootbox: 'ЛУТБОКС',
      loto: 'ЛОТО',
    };

    const BONUS_EMOJIS: Record<string, string> = {
      wheel: '🎡',
      slots: '🎰',
      lootbox: '🎁',
      loto: '🎲',
    };

    return (
      <div className="h-screen bg-black text-white flex flex-col items-center justify-center">
        <div className="text-6xl mb-2">{BONUS_EMOJIS[bonusType || 'slots']}</div>
        <h1 className="text-6xl font-black text-yellow-400 mb-2">{BONUS_TITLES[bonusType || 'slots']}</h1>
        <p className="text-gray-400 text-xl mb-4">
          {bonusType === 'wheel' ? 'Игроки крутят колесо...' : bonusType === 'lootbox' ? 'Игроки выбирают коробки...' : bonusType === 'loto' ? 'Игроки выбирают числа...' : 'Игроки крутят барабаны...'}
        </p>
        <p className="text-yellow-400 text-4xl font-mono font-bold mb-8">{timer}с</p>

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
                <div key={nickname} className="flex items-center justify-between bg-gray-900/50 rounded-xl px-6 py-4">
                  <span className="text-xl font-bold">{nickname}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-xl text-gray-300">{detail}</span>
                    <span className={`text-xl font-mono font-bold ${winAmount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {winAmount >= 0 ? '+' : ''}{winAmount.toFixed(0)}$
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {bonusResults.length === 0 && (
          <p className="text-gray-600 text-2xl animate-pulse">Ждём ставки...</p>
        )}
      </div>
    );
  }

  // --- VOTING ---
  if (phase === 'voting') {
    const yes = voteData?.yes || gameState.voteYes;
    const no = voteData?.no || gameState.voteNo;
    const total = voteData?.total || gameState.voteTotal;
    const timer = voteData?.timer || gameState.voteTimer;

    return (
      <div className="h-screen bg-black text-white flex flex-col items-center justify-center">
        <h1 className="text-5xl font-black text-yellow-400 mb-2">РАУНД {gameState.roundNumber} ЗАВЕРШЁН</h1>
        {roundResult && (
          <div className="mb-8 text-center">
            <p className="text-gray-400 text-xl">{roundResult.ticker} — {roundResult.duration}с</p>
            <p className="text-3xl font-bold text-green-400 mt-2">
              🏆 {roundResult.winner.nickname}: {roundResult.winner.totalPnl >= 0 ? '+' : ''}{roundResult.winner.totalPnl.toFixed(0)}$
            </p>
          </div>
        )}

        <div className="bg-gray-900/80 border border-gray-700 rounded-2xl p-10 text-center">
          <h2 className="text-4xl font-black mb-6">СЛЕДУЮЩИЙ РАУНД?</h2>
          <div className="flex gap-12 justify-center mb-6">
            <div className="text-center">
              <p className="text-6xl font-black text-green-400">{yes}</p>
              <p className="text-xl text-green-400 mt-2">ДА</p>
            </div>
            <div className="text-center">
              <p className="text-6xl font-black text-red-400">{no}</p>
              <p className="text-xl text-red-400 mt-2">НЕТ</p>
            </div>
          </div>
          <p className="text-gray-500 text-lg">Проголосовало: {yes + no} / {total}</p>
          <p className="text-yellow-400 text-3xl font-mono font-bold mt-4">{timer}с</p>
        </div>

        {/* Мини-лидерборд */}
        <div className="mt-8 w-full max-w-xl">
          {leaderboard.slice(0, 5).map((entry, i) => (
            <div key={entry.nickname} className="flex justify-between px-4 py-2 text-lg">
              <span className={i === 0 ? 'text-yellow-400 font-bold' : 'text-gray-300'}>
                {i + 1}. {entry.nickname}
              </span>
              <span className="font-mono font-bold">${entry.balance.toFixed(0)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- FINISHED ---
  if (phase === 'finished') {
    const stats = finalStats.length > 0 ? finalStats : leaderboard.map((e, i) => ({
      nickname: e.nickname, rank: i + 1, balance: e.balance,
      maxBalance: e.balance, worstTrade: 0, bestTrade: 0, totalTrades: 0, liquidations: 0,
    }));
    const medals = ['🏆', '🥈', '🥉'];

    return (
      <div className="h-screen bg-black text-white flex flex-col items-center justify-center overflow-y-auto">
        <h1 className="text-6xl font-black text-yellow-400 mb-6 mt-8">ИГРА ОКОНЧЕНА</h1>

        <div className="w-full max-w-3xl px-4">
          <table className="w-full text-left">
            <thead>
              <tr className="text-gray-500 text-sm">
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
              {stats.map((s) => (
                <tr key={s.nickname} className={`border-t border-gray-800 ${s.rank === 1 ? 'text-yellow-400 text-xl' : 'text-lg'}`}>
                  <td className="py-4 font-bold">{s.rank <= 3 ? medals[s.rank - 1] : s.rank}</td>
                  <td className="py-4 font-bold">{s.nickname}</td>
                  <td className="py-4 text-right font-mono font-bold">${s.balance.toFixed(0)}</td>
                  <td className="py-4 text-right font-mono text-green-400">${s.maxBalance.toFixed(0)}</td>
                  <td className="py-4 text-right font-mono text-green-400">+{s.bestTrade.toFixed(0)}</td>
                  <td className="py-4 text-right font-mono text-red-400">{s.worstTrade.toFixed(0)}</td>
                  <td className="py-4 text-right font-mono">{s.totalTrades}</td>
                  <td className="py-4 text-right font-mono text-red-400">{s.liquidations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black flex items-center justify-center text-white text-2xl">
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
      <span className={`text-3xl font-mono font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
        {formatPrice(price)}
      </span>
      <span className={`text-lg font-mono ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
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
      <rect x={0} y={0} width={width} height={height} fill="#0a0a0a" rx={8} />

      {[0.25, 0.5, 0.75].map((pct) => {
        const price = minPrice + priceRange * pct;
        const y = scaleY(price);
        return (
          <g key={pct}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#1a1a2e" strokeWidth={1} />
            <text x={width - padding.right + 5} y={y + 4} fill="#555" fontSize={11} fontFamily="monospace">
              {formatPrice(price)}
            </text>
          </g>
        );
      })}

      {visible.map((candle, i) => {
        const x = padding.left + i * gap + gap / 2;
        const isGreen = candle.close >= candle.open;
        const color = isGreen ? '#22c55e' : '#ef4444';
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
        stroke="#fbbf24" strokeWidth={1} strokeDasharray="4,4"
      />
      <rect x={width - padding.right} y={scaleY(lastPrice) - 10} width={75} height={20} rx={4} fill="#fbbf24" />
      <text
        x={width - padding.right + 37} y={scaleY(lastPrice) + 4}
        fill="black" fontSize={11} fontFamily="monospace" textAnchor="middle" fontWeight="bold"
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
        const color = isLong ? '#22c55e' : '#ef4444';
        const arrow = isLong ? '▲' : '▼';
        // Offset multiple markers vertically
        const yOffset = idx * 18;
        return (
          <g key={p.nickname}>
            <line x1={x} y1={y} x2={width - padding.right} y2={y} stroke={color} strokeWidth={0.8} strokeDasharray="3,3" opacity={0.5} />
            <circle cx={x} cy={y} r={5} fill={color} />
            <text x={x + 8} y={y - 8 - yOffset} fill={color} fontSize={12} fontFamily="sans-serif" fontWeight="bold">
              {arrow} {p.nickname}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LeaderboardRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const medals = ['🏆', '🥈', '🥉'];
  const rankDisplay = rank <= 3 ? medals[rank - 1] : `${rank}`;
  const medalColors = ['text-yellow-400', 'text-gray-400', 'text-orange-400'];
  const rankColor = rank <= 3 ? medalColors[rank - 1] : 'text-gray-600';

  return (
    <div className="flex items-center gap-4 bg-gray-900/50 rounded-xl px-5 py-3">
      <span className={`font-bold text-2xl w-10 text-center ${rankColor}`}>{rankDisplay}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-white font-semibold text-xl truncate">{entry.nickname}</p>
          {entry.hasPosition && (
            <span className={`text-sm px-2 py-0.5 rounded font-bold ${entry.positionDirection === 'long' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {entry.positionDirection === 'long' ? 'LONG' : 'SHORT'}
              {entry.positionLeverage && entry.positionLeverage > 1 ? ` x${entry.positionLeverage}` : ''}
            </span>
          )}
        </div>
      </div>
      <div className="text-right">
        <p className="font-mono font-bold text-xl text-white">${entry.balance.toFixed(0)}</p>
        <p className={`font-mono text-sm ${entry.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {entry.totalPnl >= 0 ? '+' : ''}{entry.totalPnl.toFixed(0)}$
        </p>
      </div>
    </div>
  );
}

function formatPrice(price: number): string {
  if (price < 0.001) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  if (price < 100) return price.toFixed(2);
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
