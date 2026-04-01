# Bonus Phase Rotation: Wheel + Slots + Lootbox

## Summary

Replace the static `slots` phase with a rotating `bonus` phase. After each round, one of three mini-games plays — determined by `roundNumber % 3`. All three share the same flow: player picks a bet, plays once, gets a result. Timer: 15 seconds.

**Goal:** DRIVE, AZART, FUN. Short dopamine loops, variety every round.

## Rotation Order

| `roundNumber % 3` | Type | Name |
|---|---|---|
| 1 | `wheel` | Колесо Фортуны |
| 2 | `slots` | Слот-Машина (existing) |
| 0 | `lootbox` | Лутбокс |

## Mini-Game Designs

### 1. Wheel (Колесо Фортуны)

**UX:** Колесо с 8 секторами. Игрок ставит, жмёт "КРУТИТЬ", колесо вращается 2-3 секунды с замедлением, останавливается на секторе.

**Sectors (8 штук, неравные шансы):**

| Sector | Multiplier | Weight | Chance |
|---|---|---|---|
| x0 (BUST) | 0 | 3 | 18.75% |
| x0.5 | 0.5 | 2 | 12.5% |
| x1.5 | 1.5 | 3 | 18.75% |
| x2 | 2 | 3 | 18.75% |
| x3 | 3 | 2 | 12.5% |
| x5 | 5 | 2 | 12.5% |
| x10 | 10 | 0.8 | 5% |
| x25 JACKPOT | 25 | 0.2 | 1.25% |

**Win calculation:** Same as slots: `multiplier === 0 ? -bet : (bet * multiplier - bet)`

**Colors:** Red (x0), Orange (x0.5), White (x1.5), Green (x2), Blue (x3), Purple (x5), Gold (x10), Rainbow/animated (x25).

### 2. Slots (Слот-Машина) — existing

No changes to existing slot logic. Already works with symbols `['₿', 'Ξ', '🐕', '🚀', '💎', '🌕']` and multipliers up to x10.

### 3. Lootbox (Лутбокс)

**UX:** 4 закрытых коробки. Игрок ставит, выбирает одну. Выбранная открывается с анимацией. Затем остальные 3 открываются, показывая "что могло быть" — усиливает дофамин.

**Box contents (4 multiplier values, randomly assigned):**

Из пула выбираются 4 значения. Пул:

| Multiplier | Weight | Meaning |
|---|---|---|
| 0 (BUST) | 3 | Потерял ставку |
| 0.5 | 2 | Потерял половину |
| x1.5 | 3 | Маленький плюс |
| x2 | 3 | Удвоение |
| x3 | 2 | Тройка |
| x5 | 1.5 | Большой выигрыш |
| x10 | 0.8 | Мега |
| x50 JACKPOT | 0.2 | Джекпот |

4 значения выбираются из пула (weighted random, без повторов по тиру — но два разных множителя допускаются). Гарантируется: минимум 1 коробка >= x2, минимум 1 коробка <= x1.5. Это создаёт ощущение "правильного выбора".

**Win calculation:** Same formula: `multiplier === 0 ? -bet : (bet * multiplier - bet)`

**Reveal flow:**
1. Игрок выбирает коробку (клик)
2. Выбранная открывается (0.5 сек анимация)
3. Через 1 сек остальные открываются одна за другой (0.3 сек между ними)
4. Показывается итог: выигрыш/проигрыш

## Architecture

### Phase Change

**`GameState.phase`**: Добавляем `'bonus'` как замену `'slots'`. Тип бонуса хранится в `BonusState.bonusType`.

### Types (new/modified)

```typescript
// Bonus type
export type BonusType = 'wheel' | 'slots' | 'lootbox';

// Existing SlotResult stays as-is for slots

// Wheel result
export interface WheelResult {
  sectorIndex: number;    // 0-7, какой сектор выпал
  multiplier: number;
  bet: number;
  winAmount: number;
}

// Lootbox result
export interface LootboxResult {
  boxes: number[];           // 4 множителя (все коробки)
  chosenIndex: number;       // 0-3, какую выбрал
  multiplier: number;        // boxes[chosenIndex]
  bet: number;
  winAmount: number;
}

// Union type for bonus result
export type BonusResult =
  | { type: 'slots'; result: SlotResult }
  | { type: 'wheel'; result: WheelResult }
  | { type: 'lootbox'; result: LootboxResult };

// Bonus state (replaces SlotState)
export interface BonusState {
  bonusType: BonusType;
  played: Record<string, BonusResult>;
  timer: number;
}
```

### Game Engine Changes

**`game-engine.ts`:**

1. `startSlots()` → `startBonus(game)`: Sets `game.phase = 'bonus'`, determines `bonusType` from `roundNumber % 3`, creates `BonusState`.

2. `spinSlots()` stays for slots logic.

3. New `spinWheel(game, playerId, bet)`: Weighted random sector selection, same validation pattern as `spinSlots`.

4. New `openLootbox(game, playerId, bet, chosenIndex)`: Generates 4 box values (weighted), validates choice, returns full reveal.

5. `getSlotResults()` → `getBonusResults()`: Returns results for any bonus type.

### Socket Events (new/modified)

**Server → Client:**
- `bonusStart: { type: BonusType, timer: number }` — new, tells client which bonus to render
- `slotResult` → `bonusResult: BonusResult` — unified result event
- `slotUpdate` → `bonusUpdate: { timer, type, results }` — unified update

**Client → Server:**
- `spinSlots` stays (for slots type)
- `spinWheel: { bet }` — new
- `openLootbox: { bet, chosenIndex }` — new

### UI Changes

**`play/page.tsx`:**
- Current inline slots rendering (lines 295-400) → conditional rendering based on `bonusType`:
  - `wheel`: Колесо с секторами, кнопка "КРУТИТЬ", ставка
  - `slots`: Текущий UI без изменений
  - `lootbox`: 4 коробки, ставка, клик для выбора

**`tv/page.tsx`:**
- Similar conditional: show appropriate bonus type results for each player
- Title changes: "КОЛЕСО ФОРТУНЫ" / "СЛОТ-МАШИНА" / "ЛУТБОКС"

### Hook Changes

**`useGame.ts`:**
- `slotResult` state → `bonusResult: BonusResult | null`
- `slotData` state → `bonusData: { timer, type, results } | null`
- Add `spinWheel(bet)` and `openLootbox(bet, chosenIndex)` callbacks
- Listen to new socket events

## Data Flow

```
Round ends
  → socket-handler calls startBonus(game)
  → bonusType = roundNumber % 3 mapping
  → server emits 'bonusStart' { type, timer }
  → client renders appropriate mini-game UI
  → player sets bet, performs action
  → client emits 'spinWheel'/'spinSlots'/'openLootbox'
  → server processes, updates balance
  → server emits 'bonusResult' to player
  → server emits 'bonusUpdate' to room
  → timer expires → voting phase
```

## Backwards Compatibility

- `SlotState` replaced by `BonusState`
- `game.slotState` replaced by `game.bonusState`
- Phase `'slots'` replaced by `'bonus'`
- No migration needed — game state is ephemeral (in-memory, no persistence)

## Timer & Pacing

- All three bonus types: 15 seconds
- Bet selection: same 4 buttons as current slots (5%, 10%, 25%, 50%)
- One play per player per bonus phase
