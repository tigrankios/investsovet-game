'use client';

import { useState } from 'react';

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
  const [reels, setReels] = useState(['?', '?', '?']);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ mult: number; win: number } | null>(null);
  const [balance, setBalance] = useState(10000);
  const [bet, setBet] = useState(1000);

  const spin = () => {
    if (spinning || bet <= 0 || bet > balance) return;
    setSpinning(true);
    setResult(null);

    let ticks = 0;
    const interval = setInterval(() => {
      setReels([
        SYMBOLS[Math.floor(Math.random() * 6)],
        SYMBOLS[Math.floor(Math.random() * 6)],
        SYMBOLS[Math.floor(Math.random() * 6)],
      ]);
      ticks++;
      if (ticks >= 20) {
        clearInterval(interval);
        const final = [
          SYMBOLS[Math.floor(Math.random() * 6)],
          SYMBOLS[Math.floor(Math.random() * 6)],
          SYMBOLS[Math.floor(Math.random() * 6)],
        ];
        setReels(final);
        const mult = getMultiplier(final);
        const win = mult === 0 ? -bet : Math.round(bet * mult - bet);
        setResult({ mult, win });
        setBalance((b) => Math.max(0, b + win));
        setSpinning(false);
      }
    }, 80);
  };

  return (
    <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center gap-6 p-6">
      <a href="/test-games" className="absolute top-4 left-4 text-text-secondary hover:text-text-primary text-sm">&larr; Назад</a>
      <h1 className="text-3xl font-display font-black text-accent-gold">СЛОТ-МАШИНА</h1>
      <p className="text-text-secondary font-mono">Баланс: ${balance.toLocaleString()}</p>

      <div className="flex gap-4">
        {reels.map((sym, i) => (
          <div key={i} className={`w-24 h-24 bg-surface border-2 rounded-xl flex items-center justify-center text-5xl transition-all ${
            spinning ? 'border-accent-gold animate-pulse' : result && result.mult > 0 ? 'border-accent-green glow-green' : 'border-border-light'
          }`}>
            {sym}
          </div>
        ))}
      </div>

      {result && (
        <div className="text-center">
          <p className={`text-3xl font-display font-black ${result.mult > 0 ? 'text-accent-green' : 'text-accent-red'}`}>
            {result.mult > 0 ? `x${result.mult}` : 'МИМО'}
          </p>
          <p className={`text-lg font-mono ${result.win >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
            {result.win >= 0 ? '+' : ''}{result.win}$
          </p>
          {result.mult >= 5 && <p className="text-accent-gold font-display font-black text-lg animate-bounce mt-1">JACKPOT!</p>}
        </div>
      )}

      <div className="flex gap-2">
        {[500, 1000, 2500, 5000].map((b) => (
          <button key={b} onClick={() => setBet(b)}
            className={`px-4 py-2 rounded-lg font-bold text-sm ${bet === b ? 'bg-accent-gold text-black' : 'bg-surface border border-border text-text-secondary'}`}>
            ${b}
          </button>
        ))}
      </div>

      <button onClick={spin} disabled={spinning || balance <= 0}
        className="bg-accent-gold text-black font-display font-black text-xl px-12 py-4 rounded-xl active:scale-95 transition-all disabled:opacity-30 glow-gold">
        КРУТИТЬ
      </button>
    </div>
  );
}
