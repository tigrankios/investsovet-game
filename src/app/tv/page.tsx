'use client';

import { useEffect, useRef, useState } from 'react';
import { useGame } from '@/lib/useGame';
import { QRCodeSVG } from 'qrcode.react';
import type { Candle, LeaderboardEntry, GameMode } from '@/lib/types';

// Эпичная музыка — бесплатные треки
const MUSIC_URL = 'https://cdn.pixabay.com/audio/2022/10/25/audio_33f9de5e3a.mp3'; // epic cinematic

export default function TVPage() {
  const {
    gameState, leaderboard, countdown, roundResult, candles, currentPrice,
    voteData, liquidationAlert, bonusData, finalStats, mmResult, mmPushAlert,
    createRoom, startGame,
  } = useGame();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [modeSelected, setModeSelected] = useState(false);

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

  // --- MODE SELECTION ---
  if (!modeSelected || !gameState) {
    const selectMode = (mode: GameMode) => {
      setModeSelected(true);
      createRoom(mode);
    };

    if (gameState) {
      // Already created, skip selection
    } else {
      return (
        <div className="h-screen bg-background text-white flex flex-col items-center justify-center">
          <h1 className="text-7xl font-display font-black tracking-tight mb-2">
            <span className="font-display text-accent-green">INVEST</span>
            <span className="font-display text-accent-gold">SOVET</span>
          </h1>
          <p className="text-text-secondary text-xl mb-16">Trading Arena</p>

          <h2 className="text-3xl font-bold text-text-primary mb-8">ВЫБЕРИ РЕЖИМ</h2>

          <div className="flex gap-8">
            <button
              onClick={() => selectMode('classic')}
              className="group glass-strong border-2 border-accent-green/50 rounded-2xl p-8 w-72 text-center hover:border-accent-green hover:bg-surface-light transition-all hover:scale-105 active:scale-95"
            >
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-2xl font-display font-black text-accent-green mb-2">КЛАССИЧЕСКИЙ</h3>
              <p className="text-text-secondary">Все против всех. Торгуй, используй скиллы, доминируй.</p>
            </button>

            <button
              onClick={() => selectMode('market_maker')}
              className="group glass-strong border-2 border-accent-gold/50 rounded-2xl p-8 w-72 text-center hover:border-accent-gold hover:bg-surface-light transition-all hover:scale-105 active:scale-95"
            >
              <div className="text-6xl mb-4">👑</div>
              <h3 className="text-2xl font-display font-black text-accent-gold mb-2">МАРКЕТ-МЕЙКЕР</h3>
              <p className="text-text-secondary">Один игрок управляет рынком. Остальные — против него.</p>
            </button>
          </div>
        </div>
      );
    }
  }

  if (!gameState) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-accent-green text-4xl font-display animate-pulse">Загрузка...</div>
      </div>
    );
  }

  const { phase, roomCode, ticker, playerNames } = gameState;
  const isMMMode = gameState.gameMode === 'market_maker';
  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/play?room=${roomCode}`
    : '';

  // --- LOBBY ---
  if (phase === 'lobby') {
    return (
      <div className="h-screen bg-background text-white flex flex-col">
        <header className="text-center py-8">
          <h1 className="text-7xl font-display font-black tracking-tight">
            <span className="font-display text-accent-green">INVEST</span>
            <span className="font-display text-accent-gold">SOVET</span>
          </h1>
          <p className="text-text-secondary text-xl mt-2">
            {isMMMode ? '👑 Режим: Маркет-Мейкер' : 'Trading Arena'}
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
            {isMMMode && playerNames.length > 0 && (
              <p className="text-accent-gold/70 text-sm mt-4">👑 Случайный игрок станет Маркет-Мейкером</p>
            )}
          </div>
        </div>

        <footer className="text-center py-6">
          {playerNames.length >= 1 ? (
            <button
              onClick={startGame}
              className="bg-accent-green text-black font-display font-bold text-2xl px-12 py-4 rounded-xl hover:bg-accent-green/90 transition-all hover:scale-105 active:scale-95 glow-green animate-glow-pulse"
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
        {isMMMode && gameState.marketMakerNickname && (
          <p className="text-accent-gold text-3xl font-bold mb-4 animate-pulse">
            👑 МАРКЕТ-МЕЙКЕР: {gameState.marketMakerNickname}
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
        {/* Ликвидация алерт */}
        {liquidationAlert && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-accent-red text-white font-bold text-2xl px-8 py-3 rounded-xl z-50 animate-alert">
            {liquidationAlert}
          </div>
        )}

        {/* MM Push алерт */}
        {mmPushAlert && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-accent-gold text-black font-bold text-2xl px-8 py-3 rounded-xl z-50 animate-alert">
            {mmPushAlert}
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
            {isMMMode && (
              <span className="text-accent-gold text-sm font-bold mr-3">👑 MM: {gameState.marketMakerNickname}</span>
            )}
            <span className="w-2 h-2 bg-accent-green rounded-full animate-pulse" />
            <span className="text-text-secondary text-sm">LIVE</span>
          </div>
        </div>

        {/* Chart + Leaderboard */}
        <div className="flex-1 flex">
          <div className="flex-1 p-4">
            <CandlestickChart candles={candles} positions={leaderboard} />
          </div>
          <div className="w-[500px] border-l border-border p-6 overflow-y-auto">
            <h3 className="text-text-secondary text-xl font-display font-bold mb-5 uppercase tracking-wider">Лидерборд</h3>
            <div className="space-y-3">
              {leaderboard.map((entry, i) => (
                <LeaderboardRow key={entry.nickname} entry={entry} rank={i + 1} isMMMode={isMMMode} />
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
      <div className="h-screen bg-background text-white flex flex-col items-center justify-center">
        <div className="text-6xl mb-2">{BONUS_EMOJIS[bonusType || 'slots']}</div>
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

  // --- VOTING ---
  if (phase === 'voting') {
    const yes = voteData?.yes || gameState.voteYes;
    const no = voteData?.no || gameState.voteNo;
    const total = voteData?.total || gameState.voteTotal;
    const timer = voteData?.timer || gameState.voteTimer;

    return (
      <div className="h-screen bg-background text-white flex flex-col items-center justify-center">
        <h1 className="text-5xl font-display font-black text-accent-gold mb-2">РАУНД {gameState.roundNumber} ЗАВЕРШЁН</h1>
        {roundResult && (
          <div className="mb-8 text-center">
            <p className="text-text-secondary text-xl">{roundResult.ticker} — {roundResult.duration}с</p>
            <p className="text-3xl font-bold text-accent-green mt-2">
              🏆 {roundResult.winner.nickname}: {roundResult.winner.totalPnl >= 0 ? '+' : ''}{roundResult.winner.totalPnl.toFixed(0)}$
            </p>
          </div>
        )}

        <div className="glass-strong border border-border-light rounded-2xl p-10 text-center">
          <h2 className="text-4xl font-display font-black mb-6">СЛЕДУЮЩИЙ РАУНД?</h2>
          <div className="flex gap-12 justify-center mb-6">
            <div className="text-center">
              <p className="text-6xl font-display font-black text-accent-green">{yes}</p>
              <p className="text-xl text-accent-green mt-2">ДА</p>
            </div>
            <div className="text-center">
              <p className="text-6xl font-display font-black text-accent-red">{no}</p>
              <p className="text-xl text-accent-red mt-2">НЕТ</p>
            </div>
          </div>
          <p className="text-text-secondary text-lg">Проголосовало: {yes + no} / {total}</p>
          <p className="text-accent-gold text-3xl font-mono font-bold mt-4">{timer}с</p>
        </div>

        {/* Мини-лидерборд */}
        <div className="mt-8 w-full max-w-xl">
          {leaderboard.slice(0, 5).map((entry, i) => (
            <div key={entry.nickname} className="flex justify-between px-4 py-2 text-lg">
              <span className={i === 0 ? 'text-accent-gold font-bold' : 'text-text-primary'}>
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
      role: e.role,
    }));
    const medals = ['🏆', '🥈', '🥉'];

    return (
      <div className="h-screen bg-background text-white flex flex-col items-center justify-center overflow-y-auto">
        {/* Market Maker Result */}
        {isMMMode && mmResult && (
          <div className={`w-full max-w-3xl mb-6 mt-4 rounded-2xl p-6 text-center border-2 ${mmResult.mmWon ? 'bg-accent-gold/10 border-accent-gold/50' : 'bg-accent-green/10 border-accent-green/50'}`}>
            <h2 className="text-4xl font-display font-black mb-3">
              {mmResult.mmWon ? '👑 МАРКЕТ-МЕЙКЕР ПОБЕДИЛ!' : '💪 ТРЕЙДЕРЫ ПОБЕДИЛИ!'}
            </h2>
            <div className="flex justify-center gap-12 text-xl">
              <div>
                <span className="text-accent-gold font-bold">👑 {mmResult.mmNickname}</span>
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
                const isMM = isMMMode && s.role === 'market_maker';
                return (
                  <tr key={s.nickname} className={`border-t border-border ${s.rank === 1 ? 'text-accent-gold text-xl' : 'text-lg'} ${isMM ? 'bg-accent-gold/5' : ''}`}>
                    <td className="py-4 font-bold">{s.rank <= 3 ? medals[s.rank - 1] : s.rank}</td>
                    <td className="py-4 font-bold">
                      {isMM && '👑 '}{s.nickname}
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
        // Offset multiple markers vertically
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

function LeaderboardRow({ entry, rank, isMMMode = false }: { entry: LeaderboardEntry; rank: number; isMMMode?: boolean }) {
  const medals = ['🏆', '🥈', '🥉'];
  const rankDisplay = rank <= 3 ? medals[rank - 1] : `${rank}`;
  const medalColors = ['text-accent-gold', 'text-text-secondary', 'text-amber-400'];
  const rankColor = rank <= 3 ? medalColors[rank - 1] : 'text-text-muted';
  const isMM = isMMMode && entry.role === 'market_maker';

  return (
    <div className={`flex items-center gap-4 rounded-xl px-5 py-3 ${isMM ? 'bg-accent-gold/10 border border-accent-gold/30' : 'glass'}`}>
      <span className={`font-bold text-2xl w-10 text-center ${rankColor}`}>{rankDisplay}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {isMM && <span className="text-lg">👑</span>}
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

function formatPrice(price: number): string {
  if (price < 0.001) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  if (price < 100) return price.toFixed(2);
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
