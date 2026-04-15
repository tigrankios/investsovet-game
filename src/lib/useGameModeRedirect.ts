'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { ClientGameState, GameMode } from './types';

const MODE_ROUTES: Record<GameMode, string> = {
  classic: '/play',
  market_maker: '/play-mm',
  binary: '/play-binary',
  draw: '/play-draw',
};

/**
 * Redirects player to the correct /play-* page if they joined a room
 * with a different game mode than the current page expects.
 *
 * Usage: useGameModeRedirect(gameState, 'classic', roomCode);
 */
export function useGameModeRedirect(
  gameState: ClientGameState | null,
  expectedMode: GameMode,
  roomCode: string,
) {
  const router = useRouter();

  useEffect(() => {
    if (!gameState || !roomCode) return;
    if (gameState.gameMode !== expectedMode) {
      const target = MODE_ROUTES[gameState.gameMode] ?? '/play';
      router.replace(`${target}?room=${roomCode}`);
    }
  }, [gameState?.gameMode, expectedMode, roomCode, router]);
}
