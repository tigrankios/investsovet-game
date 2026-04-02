'use client';

import { useState } from 'react';

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
  const [selected, setSelected] = useState<number[]>([]);
  const [drawn, setDrawn] = useState<number[] | null>(null);
  const [balance, setBalance] = useState(10000);
  const [bet, setBet] = useState(1000);
  const [playing, setPlaying] = useState(false);

  const toggle = (n: number) => {
    if (drawn) return;
    setSelected((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : prev.length < 5 ? [...prev, n] : prev
    );
  };

  const play = () => {
    if (selected.length !== 5 || bet <= 0 || bet > balance) return;
    setPlaying(true);
    const d = drawNumbers();
    setDrawn(d);

    const matches = selected.filter((n) => d.includes(n)).length;
    const mult = PAYOUTS[matches];
    const win = mult === 0 ? -bet : Math.round(bet * mult - bet);
    setBalance((b) => Math.max(0, b + win));

    setTimeout(() => setPlaying(false), 1000);
  };

  const reset = () => {
    setSelected([]);
    setDrawn(null);
  };

  const matches = drawn ? selected.filter((n) => drawn.includes(n)).length : 0;
  const mult = drawn ? PAYOUTS[matches] : null;

  return (
    <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center gap-4 p-6">
      <a href="/test-games" className="absolute top-4 left-4 text-text-secondary hover:text-text-primary text-sm">&larr; Назад</a>
      <h1 className="text-3xl font-display font-black text-accent-gold">ЛОТО</h1>
      <p className="text-text-secondary font-mono">Баланс: ${balance.toLocaleString()}</p>

      <div className="grid grid-cols-5 gap-2 w-full max-w-xs">
        {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => {
          const isSel = selected.includes(n);
          const isDrawn = drawn?.includes(n);
          const isMatch = isDrawn && isSel;
          const isPlayerOnly = !isDrawn && isSel && drawn;
          return (
            <button key={n} onClick={() => toggle(n)} disabled={!!drawn}
              className={`h-12 rounded-lg font-bold text-lg transition-all active:scale-95 ${
                drawn
                  ? isMatch ? 'bg-accent-green text-white ring-2 ring-accent-green scale-110'
                    : isDrawn ? 'bg-accent-gold text-black'
                    : isPlayerOnly ? 'bg-accent-red/50 text-white'
                    : 'bg-surface text-text-muted'
                  : isSel ? 'bg-accent-gold text-black scale-105' : 'bg-surface-light text-text-primary hover:bg-surface'
              }`}>
              {n}
            </button>
          );
        })}
      </div>

      {!drawn && <p className="text-text-secondary text-sm">Выбрано: {selected.length}/5</p>}

      {drawn && (
        <div className="text-center">
          <p className="text-text-secondary text-sm">Выпало: {drawn.join(', ')}</p>
          <p className="text-white font-bold">Совпадений: {matches}/5</p>
          <p className={`text-3xl font-display font-black ${mult && mult > 0 ? 'text-accent-green' : 'text-accent-red'}`}>
            {mult && mult > 0 ? `x${mult}` : 'МИМО'}
          </p>
          <p className={`text-lg font-mono ${mult && mult > 0 ? 'text-accent-green' : 'text-accent-red'}`}>
            {mult === 0 ? `-${bet}$` : `+${Math.round(bet * (mult ?? 0) - bet)}$`}
          </p>
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

      {!drawn ? (
        <button onClick={play} disabled={selected.length !== 5 || balance <= 0}
          className="bg-accent-gold text-black font-display font-black text-xl px-12 py-4 rounded-xl active:scale-95 disabled:opacity-30 glow-gold">
          ИГРАТЬ
        </button>
      ) : (
        <button onClick={reset}
          className="bg-accent-gold text-black font-display font-black text-xl px-12 py-4 rounded-xl active:scale-95 glow-gold">
          ЕЩЁ РАЗ
        </button>
      )}
    </div>
  );
}
