'use client';

import { useState } from 'react';
import { LotoGame } from '@/components/games/LotoGame';

const PAYOUTS: Record<number, number> = { 0: 0, 1: 0.5, 2: 1.5, 3: 3, 4: 10, 5: 50 };

function drawNumbers(): number[] {
  const pool = Array.from({ length: 20 }, (_, i) => i + 1);
  const drawn: number[] = [];
  for (let i = 0; i < 5; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    drawn.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return drawn.sort((a, b) => a - b);
}

export default function TestLoto() {
  const [drawn, setDrawn] = useState<number[] | null>(null);
  const [playerNums, setPlayerNums] = useState<number[] | null>(null);
  const [matches, setMatches] = useState<number | null>(null);
  const [balance, setBalance] = useState(10000);
  const [bet, setBet] = useState(1000);
  const [key, setKey] = useState(0);

  const play = (numbers: number[]) => {
    const d = drawNumbers();
    const m = numbers.filter((n) => d.includes(n)).length;
    const mult = PAYOUTS[m];
    const win = mult === 0 ? -bet : Math.round(bet * mult - bet);
    setDrawn(d);
    setPlayerNums(numbers);
    setMatches(m);
    setBalance((b) => Math.max(0, b + win));
  };

  const mult = matches !== null ? PAYOUTS[matches] : null;
  const win = mult !== null ? (mult === 0 ? -bet : Math.round(bet * mult - bet)) : null;

  return (
    <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center gap-4 p-6">
      <a href="/test-games" className="absolute top-4 left-4 text-text-secondary hover:text-text-primary text-sm">&larr; Назад</a>
      <h1 className="text-3xl font-display font-black text-accent-gold">ЛОТО</h1>
      <p className="text-text-secondary font-mono">Баланс: ${balance.toLocaleString()}</p>

      <LotoGame key={key} onPlay={play} resultDrawn={drawn} resultPlayerNumbers={playerNums} resultMatches={matches} disabled={balance <= 0} />

      {win !== null && mult !== null && (
        <div className="text-center">
          <p className={`text-lg font-mono ${win >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
            {mult > 0 ? `x${mult} ` : ''}{win >= 0 ? '+' : ''}{win}$
          </p>
        </div>
      )}

      {drawn !== null && (
        <button onClick={() => { setDrawn(null); setPlayerNums(null); setMatches(null); setKey((k) => k + 1); }}
          className="bg-accent-gold text-black font-display font-black text-xl px-12 py-4 rounded-xl active:scale-95 glow-gold">
          ЕЩЁ РАЗ
        </button>
      )}

      <div className="flex gap-2">
        {[500, 1000, 2500, 5000].map((b) => (
          <button key={b} onClick={() => setBet(b)}
            className={`px-4 py-2 rounded-lg font-bold text-sm ${bet === b ? 'bg-accent-gold text-black' : 'bg-surface border border-border text-text-secondary'}`}>
            ${b}
          </button>
        ))}
      </div>
    </div>
  );
}
