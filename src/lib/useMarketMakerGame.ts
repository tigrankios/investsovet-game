'use client';

import { useEffect, useState, useCallback } from 'react';
import { useGame, getSocket } from './useGame';
import type { MMLeverType } from './types';

export function useMarketMakerGame() {
  const game = useGame();

  const [mmLeverAlert, setMmLeverAlert] = useState('');
  const [mmRentAlert, setMmRentAlert] = useState('');
  const [mmResult, setMmResult] = useState<{ mmWon: boolean; mmBalance: number; tradersAvg: number; mmNickname: string } | null>(null);

  useEffect(() => {
    const socket = getSocket();

    socket.on('mmLeverUsed', ({ lever, duration }) => {
      const names: Record<string, string> = {
        commission: 'КОМИССИЯ x3',
        freeze: 'ЗАМОРОЗКА',
        squeeze: 'СЖАТИЕ',
      };
      setMmLeverAlert(`${names[lever] || lever} (${duration}s)`);
      setTimeout(() => setMmLeverAlert(''), duration * 1000);
    });

    socket.on('mmRentTick', ({ amount }) => {
      setMmRentAlert(`-$${amount}`);
      setTimeout(() => setMmRentAlert(''), 1500);
    });

    socket.on('mmInactivityPenalty', () => {
      setMmLeverAlert('ММ БЕЗДЕЙСТВУЕТ! +$200 бонус!');
      setTimeout(() => setMmLeverAlert(''), 3000);
    });

    socket.on('marketMakerResult', (data) => setMmResult(data));

    return () => {
      socket.off('mmLeverUsed');
      socket.off('mmRentTick');
      socket.off('mmInactivityPenalty');
      socket.off('marketMakerResult');
    };
  }, []);

  const useMMLever = useCallback((lever: MMLeverType) => {
    getSocket().emit('useMMLever', { lever });
  }, []);

  return { ...game, mmLeverAlert, mmRentAlert, mmResult, useMMLever };
}
