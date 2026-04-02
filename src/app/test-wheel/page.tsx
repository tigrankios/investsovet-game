'use client';

import { useState } from 'react';
import { WheelGame, WHEEL_SECTORS_DISPLAY } from '@/components/games/WheelGame';

export default function TestWheel() {
  const [result, setResult] = useState<number | null>(null);
  const [balance, setBalance] = useState(10000);
  const [bet, setBet] = useState(1000);
  const [key, setKey] = useState(0);

  const spin = () => {
    const sectorIdx = Math.floor(Math.random() * WHEEL_SECTORS_DISPLAY.length);
    setTimeout(() => {
      setResult(sectorIdx);
      const mult = WHEEL_SECTORS_DISPLAY[sectorIdx].mult;
      const win = mult === 0 ? -bet : Math.round(bet * mult - bet);
      setBalance((b) => Math.max(0, b + win));
    }, 500);
  };

  const win = result !== null
    ? WHEEL_SECTORS_DISPLAY[result].mult === 0 ? -bet : Math.round(bet * WHEEL_SECTORS_DISPLAY[result].mult - bet)
    : null;

  return (
    <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center gap-4 p-6">
      <a href="/test-games" className="absolute top-4 left-4 text-text-secondary hover:text-text-primary text-sm">&larr; Назад</a>
      <h1 className="text-3xl font-display font-black text-accent-gold">КОЛЕСО ФОРТУНЫ</h1>
      <p className="text-text-secondary font-mono">Баланс: ${balance.toLocaleString()}</p>

      <WheelGame key={key} onSpin={spin} resultSectorIndex={result} disabled={balance <= 0} />

      {win !== null && (
        <p className={`text-lg font-mono ${win >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
          {win >= 0 ? '+' : ''}{win}$
        </p>
      )}

      {result !== null && (
        <button onClick={() => { setResult(null); setKey((k) => k + 1); }}
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
