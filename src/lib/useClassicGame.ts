'use client';

import { useCallback } from 'react';
import { useGame, getSocket } from './useGame';

export function useClassicGame() {
  const game = useGame();

  const usePlayerSkill = useCallback(() => getSocket().emit('useSkill'), []);

  return { ...game, usePlayerSkill };
}
