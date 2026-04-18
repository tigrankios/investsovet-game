# Merge Pages — Design Spec (Stage 2)

## Overview

Collapse 8 pages (4 TV + 4 play) into 2 pages (`/tv` + `/play`). Game mode determined by `gameState.gameMode`, not URL. Each mode's trading UI extracted into dedicated components.

## Architecture

**Pages:**
- `/tv/page.tsx` — orchestrator: lobby, countdown, finished, mode switch → delegates to mode TV component
- `/play/page.tsx` — orchestrator: join, lobby, countdown, finished, mode switch → delegates to mode play component

**Mode components:**
```
src/components/modes/
├── classic/
│   ├── ClassicTV.tsx
│   └── ClassicPlay.tsx
├── market-maker/
│   ├── MarketMakerTV.tsx
│   └── MarketMakerPlay.tsx
├── binary/
│   ├── BinaryTV.tsx
│   └── BinaryPlay.tsx
└── draw/
    ├── DrawTV.tsx
    └── DrawPlay.tsx
```

**Hooks:**
- `useGame` stays as the single base hook (no mode-specific hooks)
- Mode-specific socket listeners live inside their components via `useEffect`
- Delete: `useClassicGame.ts`, `useMarketMakerGame.ts`, `useBinaryGame.ts`

**Deleted pages:**
- `src/app/tv-mm/` — delete
- `src/app/tv-binary/` — delete
- `src/app/tv-draw/` — delete
- `src/app/play-mm/` — delete
- `src/app/play-binary/` — delete
- `src/app/play-draw/` — delete

**Deleted hooks:**
- `src/lib/useClassicGame.ts` — delete
- `src/lib/useMarketMakerGame.ts` — delete
- `src/lib/useBinaryGame.ts` — delete

**Other changes:**
- `src/lib/useGameModeRedirect.ts` — delete (no longer needed, single page handles all modes)
- `src/app/page.tsx` — simplify: only "Создать комнату (TV)" → `/tv` and "Войти как игрок" → `/play`
- QR code join URL: `/play?room=XXXXX` (single URL for all modes)

## Component Props

Each mode component receives the base game state and actions from the orchestrator:

```typescript
interface ModeComponentProps {
  // From useGame
  gameState: ClientGameState;
  playerState: ClientPlayerState | null;
  leaderboard: LeaderboardEntry[];
  candles: Candle[];
  currentPrice: number;
  // Actions
  openPosition: (direction, size, leverage) => void;
  closePosition: () => void;
  // ... other shared actions
}
```

Mode-specific state (binaryRound, myBet, etc.) is managed inside the component with local useState + socket listeners.

## Orchestrator Logic

```typescript
// tv/page.tsx (simplified)
function TVPage() {
  const game = useGame();

  if (roomClosed) return <RoomClosedScreen />;
  if (!gameState) return <Loading />;
  if (phase === 'lobby') return <Lobby />; // with mode selector
  if (phase === 'countdown') return <Countdown />;
  if (phase === 'finished') return <Finished />;

  // Trading phases — delegate to mode component
  switch (gameState.gameMode) {
    case 'classic': return <ClassicTV {...props} />;
    case 'market_maker': return <MarketMakerTV {...props} />;
    case 'binary': return <BinaryTV {...props} />;
    case 'draw': return <DrawTV {...props} />;
  }
}
```

## Not Included
- No new features
- No visual changes (components look identical to current pages)
- No server changes
