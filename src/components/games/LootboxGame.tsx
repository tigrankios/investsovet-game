'use client';

import { useState, useEffect } from 'react';

interface LootboxGameProps {
  onChoose: (index: number) => void;
  resultBoxes: number[] | null;
  resultChosenIndex: number | null;
  disabled: boolean;
}

export function LootboxGame({ onChoose, resultBoxes, resultChosenIndex, disabled }: LootboxGameProps) {
  const [revealed, setRevealed] = useState([false, false, false, false]);
  const [chosen, setChosen] = useState(false);

  const handleChoice = (idx: number) => {
    if (chosen || disabled) return;
    setChosen(true);
    onChoose(idx);
  };

  // Staggered reveal animation when result arrives
  useEffect(() => {
    if (!resultBoxes || resultChosenIndex === null) return;

    // Reveal chosen immediately
    setRevealed((prev) => { const n = [...prev]; n[resultChosenIndex] = true; return n; });

    // Reveal others staggered
    const others = [0, 1, 2, 3].filter((i) => i !== resultChosenIndex);
    const timeouts = others.map((idx, i) =>
      setTimeout(() => {
        setRevealed((prev) => { const n = [...prev]; n[idx] = true; return n; });
      }, 800 + i * 300)
    );

    return () => timeouts.forEach(clearTimeout);
  }, [resultBoxes, resultChosenIndex]);

  return (
    <div className="flex flex-col items-center">
      <div className="grid grid-cols-2 gap-4 mb-6 w-full max-w-sm">
        {[0, 1, 2, 3].map((i) => {
          const isRevealed = revealed[i];
          const isChosen = resultChosenIndex === i;
          const val = resultBoxes ? resultBoxes[i] : null;

          return (
            <button key={i} onClick={() => handleChoice(i)} disabled={chosen || disabled}
              className={`h-28 rounded-xl font-black text-2xl transition-all active:scale-95 ${
                isRevealed
                  ? isChosen
                    ? val !== null && val >= 2 ? 'bg-accent-green/80 ring-4 ring-accent-green' : 'bg-accent-red/80 ring-4 ring-accent-red'
                    : 'bg-surface-light opacity-60'
                  : 'bg-gradient-to-br from-accent-gold to-amber-600 hover:scale-105'
              }`}>
              {isRevealed && val !== null ? (val === 0 ? 'BUST' : `x${val}`) : chosen ? '...' : '?'}
            </button>
          );
        })}
      </div>

      {/* Result */}
      {resultBoxes && resultChosenIndex !== null && (
        <div className="text-center mb-4">
          <p className={`text-3xl font-display font-black ${resultBoxes[resultChosenIndex] >= 2 ? 'text-accent-green' : 'text-accent-red'}`}>
            {resultBoxes[resultChosenIndex] === 0 ? 'BUST' : `x${resultBoxes[resultChosenIndex]}`}
          </p>
        </div>
      )}

      {!chosen && !disabled && (
        <p className="text-text-secondary text-lg">Выбери коробку!</p>
      )}
    </div>
  );
}
