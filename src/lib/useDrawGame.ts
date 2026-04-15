'use client';

import { useEffect, useState, useCallback } from 'react';
import { useGame, getSocket } from './useGame';
import { SKILL_NAMES, SKILL_EMOJIS } from './types';
import type { SkillType, Candle } from './types';

export interface DrawPoint {
  x: number; // 0-1, normalized X position
  y: number; // 0-1, normalized Y position (0=top=high price, 1=bottom=low price)
}

export function useDrawGame() {
  const game = useGame();

  // Classic skill alerts (reused from useClassicGame)
  const [skillAlert, setSkillAlert] = useState('');

  // Draw-specific state
  const [drawTimer, setDrawTimer] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [previewCandles, setPreviewCandles] = useState<Candle[]>([]);
  const [mmLiquidationAlert, setMmLiquidationAlert] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();

    socket.on('skillAssigned', () => {
      // playerUpdate will carry the skill info
    });

    socket.on('skillUsed', ({ nickname, skill }: { nickname: string; skill: SkillType }) => {
      const emoji = SKILL_EMOJIS[skill as SkillType] || '';
      const name = SKILL_NAMES[skill as SkillType] || skill;
      setSkillAlert(`${nickname}: ${emoji} ${name.toUpperCase()}!`);
      setTimeout(() => setSkillAlert(''), 3000);
    });

    socket.on('drawPhase', ({ timer }: { timer: number }) => {
      setDrawTimer(timer);
      setIsDrawing(true);
    });

    socket.on('drawPreview', ({ candles }: { candles: Candle[] }) => {
      setPreviewCandles(candles);
      setIsDrawing(false);
    });

    socket.on('mmLiquidationBonus', ({ nickname, amount }: { nickname: string; amount: number }) => {
      setMmLiquidationAlert(`${nickname} ликвидирован! +$${amount.toFixed(0)}`);
      setTimeout(() => setMmLiquidationAlert(null), 3000);
    });

    return () => {
      socket.off('skillAssigned');
      socket.off('skillUsed');
      socket.off('drawPhase');
      socket.off('drawPreview');
      socket.off('mmLiquidationBonus');
    };
  }, []);

  // Reset draw state on phase changes
  useEffect(() => {
    if (game.gameState?.phase === 'countdown') {
      setIsDrawing(false);
      setPreviewCandles([]);
    }
  }, [game.gameState?.phase]);

  const submitDrawing = useCallback((points: DrawPoint[]) => {
    getSocket().emit('submitDrawing', { points });
  }, []);

  const usePlayerSkill = useCallback(() => {
    getSocket().emit('useSkill');
  }, []);

  const voteNextRound = useCallback((vote: boolean) => {
    getSocket().emit('voteNextRound', { vote });
  }, []);

  return {
    ...game,
    skillAlert,
    drawTimer,
    isDrawing,
    previewCandles,
    mmLiquidationAlert,
    submitDrawing,
    usePlayerSkill,
    voteNextRound,
  };
}
