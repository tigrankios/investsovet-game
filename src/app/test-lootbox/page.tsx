'use client';

import { useState } from 'react';

const POOL = [
  { mult: 0, weight: 3 }, { mult: 0.5, weight: 2 }, { mult: 1.5, weight: 3 },
  { mult: 2, weight: 3 }, { mult: 3, weight: 2 }, { mult: 5, weight: 1.5 },
  { mult: 10, weight: 0.8 }, { mult: 50, weight: 0.2 },
];

function weightedRandom(pool: { mult: number; weight: number }[]): number {
  const total = pool.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of pool) { r -= p.weight; if (r <= 0) return p.mult; }
  return pool[pool.length - 1].mult;
}

function generateBoxes(): number[] {
  const boxes = [0, 0, 0, 0].map(() => weightedRandom(POOL));
  if (!boxes.some((m) => m >= 2)) boxes[Math.floor(Math.random() * 4)] = 2;
  if (!boxes.some((m) => m <= 1.5)) {
    const idx = boxes.findIndex((_, i) => boxes[i] >= 2 && boxes.filter((v) => v >= 2).length > 1);
    boxes[idx >= 0 ? idx : 3] = 1.5;
  }
  for (let i = 3; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [boxes[i], boxes[j]] = [boxes[j], boxes[i]]; }
  return boxes;
}

export default function TestLootbox() {
  const [boxes, setBoxes] = useState<number[] | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [revealed, setRevealed] = useState([false, false, false, false]);
  const [balance, setBalance] = useState(10000);
  const [bet, setBet] = useState(1000);
  const [playing, setPlaying] = useState(false);

  const startRound = () => {
    setBoxes(generateBoxes());
    setChosen(null);
    setRevealed([false, false, false, false]);
    setPlaying(true);
  };

  const choose = (idx: number) => {
    if (chosen !== null || !boxes) return;
    setChosen(idx);

    // Reveal chosen
    setRevealed((p) => { const n = [...p]; n[idx] = true; return n; });

    // Calculate win
    const mult = boxes[idx];
    const win = mult === 0 ? -bet : Math.round(bet * mult - bet);
    setBalance((b) => Math.max(0, b + win));

    // Reveal others after delay
    const others = [0, 1, 2, 3].filter((i) => i !== idx);
    others.forEach((i, delay) => {
      setTimeout(() => {
        setRevealed((p) => { const n = [...p]; n[i] = true; return n; });
      }, 800 + delay * 300);
    });

    setTimeout(() => setPlaying(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center gap-6 p-6">
      <a href="/test-games" className="absolute top-4 left-4 text-text-secondary hover:text-text-primary text-sm">&larr; Назад</a>
      <h1 className="text-3xl font-display font-black text-accent-gold">ЛУТБОКС</h1>
      <p className="text-text-secondary font-mono">Баланс: ${balance.toLocaleString()}</p>

      {boxes ? (
        <>
          <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
            {[0, 1, 2, 3].map((i) => {
              const isRevealed = revealed[i];
              const isChosen = chosen === i;
              const val = boxes[i];
              return (
                <button key={i} onClick={() => choose(i)} disabled={chosen !== null}
                  className={`h-28 rounded-xl font-black text-2xl transition-all active:scale-95 ${
                    isRevealed
                      ? isChosen
                        ? val >= 2 ? 'bg-accent-green/80 ring-4 ring-accent-green' : 'bg-accent-red/80 ring-4 ring-accent-red'
                        : 'bg-surface-light opacity-60'
                      : 'bg-gradient-to-br from-accent-gold to-amber-600 hover:scale-105'
                  }`}>
                  {isRevealed ? (val === 0 ? 'BUST' : `x${val}`) : '?'}
                </button>
              );
            })}
          </div>

          {chosen !== null && (
            <div className="text-center">
              <p className={`text-3xl font-display font-black ${boxes[chosen] >= 2 ? 'text-accent-green' : 'text-accent-red'}`}>
                {boxes[chosen] === 0 ? 'BUST' : `x${boxes[chosen]}`}
              </p>
              <p className={`text-lg font-mono ${boxes[chosen] > 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                {boxes[chosen] === 0 ? `-${bet}$` : `+${Math.round(bet * boxes[chosen] - bet)}$`}
              </p>
            </div>
          )}

          {!playing && (
            <button onClick={startRound} className="bg-accent-gold text-black font-display font-black text-xl px-12 py-4 rounded-xl active:scale-95 glow-gold">
              ЕЩЁ РАЗ
            </button>
          )}
        </>
      ) : (
        <>
          <p className="text-text-secondary">Выбери одну из 4 коробок. Остальные откроются после.</p>
          <div className="flex gap-2">
            {[500, 1000, 2500, 5000].map((b) => (
              <button key={b} onClick={() => setBet(b)}
                className={`px-4 py-2 rounded-lg font-bold text-sm ${bet === b ? 'bg-accent-gold text-black' : 'bg-surface border border-border text-text-secondary'}`}>
                ${b}
              </button>
            ))}
          </div>
          <button onClick={startRound} disabled={balance <= 0}
            className="bg-accent-gold text-black font-display font-black text-xl px-12 py-4 rounded-xl active:scale-95 disabled:opacity-30 glow-gold">
            ОТКРЫТЬ
          </button>
        </>
      )}
    </div>
  );
}
