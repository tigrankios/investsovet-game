# Persistent Lobby & Game Restart — Design Spec

## Overview

Redesign room lifecycle so that rooms persist after a game ends. Players stay connected, and the TV host can select a different game mode or restart — all without anyone re-joining.

## Current vs New Room Lifecycle

**Current:** `createRoom → lobby → countdown → trading → ... → finished → room deleted (5min)`

**New:** `createRoom → lobby → [select mode] → countdown → trading → ... → finished → [TV: "В лобби"] → lobby → [select mode] → ...`

The room only dies when the host explicitly closes it or after 30 minutes of inactivity in lobby.

## Host Identity

The first socket that calls `createRoom` is the host. Their socket ID is stored as `game.hostId`. Only the host can:
- `selectGameMode` — change game mode in lobby
- `startGame` — start the game
- `returnToLobby` — return to lobby after finished
- `closeRoom` — destroy the room

On host reconnect: if a socket reconnects with the same session (matching the TV page's stored room code), update `game.hostId` to the new socket ID.

## New Socket Events

| Event | Direction | Data | Who |
|-------|-----------|------|-----|
| `selectGameMode` | Client → Server | `{ gameMode: GameMode }` | Host only |
| `returnToLobby` | Client → Server | — | Host only |
| `closeRoom` | Client → Server | — | Host only |
| `roomClosed` | Server → Client | `{ message: string }` | Broadcast to all |

## Server: `resetToLobby(game)`

Called when host sends `returnToLobby`. Resets game state while preserving the player pool.

**Resets:**
- `game.phase` → `'lobby'`
- `game.roundNumber` → 0
- All player balances → $10,000 (INITIAL_BALANCE)
- All player positions → null
- All player PnL, stats → 0
- All player skills, effects → cleared
- `game.binaryState` → null
- `game.mmCasino` → null
- `game.bonusState` → null
- `game.voteState` → null
- `game.candles` → []
- `game.visibleCandleCount` → 0
- `game.currentPrice` → 0
- `game.elapsed` → 0
- `game.marketMakerId` → null
- All active timers for the room → cleared

**Preserves:**
- `game.roomCode`
- `game.gameMode` (last used, host can change before next start)
- `game.players` array (id, nickname, connected status)
- `game.hostId`

## Server: `closeRoom`

Called when host sends `closeRoom` or after 30 minutes of lobby inactivity.

- Emit `roomClosed` to all sockets in the room
- Clear all timers
- Remove room from `rooms` map
- Clean up `playerRooms` and `playerNicknames` for all players

## Server: `selectGameMode`

- Validate sender is host
- Validate phase is `'lobby'`
- Update `game.gameMode`
- `broadcastState(io, game)` — all clients receive updated mode

## Lobby Inactivity Timer

- Start a 30-minute timer when room enters `'lobby'` phase
- Cancel the timer when `startGame` is called
- If timer fires: call `closeRoom` logic automatically
- Reset timer on each `returnToLobby`

## Remove `scheduleRoomCleanup`

The current 5-minute cleanup timer after `finished` is removed. Rooms now wait for the host's action (return to lobby or close).

## TV UI Changes (All TV Pages)

### Lobby Phase
Add to existing lobby screen:
- **Mode selector:** 4 buttons (Классика / Маркет-Мейкер / Бинарные / Нарисуй график), highlighted = currently selected `gameMode`
- **Close room button:** "Закрыть комнату" — top-right, small, secondary style
- Existing elements stay: QR code, room code, player list, Start button

### Finished Phase
Add:
- **"В лобби" button** — prominent, below or next to the final stats table
- When clicked: emits `returnToLobby`, server resets game, all clients return to lobby

### `roomClosed` Handler
- Show "Комната закрыта" message
- Redirect to `/` after 3 seconds

## Play UI Changes (All Play Pages)

### Lobby Phase (after return from finished)
- Show "Ждём следующую игру..." (same as current lobby, minus join form since already joined)

### `roomClosed` Handler
- Show "Комната закрыта" + button to go to `/`

### Auto-redirect on Mode Change
- `useGameModeRedirect` already handles this: when `gameState.gameMode` changes in lobby, player auto-redirects to the correct `/play-*` page
- No additional work needed

## Scope — What This Does NOT Include

- Merging TV pages into one (Этап 2)
- Merging play pages into one (Этап 2)
- Player kicking/banning
- Spectator mode
- Chat or messaging between players

## Files to Modify

### Server
- `src/server/shared-state.ts` — add `resetToLobby`, remove `scheduleRoomCleanup`, add lobby inactivity timer
- `src/server/socket-handler.ts` — add `selectGameMode`, `returnToLobby`, `closeRoom` handlers; save hostId on createRoom; validate host for restricted events
- `src/lib/types/shared.ts` — add new events to ServerToClientEvents and ClientToServerEvents; add `hostId` to GameState
- `src/lib/engine/shared.ts` — add `resetToLobby` function (or put in shared-state)

### Client
- `src/lib/useGame.ts` — add `roomClosed` listener, `selectGameMode`/`returnToLobby`/`closeRoom` actions
- `src/app/tv/page.tsx` — mode selector in lobby, "В лобби" button in finished, "Закрыть комнату" button, roomClosed handler
- `src/app/tv-mm/page.tsx` — same changes
- `src/app/tv-binary/page.tsx` — same changes
- `src/app/tv-draw/page.tsx` — same changes (if exists)
- `src/app/play/page.tsx` — roomClosed handler, lobby-after-finished UI
- `src/app/play-mm/page.tsx` — same
- `src/app/play-binary/page.tsx` — same
- `src/app/play-draw/page.tsx` — same (if exists)
