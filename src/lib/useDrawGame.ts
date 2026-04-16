'use client';

import { useEffect, useState, useCallback } from 'react';
import { useGame, getSocket } from './useGame';
import type { DrawPoint } from './types';

export function useDrawGame() {
  const game = useGame();

  // Draw-specific state
  const [drawTimer, setDrawTimer] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mmLiquidationAlert, setMmLiquidationAlert] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();

    socket.on('drawPhase', ({ timer }: { timer: number }) => {
      setDrawTimer(timer);
      setIsDrawing(true);
    });

    socket.on('mmLiquidationBonus', ({ nickname, amount }: { nickname: string; amount: number }) => {
      setMmLiquidationAlert(`${nickname} ликвидирован! +$${amount.toFixed(0)}`);
      setTimeout(() => setMmLiquidationAlert(null), 3000);
    });

    return () => {
      socket.off('drawPhase');
      socket.off('mmLiquidationBonus');
    };
  }, []);

  // Reset draw state on phase changes
  useEffect(() => {
    if (game.gameState?.phase === 'countdown') {
      setIsDrawing(false);
    }
  }, [game.gameState?.phase]);

  const submitDrawing = useCallback((points: DrawPoint[]) => {
    getSocket().emit('submitDrawing', { points });
  }, []);

  const usePlayerSkill = useCallback(() => {
    getSocket().emit('useSkill');
  }, []);

  return {
    ...game,
    drawTimer,
    isDrawing,
    mmLiquidationAlert,
    submitDrawing,
    usePlayerSkill,
  };
}
