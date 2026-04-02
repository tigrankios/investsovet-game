'use client';

import { useEffect, useState, useCallback } from 'react';
import { useGame, getSocket } from './useGame';
import { SKILL_NAMES, SKILL_EMOJIS } from './types';
import type { SkillType } from './types';

export function useClassicGame() {
  const game = useGame();

  const [skillAlert, setSkillAlert] = useState('');

  useEffect(() => {
    const socket = getSocket();

    socket.on('skillAssigned', () => {
      // playerUpdate will carry the skill info
    });

    socket.on('skillUsed', ({ nickname, skill }) => {
      const emoji = SKILL_EMOJIS[skill as SkillType] || '';
      const name = SKILL_NAMES[skill as SkillType] || skill;
      setSkillAlert(`${nickname}: ${emoji} ${name.toUpperCase()}!`);
      setTimeout(() => setSkillAlert(''), 3000);
    });

    return () => {
      socket.off('skillAssigned');
      socket.off('skillUsed');
    };
  }, []);

  const usePlayerSkill = useCallback(() => getSocket().emit('useSkill'), []);

  return { ...game, skillAlert, usePlayerSkill };
}
