# Market Maker Casino Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current minimal MM mode (2 price-push buttons, MM trades normally) with the full "Casino" design where MM doesn't trade but controls market conditions via 3 levers, rent system, and inactivity penalties.

**Architecture:** The MM Casino mode adds server-side systems (rent ticking, lever cooldowns, commission/freeze/squeeze effects, inactivity tracking, synergy detection) driven by the existing 1-second candle tick loop. The MM gets a completely different phone UI (dashboard + lever buttons instead of chart + trading). Types, game engine, socket handler, client hook, and both UI pages all change.

**Tech Stack:** TypeScript, Next.js, Socket.IO, React

**Spec:** `docs/superpowers/specs/2026-04-02-market-maker-casino-mode-design.md`

---

### Task 1: Update Types — MM Casino Constants and State

**Files:**
- Modify: `src/lib/types.ts`

This task replaces the old MM types with the full Casino mode type system.

- [ ] **Step 1: Replace MM constants and add Casino constants**

In `src/lib/types.ts`, replace line 8:
```typescript
export const MM_INITIAL_BALANCE = 15000;
```
with:
```typescript
// MM Casino Mode Constants
export const MM_STARTING_BALANCE = 0;
export const MAX_POSITION_PERCENT = 30;
export const RENT_AMOUNT = 100;
export const RENT_INTERVAL_SEC = 5;
export const COMMISSION_PERCENT = 3;
export const COMMISSION_DURATION_SEC = 6;
export const COMMISSION_COOLDOWN_SEC = 20;
export const FREEZE_DURATION_SEC_MM = 5;
export const FREEZE_COOLDOWN_SEC = 20;
export const SQUEEZE_TIGHTENING_PERCENT = 30;
export const SQUEEZE_DURATION_SEC = 8;
export const SQUEEZE_COOLDOWN_SEC = 20;
export const MM_LIQUIDATION_BONUS_PERCENT = 25;
export const MM_INACTIVITY_THRESHOLD_SEC = 8;
export const MM_INACTIVITY_RENT_PAUSE_SEC = 5;
export const MM_INACTIVITY_TRADER_BONUS = 200;
export const TRADER_INACTIVITY_THRESHOLD_SEC = 15;
export const TRADER_INACTIVITY_RENT_MULTIPLIER = 2;
export const SYNERGY_MIN_TRADERS = 3;
export const SYNERGY_THRESHOLD_WIDENING_PERCENT = 30;
```

- [ ] **Step 2: Add MM lever types**

After the `PlayerRole` type, add:
```typescript
export type MMLeverType = 'commission' | 'freeze' | 'squeeze';

export interface MMLeverState {
  commission: { active: boolean; ticksLeft: number; cooldownLeft: number };
  freeze: { active: boolean; ticksLeft: number; cooldownLeft: number };
  squeeze: { active: boolean; ticksLeft: number; cooldownLeft: number };
}

export interface MMCasinoState {
  levers: MMLeverState;
  lastLeverTime: number;       // elapsed seconds when MM last pressed a lever
  rentPausedTicksLeft: number;  // ticks of rent pause remaining
  traderLastOpenTime: Record<string, number>; // playerId -> elapsed when they last opened
}
```

- [ ] **Step 3: Update GameState interface**

Replace the 3 MM fields in `GameState`:
```typescript
  // Market Maker mode
  gameMode: GameMode;
  marketMakerId: string | null;
  mmNextCandleModifier: number | null; // 0.5 or -0.5
```
with:
```typescript
  // Market Maker mode
  gameMode: GameMode;
  marketMakerId: string | null;
  mmCasino: MMCasinoState | null;
```

- [ ] **Step 4: Update ClientGameState**

Add after `marketMakerNickname`:
```typescript
  mmLevers: MMLeverState | null;
  mmBalance: number;
```

- [ ] **Step 5: Update ClientPlayerState**

Add:
```typescript
  rentDrain: number;  // current rent per tick for this player (100 or 200 if inactive)
  isFreezed: boolean; // can't close position right now
```

- [ ] **Step 6: Replace socket events**

In `ServerToClientEvents`, replace `mmPush` with:
```typescript
  mmLeverUsed: (data: { lever: MMLeverType; duration: number }) => void;
  mmRentTick: (data: { amount: number; mmBalance: number }) => void;
  mmInactivityPenalty: () => void;
```

In `ClientToServerEvents`, replace `mmPush` with:
```typescript
  useMMLever: (data: { lever: MMLeverType }) => void;
```

- [ ] **Step 7: Add trader position info for MM dashboard to LeaderboardEntry**

Already has `positionDirection`, `positionLeverage`, `positionOpenedAt`, `positionEntryPrice`. Add:
```typescript
  positionSize: number | null;
  liquidationPrice: number | null;
```

- [ ] **Step 8: Run type check**

Run: `bunx tsc --noEmit`
Expected: Errors in game-engine.ts, socket-handler.ts, useGame.ts (they reference old MM types). This is expected — we fix them in subsequent tasks.

- [ ] **Step 9: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(mm-casino): replace MM types with Casino mode type system"
```

---

### Task 2: Rewrite Game Engine — MM Casino Core Logic

**Files:**
- Modify: `src/lib/game-engine.ts`

This task replaces the old mmPush/candle-modification logic with the full Casino system: rent, levers, inactivity, synergy, position cap, and modified leverage progression.

- [ ] **Step 1: Update imports**

Replace `MM_INITIAL_BALANCE` with new constants in the import:
```typescript
import {
  GameState, GameMode, Player, Position, LeaderboardEntry, RoundResult, Leverage, VoteState,
  BonusState, BonusType, BonusResult, WheelResult, LootboxResult, LotoResult,
  SlotResult, SlotSymbol, SLOT_SYMBOLS,
  WHEEL_SECTORS, LOOTBOX_POOL, BONUS_TIMER_SEC,
  LOTO_NUMBERS_TOTAL, LOTO_PICK_COUNT, LOTO_DRAW_COUNT, LOTO_PAYOUTS,
  SkillType, ALL_SKILLS, FREEZE_DURATION, INVERSE_DURATION, BLIND_DURATION,
  INITIAL_BALANCE, MIN_ROUND_DURATION, MAX_ROUND_DURATION, VOTE_TIMER_SEC, AVAILABLE_LEVERAGES,
  MMLeverType, MMLeverState, MMCasinoState,
  MM_STARTING_BALANCE, MAX_POSITION_PERCENT, RENT_AMOUNT, RENT_INTERVAL_SEC,
  COMMISSION_PERCENT, COMMISSION_DURATION_SEC, COMMISSION_COOLDOWN_SEC,
  FREEZE_DURATION_SEC_MM, FREEZE_COOLDOWN_SEC,
  SQUEEZE_TIGHTENING_PERCENT, SQUEEZE_DURATION_SEC, SQUEEZE_COOLDOWN_SEC,
  MM_LIQUIDATION_BONUS_PERCENT, MM_INACTIVITY_THRESHOLD_SEC, MM_INACTIVITY_RENT_PAUSE_SEC,
  MM_INACTIVITY_TRADER_BONUS, TRADER_INACTIVITY_THRESHOLD_SEC, TRADER_INACTIVITY_RENT_MULTIPLIER,
  SYNERGY_MIN_TRADERS, SYNERGY_THRESHOLD_WIDENING_PERCENT,
} from './types';
```

Remove `MM_PUSH_MODIFIER` constant (line 17).

- [ ] **Step 2: Update createGame — add mmCasino null**

In `createGame()`, replace:
```typescript
    marketMakerId: null,
    mmNextCandleModifier: null,
```
with:
```typescript
    marketMakerId: null,
    mmCasino: null,
```

- [ ] **Step 3: Create initial MMCasinoState helper**

Add after imports:
```typescript
function createMMCasinoState(): MMCasinoState {
  return {
    levers: {
      commission: { active: false, ticksLeft: 0, cooldownLeft: 0 },
      freeze: { active: false, ticksLeft: 0, cooldownLeft: 0 },
      squeeze: { active: false, ticksLeft: 0, cooldownLeft: 0 },
    },
    lastLeverTime: 0,
    rentPausedTicksLeft: 0,
    traderLastOpenTime: {},
  };
}
```

- [ ] **Step 4: Rewrite assignMarketMaker**

Replace the existing `assignMarketMaker` function:
```typescript
export function assignMarketMaker(game: GameState): Player | null {
  if (game.gameMode !== 'market_maker') return null;
  const connected = game.players.filter((p) => p.connected);
  if (connected.length === 0) return null;
  const mm = connected[Math.floor(Math.random() * connected.length)];
  mm.role = 'market_maker';
  mm.balance = MM_STARTING_BALANCE;
  mm.maxBalance = MM_STARTING_BALANCE;
  game.marketMakerId = mm.id;
  game.mmCasino = createMMCasinoState();
  console.log(`[Game] Market Maker (Casino) assigned: ${mm.nickname}`);
  return mm;
}
```

- [ ] **Step 5: Replace mmPush with useMMLever**

Remove the old `mmPush` function entirely. Add:
```typescript
export function useMMLever(
  game: GameState,
  playerId: string,
  lever: MMLeverType,
): { success: boolean; message: string; duration?: number } {
  if (game.gameMode !== 'market_maker' || !game.mmCasino) return { success: false, message: 'Wrong mode' };
  if (game.phase !== 'trading') return { success: false, message: 'Round not active' };
  if (game.marketMakerId !== playerId) return { success: false, message: 'Not the MM' };

  const state = game.mmCasino.levers[lever];
  if (state.active) return { success: false, message: 'Already active' };
  if (state.cooldownLeft > 0) return { success: false, message: `Cooldown: ${state.cooldownLeft}s` };

  // Activate lever
  game.mmCasino.lastLeverTime = game.elapsed;

  switch (lever) {
    case 'commission':
      state.active = true;
      state.ticksLeft = COMMISSION_DURATION_SEC;
      state.cooldownLeft = COMMISSION_COOLDOWN_SEC;
      return { success: true, message: 'COMMISSION x3 activated!', duration: COMMISSION_DURATION_SEC };
    case 'freeze':
      state.active = true;
      state.ticksLeft = FREEZE_DURATION_SEC_MM;
      state.cooldownLeft = FREEZE_COOLDOWN_SEC;
      return { success: true, message: 'FREEZE activated!', duration: FREEZE_DURATION_SEC_MM };
    case 'squeeze':
      state.active = true;
      state.ticksLeft = SQUEEZE_DURATION_SEC;
      state.cooldownLeft = SQUEEZE_COOLDOWN_SEC;
      return { success: true, message: 'SQUEEZE activated!', duration: SQUEEZE_DURATION_SEC };
  }
}
```

- [ ] **Step 6: Add rent and lever tick processing to tickCandle**

Remove the old `mmNextCandleModifier` candle manipulation block from `tickCandle()`. After `game.elapsed++`, add MM Casino tick logic:

```typescript
  // --- MM Casino: tick levers, rent, inactivity ---
  if (game.gameMode === 'market_maker' && game.mmCasino) {
    const casino = game.mmCasino;
    const mm = game.players.find((p) => p.id === game.marketMakerId);

    // Tick lever durations and cooldowns
    for (const lever of ['commission', 'freeze', 'squeeze'] as MMLeverType[]) {
      const s = casino.levers[lever];
      if (s.active) {
        s.ticksLeft--;
        if (s.ticksLeft <= 0) s.active = false;
      }
      if (s.cooldownLeft > 0) s.cooldownLeft--;
    }

    // Rent pause tick
    if (casino.rentPausedTicksLeft > 0) {
      casino.rentPausedTicksLeft--;
    }

    // MM inactivity check
    if (game.elapsed - casino.lastLeverTime >= MM_INACTIVITY_THRESHOLD_SEC) {
      casino.rentPausedTicksLeft = MM_INACTIVITY_RENT_PAUSE_SEC;
      casino.lastLeverTime = game.elapsed; // reset timer
      // Trader bonus
      for (const p of game.players) {
        if (p.connected && p.role === 'trader') {
          p.balance = roundMoney(p.balance + MM_INACTIVITY_TRADER_BONUS);
        }
      }
    }

    // Rent collection (every RENT_INTERVAL_SEC seconds)
    if (game.elapsed % RENT_INTERVAL_SEC === 0 && casino.rentPausedTicksLeft <= 0 && mm) {
      for (const p of game.players) {
        if (!p.connected || p.role === 'market_maker') continue;
        // Trader inactivity: double rent
        const lastOpen = casino.traderLastOpenTime[p.id] ?? 0;
        const isInactive = (game.elapsed - lastOpen) >= TRADER_INACTIVITY_THRESHOLD_SEC;
        const rentAmount = isInactive ? RENT_AMOUNT * TRADER_INACTIVITY_RENT_MULTIPLIER : RENT_AMOUNT;
        const actualRent = Math.min(rentAmount, p.balance);
        p.balance = roundMoney(p.balance - actualRent);
        mm.balance = roundMoney(mm.balance + actualRent);
      }
    }

    // Squeeze: recalculate liquidation prices for all trader positions
    if (casino.levers.squeeze.active) {
      for (const p of game.players) {
        if (p.position && p.connected && p.role === 'trader') {
          const synergy = hasSynergyBonus(game);
          const tighten = SQUEEZE_TIGHTENING_PERCENT / 100;
          const widen = synergy ? SYNERGY_THRESHOLD_WIDENING_PERCENT / 100 : 0;
          const factor = (1 - tighten) * (1 + widen);
          // Recalculate liq price with squeeze factor
          p.position.liquidationPrice = calcLiquidationPriceSqueeze(
            p.position.direction, p.position.entryPrice, p.position.leverage, factor
          );
        }
      }
    }
  }
```

- [ ] **Step 7: Add helper functions**

```typescript
function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function calcLiquidationPriceSqueeze(
  direction: 'long' | 'short', entryPrice: number, leverage: Leverage, factor: number
): number {
  // factor < 1 = tighter (squeeze), factor > 1 = wider (synergy), combined
  const base = 1 / leverage;
  const adjusted = base * factor;
  if (direction === 'long') {
    return entryPrice * (1 - adjusted);
  } else {
    return entryPrice * (1 + adjusted);
  }
}

export function hasSynergyBonus(game: GameState): boolean {
  if (game.gameMode !== 'market_maker') return false;
  const tradersWithPositions = game.players.filter(
    (p) => p.connected && p.role === 'trader' && p.position
  );
  if (tradersWithPositions.length < SYNERGY_MIN_TRADERS) return false;
  const directions = tradersWithPositions.map((p) => p.position!.direction);
  const longCount = directions.filter((d) => d === 'long').length;
  const shortCount = directions.filter((d) => d === 'short').length;
  return longCount >= SYNERGY_MIN_TRADERS || shortCount >= SYNERGY_MIN_TRADERS;
}
```

- [ ] **Step 8: Add position size cap and commission to openPosition**

In `openPosition()`, after the existing `size > player.balance` check, add:
```typescript
  // MM Casino: position size limit (30% of balance)
  if (game.gameMode === 'market_maker' && player.role === 'trader') {
    const maxSize = Math.floor(player.balance * MAX_POSITION_PERCENT / 100);
    if (size > maxSize) return { success: false, message: `Макс. ${MAX_POSITION_PERCENT}% баланса ($${maxSize})` };
  }

  // MM Casino: block MM from trading
  if (game.gameMode === 'market_maker' && player.role === 'market_maker') {
    return { success: false, message: 'MM не торгует' };
  }
```

After the position is created, before the return, add commission logic:
```typescript
  // MM Casino: commission charge
  if (game.gameMode === 'market_maker' && game.mmCasino?.levers.commission.active) {
    const commission = roundMoney(actualSize * COMMISSION_PERCENT / 100);
    player.balance = roundMoney(player.balance - commission);
    const mm = game.players.find((p) => p.id === game.marketMakerId);
    if (mm) mm.balance = roundMoney(mm.balance + commission);
  }

  // MM Casino: record open time for inactivity tracking
  if (game.gameMode === 'market_maker' && game.mmCasino) {
    game.mmCasino.traderLastOpenTime[playerId] = game.elapsed;
  }
```

- [ ] **Step 9: Add freeze check and commission to closePosition**

In `closePosition()`, after the "no position" check, add:
```typescript
  // MM Casino: freeze blocks closing
  if (game.gameMode === 'market_maker' && game.mmCasino?.levers.freeze.active && player.role === 'trader') {
    return { success: false, message: 'FREEZE! Cannot close positions!', pnl: 0 };
  }
```

Before `player.position = null`, add commission on close:
```typescript
  // MM Casino: commission on close
  if (game.gameMode === 'market_maker' && game.mmCasino?.levers.commission.active) {
    const commission = roundMoney(Math.abs(pnl) * COMMISSION_PERCENT / 100);
    player.balance = roundMoney(player.balance - commission);
    const mmPlayer = game.players.find((p) => p.id === game.marketMakerId);
    if (mmPlayer) mmPlayer.balance = roundMoney(mmPlayer.balance + commission);
  }
```

- [ ] **Step 10: Update liquidation bonus for MM Casino**

In `tickCandle()`, in the liquidation section, replace the aggressor bonus with MM bonus:
```typescript
        // MM Casino: liquidation bonus goes to MM (25%)
        if (game.gameMode === 'market_maker' && game.marketMakerId) {
          const mm = game.players.find((p) => p.id === game.marketMakerId);
          if (mm) {
            const bonus = roundMoney(loss * MM_LIQUIDATION_BONUS_PERCENT / 100);
            mm.balance = roundMoney(mm.balance + bonus);
          }
        } else if (game.lastAggressorId && game.lastAggressorId !== player.id) {
          // Classic mode: aggressor bonus
          const aggressor = game.players.find((p) => p.id === game.lastAggressorId);
          if (aggressor && aggressor.connected) {
            const bonus = roundMoney(loss * LIQUIDATION_BONUS_PERCENT);
            aggressor.balance = roundMoney(aggressor.balance + bonus);
            aggressor.pnl = roundMoney(aggressor.pnl + bonus);
          }
        }
```

- [ ] **Step 11: Update setupNextRound — reset casino state, modified leverage**

Replace `game.mmNextCandleModifier = null;` with:
```typescript
  // Reset MM Casino state for new round (keep same MM)
  if (game.mmCasino) {
    game.mmCasino.levers = createMMCasinoState().levers;
    game.mmCasino.lastLeverTime = 0;
    game.mmCasino.rentPausedTicksLeft = 0;
    game.mmCasino.traderLastOpenTime = {};
  }
```

In the leverage removal section, change to keep 200x in MM mode:
```typescript
  // Remove lowest leverage (but in MM mode, keep 200x minimum)
  if (game.availableLeverages.length > 1) {
    if (game.gameMode === 'market_maker') {
      // Only remove if it won't leave us without 200x
      const newLeverages = game.availableLeverages.slice(1);
      if (newLeverages.includes(200 as Leverage)) {
        game.availableLeverages = newLeverages;
      }
      // Otherwise stop removing
    } else {
      game.availableLeverages = game.availableLeverages.slice(1);
    }
  }
```

- [ ] **Step 12: Update getLeaderboard — add position details**

In `getLeaderboard()` map, add:
```typescript
        positionSize: p.position?.size ?? null,
        liquidationPrice: p.position?.liquidationPrice ?? null,
```

- [ ] **Step 13: Run type check**

Run: `bunx tsc --noEmit`
Expected: Errors only in socket-handler.ts and useGame.ts (they still reference old mmPush). Fix in next tasks.

- [ ] **Step 14: Commit**

```bash
git add src/lib/game-engine.ts
git commit -m "feat(mm-casino): rewrite game engine with Casino mode mechanics"
```

---

### Task 3: Update Socket Handler

**Files:**
- Modify: `src/server/socket-handler.ts`

- [ ] **Step 1: Update imports**

Replace `mmPush as mmPushEngine` with `useMMLever`:
```typescript
  assignMarketMaker, useMMLever, getMarketMakerResult, hasSynergyBonus,
```

Add type import:
```typescript
import type {
  ClientToServerEvents, ServerToClientEvents, GameState, ClientGameState, Leverage, MMLeverType,
} from '../lib/types';
```

- [ ] **Step 2: Update getClientGameState**

Add MM casino fields:
```typescript
    mmLevers: game.mmCasino?.levers || null,
    mmBalance: game.marketMakerId
      ? Math.round((game.players.find((p) => p.id === game.marketMakerId)?.balance || 0) * 100) / 100
      : 0,
```

- [ ] **Step 3: Update sendPlayerUpdate**

Add new fields:
```typescript
    rentDrain: game.mmCasino
      ? (() => {
          const lastOpen = game.mmCasino.traderLastOpenTime[playerId] ?? 0;
          const isInactive = (game.elapsed - lastOpen) >= 15; // TRADER_INACTIVITY_THRESHOLD_SEC
          return isInactive ? 200 : 100;
        })()
      : 0,
    isFreezed: game.mmCasino?.levers.freeze.active && player.role === 'trader' ? true : false,
```

- [ ] **Step 4: Replace mmPush socket handler with useMMLever**

Replace the `socket.on('mmPush', ...)` handler with:
```typescript
    socket.on('useMMLever', ({ lever }) => {
      if (!['commission', 'freeze', 'squeeze'].includes(lever)) {
        socket.emit('error', 'Invalid lever');
        return;
      }
      const roomCode = playerRooms.get(socket.id);
      if (!roomCode) return;
      const game = rooms.get(roomCode);
      if (!game) return;

      const result = useMMLever(game, socket.id, lever as MMLeverType);
      if (result.success) {
        io.to(roomCode).emit('mmLeverUsed', { lever: lever as MMLeverType, duration: result.duration! });
        broadcastState(io, game);
      } else {
        socket.emit('error', result.message);
      }
    });
```

- [ ] **Step 5: Add rent tick broadcast in candle timer**

In the candle timer interval (after `tickCandle` and before leaderboard broadcast), add:
```typescript
        // MM Casino: broadcast rent ticks
        if (game.gameMode === 'market_maker' && game.mmCasino && game.elapsed % 5 === 0) {
          const mm = game.players.find((p) => p.id === game.marketMakerId);
          if (mm) {
            io.to(game.roomCode).emit('mmRentTick', {
              amount: 100,
              mmBalance: Math.round(mm.balance * 100) / 100,
            });
          }
        }

        // MM Casino: broadcast inactivity penalty
        if (game.gameMode === 'market_maker' && game.mmCasino && game.mmCasino.rentPausedTicksLeft === MM_INACTIVITY_RENT_PAUSE_SEC) {
          io.to(game.roomCode).emit('mmInactivityPenalty');
        }
```

Import `MM_INACTIVITY_RENT_PAUSE_SEC` from types at the top.

- [ ] **Step 6: Run type check and build**

Run: `bunx tsc --noEmit && bun run build`
Expected: Errors only in useGame.ts and UI files. Fix in next tasks.

- [ ] **Step 7: Commit**

```bash
git add src/server/socket-handler.ts
git commit -m "feat(mm-casino): update socket handler with lever system and rent broadcasts"
```

---

### Task 4: Update Client Hook

**Files:**
- Modify: `src/lib/useGame.ts`

- [ ] **Step 1: Update imports and types**

Replace `GameMode` import, add `MMLeverType`:
```typescript
import type {
  ClientGameState, ClientPlayerState, LeaderboardEntry,
  RoundResult, Candle, Leverage, BonusResult, BonusType, SkillType, FinalPlayerStats,
  GameMode, MMLeverType,
} from './types';
```

- [ ] **Step 2: Replace MM state**

Replace `mmPushAlert` state with:
```typescript
  const [mmLeverAlert, setMmLeverAlert] = useState('');
  const [mmRentAlert, setMmRentAlert] = useState('');
```

- [ ] **Step 3: Replace event listeners**

Remove `socket.on('mmPush', ...)`. Replace with:
```typescript
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
      setMmLeverAlert('MM БЕЗДЕЙСТВУЕТ! +$200 бонус!');
      setTimeout(() => setMmLeverAlert(''), 3000);
    });
```

- [ ] **Step 4: Update cleanup**

Replace `socket.off('mmPush')` with:
```typescript
      socket.off('mmLeverUsed');
      socket.off('mmRentTick');
      socket.off('mmInactivityPenalty');
```

- [ ] **Step 5: Replace mmPush callback with useMMLever**

Replace:
```typescript
  const mmPush = useCallback((direction: 'up' | 'down') => {
    getSocket().emit('mmPush', { direction });
  }, []);
```
with:
```typescript
  const useMMLever = useCallback((lever: MMLeverType) => {
    getSocket().emit('useMMLever', { lever });
  }, []);
```

- [ ] **Step 6: Update return object**

Replace `mmPushAlert` and `mmPush` with:
```typescript
    mmLeverAlert, mmRentAlert,
    ...
    useMMLever,
```

- [ ] **Step 7: Run type check**

Run: `bunx tsc --noEmit`
Expected: Errors in play/page.tsx and tv/page.tsx only (they reference old mmPush/mmPushAlert).

- [ ] **Step 8: Commit**

```bash
git add src/lib/useGame.ts
git commit -m "feat(mm-casino): update client hook with lever events and rent alerts"
```

---

### Task 5: Rewrite Player UI — MM Dashboard & Trader Effects

**Files:**
- Modify: `src/app/play/page.tsx`

This is the biggest UI task. The MM gets a completely different trading screen (dashboard with trader positions + 3 lever buttons). Traders get effect banners and freeze behavior.

- [ ] **Step 1: Update useGame destructuring**

Replace `mmPush, mmPushAlert` with `useMMLever, mmLeverAlert, mmRentAlert` in the destructured hook values.

- [ ] **Step 2: Replace MM push alert with lever alert**

Replace the `mmPushAlert` banner with:
```typescript
        {mmLeverAlert && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-accent-gold text-black font-bold rounded-lg px-4 py-2 z-50 animate-alert">
            {mmLeverAlert}
          </div>
        )}
```

- [ ] **Step 3: Add rent drain alert for traders**

After the lever alert, add:
```typescript
        {mmRentAlert && playerState.role === 'trader' && gameState.gameMode === 'market_maker' && (
          <div className="absolute top-2 right-4 text-accent-red font-mono font-bold text-sm z-50 animate-ping">
            {mmRentAlert}
          </div>
        )}
```

- [ ] **Step 4: Replace MM trading UI**

Replace the entire MM buttons block (the `playerState.role === 'market_maker'` section) with a full dashboard:

```typescript
        {/* Market Maker Dashboard */}
        {playerState.role === 'market_maker' && gameState.gameMode === 'market_maker' && (
          <div className="flex-1 flex flex-col mx-4 mt-2">
            {/* MM Balance */}
            <div className="text-center mb-3">
              <p className="text-text-secondary text-xs uppercase">MM Баланс</p>
              <p className="text-3xl font-mono font-bold text-accent-gold">${playerState.balance.toFixed(0)}</p>
            </div>

            {/* Lever Buttons */}
            <div className="space-y-2 mb-3">
              {(['commission', 'freeze', 'squeeze'] as const).map((lever) => {
                const leverState = gameState.mmLevers?.[lever];
                const isActive = leverState?.active || false;
                const cooldown = leverState?.cooldownLeft || 0;
                const canUse = !isActive && cooldown <= 0;
                const configs = {
                  commission: { label: 'КОМИССИЯ x3', color: 'bg-accent-red', icon: 'COM' },
                  freeze: { label: 'ЗАМОРОЗКА', color: 'bg-blue-600', icon: 'FRZ' },
                  squeeze: { label: 'СЖАТИЕ', color: 'bg-accent-gold', icon: 'SQZ' },
                };
                const cfg = configs[lever];
                return (
                  <button
                    key={lever}
                    onClick={() => useMMLever(lever)}
                    disabled={!canUse}
                    className={`w-full py-3 rounded-xl font-bold text-lg active:scale-95 transition-all ${
                      isActive ? `${cfg.color} text-white animate-pulse` :
                      canUse ? `${cfg.color} text-white` :
                      'bg-surface-light text-text-muted'
                    } disabled:opacity-40`}
                  >
                    {cfg.icon} {cfg.label}
                    {isActive && ` (${leverState?.ticksLeft}s)`}
                    {!isActive && cooldown > 0 && ` (CD: ${cooldown}s)`}
                  </button>
                );
              })}
            </div>

            {/* Trader Positions Dashboard */}
            <div className="flex-1 overflow-y-auto space-y-2">
              <p className="text-text-secondary text-xs uppercase">Позиции трейдеров</p>
              {leaderboard.filter((e) => e.role === 'trader').map((entry) => (
                <div key={entry.nickname} className={`rounded-lg p-2 text-sm ${
                  entry.hasPosition
                    ? entry.totalPnl >= 0 ? 'bg-accent-green/10 border border-accent-green/30' : 'bg-accent-red/10 border border-accent-red/30'
                    : 'bg-surface-light border border-border'
                }`}>
                  <div className="flex justify-between">
                    <span className="font-bold">{entry.nickname}</span>
                    <span className="font-mono">${entry.balance.toFixed(0)}</span>
                  </div>
                  {entry.hasPosition && (
                    <div className="flex justify-between text-xs mt-1">
                      <span className={entry.positionDirection === 'long' ? 'text-accent-green' : 'text-accent-red'}>
                        {entry.positionDirection?.toUpperCase()} x{entry.positionLeverage}
                      </span>
                      <span className="text-text-secondary">
                        Margin: ${entry.positionSize} | Liq: {entry.liquidationPrice?.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
```

- [ ] **Step 5: Add active effect banners for traders**

After the trader MM indicator, add effect banners:
```typescript
        {/* Active MM effects for traders */}
        {playerState.role === 'trader' && gameState.gameMode === 'market_maker' && gameState.mmLevers && (
          <div className="mx-4 mt-1 space-y-1">
            {gameState.mmLevers.commission.active && (
              <div className="bg-accent-red/20 border border-accent-red/50 rounded-lg px-3 py-1 text-accent-red text-xs font-bold text-center">
                КОМИССИЯ x3 — 3% fee! ({gameState.mmLevers.commission.ticksLeft}s)
              </div>
            )}
            {gameState.mmLevers.freeze.active && (
              <div className="bg-blue-600/20 border border-blue-500/50 rounded-lg px-3 py-1 text-blue-400 text-xs font-bold text-center">
                ЗАМОРОЗКА — Нельзя закрыть! ({gameState.mmLevers.freeze.ticksLeft}s)
              </div>
            )}
            {gameState.mmLevers.squeeze.active && (
              <div className="bg-accent-gold/20 border border-accent-gold/50 rounded-lg px-3 py-1 text-accent-gold text-xs font-bold text-center">
                СЖАТИЕ — Ликвидация ближе! ({gameState.mmLevers.squeeze.ticksLeft}s)
              </div>
            )}
          </div>
        )}
```

- [ ] **Step 6: Disable close button during freeze**

In the close position button, add disabled state:
```typescript
              disabled={playerState.isFreezed}
```
And change the button text when frozen:
```typescript
              {playerState.isFreezed ? 'FREEZE — LOCKED' : `CLOSE ${unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)}$`}
```

- [ ] **Step 7: Hide trading controls for MM**

Wrap the entire trading controls section (leverage selector, size selector, long/short buttons) in:
```typescript
        {playerState.role !== 'market_maker' && (
          /* ...existing trading controls... */
        )}
```

- [ ] **Step 8: Run type check and build**

Run: `bunx tsc --noEmit && bun run build`
Expected: May have errors in tv/page.tsx (still references old mmPushAlert). Fix in Task 6.

- [ ] **Step 9: Commit**

```bash
git add src/app/play/page.tsx
git commit -m "feat(mm-casino): MM dashboard UI with levers, trader effect banners"
```

---

### Task 6: Update TV Page

**Files:**
- Modify: `src/app/tv/page.tsx`

- [ ] **Step 1: Update useGame destructuring**

Replace `mmPushAlert` with `mmLeverAlert, mmRentAlert` in destructured values.

- [ ] **Step 2: Replace mmPushAlert banner with lever alert**

Replace the mmPushAlert banner with:
```typescript
        {mmLeverAlert && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-accent-gold text-black font-bold text-2xl px-8 py-3 rounded-xl z-50 animate-alert">
            {mmLeverAlert}
          </div>
        )}
```

- [ ] **Step 3: Add active effects overlay in trading view**

After the header, before the chart section, add:
```typescript
        {/* MM Active Effects */}
        {isMMMode && gameState.mmLevers && (
          <div className="flex gap-2 px-6 py-1">
            {gameState.mmLevers.commission.active && (
              <span className="bg-accent-red/20 border border-accent-red/50 rounded px-3 py-1 text-accent-red text-sm font-bold animate-pulse">
                КОМИССИЯ x3 ({gameState.mmLevers.commission.ticksLeft}s)
              </span>
            )}
            {gameState.mmLevers.freeze.active && (
              <span className="bg-blue-600/20 border border-blue-500/50 rounded px-3 py-1 text-blue-400 text-sm font-bold animate-pulse">
                ЗАМОРОЗКА ({gameState.mmLevers.freeze.ticksLeft}s)
              </span>
            )}
            {gameState.mmLevers.squeeze.active && (
              <span className="bg-accent-gold/20 border border-accent-gold/50 rounded px-3 py-1 text-accent-gold text-sm font-bold animate-pulse">
                СЖАТИЕ ({gameState.mmLevers.squeeze.ticksLeft}s)
              </span>
            )}
          </div>
        )}
```

- [ ] **Step 4: Add MM balance display in header**

In the trading header, after the MM name, add:
```typescript
            {isMMMode && (
              <span className="text-accent-gold text-sm font-mono font-bold mr-3">
                ${gameState.mmBalance.toFixed(0)}
              </span>
            )}
```

- [ ] **Step 5: Run full build**

Run: `bunx tsc --noEmit && bun run build`
Expected: Clean build with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/tv/page.tsx
git commit -m "feat(mm-casino): update TV page with lever effects and MM balance"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Full build**

Run: `bun run build`
Expected: Clean build, all pages compile.

- [ ] **Step 2: Start dev server**

Run: `bun run dev`
Expected: Server starts on http://localhost:3000

- [ ] **Step 3: Manual test — Classic mode still works**

1. Open TV (localhost:3000/tv) → select "Classic" → room created
2. Join as player on /play → trade normally
3. Verify: no MM-specific UI appears, no rent, no levers

- [ ] **Step 4: Manual test — MM Casino mode**

1. Open TV → select "Market Maker" → room created
2. Join with 2+ players
3. Start game → one player becomes MM with $0 balance
4. Verify MM sees: lever dashboard, trader positions, no trading controls
5. Verify traders see: normal trading, "vs MM" indicator
6. Press Commission lever → verify red banner appears for traders, 3% fee charged
7. Press Freeze → verify traders can't close positions for 5s
8. Press Squeeze → verify liquidation thresholds tighten
9. Wait 8s without pressing lever → verify rent pauses, traders get $200
10. Verify rent drains traders every 5s ($100 each)
11. Play full 6 rounds → verify final MM vs Traders result

- [ ] **Step 5: Commit everything**

```bash
git add -A
git commit -m "feat(mm-casino): complete Market Maker Casino mode implementation"
```
