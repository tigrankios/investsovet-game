'use client';

import type { LeaderboardEntry } from '@/lib/types';
import { IconTrophy, IconSilver, IconBronze } from '@/components/icons';

export function LeaderboardRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const rankDisplay = rank === 1 ? <IconTrophy size={24} /> : rank === 2 ? <IconSilver size={24} /> : rank === 3 ? <IconBronze size={24} /> : `${rank}`;
  const medalColors = ['text-accent-gold', 'text-text-secondary', 'text-amber-400'];
  const rankColor = rank <= 3 ? medalColors[rank - 1] : 'text-text-muted';

  return (
    <div className="flex items-center gap-4 rounded-xl px-5 py-3 glass">
      <span className={`font-bold text-2xl w-10 text-center ${rankColor}`}>{rankDisplay}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
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
