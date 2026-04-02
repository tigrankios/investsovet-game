'use client';

import { useState, useEffect } from 'react';

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
  const [landed, setLanded] = useState(false);
  const [result, setResult] = useState<number | null>(null);

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    setLanded(false);
    setResult(null);

    // Pick random sector
    const sectorIdx = Math.floor(Math.random() * 8);
    const sectorAngle = 360 - (sectorIdx * 45 + 22.5);
    const target = wheelAngle + 360 * 5 + sectorAngle;

    // Small delay then land
    setTimeout(() => {
      setWheelAngle(target);
    }, 50);

    setTimeout(() => {
      setSpinning(false);
      setLanded(true);
      setResult(sectorIdx);
    }, 3050);
  };

  const r = 120;
  const cx = 140;
  const cy = 140;
  const sectorAngle = 360 / sectors.length;

  return (
    <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center gap-6">
      <h1 className="text-3xl font-display font-black text-accent-gold">КОЛЕСО ФОРТУНЫ</h1>

      <div className="relative" style={{ width: 280, height: 280 }}>
        {/* Pointer */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
          <svg width="24" height="20" viewBox="0 0 24 20">
            <polygon points="12,20 0,0 24,0" fill="#FFD740" />
          </svg>
        </div>
        {/* Wheel */}
        <svg
          width={280} height={280} viewBox="0 0 280 280"
          style={{
            transform: `rotate(${wheelAngle}deg)`,
            transition: spinning ? 'transform 3s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
          }}
        >
          {sectors.map((sec, i) => {
            const startA = (i * sectorAngle - 90) * Math.PI / 180;
            const endA = ((i + 1) * sectorAngle - 90) * Math.PI / 180;
            const x1 = cx + r * Math.cos(startA);
            const y1 = cy + r * Math.sin(startA);
            const x2 = cx + r * Math.cos(endA);
            const y2 = cy + r * Math.sin(endA);
            const midA = ((i + 0.5) * sectorAngle - 90) * Math.PI / 180;
            const tx = cx + (r * 0.65) * Math.cos(midA);
            const ty = cy + (r * 0.65) * Math.sin(midA);
            const textRot = (i + 0.5) * sectorAngle;

            return (
              <g key={i}>
                <path
                  d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2} Z`}
                  fill={sec.color}
                  stroke="#0B0E17"
                  strokeWidth={2}
                />
                <text
                  x={tx} y={ty}
                  fill="white" fontSize={13} fontWeight="bold"
                  textAnchor="middle" dominantBaseline="middle"
                  transform={`rotate(${textRot}, ${tx}, ${ty})`}
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                >
                  {sec.label}
                </text>
              </g>
            );
          })}
          <circle cx={cx} cy={cy} r={20} fill="#0B0E17" stroke="#1E2333" strokeWidth={3} />
          <circle cx={cx} cy={cy} r={8} fill="#FFD740" />
        </svg>
      </div>

      {landed && result !== null && (
        <p className="text-2xl font-display font-black" style={{ color: sectors[result].color }}>
          {sectors[result].label}
        </p>
      )}

      <button
        onClick={spin}
        disabled={spinning}
        className="bg-accent-gold text-black font-display font-black text-xl px-12 py-4 rounded-xl active:scale-95 transition-all disabled:opacity-30 glow-gold"
      >
        КРУТИТЬ
      </button>
    </div>
  );
}
