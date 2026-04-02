'use client';

import { useState, useEffect, useRef } from 'react';

const SYMBOLS = ['₿', 'Ξ', '🐕', '🚀', '💎', '🌕'];

interface SlotsGameProps {
  onSpin: () => void;
  resultReels: string[] | null;
  resultMultiplier: number | null;
  disabled: boolean;
}

export function SlotsGame({ onSpin, resultReels, resultMultiplier, disabled }: SlotsGameProps) {
  const [displayReels, setDisplayReels] = useState(['?', '?', '?']);
  const [animating, setAnimating] = useState(false);
  const [done, setDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleSpin = () => {
    if (animating || disabled) return;
    setAnimating(true);
    setDone(false);

    let ticks = 0;
    intervalRef.current = setInterval(() => {
      setDisplayReels([
        SYMBOLS[Math.floor(Math.random() * 6)],
        SYMBOLS[Math.floor(Math.random() * 6)],
        SYMBOLS[Math.floor(Math.random() * 6)],
      ]);
      ticks++;
      if (ticks >= 15) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        onSpin();
      }
    }, 100);
  };

  // When result arrives, show final reels
  useEffect(() => {
    if (!resultReels || !animating) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setDisplayReels([...resultReels]);
    setAnimating(false);
    setDone(true);
  }, [resultReels]);

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const showReels = done && resultReels ? resultReels : displayReels;
  const isWin = done && resultMultiplier !== null && resultMultiplier > 0;

  return (
    <div className="flex flex-col items-center">
      <div className="flex gap-4 mb-6">
        {showReels.map((sym, i) => (
          <div key={i} className={`w-24 h-24 bg-surface border-2 rounded-xl flex items-center justify-center text-5xl transition-all ${
            animating ? 'border-accent-gold animate-pulse' : isWin ? 'border-accent-green glow-green' : 'border-border-light'
          }`}>
            {sym}
          </div>
        ))}
      </div>

      {/* Result */}
      {done && resultMultiplier !== null && (
        <div className="text-center mb-4">
          <p className={`text-3xl font-display font-black ${isWin ? 'text-accent-green' : 'text-accent-red'}`}>
            {isWin ? `x${resultMultiplier}` : 'МИМО'}
          </p>
          {resultMultiplier >= 5 && <p className="text-accent-gold font-display font-black text-lg animate-bounce mt-1">JACKPOT!</p>}
        </div>
      )}

      {/* Spin button */}
      {!done && !animating && (
        <button onClick={handleSpin} disabled={disabled}
          className="bg-accent-gold text-black font-display font-black text-xl px-12 py-4 rounded-xl active:scale-95 transition-all disabled:opacity-30 glow-gold">
          КРУТИТЬ
        </button>
      )}

      {animating && (
        <p className="text-accent-gold text-xl animate-pulse font-bold">Крутим...</p>
      )}
    </div>
  );
}
