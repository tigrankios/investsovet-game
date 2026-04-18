# Persistent Lobby & Game Restart — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make rooms persist after game ends so TV host can restart games or switch modes without players re-joining.

**Architecture:** Add `hostId` to GameState, new socket events (`selectGameMode`, `returnToLobby`, `closeRoom`, `roomClosed`), a `resetToLobby()` function that resets game state while preserving the player pool, and lobby inactivity timer. Remove `scheduleRoomCleanup`. Update all TV pages with mode selector + "В лобби" button, and all play pages with `roomClosed` handler.

**Tech Stack:** TypeScript, Socket.IO, React, Next.js, Tailwind CSS

---

### Task 1: Add types and socket event definitions

**Files:**
- Modify: `src/lib/types/shared.ts`

- [ ] **Step 1: Add `hostId` to `GameState` interface**

In `src/lib/types/shared.ts`, find the `GameState` interface (line ~181) and add `hostId` after `drawState`:

```typescript
  drawState: DrawRoundState | null;
  // Persistent lobby
  hostId: string | null;
}
```

- [ ] **Step 2: Add new events to `ServerToClientEvents`**

In `ServerToClientEvents` (line ~293), add before the closing `}`:

```typescript
  // Persistent lobby
  roomClosed: (data: { message: string }) => void;
```

- [ ] **Step 3: Add new events to `ClientToServerEvents`**

In `ClientToServerEvents` (line ~330), add before the closing `}`:

```typescript
  // Persistent lobby
  selectGameMode: (data: { gameMode: GameMode }) => void;
  returnToLobby: () => void;
  closeRoom: () => void;
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: Error in `engine/shared.ts` about missing `hostId` in `createGame` return — that's expected, fixed in Task 2.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types/shared.ts
git commit -m "feat: add persistent lobby types and socket events"
```

---

### Task 2: Add `resetToLobby` and update `createGame`

**Files:**
- Modify: `src/lib/engine/shared.ts`

- [ ] **Step 1: Add `hostId: null` to `createGame` return object**

In `src/lib/engine/shared.ts`, in the `createGame` function return object (line ~67), add after `drawState: null,`:

```typescript
    drawState: null,
    hostId: null,
```

- [ ] **Step 2: Add `resetToLobby` function**

Add at the end of `src/lib/engine/shared.ts`:

```typescript
export function resetToLobby(game: GameState): void {
  game.phase = 'lobby';
  game.roundNumber = 0;
  game.candles = [];
  game.visibleCandleCount = 0;
  game.currentPrice = 0;
  game.elapsed = 0;
  game.voteState = null;
  game.bonusState = null;
  game.lastAggressorId = null;
  game.marketMakerId = null;
  game.mmCasino = null;
  game.mmNextCandleModifier = 0;
  game.binaryState = null;
  game.drawState = null;

  // Reset all players to fresh state, keep identity + connection
  for (const player of game.players) {
    player.balance = INITIAL_BALANCE;
    player.position = null;
    player.pnl = 0;
    player.role = 'trader';
    player.skill = null;
    player.skillUsed = false;
    player.pnlMultiplier = 1;
    player.shieldActive = false;
    player.frozenBy = null;
    player.freezeTicksLeft = 0;
    player.blindTicksLeft = 0;
    player.maxBalance = INITIAL_BALANCE;
    player.worstTrade = 0;
    player.bestTrade = 0;
    player.totalTrades = 0;
    player.liquidations = 0;
  }
}
```

- [ ] **Step 3: Export `resetToLobby` from engine index**

In `src/lib/engine/index.ts`, the file already has `export * from './shared'`, so `resetToLobby` will be auto-exported. Verify this.

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: PASS (0 errors)

- [ ] **Step 5: Commit**

```bash
git add src/lib/engine/shared.ts
git commit -m "feat: add resetToLobby function and hostId to createGame"
```

---

### Task 3: Add server-side handlers for persistent lobby

**Files:**
- Modify: `src/server/shared-state.ts`
- Modify: `src/server/socket-handler.ts`

- [ ] **Step 1: Add `closeRoomNow` and lobby timer to `shared-state.ts`**

In `src/server/shared-state.ts`, add a new map for lobby timers and two new functions. Replace `scheduleRoomCleanup` with `closeRoomNow` and add `startLobbyInactivityTimer`:

```typescript
// Lobby inactivity timers (separate from game timers)
export const lobbyTimers = new Map<string, NodeJS.Timeout>();

const LOBBY_INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes

export function closeRoomNow(roomCode: string, io: SocketServer, message = 'Комната закрыта') {
  const game = rooms.get(roomCode);
  if (!game) return;

  io.to(roomCode).emit('roomClosed', { message });
  clearTimer(roomCode);
  const lobbyTimer = lobbyTimers.get(roomCode);
  if (lobbyTimer) {
    clearTimeout(lobbyTimer);
    lobbyTimers.delete(roomCode);
  }
  rooms.delete(roomCode);
  for (const player of game.players) {
    playerRooms.delete(player.id);
    playerNicknames.delete(player.id);
  }
  console.log(`[WS] Room ${roomCode} closed: ${message}`);
}

export function startLobbyInactivityTimer(roomCode: string, io: SocketServer) {
  // Clear any existing lobby timer
  const existing = lobbyTimers.get(roomCode);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    lobbyTimers.delete(roomCode);
    closeRoomNow(roomCode, io, 'Комната закрыта (неактивность)');
  }, LOBBY_INACTIVITY_MS);

  lobbyTimers.set(roomCode, timer);
}

export function cancelLobbyInactivityTimer(roomCode: string) {
  const timer = lobbyTimers.get(roomCode);
  if (timer) {
    clearTimeout(timer);
    lobbyTimers.delete(roomCode);
  }
}
```

Remove the old `scheduleRoomCleanup` function entirely.

- [ ] **Step 2: Update `socket-handler.ts` imports**

Replace the import of `scheduleRoomCleanup` with the new functions:

```typescript
import {
  rooms, playerRooms, playerNicknames, timers,
  broadcastState, broadcastLeaderboard, sendPlayerUpdate,
  clearTimer, shouldEndGame,
  closeRoomNow, startLobbyInactivityTimer, cancelLobbyInactivityTimer,
} from './shared-state';
```

Also update the re-export block to remove `scheduleRoomCleanup` and add new exports:

```typescript
export {
  rooms, playerRooms, playerNicknames, timers,
  broadcastState, broadcastLeaderboard, sendPlayerUpdate,
  clearTimer, shouldEndGame,
  closeRoomNow, startLobbyInactivityTimer, cancelLobbyInactivityTimer,
} from './shared-state';
```

- [ ] **Step 3: Save `hostId` on `createRoom`**

In `socket-handler.ts`, in the `createRoom` handler (line ~41), add `game.hostId = socket.id;` after `rooms.set(...)`:

```typescript
    socket.on('createRoom', async ({ gameMode }) => {
      const game = await createGame(gameMode);
      game.hostId = socket.id;
      rooms.set(game.roomCode, game);
      socket.join(game.roomCode);
      playerRooms.set(socket.id, game.roomCode);
      console.log(`[WS] Room created: ${game.roomCode} (${game.ticker}, ${game.roundDuration}s, ${game.candles.length} candles)`);
      broadcastState(io, game);
      startLobbyInactivityTimer(game.roomCode, io);
    });
```

- [ ] **Step 4: Add host validation helper**

Add a helper function at the top of `setupSocketHandlers`, right after the `io.on('connection', ...)` line:

```typescript
    function isHost(socket: GameSocket): { game: GameState; roomCode: string } | null {
      const roomCode = playerRooms.get(socket.id);
      if (!roomCode) return null;
      const game = rooms.get(roomCode);
      if (!game) return null;
      if (game.hostId !== socket.id) {
        socket.emit('error', 'Only the host can do this');
        return null;
      }
      return { game, roomCode };
    }
```

- [ ] **Step 5: Add host validation to `startGame`**

Update the `startGame` handler to validate the sender is the host. Replace lines 100-118:

```typescript
    socket.on('startGame', () => {
      const ctx = isHost(socket);
      if (!ctx) return;
      const { game, roomCode } = ctx;
      if (game.phase !== 'lobby') return;
      if (game.players.filter((p) => p.connected).length < 1) {
        socket.emit('error', 'Нужен хотя бы 1 игрок');
        return;
      }
      cancelLobbyInactivityTimer(roomCode);
      console.log(`[WS] Game starting in ${roomCode} (mode: ${game.gameMode})`);
      if (game.gameMode === 'binary') {
        binaryStartRound(roomCode, io);
      } else if (game.gameMode === 'market_maker') {
        mmStartTrading(io, game);
      } else if (game.gameMode === 'draw') {
        drawStartRound(roomCode, io);
      } else {
        classicStartTrading(io, game);
      }
    });
```

- [ ] **Step 6: Add `selectGameMode` handler**

Add after the `startGame` handler:

```typescript
    socket.on('selectGameMode', ({ gameMode }) => {
      const ctx = isHost(socket);
      if (!ctx) return;
      const { game } = ctx;
      if (game.phase !== 'lobby') {
        socket.emit('error', 'Can only change mode in lobby');
        return;
      }
      game.gameMode = gameMode;
      broadcastState(io, game);
      console.log(`[WS] Mode changed to ${gameMode} in ${game.roomCode}`);
    });
```

- [ ] **Step 7: Add `returnToLobby` handler**

Add the import for `resetToLobby` at the top of the file:

```typescript
import {
  createGame, addPlayer, removePlayer, getPlayer,
  getVoteResult, resetToLobby,
  spinSlots, spinWheel, openLootbox, playLoto, getBonusResults,
  useSkill, castVote,
} from '../lib/engine';
```

Add the handler:

```typescript
    socket.on('returnToLobby', () => {
      const ctx = isHost(socket);
      if (!ctx) return;
      const { game, roomCode } = ctx;
      if (game.phase !== 'finished') {
        socket.emit('error', 'Game must be finished first');
        return;
      }
      clearTimer(roomCode);
      resetToLobby(game);
      broadcastState(io, game);
      // Send fresh playerUpdate to all connected players
      for (const player of game.players) {
        if (player.connected) {
          sendPlayerUpdate(io, game, player.id);
        }
      }
      startLobbyInactivityTimer(roomCode, io);
      console.log(`[WS] Room ${roomCode} returned to lobby`);
    });
```

- [ ] **Step 8: Add `closeRoom` handler**

```typescript
    socket.on('closeRoom', () => {
      const ctx = isHost(socket);
      if (!ctx) return;
      closeRoomNow(ctx.roomCode, io);
    });
```

- [ ] **Step 9: Update host on reconnect**

In the `joinRoom` handler, in the reconnect block (line ~67-80), add host ID update. After `existing.id = socket.id;` add:

```typescript
        // Update hostId if this is the host reconnecting
        if (game.hostId === oldId) {
          game.hostId = socket.id;
        }
```

- [ ] **Step 10: Verify types compile**

Run: `npx tsc --noEmit`
Expected: PASS (0 errors)

- [ ] **Step 11: Commit**

```bash
git add src/server/shared-state.ts src/server/socket-handler.ts
git commit -m "feat: add persistent lobby server handlers (selectGameMode, returnToLobby, closeRoom)"
```

---

### Task 4: Remove `scheduleRoomCleanup` from all mode handlers

**Files:**
- Modify: `src/server/classic-handler.ts`
- Modify: `src/server/market-maker-handler.ts`
- Modify: `src/server/binary-handler.ts`
- Modify: `src/server/draw-handler.ts` (if exists)

- [ ] **Step 1: Find and remove all calls to `scheduleRoomCleanup`**

In each handler file, search for `scheduleRoomCleanup` and remove the call. The room should stay alive after `finished` phase. Keep the `game.phase = 'finished'` and `broadcastState` — just remove the cleanup scheduling.

In each file, also update the import to remove `scheduleRoomCleanup` if it's imported.

Example for `binary-handler.ts` — find:
```typescript
import {
  rooms, playerRooms, timers,
  broadcastState, broadcastLeaderboard, sendPlayerUpdate,
  clearTimer, scheduleRoomCleanup,
} from './shared-state';
```
Replace with:
```typescript
import {
  rooms, playerRooms, timers,
  broadcastState, broadcastLeaderboard, sendPlayerUpdate,
  clearTimer,
} from './shared-state';
```

And remove the line:
```typescript
    scheduleRoomCleanup(roomCode, game);
```

Repeat for all handler files that import or call `scheduleRoomCleanup`.

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: PASS (0 errors)

- [ ] **Step 3: Commit**

```bash
git add src/server/classic-handler.ts src/server/market-maker-handler.ts src/server/binary-handler.ts src/server/draw-handler.ts
git commit -m "refactor: remove scheduleRoomCleanup from all mode handlers"
```

---

### Task 5: Update `useGame` hook with new actions and `roomClosed` listener

**Files:**
- Modify: `src/lib/useGame.ts`

- [ ] **Step 1: Add `roomClosed` state and listener**

Add state:
```typescript
const [roomClosed, setRoomClosed] = useState<string | null>(null);
```

Add listener inside the `useEffect` (after the `error` listener):
```typescript
    socket.on('roomClosed', ({ message }: { message: string }) => {
      setRoomClosed(message);
    });
```

Add cleanup:
```typescript
      socket.off('roomClosed');
```

- [ ] **Step 2: Add new action callbacks**

Add after the existing callbacks:
```typescript
  const selectGameMode = useCallback((gameMode: GameMode) => {
    getSocket().emit('selectGameMode', { gameMode });
  }, []);

  const returnToLobby = useCallback(() => {
    getSocket().emit('returnToLobby');
  }, []);

  const closeRoom = useCallback(() => {
    getSocket().emit('closeRoom');
  }, []);
```

- [ ] **Step 3: Add to return object**

Update the return statement to include the new values:
```typescript
  return {
    gameState, playerState, leaderboard, countdown, roundResult,
    candles, currentPrice, tradeMessage, error, liquidationAlert,
    bonusResult, bonusData, finalStats, priceAlert, skillAlert,
    roomClosed,
    createRoom, joinRoom, startGame, openPosition, closePosition,
    spinSlots, spinWheel, openLootbox, playLoto,
    selectGameMode, returnToLobby, closeRoom,
  };
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: PASS (0 errors)

- [ ] **Step 5: Commit**

```bash
git add src/lib/useGame.ts
git commit -m "feat: add roomClosed listener and lobby actions to useGame hook"
```

---

### Task 6: Update TV pages with mode selector, "В лобби" button, and close room

**Files:**
- Modify: `src/app/tv/page.tsx`
- Modify: `src/app/tv-mm/page.tsx`
- Modify: `src/app/tv-binary/page.tsx`
- Modify: `src/app/tv-draw/page.tsx` (if exists)

For each TV page, apply the same three changes:

- [ ] **Step 1: Destructure new actions from hook**

Each TV page uses `useGame()`. Update the destructuring to include new actions:
```typescript
const {
  gameState, leaderboard, finalStats,
  createRoom, startGame,
  selectGameMode, returnToLobby, closeRoom, roomClosed,
  // ... other existing destructured values
} = useGame();
```

- [ ] **Step 2: Add `roomClosed` handler**

Add a `useEffect` that redirects to home on room closed:
```typescript
  const router = useRouter(); // add import if not present

  useEffect(() => {
    if (roomClosed) {
      setTimeout(() => router.push('/'), 3000);
    }
  }, [roomClosed, router]);
```

Add a render check early in the component (before the lobby/game phase checks):
```typescript
  if (roomClosed) {
    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center">
        <h2 className="text-3xl font-display font-bold text-accent-red mb-4">Комната закрыта</h2>
        <p className="text-text-secondary">{roomClosed}</p>
        <p className="text-text-muted mt-4">Перенаправление на главную...</p>
      </div>
    );
  }
```

- [ ] **Step 3: Add mode selector to lobby phase**

In each TV page's lobby render, add a mode selector with 4 buttons. Insert it between the player list and the Start button:

```tsx
{/* Mode selector */}
<div className="mt-6">
  <p className="text-text-secondary text-sm font-semibold uppercase tracking-wider mb-2">Режим</p>
  <div className="flex gap-2 flex-wrap">
    {([
      { mode: 'classic' as const, label: 'Классика', color: 'from-accent-gold to-amber-500' },
      { mode: 'market_maker' as const, label: 'Маркет-Мейкер', color: 'from-accent-purple to-purple-500' },
      { mode: 'binary' as const, label: 'Бинарные', color: 'from-accent-gold to-orange-500' },
      { mode: 'draw' as const, label: 'Нарисуй график', color: 'from-accent-purple to-violet-500' },
    ]).map(({ mode, label, color }) => (
      <button
        key={mode}
        onClick={() => selectGameMode(mode)}
        className={`px-4 py-2 rounded-lg font-display font-bold text-sm transition-all ${
          gameState.gameMode === mode
            ? `bg-gradient-to-r ${color} text-white scale-105`
            : 'bg-surface border border-border text-text-secondary hover:text-white'
        }`}
      >
        {label}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 4: Add "Закрыть комнату" button to lobby**

Add a small button in the top-right of the lobby screen:

```tsx
<button
  onClick={closeRoom}
  className="absolute top-4 right-4 text-sm text-text-muted hover:text-accent-red transition-colors"
>
  Закрыть комнату
</button>
```

- [ ] **Step 5: Add "В лобби" button to finished phase**

Find the finished phase render in each TV page. Add a button below the final stats table:

```tsx
<button
  onClick={returnToLobby}
  className="mt-6 bg-gradient-to-r from-accent-gold to-amber-500 text-background font-display font-bold text-xl py-4 px-8 rounded-xl hover:scale-105 transition-all"
>
  В ЛОББИ
</button>
```

- [ ] **Step 6: Repeat for all TV pages**

Apply steps 1-5 to each TV page: `tv/page.tsx`, `tv-mm/page.tsx`, `tv-binary/page.tsx`, and `tv-draw/page.tsx` (if it exists).

- [ ] **Step 7: Verify types compile**

Run: `npx tsc --noEmit`
Expected: PASS (0 errors)

- [ ] **Step 8: Commit**

```bash
git add src/app/tv/page.tsx src/app/tv-mm/page.tsx src/app/tv-binary/page.tsx src/app/tv-draw/page.tsx
git commit -m "feat: add mode selector, return-to-lobby, and close-room to all TV pages"
```

---

### Task 7: Update play pages with `roomClosed` handler

**Files:**
- Modify: `src/app/play/page.tsx`
- Modify: `src/app/play-mm/page.tsx`
- Modify: `src/app/play-binary/page.tsx`
- Modify: `src/app/play-draw/page.tsx` (if exists)

For each play page:

- [ ] **Step 1: Destructure `roomClosed` from hook**

Each play page uses a mode-specific hook (`useClassicGame`, `useMarketMakerGame`, `useBinaryGame`, etc.) which extends `useGame`. Since `roomClosed` is in the base hook, it should be available. Add it to destructuring:

```typescript
const {
  // ... existing values
  roomClosed,
} = useClassicGame(); // or useBinaryGame, etc.
```

- [ ] **Step 2: Add `roomClosed` render check**

Add early in the component, after the join/lobby checks:

```tsx
  if (roomClosed) {
    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center p-6">
        <h2 className="text-2xl font-display font-bold text-accent-red mb-4">Комната закрыта</h2>
        <p className="text-text-secondary mb-6">{roomClosed}</p>
        <Link href="/" className="bg-accent-green text-white font-display font-bold py-3 px-6 rounded-xl">
          На главную
        </Link>
      </div>
    );
  }
```

- [ ] **Step 3: Repeat for all play pages**

Apply steps 1-2 to `play/page.tsx`, `play-mm/page.tsx`, `play-binary/page.tsx`, and `play-draw/page.tsx` (if it exists).

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: PASS (0 errors)

- [ ] **Step 5: Commit**

```bash
git add src/app/play/page.tsx src/app/play-mm/page.tsx src/app/play-binary/page.tsx src/app/play-draw/page.tsx
git commit -m "feat: add roomClosed handler to all play pages"
```

---

### Task 8: End-to-end verification

- [ ] **Step 1: Start the dev server**

```bash
bun run dev
```

- [ ] **Step 2: Test full flow**

1. Open http://localhost:3000 → click "Классика — на ТВ"
2. TV lobby shows: QR code, mode selector, player list, Start button, Close room button
3. Open play page in another tab, join with a nickname
4. On TV: switch mode to "Бинарные" → player tab auto-redirects to `/play-binary`
5. On TV: click Start → game begins in binary mode
6. Play through to finished
7. On TV: click "В лобби" → both TV and player return to lobby
8. On TV: switch mode to "Классика" → player redirects to `/play`
9. On TV: click Start → new game begins in classic mode
10. On TV (lobby): click "Закрыть комнату" → both see "Комната закрыта", TV redirects to home

- [ ] **Step 3: Push**

```bash
git push origin main
```
