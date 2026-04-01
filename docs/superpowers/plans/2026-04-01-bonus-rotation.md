# Bonus Phase Rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static `slots` phase with a rotating `bonus` phase that cycles through Wheel, Slots, and Lootbox mini-games based on round number.

**Architecture:** The `slots` phase becomes `bonus`. A `BonusType` discriminator selects the mini-game. Game engine gets two new functions (`spinWheel`, `openLootbox`) alongside existing `spinSlots`. Socket events are unified under `bonus*` names. UI renders conditionally based on bonus type.

**Tech Stack:** TypeScript, Socket.IO, React, Tailwind CSS, Next.js

---

### Task 1: Update Types

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add bonus types and replace slot phase**

Replace the `SlotState` interface and add new types. Change `GamePhase` to use `'bonus'` instead of `'slots'`. Add `BONUS_TIMER_SEC` constant.

In `src/lib/types.ts`, make these changes:

1. After the `SlotResult` interface (line 46), add the new types:

```typescript
// --- Bonus Phase (rotating mini-games) ---
export type BonusType = 'wheel' | 'slots' | 'lootbox';
export const BONUS_TIMER_SEC = 15;

export interface WheelSector {
  multiplier: number;
  label: string;
  weight: number;
}

export const WHEEL_SECTORS: WheelSector[] = [
  { multiplier: 0,    label: 'BUST',     weight: 3 },
  { multiplier: 0.5,  label: 'x0.5',     weight: 2 },
  { multiplier: 1.5,  label: 'x1.5',     weight: 3 },
  { multiplier: 2,    label: 'x2',       weight: 3 },
  { multiplier: 3,    label: 'x3',       weight: 2 },
  { multiplier: 5,    label: 'x5',       weight: 2 },
  { multiplier: 10,   label: 'x10',      weight: 0.8 },
  { multiplier: 25,   label: 'x25 JACKPOT', weight: 0.2 },
];

export const LOOTBOX_POOL = [
  { multiplier: 0,   weight: 3 },
  { multiplier: 0.5, weight: 2 },
  { multiplier: 1.5, weight: 3 },
  { multiplier: 2,   weight: 3 },
  { multiplier: 3,   weight: 2 },
  { multiplier: 5,   weight: 1.5 },
  { multiplier: 10,  weight: 0.8 },
  { multiplier: 50,  weight: 0.2 },
];

export interface WheelResult {
  sectorIndex: number;
  multiplier: number;
  bet: number;
  winAmount: number;
}

export interface LootboxResult {
  boxes: number[];
  chosenIndex: number;
  multiplier: number;
  bet: number;
  winAmount: number;
}

export type BonusResult =
  | { type: 'slots'; result: SlotResult }
  | { type: 'wheel'; result: WheelResult }
  | { type: 'lootbox'; result: LootboxResult };

export interface BonusState {
  bonusType: BonusType;
  played: Record<string, BonusResult>;
  timer: number;
}
```

2. In `GamePhase` (line 49-55), replace `'slots'` with `'bonus'`:

```typescript
export type GamePhase =
  | 'lobby'
  | 'countdown'
  | 'trading'
  | 'bonus'        // rotating mini-game after round
  | 'voting'
  | 'finished';
```

3. In `GameState` (line 67-80), replace `slotState` with `bonusState`:

```typescript
export interface GameState {
  roomCode: string;
  phase: GamePhase;
  players: Player[];
  ticker: string;
  candles: Candle[];
  visibleCandleCount: number;
  currentPrice: number;
  roundDuration: number;
  elapsed: number;
  roundNumber: number;
  voteState: VoteState | null;
  bonusState: BonusState | null;
}
```

4. In `ServerToClientEvents` (line 95-110), replace slot events with bonus events:

```typescript
export interface ServerToClientEvents {
  gameState: (state: ClientGameState) => void;
  candleUpdate: (data: { candle: Candle; price: number; index: number }) => void;
  leaderboard: (entries: LeaderboardEntry[]) => void;
  playerJoined: (player: { nickname: string }) => void;
  playerLeft: (nickname: string) => void;
  countdown: (seconds: number) => void;
  roundEnd: (results: RoundResult) => void;
  tradeResult: (data: { success: boolean; message: string }) => void;
  playerUpdate: (player: ClientPlayerState) => void;
  liquidated: (data: { nickname: string; loss: number }) => void;
  voteUpdate: (data: { yes: number; no: number; total: number; timer: number }) => void;
  bonusResult: (result: BonusResult) => void;
  bonusUpdate: (data: { timer: number; bonusType: BonusType; results: { nickname: string; result: BonusResult }[] }) => void;
  error: (message: string) => void;
}
```

5. In `ClientToServerEvents` (line 112-120), replace `spinSlots` and add new events:

```typescript
export interface ClientToServerEvents {
  createRoom: () => void;
  joinRoom: (data: { roomCode: string; nickname: string }) => void;
  startGame: () => void;
  openPosition: (data: { direction: 'long' | 'short'; size: number; leverage: Leverage }) => void;
  closePosition: () => void;
  spinSlots: (data: { bet: number }) => void;
  spinWheel: (data: { bet: number }) => void;
  openLootbox: (data: { bet: number; chosenIndex: number }) => void;
  voteNextRound: (data: { vote: boolean }) => void;
}
```

6. In `ClientGameState` (line 123-138), replace `slotTimer` with `bonusTimer` and add `bonusType`:

```typescript
export interface ClientGameState {
  roomCode: string;
  phase: GamePhase;
  playerCount: number;
  playerNames: string[];
  ticker: string;
  visibleCandles: Candle[];
  currentPrice: number;
  elapsed: number;
  roundNumber: number;
  voteYes: number;
  voteNo: number;
  voteTotal: number;
  voteTimer: number;
  bonusTimer: number;
  bonusType: BonusType | null;
}
```

7. Remove the `SLOT_TIMER_SEC` constant (line 39) and the `SlotState` interface (lines 62-65). Keep `SLOT_SYMBOLS`, `SlotSymbol`, and `SlotResult` — they're still used by the slots mini-game.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/kislikjeka/projects/investsovet-game && npx tsc --noEmit 2>&1 | head -40`

Expected: Errors in `game-engine.ts`, `socket-handler.ts`, `useGame.ts`, `play/page.tsx`, `tv/page.tsx` — these reference old types. That's expected and will be fixed in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add bonus rotation types (wheel, slots, lootbox)"
```

---

### Task 2: Update Game Engine

**Files:**
- Modify: `src/lib/game-engine.ts`

- [ ] **Step 1: Update imports**

Replace the imports at line 1-5:

```typescript
import {
  GameState, Player, Position, LeaderboardEntry, RoundResult, Leverage, VoteState,
  BonusState, BonusType, BonusResult, SlotResult, SlotSymbol, SLOT_SYMBOLS,
  WheelResult, LootboxResult, WHEEL_SECTORS, LOOTBOX_POOL, BONUS_TIMER_SEC,
  INITIAL_BALANCE, MIN_ROUND_DURATION, MAX_ROUND_DURATION, VOTE_TIMER_SEC,
} from './types';
```

- [ ] **Step 2: Replace `startSlots` with `startBonus`**

Replace the `startSlots` function (lines 257-264) with:

```typescript
function getBonusType(roundNumber: number): BonusType {
  const mod = roundNumber % 3;
  if (mod === 1) return 'wheel';
  if (mod === 2) return 'slots';
  return 'lootbox';
}

export function startBonus(game: GameState): BonusState {
  const bonusType = getBonusType(game.roundNumber);
  game.phase = 'bonus';
  game.bonusState = {
    bonusType,
    played: {},
    timer: BONUS_TIMER_SEC,
  };
  return game.bonusState;
}
```

- [ ] **Step 3: Update `spinSlots` to work with `bonusState`**

Replace the `spinSlots` function (lines 287-313) with:

```typescript
export function spinSlots(
  game: GameState,
  playerId: string,
  bet: number,
): { success: boolean; message: string; result?: BonusResult } {
  const player = getPlayer(game, playerId);
  if (!player) return { success: false, message: 'Игрок не найден' };
  if (game.phase !== 'bonus') return { success: false, message: 'Бонус не активен' };
  if (!game.bonusState || game.bonusState.bonusType !== 'slots') return { success: false, message: 'Сейчас не слоты' };
  if (game.bonusState.played[playerId]) return { success: false, message: 'Уже крутил!' };
  if (bet <= 0) return { success: false, message: 'Некорректная ставка' };
  if (bet > player.balance) return { success: false, message: 'Недостаточно средств' };

  const reels: [SlotSymbol, SlotSymbol, SlotSymbol] = [randomSymbol(), randomSymbol(), randomSymbol()];
  const multiplier = getSlotMultiplier(reels);
  const winAmount = multiplier === 0 ? -bet : Math.round((bet * multiplier - bet) * 100) / 100;

  player.balance = Math.round((player.balance + winAmount) * 100) / 100;
  if (player.balance < 0) player.balance = 0;

  const slotResult: SlotResult = { reels, multiplier, bet, winAmount };
  const bonusResult: BonusResult = { type: 'slots', result: slotResult };
  game.bonusState.played[playerId] = bonusResult;

  return { success: true, message: `${reels.join(' ')} — x${multiplier}`, result: bonusResult };
}
```

- [ ] **Step 4: Add `spinWheel` function**

Add after the `spinSlots` function:

```typescript
function weightedRandomIndex(weights: number[]): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    random -= weights[i];
    if (random <= 0) return i;
  }
  return weights.length - 1;
}

export function spinWheel(
  game: GameState,
  playerId: string,
  bet: number,
): { success: boolean; message: string; result?: BonusResult } {
  const player = getPlayer(game, playerId);
  if (!player) return { success: false, message: 'Игрок не найден' };
  if (game.phase !== 'bonus') return { success: false, message: 'Бонус не активен' };
  if (!game.bonusState || game.bonusState.bonusType !== 'wheel') return { success: false, message: 'Сейчас не колесо' };
  if (game.bonusState.played[playerId]) return { success: false, message: 'Уже крутил!' };
  if (bet <= 0) return { success: false, message: 'Некорректная ставка' };
  if (bet > player.balance) return { success: false, message: 'Недостаточно средств' };

  const sectorIndex = weightedRandomIndex(WHEEL_SECTORS.map((s) => s.weight));
  const multiplier = WHEEL_SECTORS[sectorIndex].multiplier;
  const winAmount = multiplier === 0 ? -bet : Math.round((bet * multiplier - bet) * 100) / 100;

  player.balance = Math.round((player.balance + winAmount) * 100) / 100;
  if (player.balance < 0) player.balance = 0;

  const wheelResult: WheelResult = { sectorIndex, multiplier, bet, winAmount };
  const bonusResult: BonusResult = { type: 'wheel', result: wheelResult };
  game.bonusState.played[playerId] = bonusResult;

  return { success: true, message: `${WHEEL_SECTORS[sectorIndex].label} — ${winAmount >= 0 ? '+' : ''}${winAmount}$`, result: bonusResult };
}
```

- [ ] **Step 5: Add `openLootbox` function**

Add after `spinWheel`:

```typescript
function generateLootboxValues(): number[] {
  const boxes: number[] = [];
  const pool = [...LOOTBOX_POOL];

  // Pick 4 weighted random values
  for (let i = 0; i < 4; i++) {
    const idx = weightedRandomIndex(pool.map((p) => p.weight));
    boxes.push(pool[idx].multiplier);
    // Remove picked to avoid 4 identical
    pool.splice(idx, 1);
    if (pool.length === 0) break;
  }

  // Guarantee: at least 1 box >= x2 and at least 1 box <= x1.5
  const hasHigh = boxes.some((v) => v >= 2);
  const hasLow = boxes.some((v) => v <= 1.5);

  if (!hasHigh) {
    // Replace a random low box with x2
    const lowIdx = boxes.findIndex((v) => v <= 1.5);
    if (lowIdx >= 0) boxes[lowIdx] = 2;
    else boxes[0] = 2;
  }
  if (!hasLow) {
    // Replace a random high box with x1.5
    const highIdx = boxes.findIndex((v) => v >= 2);
    if (highIdx >= 0 && boxes.filter((v) => v >= 2).length > 1) {
      boxes[highIdx] = 1.5;
    } else {
      // Just set the last one
      boxes[3] = 1.5;
    }
  }

  // Shuffle
  for (let i = boxes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [boxes[i], boxes[j]] = [boxes[j], boxes[i]];
  }

  return boxes;
}

export function openLootbox(
  game: GameState,
  playerId: string,
  bet: number,
  chosenIndex: number,
): { success: boolean; message: string; result?: BonusResult } {
  const player = getPlayer(game, playerId);
  if (!player) return { success: false, message: 'Игрок не найден' };
  if (game.phase !== 'bonus') return { success: false, message: 'Бонус не активен' };
  if (!game.bonusState || game.bonusState.bonusType !== 'lootbox') return { success: false, message: 'Сейчас не лутбокс' };
  if (game.bonusState.played[playerId]) return { success: false, message: 'Уже выбирал!' };
  if (bet <= 0) return { success: false, message: 'Некорректная ставка' };
  if (bet > player.balance) return { success: false, message: 'Недостаточно средств' };
  if (chosenIndex < 0 || chosenIndex > 3) return { success: false, message: 'Некорректный выбор' };

  const boxes = generateLootboxValues();
  const multiplier = boxes[chosenIndex];
  const winAmount = multiplier === 0 ? -bet : Math.round((bet * multiplier - bet) * 100) / 100;

  player.balance = Math.round((player.balance + winAmount) * 100) / 100;
  if (player.balance < 0) player.balance = 0;

  const lootboxResult: LootboxResult = { boxes, chosenIndex, multiplier, bet, winAmount };
  const bonusResult: BonusResult = { type: 'lootbox', result: lootboxResult };
  game.bonusState.played[playerId] = bonusResult;

  return { success: true, message: `x${multiplier} — ${winAmount >= 0 ? '+' : ''}${winAmount}$`, result: bonusResult };
}
```

- [ ] **Step 6: Replace `getSlotResults` with `getBonusResults`**

Replace `getSlotResults` function (lines 315-321) with:

```typescript
export function getBonusResults(game: GameState): { nickname: string; result: BonusResult }[] {
  if (!game.bonusState) return [];
  return Object.entries(game.bonusState.played).map(([playerId, result]) => {
    const player = game.players.find((p) => p.id === playerId);
    return { nickname: player?.nickname || '???', result };
  });
}
```

- [ ] **Step 7: Update `createGame` and `setupNextRound`**

In `createGame` (line 31), change `slotState: null` to `bonusState: null`.

In `setupNextRound` (line 336), change `game.slotState = null` to `game.bonusState = null`.

- [ ] **Step 8: Verify TypeScript compiles for this file**

Run: `cd /Users/kislikjeka/projects/investsovet-game && npx tsc --noEmit 2>&1 | grep game-engine`

Expected: No errors in `game-engine.ts`. Other files will still have errors.

- [ ] **Step 9: Commit**

```bash
git add src/lib/game-engine.ts
git commit -m "feat: add wheel and lootbox engine logic, replace slots phase with bonus"
```

---

### Task 3: Update Socket Handler

**Files:**
- Modify: `src/server/socket-handler.ts`

- [ ] **Step 1: Update imports**

Replace imports (lines 1-10):

```typescript
import { Server as SocketServer, Socket } from 'socket.io';
import type {
  ClientToServerEvents, ServerToClientEvents, GameState, ClientGameState,
} from '../lib/types';
import {
  createGame, addPlayer, removePlayer, getPlayer,
  tickCandle, openPosition, closePosition, getLeaderboard, endRound,
  getUnrealizedPnl, startVoting, castVote, getVoteResult, setupNextRound,
  startBonus, spinSlots, spinWheel, openLootbox, getBonusResults,
} from '../lib/game-engine';
```

- [ ] **Step 2: Update `getClientGameState`**

Replace `getClientGameState` function (lines 19-37):

```typescript
function getClientGameState(game: GameState): ClientGameState {
  const voteResult = getVoteResult(game);
  return {
    roomCode: game.roomCode,
    phase: game.phase,
    playerCount: game.players.filter((p) => p.connected).length,
    playerNames: game.players.filter((p) => p.connected).map((p) => p.nickname),
    ticker: game.ticker,
    visibleCandles: game.candles.slice(0, game.visibleCandleCount),
    currentPrice: game.currentPrice,
    elapsed: game.elapsed,
    roundNumber: game.roundNumber,
    voteYes: voteResult.yes,
    voteNo: voteResult.no,
    voteTotal: voteResult.total,
    voteTimer: game.voteState?.timer || 0,
    bonusTimer: game.bonusState?.timer || 0,
    bonusType: game.bonusState?.bonusType || null,
  };
}
```

- [ ] **Step 3: Rename `startSlotsPhase` to `startBonusPhase`**

Replace the entire `startSlotsPhase` function (lines 135-167):

```typescript
function startBonusPhase(io: SocketServer, game: GameState) {
  const bonusState = startBonus(game);
  broadcastState(io, game);

  io.to(game.roomCode).emit('bonusUpdate', {
    timer: bonusState.timer,
    bonusType: bonusState.bonusType,
    results: [],
  });

  const bonusTimer = setInterval(() => {
    if (!game.bonusState) { clearInterval(bonusTimer); return; }
    game.bonusState.timer--;

    io.to(game.roomCode).emit('bonusUpdate', {
      timer: game.bonusState.timer,
      bonusType: game.bonusState.bonusType,
      results: getBonusResults(game),
    });

    if (game.bonusState.timer <= 0) {
      clearInterval(bonusTimer);
      for (const player of game.players) {
        if (player.connected) sendPlayerUpdate(io, game, player.id);
      }
      broadcastLeaderboard(io, game);

      setTimeout(() => {
        startVotingPhase(io, game);
      }, 2000);
    }
  }, 1000);
}
```

- [ ] **Step 4: Update `startTrading` reference**

In `startTrading` function (line 124-126), replace `startSlotsPhase` with `startBonusPhase`:

```typescript
          setTimeout(() => {
            startBonusPhase(io, game);
          }, 3000);
```

- [ ] **Step 5: Update `spinSlots` socket handler and add new handlers**

Replace the `spinSlots` socket handler (lines 303-322) with all three bonus handlers:

```typescript
    socket.on('spinSlots', ({ bet }) => {
      const roomCode = playerRooms.get(socket.id);
      if (!roomCode) return;
      const game = rooms.get(roomCode);
      if (!game || game.phase !== 'bonus') return;

      const result = spinSlots(game, socket.id, bet);
      if (result.success && result.result) {
        socket.emit('bonusResult', result.result);
        sendPlayerUpdate(io, game, socket.id);
        broadcastLeaderboard(io, game);
        io.to(roomCode).emit('bonusUpdate', {
          timer: game.bonusState?.timer || 0,
          bonusType: game.bonusState?.bonusType || 'slots',
          results: getBonusResults(game),
        });
      } else {
        socket.emit('error', result.message);
      }
    });

    socket.on('spinWheel', ({ bet }) => {
      const roomCode = playerRooms.get(socket.id);
      if (!roomCode) return;
      const game = rooms.get(roomCode);
      if (!game || game.phase !== 'bonus') return;

      const result = spinWheel(game, socket.id, bet);
      if (result.success && result.result) {
        socket.emit('bonusResult', result.result);
        sendPlayerUpdate(io, game, socket.id);
        broadcastLeaderboard(io, game);
        io.to(roomCode).emit('bonusUpdate', {
          timer: game.bonusState?.timer || 0,
          bonusType: game.bonusState?.bonusType || 'wheel',
          results: getBonusResults(game),
        });
      } else {
        socket.emit('error', result.message);
      }
    });

    socket.on('openLootbox', ({ bet, chosenIndex }) => {
      const roomCode = playerRooms.get(socket.id);
      if (!roomCode) return;
      const game = rooms.get(roomCode);
      if (!game || game.phase !== 'bonus') return;

      const result = openLootbox(game, socket.id, bet, chosenIndex);
      if (result.success && result.result) {
        socket.emit('bonusResult', result.result);
        sendPlayerUpdate(io, game, socket.id);
        broadcastLeaderboard(io, game);
        io.to(roomCode).emit('bonusUpdate', {
          timer: game.bonusState?.timer || 0,
          bonusType: game.bonusState?.bonusType || 'lootbox',
          results: getBonusResults(game),
        });
      } else {
        socket.emit('error', result.message);
      }
    });
```

- [ ] **Step 6: Verify TypeScript compiles for this file**

Run: `cd /Users/kislikjeka/projects/investsovet-game && npx tsc --noEmit 2>&1 | grep socket-handler`

Expected: No errors in `socket-handler.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/server/socket-handler.ts
git commit -m "feat: update socket handler for bonus rotation (wheel, slots, lootbox)"
```

---

### Task 4: Update Client Hook

**Files:**
- Modify: `src/lib/useGame.ts`

- [ ] **Step 1: Replace hook implementation**

Replace the entire file content:

```typescript
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket } from './socket-client';
import type {
  ClientGameState, ClientPlayerState, LeaderboardEntry,
  RoundResult, Candle, Leverage, BonusResult, BonusType,
} from './types';

export function useGame() {
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [playerState, setPlayerState] = useState<ClientPlayerState | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [countdown, setCountdown] = useState(0);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [tradeMessage, setTradeMessage] = useState('');
  const [error, setError] = useState('');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [voteData, setVoteData] = useState<{ yes: number; no: number; total: number; timer: number } | null>(null);
  const [liquidationAlert, setLiquidationAlert] = useState('');
  const [bonusResult, setBonusResult] = useState<BonusResult | null>(null);
  const [bonusData, setBonusData] = useState<{ timer: number; bonusType: BonusType; results: { nickname: string; result: BonusResult }[] } | null>(null);
  const candlesRef = useRef<Candle[]>([]);

  useEffect(() => {
    const socket = getSocket();

    socket.on('gameState', (state) => {
      setGameState(state);
      candlesRef.current = state.visibleCandles;
      setCandles([...state.visibleCandles]);
      setCurrentPrice(state.currentPrice);
      if (state.phase !== 'voting') setVoteData(null);
    });

    socket.on('playerUpdate', (state) => setPlayerState(state));
    socket.on('leaderboard', (entries) => setLeaderboard(entries));
    socket.on('countdown', (sec) => setCountdown(sec));

    socket.on('candleUpdate', ({ candle, price }) => {
      candlesRef.current = [...candlesRef.current, candle];
      setCandles([...candlesRef.current]);
      setCurrentPrice(price);
    });

    socket.on('roundEnd', (result) => setRoundResult(result));

    socket.on('tradeResult', ({ message }) => {
      setTradeMessage(message);
      setTimeout(() => setTradeMessage(''), 2000);
    });

    socket.on('liquidated', ({ nickname, loss }) => {
      setLiquidationAlert(`\u{1F480} ${nickname} \u{041B}\u{0418}\u{041A}\u{0412}\u{0418}\u{0414}\u{0418}\u{0420}\u{041E}\u{0412}\u{0410}\u{041D}! -$${loss.toFixed(0)}`);
      setTimeout(() => setLiquidationAlert(''), 3000);
    });

    socket.on('voteUpdate', (data) => setVoteData(data));

    socket.on('bonusResult', (result) => setBonusResult(result));
    socket.on('bonusUpdate', (data) => setBonusData(data));

    socket.on('error', (msg) => {
      setError(msg);
      setTimeout(() => setError(''), 3000);
    });

    return () => {
      socket.off('gameState');
      socket.off('playerUpdate');
      socket.off('leaderboard');
      socket.off('countdown');
      socket.off('candleUpdate');
      socket.off('roundEnd');
      socket.off('tradeResult');
      socket.off('liquidated');
      socket.off('voteUpdate');
      socket.off('bonusResult');
      socket.off('bonusUpdate');
      socket.off('error');
    };
  }, []);

  const createRoom = useCallback(() => getSocket().emit('createRoom'), []);

  const joinRoom = useCallback((roomCode: string, nickname: string) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('investsovet_room', roomCode);
      sessionStorage.setItem('investsovet_nick', nickname);
    }
    getSocket().emit('joinRoom', { roomCode, nickname });
  }, []);

  const startGame = useCallback(() => getSocket().emit('startGame'), []);

  const openPosition = useCallback((direction: 'long' | 'short', size: number, leverage: Leverage) => {
    getSocket().emit('openPosition', { direction, size, leverage });
  }, []);

  const closePosition = useCallback(() => getSocket().emit('closePosition'), []);

  const spinSlots = useCallback((bet: number) => {
    getSocket().emit('spinSlots', { bet });
  }, []);

  const spinWheel = useCallback((bet: number) => {
    getSocket().emit('spinWheel', { bet });
  }, []);

  const openLootbox = useCallback((bet: number, chosenIndex: number) => {
    getSocket().emit('openLootbox', { bet, chosenIndex });
  }, []);

  const voteNextRound = useCallback((vote: boolean) => {
    getSocket().emit('voteNextRound', { vote });
  }, []);

  return {
    gameState, playerState, leaderboard, countdown, roundResult,
    candles, currentPrice, tradeMessage, error, voteData, liquidationAlert,
    bonusResult, bonusData,
    createRoom, joinRoom, startGame, openPosition, closePosition,
    spinSlots, spinWheel, openLootbox, voteNextRound,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/useGame.ts
git commit -m "feat: update useGame hook for bonus rotation events"
```

---

### Task 5: Update Play Page UI

**Files:**
- Modify: `src/app/play/page.tsx`

- [ ] **Step 1: Update imports and destructuring**

At top of `PlayContent` function, update the destructuring from `useGame()` (lines 28-33):

```typescript
  const {
    gameState, playerState, countdown, roundResult, currentPrice,
    tradeMessage, error, voteData, liquidationAlert,
    bonusResult, bonusData,
    joinRoom, openPosition, closePosition, spinSlots, spinWheel, openLootbox, voteNextRound,
  } = useGame();
```

- [ ] **Step 2: Update state variables**

Replace the slot-specific state (lines 42-45) with bonus-generic state:

```typescript
  const [bonusBetPercent, setBonusBetPercent] = useState(10);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [animating, setAnimating] = useState(false);
  // Slots animation
  const [displayReels, setDisplayReels] = useState<string[]>(['?', '?', '?']);
  // Lootbox state
  const [lootboxRevealed, setLootboxRevealed] = useState(false);
  const [revealedBoxes, setRevealedBoxes] = useState<boolean[]>([false, false, false, false]);
```

- [ ] **Step 3: Update the round-change reset effect**

Replace the effect at lines 60-65:

```typescript
  useEffect(() => {
    setHasVoted(false);
    setHasPlayed(false);
    setAnimating(false);
    setDisplayReels(['?', '?', '?']);
    setLootboxRevealed(false);
    setRevealedBoxes([false, false, false, false]);
  }, [gameState?.roundNumber]);
```

- [ ] **Step 4: Add lootbox reveal effect (MUST be before any conditional returns)**

Add this effect right after the round-change reset effect (Step 3) and BEFORE any `if (gameState.phase === ...)` blocks. This is critical — React hooks cannot be inside conditional blocks:

```tsx
  // Lootbox reveal animation
  useEffect(() => {
    if (!bonusResult || bonusResult.type !== 'lootbox' || lootboxRevealed) return;
    const chosen = bonusResult.result.chosenIndex;
    setRevealedBoxes((prev) => { const next = [...prev]; next[chosen] = true; return next; });
    const others = [0, 1, 2, 3].filter((i) => i !== chosen);
    const timeouts = others.map((idx, i) =>
      setTimeout(() => {
        setRevealedBoxes((prev) => { const next = [...prev]; next[idx] = true; return next; });
      }, 1000 + i * 300)
    );
    setLootboxRevealed(true);
    return () => timeouts.forEach(clearTimeout);
  }, [bonusResult, lootboxRevealed]);
```

- [ ] **Step 5: Replace the entire slots phase UI block**

Replace the `// --- SLOTS ---` block (lines 295-400) with the bonus phase UI:

```tsx
  // --- BONUS PHASE ---
  if (gameState.phase === 'bonus' && playerState) {
    const bonusBalance = playerState.balance;
    const bonusBet = Math.floor(bonusBalance * bonusBetPercent / 100);
    const timer = bonusData?.timer || gameState.bonusTimer;
    const bonusType = bonusData?.bonusType || gameState.bonusType;

    const BONUS_TITLES: Record<string, string> = {
      wheel: 'КОЛЕСО ФОРТУНЫ',
      slots: 'СЛОТ-МАШИНА',
      lootbox: 'ЛУТБОКС',
    };

    const SLOT_SYMBOLS_DISPLAY = ['₿', 'Ξ', '🐕', '🚀', '💎', '🌕'];

    // --- Slots spin handler ---
    const handleSlotSpin = () => {
      if (hasPlayed || bonusBet <= 0) return;
      setAnimating(true);
      let ticks = 0;
      const spinInterval = setInterval(() => {
        setDisplayReels([
          SLOT_SYMBOLS_DISPLAY[Math.floor(Math.random() * 6)],
          SLOT_SYMBOLS_DISPLAY[Math.floor(Math.random() * 6)],
          SLOT_SYMBOLS_DISPLAY[Math.floor(Math.random() * 6)],
        ]);
        ticks++;
        if (ticks >= 15) {
          clearInterval(spinInterval);
          spinSlots(bonusBet);
          setHasPlayed(true);
          setAnimating(false);
        }
      }, 100);
    };

    // --- Wheel spin handler ---
    const handleWheelSpin = () => {
      if (hasPlayed || bonusBet <= 0) return;
      setAnimating(true);
      setTimeout(() => {
        spinWheel(bonusBet);
        setHasPlayed(true);
        setAnimating(false);
      }, 2000);
    };

    // --- Lootbox handler ---
    const handleLootboxChoice = (index: number) => {
      if (hasPlayed || bonusBet <= 0) return;
      setHasPlayed(true);
      openLootbox(bonusBet, index);
    };

    // Derive slot display reels from result
    const showReels = hasPlayed && bonusResult?.type === 'slots' ? [...bonusResult.result.reels] : displayReels;

    // Get win info from any bonus result
    const winAmount = bonusResult ? bonusResult.result.winAmount : null;
    const multiplier = bonusResult ? bonusResult.result.multiplier : null;

    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
        <p className="text-yellow-400 text-lg font-mono mb-2">{timer}с</p>
        <h2 className="text-3xl font-black mb-6 text-yellow-400">{BONUS_TITLES[bonusType || 'slots']}</h2>

        {/* === WHEEL UI === */}
        {bonusType === 'wheel' && (
          <>
            {/* Wheel sectors display */}
            <div className="grid grid-cols-4 gap-2 mb-6 w-full max-w-sm">
              {[
                { label: 'BUST', color: 'bg-red-600', mult: 0 },
                { label: 'x0.5', color: 'bg-orange-500', mult: 0.5 },
                { label: 'x1.5', color: 'bg-gray-600', mult: 1.5 },
                { label: 'x2', color: 'bg-green-600', mult: 2 },
                { label: 'x3', color: 'bg-blue-600', mult: 3 },
                { label: 'x5', color: 'bg-purple-600', mult: 5 },
                { label: 'x10', color: 'bg-yellow-600', mult: 10 },
                { label: 'x25', color: 'bg-gradient-to-r from-pink-500 to-yellow-500', mult: 25 },
              ].map((sector) => (
                <div
                  key={sector.label}
                  className={`${sector.color} rounded-lg py-3 text-center font-bold text-sm ${
                    hasPlayed && bonusResult?.type === 'wheel' && bonusResult.result.multiplier === sector.mult
                      ? 'ring-4 ring-white scale-110'
                      : hasPlayed ? 'opacity-30' : ''
                  } transition-all`}
                >
                  {sector.label}
                </div>
              ))}
            </div>

            {animating && (
              <div className="text-6xl mb-6 animate-spin">🎡</div>
            )}
          </>
        )}

        {/* === SLOTS UI === */}
        {bonusType === 'slots' && (
          <div className="flex gap-4 mb-8">
            {showReels.map((sym, i) => (
              <div
                key={i}
                className={`w-24 h-24 bg-gray-900 border-2 ${animating ? 'border-yellow-400' : hasPlayed && bonusResult?.type === 'slots' && bonusResult.result.multiplier > 0 ? 'border-green-400' : 'border-gray-700'} rounded-xl flex items-center justify-center text-5xl ${animating ? 'animate-pulse' : ''}`}
              >
                {sym}
              </div>
            ))}
          </div>
        )}

        {/* === LOOTBOX UI === */}
        {bonusType === 'lootbox' && (
          <div className="grid grid-cols-2 gap-4 mb-6 w-full max-w-sm">
            {[0, 1, 2, 3].map((i) => {
              const isRevealed = revealedBoxes[i];
              const isChosen = bonusResult?.type === 'lootbox' && bonusResult.result.chosenIndex === i;
              const boxValue = bonusResult?.type === 'lootbox' ? bonusResult.result.boxes[i] : null;

              return (
                <button
                  key={i}
                  onClick={() => handleLootboxChoice(i)}
                  disabled={hasPlayed}
                  className={`h-28 rounded-xl font-black text-2xl transition-all active:scale-95 ${
                    isRevealed
                      ? isChosen
                        ? boxValue !== null && boxValue >= 2 ? 'bg-green-600 ring-4 ring-green-400' : 'bg-red-600 ring-4 ring-red-400'
                        : 'bg-gray-800 opacity-60'
                      : 'bg-gradient-to-br from-yellow-500 to-orange-600 hover:scale-105'
                  }`}
                >
                  {isRevealed && boxValue !== null
                    ? boxValue === 0 ? 'BUST' : `x${boxValue}`
                    : hasPlayed ? '...' : '🎁'
                  }
                </button>
              );
            })}
          </div>
        )}

        {/* === Result display (all types) === */}
        {hasPlayed && winAmount !== null && multiplier !== null && !animating && (
          <div className="mb-6 text-center">
            <p className={`text-3xl font-black ${winAmount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {multiplier > 0 ? `x${multiplier}` : 'МИМО'}
            </p>
            <p className={`text-xl font-bold mt-1 ${winAmount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {winAmount >= 0 ? '+' : ''}{winAmount.toFixed(0)}$
            </p>
            {multiplier >= 10 && (
              <p className="text-yellow-400 text-lg mt-2 animate-bounce font-black">JACKPOT!</p>
            )}
          </div>
        )}

        {/* === Bet controls (shared for all types) === */}
        {!hasPlayed && !animating && (
          <>
            <div className="w-full max-w-sm mb-4">
              <p className="text-gray-400 text-sm mb-2 text-center">Ставка: ${bonusBet.toLocaleString()}</p>
              <div className="flex gap-2">
                {[5, 10, 25, 50].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setBonusBetPercent(pct)}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all active:scale-95 ${
                      bonusBetPercent === pct
                        ? 'bg-yellow-400 text-black'
                        : 'bg-gray-900 text-gray-400 border border-gray-800'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {bonusType === 'lootbox' ? (
              <p className="text-gray-400 text-lg">Выбери коробку!</p>
            ) : (
              <button
                onClick={bonusType === 'wheel' ? handleWheelSpin : handleSlotSpin}
                disabled={bonusBet <= 0}
                className="bg-yellow-400 text-black font-black text-2xl px-12 py-5 rounded-xl active:scale-95 transition-all disabled:opacity-30"
              >
                КРУТИТЬ
              </button>
            )}
          </>
        )}

        {!hasPlayed && animating && (
          <p className="text-yellow-400 text-xl animate-pulse font-bold">
            {bonusType === 'wheel' ? 'Крутим колесо...' : 'Крутим...'}
          </p>
        )}

        <p className="text-gray-600 text-sm mt-4">Баланс: ${bonusBalance.toFixed(0)}</p>
      </div>
    );
  }
```

- [ ] **Step 6: Remove unused imports**

In the imports at the top of the file (line 6), remove `SlotResult` if it was imported — it's no longer used in this file. The new types come through `useGame` hook.

Remove the import line for `INITIAL_BALANCE` if still present (it may be unused).

- [ ] **Step 7: Verify no TypeScript errors**

Run: `cd /Users/kislikjeka/projects/investsovet-game && npx tsc --noEmit 2>&1 | grep play/page`

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/play/page.tsx
git commit -m "feat: add wheel and lootbox UI to player bonus phase"
```

---

### Task 6: Update TV Page

**Files:**
- Modify: `src/app/tv/page.tsx`

- [ ] **Step 1: Update hook usage**

In the destructuring from `useGame()` (lines 12-16), replace `slotData` with `bonusData`:

```typescript
  const {
    gameState, leaderboard, countdown, roundResult, candles, currentPrice,
    voteData, liquidationAlert, bonusData,
    createRoom, startGame,
  } = useGame();
```

- [ ] **Step 2: Replace the slots phase TV block**

Replace the `// --- SLOTS ---` block (lines 161-195) with:

```tsx
  // --- BONUS ---
  if (phase === 'bonus') {
    const timer = bonusData?.timer || gameState.bonusTimer;
    const bonusType = bonusData?.bonusType || gameState.bonusType;
    const bonusResults = bonusData?.results || [];

    const BONUS_TITLES: Record<string, string> = {
      wheel: 'КОЛЕСО ФОРТУНЫ',
      slots: 'СЛОТ-МАШИНА',
      lootbox: 'ЛУТБОКС',
    };

    const BONUS_EMOJIS: Record<string, string> = {
      wheel: '🎡',
      slots: '🎰',
      lootbox: '🎁',
    };

    return (
      <div className="h-screen bg-black text-white flex flex-col items-center justify-center">
        <div className="text-6xl mb-2">{BONUS_EMOJIS[bonusType || 'slots']}</div>
        <h1 className="text-6xl font-black text-yellow-400 mb-2">{BONUS_TITLES[bonusType || 'slots']}</h1>
        <p className="text-gray-400 text-xl mb-4">
          {bonusType === 'wheel' ? 'Игроки крутят колесо...' : bonusType === 'lootbox' ? 'Игроки выбирают коробки...' : 'Игроки крутят барабаны...'}
        </p>
        <p className="text-yellow-400 text-4xl font-mono font-bold mb-8">{timer}с</p>

        {bonusResults.length > 0 && (
          <div className="w-full max-w-2xl space-y-3">
            {bonusResults.map(({ nickname, result }) => {
              const { winAmount, multiplier } = result.result;
              let detail = '';
              if (result.type === 'slots') {
                detail = result.result.reels.join(' ');
              } else if (result.type === 'wheel') {
                detail = `Сектор: ${multiplier > 0 ? `x${multiplier}` : 'BUST'}`;
              } else if (result.type === 'lootbox') {
                detail = `Коробка ${result.result.chosenIndex + 1}: ${multiplier > 0 ? `x${multiplier}` : 'BUST'}`;
              }

              return (
                <div key={nickname} className="flex items-center justify-between bg-gray-900/50 rounded-xl px-6 py-4">
                  <span className="text-xl font-bold">{nickname}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-xl text-gray-300">{detail}</span>
                    <span className={`text-xl font-mono font-bold ${winAmount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {winAmount >= 0 ? '+' : ''}{winAmount.toFixed(0)}$
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {bonusResults.length === 0 && (
          <p className="text-gray-600 text-2xl animate-pulse">Ждём ставки...</p>
        )}
      </div>
    );
  }
```

- [ ] **Step 3: Update music effect**

In the music `useEffect` (lines 24-38), add `'bonus'` alongside `'trading'` and `'countdown'` if you want music during bonus phase. Or leave as-is if music should only play during trading. The current behavior is fine — no change needed.

- [ ] **Step 4: Verify no TypeScript errors**

Run: `cd /Users/kislikjeka/projects/investsovet-game && npx tsc --noEmit 2>&1 | grep tv/page`

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/tv/page.tsx
git commit -m "feat: update TV page for bonus rotation display"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Full TypeScript check**

Run: `cd /Users/kislikjeka/projects/investsovet-game && npx tsc --noEmit`

Expected: Zero errors.

- [ ] **Step 2: Build check**

Run: `cd /Users/kislikjeka/projects/investsovet-game && bun run build`

Expected: Build succeeds.

- [ ] **Step 3: Start dev server and smoke test**

Run: `cd /Users/kislikjeka/projects/investsovet-game && bun run dev`

Smoke test checklist:
1. Open TV page (creates room)
2. Join with a player from phone/another tab
3. Start game, play a round
4. Round 1: Wheel appears (bonus phase)
5. Round 2: Slots appear (bonus phase)
6. Round 3: Lootbox appears (bonus phase)
7. Verify balances update correctly after each bonus
8. Verify TV shows correct bonus type and results

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address issues found during smoke testing"
```
