'use client';

import { useState, useEffect, useRef } from 'react';

export const WHEEL_SECTORS_DISPLAY = [
  { label: 'BUST', color: '#FF1744', mult: 0 },
  { label: 'x0.5', color: '#FF6D00', mult: 0.5 },
  { label: 'x1.5', color: '#546E7A', mult: 1.5 },
  { label: 'x2', color: '#00E676', mult: 2 },
  { label: 'x3', color: '#448AFF', mult: 3 },
  { label: 'x5', color: '#B388FF', mult: 5 },
  { label: 'x10', color: '#FFD740', mult: 10 },
  { label: 'x25', color: '#FF4081', mult: 25 },
];

interface WheelGameProps {
  onSpin: () => void;
  resultSectorIndex: number | null;
  disabled: boolean;
}

export function WheelGame({ onSpin, resultSectorIndex, disabled }: WheelGameProps) {
  const [wheelAngle, setWheelAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleSpin = () => {
    if (spinning || disabled) return;
    setSpinning(true);
    setLanded(false);
    onSpin();

    // Start fast spin
    let angle = wheelAngle;
    intervalRef.current = setInterval(() => {
      angle += 15;
      setWheelAngle(angle);
    }, 16);
  };

  // When result arrives, decelerate to target sector
  useEffect(() => {
    if (resultSectorIndex === null || !spinning) return;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const landAngle = 360 - (resultSectorIndex * 45 + 22.5);
    const currentMod = wheelAngle % 360;
    const extra = landAngle <= currentMod ? 360 : 0;
    const target = wheelAngle - currentMod + 360 * 5 + landAngle + extra;

    setWheelAngle(target);

    const timeout = setTimeout(() => {
      setSpinning(false);
      setLanded(true);
    }, 3000);

    return () => clearTimeout(timeout);
  }, [resultSectorIndex]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const r = 120, cx = 140, cy = 140;
  const sa = 360 / WHEEL_SECTORS_DISPLAY.length;

  return (
    <div className="flex flex-col items-center">
      <div className="relative mb-4" style={{ width: 280, height: 280 }}>
        {/* Pointer */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
          <svg width="24" height="20" viewBox="0 0 24 20"><polygon points="12,20 0,0 24,0" fill="#FFD740" /></svg>
        </div>
        {/* Wheel */}
        <svg width={280} height={280} viewBox="0 0 280 280"
          style={{
            transform: `rotate(${wheelAngle}deg)`,
            transition: spinning && resultSectorIndex !== null ? 'transform 3s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
          }}>
          {WHEEL_SECTORS_DISPLAY.map((sec, i) => {
            const a1 = (i * sa - 90) * Math.PI / 180;
            const a2 = ((i + 1) * sa - 90) * Math.PI / 180;
            const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
            const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
            const ma = ((i + 0.5) * sa - 90) * Math.PI / 180;
            const tx = cx + r * 0.65 * Math.cos(ma), ty = cy + r * 0.65 * Math.sin(ma);
            return (
              <g key={i}>
                <path d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2} Z`} fill={sec.color} stroke="#0B0E17" strokeWidth={2} />
                <text x={tx} y={ty} fill="white" fontSize={13} fontWeight="bold" textAnchor="middle" dominantBaseline="middle"
                  transform={`rotate(${(i + 0.5) * sa}, ${tx}, ${ty})`} style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>{sec.label}</text>
              </g>
            );
          })}
          <circle cx={cx} cy={cy} r={20} fill="#0B0E17" stroke="#1E2333" strokeWidth={3} />
          <circle cx={cx} cy={cy} r={8} fill="#FFD740" />
        </svg>
      </div>

      {/* Result */}
      {landed && resultSectorIndex !== null && (
        <div className="text-center mb-4">
          <p className="text-3xl font-display font-black" style={{ color: WHEEL_SECTORS_DISPLAY[resultSectorIndex].color }}>
            {WHEEL_SECTORS_DISPLAY[resultSectorIndex].label}
          </p>
        </div>
      )}

      {/* Spin button */}
      {!landed && !spinning && (
        <button onClick={handleSpin} disabled={disabled}
          className="bg-accent-gold text-black font-display font-black text-xl px-12 py-4 rounded-xl active:scale-95 transition-all disabled:opacity-30 glow-gold">
          КРУТИТЬ
        </button>
      )}
    </div>
  );
}
