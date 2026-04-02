'use client';

import { useState } from 'react';

interface LotoGameProps {
  onPlay: (numbers: number[]) => void;
  resultDrawn: number[] | null;
  resultPlayerNumbers: number[] | null;
  resultMatches: number | null;
  disabled: boolean;
}

export function LotoGame({ onPlay, resultDrawn, resultPlayerNumbers, resultMatches, disabled }: LotoGameProps) {
  const [selected, setSelected] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const toggle = (n: number) => {
    if (submitted || disabled) return;
    setSelected((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : prev.length < 5 ? [...prev, n] : prev
    );
  };

  const handlePlay = () => {
    if (selected.length !== 5 || disabled) return;
    setSubmitted(true);
    onPlay(selected);
  };

  const played = resultDrawn !== null;

  return (
    <div className="flex flex-col items-center">
      <div className="grid grid-cols-5 gap-2 w-full max-w-xs mb-4">
        {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => {
          const isSel = selected.includes(n);
          const isDrawn = resultDrawn?.includes(n);
          const isMatch = isDrawn && resultPlayerNumbers?.includes(n);
          const isPlayerOnly = !isDrawn && resultPlayerNumbers?.includes(n) && played;

          return (
            <button key={n} onClick={() => toggle(n)} disabled={submitted || disabled}
              className={`h-12 rounded-lg font-bold text-lg transition-all active:scale-95 ${
                played
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

      {!played && <p className="text-text-secondary text-sm mb-4">Выбрано: {selected.length}/5</p>}

      {played && resultDrawn && (
        <div className="text-center mb-4">
          <p className="text-text-secondary text-sm">Выпало: {resultDrawn.join(', ')}</p>
          <p className="text-white font-bold">Совпадений: {resultMatches}/5</p>
        </div>
      )}

      {/* Play button */}
      {!submitted && !disabled && (
        <button onClick={handlePlay} disabled={selected.length !== 5}
          className="bg-accent-gold text-black font-display font-black text-xl px-12 py-4 rounded-xl active:scale-95 transition-all disabled:opacity-30 glow-gold">
          ИГРАТЬ
        </button>
      )}
    </div>
  );
}
