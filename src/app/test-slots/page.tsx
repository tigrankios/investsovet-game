'use client';

import { useState } from 'react';
import { SlotsGame } from '@/components/games/SlotsGame';

const SYMBOLS = ['₿', 'Ξ', '🐕', '🚀', '💎', '🌕'];

function getMultiplier(reels: string[]): number {
  const [a, b, c] = reels;
  if (a === b && b === c) {
    if (a === '₿') return 10;
    if (a === '💎') return 5;
    return 3;
  }
  if (a === b || b === c || a === c) return 1.5;
  return 0;
}

export default function TestSlots() {
  const [resultReels, setResultReels] = useState<string[] | null>(null);
  const [resultMult, setResultMult] = useState<number | null>(null);
  const [balance, setBalance] = useState(10000);
  const [bet, setBet] = useState(1000);
  const [key, setKey] = useState(0);

  const spin = () => {
    const reels = [SYMBOLS[Math.floor(Math.random() * 6)], SYMBOLS[Math.floor(Math.random() * 6)], SYMBOLS[Math.floor(Math.random() * 6)]];
    const mult = getMultiplier(reels);
    const win = mult === 0 ? -bet : Math.round(bet * mult - bet);
    setResultReels(reels);
    setResultMult(mult);
    setBalance((b) => Math.max(0, b + win));
  };

  const win = resultMult !== null
    ? resultMult === 0 ? -bet : Math.round(bet * resultMult - bet)
    : null;

  return (
    <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center gap-6 p-6">
      <a href="/test-games" className="absolute top-4 left-4 text-text-secondary hover:text-text-primary text-sm">&larr; Назад</a>
      <h1 className="text-3xl font-display font-black text-accent-gold">СЛОТ-МАШИНА</h1>
      <p className="text-text-secondary font-mono">Баланс: ${balance.toLocaleString()}</p>

      <SlotsGame key={key} onSpin={spin} resultReels={resultReels} resultMultiplier={resultMult} disabled={balance <= 0} />

      {win !== null && (
        <p className={`text-lg font-mono ${win >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
          {win >= 0 ? '+' : ''}{win}$
        </p>
      )}

      {resultReels !== null && (
        <button onClick={() => { setResultReels(null); setResultMult(null); setKey((k) => k + 1); }}
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
