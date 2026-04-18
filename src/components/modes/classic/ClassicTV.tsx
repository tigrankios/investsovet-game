'use client';

import type { ClientGameState, LeaderboardEntry, Candle, BonusType, BonusResult, FinalPlayerStats } from '@/lib/types';
import { BONUS_TITLES } from '@/lib/types';
import { CandlestickChart } from '../shared/CandlestickChart';
import { PriceDisplay } from '../shared/PriceDisplay';
import { LeaderboardRow } from '../shared/LeaderboardRow';
import { IconTrophy, IconSilver, IconBronze, BONUS_ICON_MAP } from '@/components/icons';

export interface ClassicTVProps {
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

export function ClassicTV({
  gameState, leaderboard, candles, currentPrice,
  countdown, liquidationAlert, bonusData, finalStats,
  returnToLobby,
}: ClassicTVProps) {
  const { phase, ticker } = gameState;

  // --- COUNTDOWN ---
  if (phase === 'countdown') {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center">
        <p className="text-text-secondary text-3xl mb-2">Раунд {gameState.roundNumber}</p>
        <p className="text-accent-gold text-2xl mb-4">{ticker}</p>
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

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border">
          <div className="flex items-center gap-4">
            <span className="text-text-secondary text-lg">R{gameState.roundNumber}</span>
            <span className="text-xl font-bold text-accent-gold">{ticker}</span>
            <PriceDisplay price={currentPrice} candles={candles} />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-accent-green rounded-full animate-pulse" />
            <span className="text-text-secondary text-sm">LIVE</span>
          </div>
        </div>

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
              {stats.map((s) => (
                  <tr key={s.nickname} className={`border-t border-border ${s.rank === 1 ? 'text-accent-gold text-xl' : 'text-lg'}`}>
                    <td className="py-4 font-bold">{s.rank === 1 ? <IconTrophy size={24} /> : s.rank === 2 ? <IconSilver size={24} /> : s.rank === 3 ? <IconBronze size={24} /> : s.rank}</td>
                    <td className="py-4 font-bold">{s.nickname}</td>
                    <td className="py-4 text-right font-mono font-bold">${s.balance.toFixed(0)}</td>
                    <td className="py-4 text-right font-mono text-accent-green">${s.maxBalance.toFixed(0)}</td>
                    <td className="py-4 text-right font-mono text-accent-green">+{s.bestTrade.toFixed(0)}</td>
                    <td className="py-4 text-right font-mono text-accent-red">{s.worstTrade.toFixed(0)}</td>
                    <td className="py-4 text-right font-mono">{s.totalTrades}</td>
                    <td className="py-4 text-right font-mono text-accent-red">{s.liquidations}</td>
                  </tr>
              ))}
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
