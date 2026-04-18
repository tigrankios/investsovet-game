'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSocket } from '@/lib/useGame';
import { MAX_POSITION_PERCENT } from '@/lib/types';
import type { ClientGameState, ClientPlayerState, LeaderboardEntry, Candle, Leverage, MMLeverType } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import { IconLong, IconShort, IconCrown } from '@/components/icons';
import { MiniChart } from '@/components/charts/MiniChart';

interface MarketMakerPlayProps {
  gameState: ClientGameState;
  playerState: ClientPlayerState;
  leaderboard: LeaderboardEntry[];
  candles: Candle[];
  currentPrice: number;
  nickname: string;
  openPosition: (direction: 'long' | 'short', size: number, leverage: Leverage) => void;
  closePosition: () => void;
  tradeMessage: string;
  liquidationAlert: string;
}

export function MarketMakerPlay({
  gameState, playerState, leaderboard, candles, currentPrice, nickname,
  openPosition, closePosition, tradeMessage, liquidationAlert,
}: MarketMakerPlayProps) {
  const [sizePercent, setSizePercent] = useState(25);
  const [leverage, setLeverage] = useState<Leverage>(25);

  // MM-specific state (from useMarketMakerGame)
  const [mmLeverAlert, setMmLeverAlert] = useState('');
  const [mmRentAlert, setMmRentAlert] = useState('');

  // MM-specific socket listeners
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

    socket.on('mmRentTick', ({ amount }: { amount: number }) => {
      setMmRentAlert(`-$${amount}`);
      setTimeout(() => setMmRentAlert(''), 1500);
    });

    socket.on('mmInactivityPenalty', () => {
      setMmLeverAlert('ММ БЕЗДЕЙСТВУЕТ! +$200 бонус!');
      setTimeout(() => setMmLeverAlert(''), 3000);
    });

    return () => {
      socket.off('mmLeverUsed');
      socket.off('mmRentTick');
      socket.off('mmInactivityPenalty');
    };
  }, []);

  // MM actions
  const useMMLever = useCallback((lever: MMLeverType) => {
    getSocket().emit('useMMLever', { lever });
  }, []);

  const mmPushUp = useCallback(() => {
    getSocket().emit('mmPush', { direction: 'up' });
  }, []);

  const mmPushDown = useCallback(() => {
    getSocket().emit('mmPush', { direction: 'down' });
  }, []);

  // Auto-select leverage if current became unavailable
  useEffect(() => {
    const avail = gameState.availableLeverages;
    if (avail && avail.length > 0 && !avail.includes(leverage)) {
      setLeverage(avail[0]);
    }
  }, [gameState.roundNumber]);

  const balance = playerState.balance;
  const position = playerState.position;
  const unrealizedPnl = playerState.unrealizedPnl;
  const totalBalance = balance + (unrealizedPnl || 0);
  const tradeSize = Math.floor(balance * sizePercent / 100);

  return (
    <div className="min-h-screen bg-background text-white flex flex-col">
      {/* Toast alerts */}
      {tradeMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-surface-light border border-border-light rounded-lg px-4 py-2 text-sm z-50">
          {tradeMessage}
        </div>
      )}
      {liquidationAlert && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-accent-red text-white font-bold rounded-lg px-4 py-2 z-50 animate-alert">
          {liquidationAlert}
        </div>
      )}
      {mmLeverAlert && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-accent-gold text-black font-bold rounded-lg px-4 py-2 z-50 animate-alert">
          {mmLeverAlert}
        </div>
      )}
      {mmRentAlert && playerState.role === 'trader' && (
        <div className="absolute top-2 right-4 text-accent-red font-mono font-bold text-sm z-50 animate-ping">
          {mmRentAlert}
        </div>
      )}

      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-text-secondary text-xs uppercase">
              {playerState.role === 'market_maker' ? 'MM Баланс' : 'Баланс'}
            </p>
            <p className={`text-2xl font-mono font-bold ${playerState.role === 'market_maker' ? 'text-accent-gold' : ''}`}>
              ${totalBalance.toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-text-secondary text-xs uppercase">PnL</p>
            <p className={`text-2xl font-mono font-bold ${playerState.pnl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
              {playerState.pnl >= 0 ? '+' : ''}{playerState.pnl.toFixed(2)}$
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-3 mt-3">
          <span className="text-accent-gold font-bold">{gameState.ticker}</span>
          <span className="text-xl font-mono font-bold">{formatPrice(currentPrice)}</span>
        </div>
      </div>

      {/* Chart */}
      {candles.length > 0 && (
        <div className="mx-2 mt-2 rounded-xl overflow-hidden" style={{ height: '40vw', maxHeight: '220px', minHeight: '140px' }}>
          <MiniChart candles={candles} positions={leaderboard} />
        </div>
      )}

      {/* Position */}
      {position && (
        <div className={`mx-4 mt-2 p-3 rounded-xl border ${
          position.direction === 'long' ? 'bg-accent-green/10 border-accent-green/30' : 'bg-accent-red/10 border-accent-red/30'
        }`}>
          <div className="flex justify-between items-center">
            <div>
              <span className={`font-bold ${position.direction === 'long' ? 'text-accent-green' : 'text-accent-red'}`}>
                {position.direction === 'long' ? 'LONG' : 'SHORT'} x{position.leverage}
              </span>
              <span className="text-text-secondary ml-2">${position.size}</span>
            </div>
            <div className="text-right">
              <p className={`font-mono font-bold ${unrealizedPnl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                {unrealizedPnl >= 0 ? '+' : ''}{unrealizedPnl.toFixed(2)}$
              </p>
              <p className="text-text-secondary text-xs">Ликв: {formatPrice(position.liquidationPrice)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Market Maker Dashboard */}
      {playerState.role === 'market_maker' && (
        <div className="flex-1 flex flex-col mx-4 mt-2">
          {/* Lever Buttons */}
          <div className="space-y-2 mb-3">
            {(['commission', 'freeze', 'squeeze'] as const).map((lever) => {
              const leverState = gameState.mmLevers?.[lever];
              const isActive = leverState?.active || false;
              const cooldown = leverState?.cooldownLeft || 0;
              const canUse = !isActive && cooldown <= 0;
              const configs = {
                commission: { label: 'КОМИССИЯ x3', color: 'bg-accent-red', desc: '3% fee на сделки' },
                freeze: { label: 'ЗАМОРОЗКА', color: 'bg-blue-600', desc: 'Блокирует закрытие' },
                squeeze: { label: 'СЖАТИЕ', color: 'bg-accent-gold', desc: 'Ликвидация ближе' },
              } as const;
              const cfg = configs[lever];
              return (
                <button
                  key={lever}
                  onClick={() => useMMLever(lever)}
                  disabled={!canUse}
                  className={`w-full py-4 rounded-xl font-bold text-lg active:scale-95 transition-all ${
                    isActive ? `${cfg.color} text-white animate-pulse` :
                    canUse ? `${cfg.color} text-white` :
                    'bg-surface-light text-text-muted'
                  } disabled:opacity-40`}
                >
                  <div>{cfg.label}</div>
                  <div className="text-xs font-normal opacity-80">
                    {isActive ? `Активно (${leverState?.ticksLeft}s)` :
                     cooldown > 0 ? `Кулдаун (${cooldown}s)` :
                     cfg.desc}
                  </div>
                </button>
              );
            })}
          </div>

          {/* MM Push Buttons */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => mmPushUp()}
              className="flex-1 py-4 rounded-xl font-bold text-lg bg-accent-green text-background active:scale-95 transition-all"
            >
              ВВЕРХ
            </button>
            <button
              onClick={() => mmPushDown()}
              className="flex-1 py-4 rounded-xl font-bold text-lg bg-accent-red text-white active:scale-95 transition-all"
            >
              ВНИЗ
            </button>
          </div>

          {/* Trader Positions Dashboard */}
          <div className="flex-1 overflow-y-auto space-y-2">
            <p className="text-text-secondary text-xs uppercase mb-1">Позиции трейдеров</p>
            {leaderboard.filter((e) => e.role === 'trader').map((entry) => (
              <div key={entry.nickname} className={`rounded-lg p-2 text-sm border ${
                entry.hasPosition
                  ? entry.totalPnl >= 0 ? 'bg-accent-green/10 border-accent-green/30' : 'bg-accent-red/10 border-accent-red/30'
                  : 'bg-surface-light border-border'
              }`}>
                <div className="flex justify-between">
                  <span className="font-bold">{entry.nickname}</span>
                  <span className="font-mono">${entry.balance.toFixed(0)}</span>
                </div>
                {entry.hasPosition && (
                  <div className="flex justify-between text-xs mt-1 text-text-secondary">
                    <span className={entry.positionDirection === 'long' ? 'text-accent-green' : 'text-accent-red'}>
                      {entry.positionDirection?.toUpperCase()} x{entry.positionLeverage}
                    </span>
                    <span>
                      ${entry.positionSize} | Liq: {entry.liquidationPrice?.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trader: MM indicator */}
      {playerState.role === 'trader' && gameState.marketMakerNickname && (
        <div className="mx-4 mt-2 text-center">
          <span className="text-accent-gold/70 text-xs">vs Маркет-Мейкер: {gameState.marketMakerNickname}</span>
        </div>
      )}

      {/* Active MM effects for traders */}
      {playerState.role === 'trader' && gameState.mmLevers && (
        <div className="mx-4 mt-1 space-y-1">
          {gameState.mmLevers.commission.active && (
            <div className="bg-accent-red/20 border border-accent-red/50 rounded-lg px-3 py-1 text-accent-red text-xs font-bold text-center animate-pulse">
              КОМИССИЯ x3 — 3% fee! ({gameState.mmLevers.commission.ticksLeft}s)
            </div>
          )}
          {gameState.mmLevers.freeze.active && (
            <div className="bg-blue-600/20 border border-blue-500/50 rounded-lg px-3 py-1 text-blue-400 text-xs font-bold text-center animate-pulse">
              ЗАМОРОЗКА — Нельзя закрыть! ({gameState.mmLevers.freeze.ticksLeft}s)
            </div>
          )}
          {gameState.mmLevers.squeeze.active && (
            <div className="bg-accent-gold/20 border border-accent-gold/50 rounded-lg px-3 py-1 text-accent-gold text-xs font-bold text-center animate-pulse">
              СЖАТИЕ — Ликвидация ближе! ({gameState.mmLevers.squeeze.ticksLeft}s)
            </div>
          )}
        </div>
      )}

      <div className="flex-1" />

      {/* Controls (traders only — NOT the MM player) */}
      {playerState.role !== 'market_maker' && (
      <div className="px-4 pb-6 space-y-3">
        {position ? (
          <button
            onClick={closePosition}
            disabled={playerState.isFreezed}
            className={`w-full py-5 rounded-xl font-display font-bold text-xl active:scale-95 transition-all ${
              playerState.isFreezed ? 'bg-blue-600 text-white opacity-60' :
              unrealizedPnl >= 0 ? 'bg-accent-green text-white glow-green' : 'bg-accent-red text-white glow-red'
            }`}
          >
            {playerState.isFreezed ? 'ЗАМОРОЖЕНО' : `ЗАКРЫТЬ ${unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)}$`}
          </button>
        ) : (
          <>
            {/* Leverage */}
            <div>
              <p className="text-text-secondary text-xs mb-1">Плечо</p>
              <div className="flex gap-1.5">
                {(gameState.availableLeverages || [500]).map((lev) => (
                  <button
                    key={lev}
                    onClick={() => setLeverage(lev)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                      leverage === lev
                        ? lev >= 200 ? 'bg-accent-purple text-white' : lev >= 50 ? 'bg-accent-red text-white' : lev >= 10 ? 'bg-orange-500 text-black' : 'bg-accent-gold text-black'
                        : 'bg-surface text-text-secondary border border-border'
                    }`}
                  >
                    {`${lev}x`}
                  </button>
                ))}
              </div>
            </div>

            {/* Size (MM mode: max 30%) */}
            <div>
              <div className="flex justify-between text-sm text-text-secondary mb-1">
                <span>Маржа: ${tradeSize.toLocaleString()}</span>
                <span className="text-accent-gold">Макс: {MAX_POSITION_PERCENT}%</span>
              </div>
              <div className="flex gap-1.5">
                {[5, 10, 15, 20, MAX_POSITION_PERCENT].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setSizePercent(pct)}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all active:scale-95 ${
                      sizePercent === pct
                        ? 'bg-accent-gold text-black'
                        : 'bg-surface text-text-secondary border border-border'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Long/Short */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => openPosition('long', tradeSize, leverage)}
                disabled={tradeSize <= 0}
                className="bg-accent-green text-white font-display font-bold text-xl py-6 rounded-xl active:scale-95 transition-all disabled:opacity-30 glow-green"
              >
                <span className="flex items-center justify-center gap-1"><IconLong size={16} /> LONG</span>
              </button>
              <button
                onClick={() => openPosition('short', tradeSize, leverage)}
                disabled={tradeSize <= 0}
                className="bg-accent-red text-white font-display font-bold text-xl py-6 rounded-xl active:scale-95 transition-all disabled:opacity-30 glow-red"
              >
                <span className="flex items-center justify-center gap-1"><IconShort size={16} /> SHORT</span>
              </button>
            </div>
          </>
        )}
      </div>
      )}
    </div>
  );
}
