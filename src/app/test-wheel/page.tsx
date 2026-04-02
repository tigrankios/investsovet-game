'use client';

import { useState } from 'react';

const sectors = [
  { label: 'BUST', color: '#FF1744', mult: 0 },
  { label: 'x0.5', color: '#FF6D00', mult: 0.5 },
  { label: 'x1.5', color: '#546E7A', mult: 1.5 },
  { label: 'x2', color: '#00E676', mult: 2 },
  { label: 'x3', color: '#448AFF', mult: 3 },
  { label: 'x5', color: '#B388FF', mult: 5 },
  { label: 'x10', color: '#FFD740', mult: 10 },
  { label: 'x25', color: '#FF4081', mult: 25 },
];

export default function TestWheel() {
  const [wheelAngle, setWheelAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [balance, setBalance] = useState(10000);
  const [bet, setBet] = useState(1000);

  const spin = () => {
    if (spinning || bet <= 0 || bet > balance) return;
    setSpinning(true);
    setResult(null);

    const sectorIdx = Math.floor(Math.random() * 8);
    // Сектор i начинается с i*45° от верха. Чтобы центр сектора совпал с указателем,
    // нужно повернуть на -(i*45 + 22.5)° т.е. 360 - (i*45 + 22.5).
    // Прибавляем полных оборотов от текущей позиции.
    const landAngle = 360 - (sectorIdx * 45 + 22.5);
    const currentMod = wheelAngle % 360;
    const extraRotation = landAngle <= currentMod ? 360 : 0;
    const target = wheelAngle - currentMod + 360 * 5 + landAngle + extraRotation;

    setTimeout(() => setWheelAngle(target), 50);

    setTimeout(() => {
      setSpinning(false);
      setResult(sectorIdx);
      const mult = sectors[sectorIdx].mult;
      const win = mult === 0 ? -bet : Math.round(bet * mult - bet);
      setBalance((b) => Math.max(0, b + win));
    }, 3050);
  };

  const r = 120, cx = 140, cy = 140;
  const sa = 360 / sectors.length;

  return (
    <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center gap-4 p-6">
      <a href="/test-games" className="absolute top-4 left-4 text-text-secondary hover:text-text-primary text-sm">&larr; Назад</a>
      <h1 className="text-3xl font-display font-black text-accent-gold">КОЛЕСО ФОРТУНЫ</h1>
      <p className="text-text-secondary font-mono">Баланс: ${balance.toLocaleString()}</p>

      <div className="relative" style={{ width: 280, height: 280 }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
          <svg width="24" height="20" viewBox="0 0 24 20"><polygon points="12,20 0,0 24,0" fill="#FFD740" /></svg>
        </div>
        <svg width={280} height={280} viewBox="0 0 280 280"
          style={{ transform: `rotate(${wheelAngle}deg)`, transition: spinning ? 'transform 3s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none' }}>
          {sectors.map((sec, i) => {
            const a1 = (i * sa - 90) * Math.PI / 180, a2 = ((i+1) * sa - 90) * Math.PI / 180;
            const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
            const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
            const ma = ((i+0.5) * sa - 90) * Math.PI / 180;
            const tx = cx + r*0.65 * Math.cos(ma), ty = cy + r*0.65 * Math.sin(ma);
            return (
              <g key={i}>
                <path d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2} Z`} fill={sec.color} stroke="#0B0E17" strokeWidth={2} />
                <text x={tx} y={ty} fill="white" fontSize={13} fontWeight="bold" textAnchor="middle" dominantBaseline="middle"
                  transform={`rotate(${(i+0.5)*sa}, ${tx}, ${ty})`} style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>{sec.label}</text>
              </g>
            );
          })}
          <circle cx={cx} cy={cy} r={20} fill="#0B0E17" stroke="#1E2333" strokeWidth={3} />
          <circle cx={cx} cy={cy} r={8} fill="#FFD740" />
        </svg>
      </div>

      {result !== null && (
        <div className="text-center">
          <p className="text-3xl font-display font-black" style={{ color: sectors[result].color }}>{sectors[result].label}</p>
          <p className={`text-lg font-mono ${sectors[result].mult > 0 ? 'text-accent-green' : 'text-accent-red'}`}>
            {sectors[result].mult === 0 ? `-${bet}$` : `+${Math.round(bet * sectors[result].mult - bet)}$`}
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

      <button onClick={spin} disabled={spinning || balance <= 0}
        className="bg-accent-gold text-black font-display font-black text-xl px-12 py-4 rounded-xl active:scale-95 transition-all disabled:opacity-30 glow-gold">
        КРУТИТЬ
      </button>
    </div>
  );
}
