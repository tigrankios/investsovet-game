'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSocket } from '@/lib/useGame';
import { SKILL_NAMES, SKILL_DESCRIPTIONS } from '@/lib/types';
import type { ClientGameState, ClientPlayerState, LeaderboardEntry, Candle, Leverage } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import { IconLong, IconShort, IconSkillShield, IconSkillBlind, SKILL_ICON_MAP } from '@/components/icons';
import { MiniChart } from '@/components/charts/MiniChart';

interface ClassicPlayProps {
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
  skillAlert: string;
}

export function ClassicPlay({
  gameState, playerState, leaderboard, candles, currentPrice, nickname,
  openPosition, closePosition, tradeMessage, liquidationAlert, skillAlert,
}: ClassicPlayProps) {
  const [sizePercent, setSizePercent] = useState(25);
  const [leverage, setLeverage] = useState<Leverage>(25);

  // Use skill action
  const usePlayerSkill = useCallback(() => getSocket().emit('useSkill'), []);

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
  const isBlind = playerState.blindTicksLeft > 0;

  return (
    <div className="min-h-screen bg-background text-white flex flex-col">
      {/* Toast */}
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
      {skillAlert && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-accent-purple text-white font-bold rounded-lg px-4 py-2 z-50 animate-alert">
          {skillAlert}
        </div>
      )}

      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        {isBlind ? (
          <div className="flex flex-col items-center py-4">
            <div className="mb-2"><IconSkillBlind size={40} /></div>
            <p className="text-xl font-display font-black text-accent-gold animate-pulse">СЛЕПОЙ ТРЕЙД</p>
            <p className="text-text-secondary mt-1">{playerState.blindTicksLeft}с</p>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-text-secondary text-xs uppercase">Баланс</p>
                <p className="text-2xl font-mono font-bold">${totalBalance.toFixed(2)}</p>
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
          </>
        )}
      </div>

      {/* Chart */}
      {!isBlind && candles.length > 0 && (
        <div className="mx-2 mt-2 rounded-xl overflow-hidden" style={{ height: '40vw', maxHeight: '220px', minHeight: '140px' }}>
          <MiniChart candles={candles} positions={leaderboard} />
        </div>
      )}

      {/* Position Awareness Strip */}
      {gameState.gameMode === 'classic' && (() => {
        const others = leaderboard.filter(e => e.nickname !== nickname);
        const longCount = others.filter(e => e.hasPosition && e.positionDirection === 'long').length;
        const shortCount = others.filter(e => e.hasPosition && e.positionDirection === 'short').length;
        const idleCount = others.filter(e => !e.hasPosition).length;
        const groups = [
          ...(longCount > 0 ? [{ count: longCount, arrow: '\u25B2', label: 'LONG', color: 'text-accent-green' }] : []),
          ...(shortCount > 0 ? [{ count: shortCount, arrow: '\u25BC', label: 'SHORT', color: 'text-accent-red' }] : []),
          ...(idleCount > 0 ? [{ count: idleCount, arrow: '\u2014', label: 'IDLE', color: 'text-text-muted' }] : []),
        ];
        if (groups.length === 0) return null;
        return (
          <div className="mx-2 mt-2 flex items-center justify-center gap-4 py-2 bg-surface rounded-xl border border-border">
            {groups.map((g, i) => (
              <div key={g.label} className="flex items-center gap-1.5">
                {i > 0 && <div className="w-px h-5 bg-border -ml-2 mr-1.5" />}
                <span className={`text-lg font-mono font-bold transition-all duration-300 ${g.color}`}>{g.count}</span>
                <span className={`text-xs font-bold uppercase opacity-80 ${g.color}`}>{g.arrow} {g.label}</span>
              </div>
            ))}
          </div>
        );
      })()}

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
            {isBlind ? (
              <span className="text-text-secondary font-mono">???</span>
            ) : (
              <div className="text-right">
                <p className={`font-mono font-bold ${unrealizedPnl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                  {unrealizedPnl >= 0 ? '+' : ''}{unrealizedPnl.toFixed(2)}$
                </p>
                <p className="text-text-secondary text-xs">Ликв: {formatPrice(position.liquidationPrice)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Skill Button (only for traders) */}
      {playerState.skill && !playerState.skillUsed && (
        <div className="mx-4 mt-3">
          <button
            onClick={usePlayerSkill}
            disabled={playerState.frozen}
            className={`w-full rounded-xl active:scale-95 transition-all border ${playerState.frozen ? 'opacity-40 border-border bg-surface' : 'border-accent-purple/50 bg-surface hover:bg-surface-light'}`}
            style={!playerState.frozen ? { boxShadow: '0 0 20px rgba(179,136,255,0.15), inset 0 0 30px rgba(179,136,255,0.05)' } : undefined}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-10 h-10 rounded-lg bg-accent-purple/20 flex items-center justify-center flex-shrink-0">
                {SKILL_ICON_MAP[playerState.skill]?.({ size: 22 })}
              </div>
              <div className="text-left flex-1">
                <p className="font-display font-bold text-sm text-text-primary">{SKILL_NAMES[playerState.skill]}</p>
                <p className="text-xs text-text-secondary">{SKILL_DESCRIPTIONS[playerState.skill]}</p>
              </div>
              <div className="text-accent-purple text-xs font-display font-bold uppercase tracking-wider">USE</div>
            </div>
          </button>
        </div>
      )}
      {playerState.skill && playerState.skillUsed && (
        <div className="mx-4 mt-2">
          <div className="flex items-center gap-2 justify-center text-sm text-text-muted">
            <span className="inline-flex items-center gap-1">{SKILL_ICON_MAP[playerState.skill]?.({ size: 14 })} {SKILL_NAMES[playerState.skill]}</span>
            <span className="text-text-muted">— использован</span>
            {playerState.shieldActive && <span className="inline-flex items-center gap-1 text-accent-green"><IconSkillShield size={14} /> активен</span>}
            {playerState.blindTicksLeft > 0 && <span className="inline-flex items-center gap-1 text-accent-blue"><IconSkillBlind size={14} /> {playerState.blindTicksLeft}с</span>}
          </div>
        </div>
      )}

      <div className="flex-1" />

      {/* Frozen indicator */}
      {playerState.frozen && (
        <div className="mx-4 mt-2 bg-blue-600/20 border border-blue-500/50 rounded-xl px-3 py-2 text-blue-400 text-sm font-bold text-center animate-pulse">
          🧊 Заморожен!
        </div>
      )}

      {/* Controls (traders only) */}
      <div className="px-4 pb-6 space-y-3">
        {position ? (
          <button
            onClick={closePosition}
            disabled={playerState.isFreezed || playerState.frozen}
            className={`w-full py-5 rounded-xl font-display font-bold text-xl active:scale-95 transition-all ${
              (playerState.isFreezed || playerState.frozen) ? 'bg-blue-600 text-white opacity-60' :
              unrealizedPnl >= 0 ? 'bg-accent-green text-white glow-green' : 'bg-accent-red text-white glow-red'
            }`}
          >
            {(playerState.isFreezed || playerState.frozen) ? 'ЗАМОРОЖЕНО' : `ЗАКРЫТЬ ${unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)}$`}
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

            {/* Size */}
            <div>
              <div className="flex justify-between text-sm text-text-secondary mb-1">
                <span>Маржа: ${tradeSize.toLocaleString()}</span>
                <span>Позиция: ${(tradeSize * leverage).toLocaleString()}</span>
              </div>
              <div className="flex gap-1.5">
                {[10, 25, 50, 75, 100].map((pct) => (
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
                disabled={tradeSize <= 0 || playerState.frozen}
                className="bg-accent-green text-white font-display font-bold text-xl py-6 rounded-xl active:scale-95 transition-all disabled:opacity-30 glow-green"
              >
                <span className="flex items-center justify-center gap-1"><IconLong size={16} /> LONG</span>
              </button>
              <button
                onClick={() => openPosition('short', tradeSize, leverage)}
                disabled={tradeSize <= 0 || playerState.frozen}
                className="bg-accent-red text-white font-display font-bold text-xl py-6 rounded-xl active:scale-95 transition-all disabled:opacity-30 glow-red"
              >
                <span className="flex items-center justify-center gap-1"><IconShort size={16} /> SHORT</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
