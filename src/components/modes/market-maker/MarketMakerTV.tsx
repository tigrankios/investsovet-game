'use client';

import { useEffect, useState } from 'react';
import type { ClientGameState, LeaderboardEntry, Candle, BonusType, BonusResult, FinalPlayerStats } from '@/lib/types';
import { BONUS_TITLES } from '@/lib/types';
import { getSocket } from '@/lib/useGame';
import { CandlestickChart } from '../shared/CandlestickChart';
import { PriceDisplay } from '../shared/PriceDisplay';
import { IconTrophy, IconSilver, IconBronze, IconCrown, BONUS_ICON_MAP } from '@/components/icons';

export interface MarketMakerTVProps {
  gameState: ClientGameState;
  leaderboard: LeaderboardEntry[];
  candles: Candle[];
  currentPrice: number;
  countdown: number;
  liquidationAlert: string;
  bonusData: { timer: number; bonusType: BonusType; results: { nickname: string; result: BonusResult }[] } | null;
  finalStats: FinalPlayerStats[];
  returnToLobby: () => void;
}

export function MarketMakerTV({
  gameState, leaderboard, candles, currentPrice,
  countdown, liquidationAlert, bonusData, finalStats,
  returnToLobby,
}: MarketMakerTVProps) {
  const { phase, ticker } = gameState;

  // Mode-specific state
  const [mmLeverAlert, setMmLeverAlert] = useState('');
  const [mmResult, setMmResult] = useState<{ mmWon: boolean; mmBalance: number; tradersAvg: number; mmNickname: string } | null>(null);

  // Mode-specific socket listeners
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
                <MMLeaderboardRow key={entry.nickname} entry={entry} rank={i + 1} />
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

// --- MM-specific LeaderboardRow ---
function MMLeaderboardRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
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
