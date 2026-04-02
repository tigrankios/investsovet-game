'use client';

import { useState } from 'react';
import { LootboxGame } from '@/components/games/LootboxGame';

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
  const [chosenIndex, setChosenIndex] = useState<number | null>(null);
  const [balance, setBalance] = useState(10000);
  const [bet, setBet] = useState(1000);
  const [key, setKey] = useState(0);

  const choose = (idx: number) => {
    const generated = generateBoxes();
    setBoxes(generated);
    setChosenIndex(idx);
    const mult = generated[idx];
    const win = mult === 0 ? -bet : Math.round(bet * mult - bet);
    setBalance((b) => Math.max(0, b + win));
  };

  const win = boxes !== null && chosenIndex !== null
    ? boxes[chosenIndex] === 0 ? -bet : Math.round(bet * boxes[chosenIndex] - bet)
    : null;

  return (
    <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center gap-6 p-6">
      <a href="/test-games" className="absolute top-4 left-4 text-text-secondary hover:text-text-primary text-sm">&larr; Назад</a>
      <h1 className="text-3xl font-display font-black text-accent-gold">ЛУТБОКС</h1>
      <p className="text-text-secondary font-mono">Баланс: ${balance.toLocaleString()}</p>

      <LootboxGame key={key} onChoose={choose} resultBoxes={boxes} resultChosenIndex={chosenIndex} disabled={balance <= 0} />

      {win !== null && (
        <p className={`text-lg font-mono ${win >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
          {win >= 0 ? '+' : ''}{win}$
        </p>
      )}

      {boxes !== null && (
        <button onClick={() => { setBoxes(null); setChosenIndex(null); setKey((k) => k + 1); }}
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
