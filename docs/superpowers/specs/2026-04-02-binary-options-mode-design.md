# Binary Options Mode — Game Design Spec

## Overview

Third game mode for InvestSovet: "Binary Options". Players view a candlestick chart and bet whether the price will go UP or DOWN after 5 candles. Bets form a shared pool — losers' money is distributed to winners proportionally to their stake size.

Core principles: maximum dopamine, fast rounds, zero downtime between rounds, social betting (against each other, not the house).

## Round Flow (~15s per round)

1. **Chart display** (2s) — New random ticker, ~20 historical candles, horizontal line at current price
2. **Betting phase** (5s) — Players choose UP/DOWN + bet size (10/25/50/75/100% of balance). Timer countdown. If no bet placed in 5s → server auto-bets random direction + 10% balance
3. **Reveal** (1s) — All bets shown on TV: who bet what direction and how much
4. **Waiting** (5 candles, ~5s) — New candles drawn in real-time, tension builds
5. **Result** (2s) — Price above/below entry → winners get from pool, balances update
6. → Immediately next round (no pause)

## Win/Loss Conditions

- Player eliminated when balance <= 0 after a round
- Game ends when: 1 player remaining (winner) OR max rounds reached (20) → highest balance wins
- All bankrupt simultaneously → highest pre-round balance wins

## Economy

- Starting balance: $10,000
- Bet sizes: 10% / 25% / 50% / 75% / 100% of current balance
- Auto-bet on timeout: random direction, 10% balance

### Payout Calculation

All bets form two pools: UP-pool and DOWN-pool.

```
Example: 5 players
  Alice  → UP   $2000
  Bob    → UP   $1000
  Charlie→ DOWN $3000
  Diana  → DOWN $500
  Eve    → UP   $1500

UP-pool:  $4500    DOWN-pool: $3500

Result: price went UP → UP wins

Losers' pool ($3500) distributed to winners proportionally:
  Alice:  2000/4500 × 3500 = +$1555.56
  Bob:    1000/4500 × 3500 = +$777.78
  Eve:    1500/4500 × 3500 = +$1166.67

Charlie: -$3000, Diana: -$500
```

### Edge Case: All Bet Same Direction

Round cancelled, bets returned, new chart generated. TV shows: "Все поставили одинаково — переигровка!"

## Mobile Screen (Player)

### Betting Phase (5s)
- Header: balance + round number (R1/20)
- Chart: ~20 historical candles with entry price line
- Timer: countdown
- Bet size selector: [10%] [25%] [50%] [75%] [100%]
- Two large buttons: [▲ UP] [▼ DOWN]

### Waiting Phase (5 candles)
- Header: balance + round number
- Chart: growing in real-time with new candles
- My bet indicator: "▲ UP $2,500"
- Candle progress: ██░░░ 2/5
- Pool summary: "UP: $6,200 vs DOWN: $3,800"

### Result Phase (2s)
- Large result: "✓ UP WINS" or "✗ DOWN WINS"
- Win/loss amount: "+$2,555" or "-$1,000"
- Updated balance
- Soft background glow: green/red (bg-accent-green/20 or bg-accent-red/20, fade 0.3s in, 0.7s out)

## TV Screen

### Layout
Reuse existing TV layout: large chart left + sidebar right.

### Betting Phase
- Header: "БИНАРНЫЕ ОПЦИОНЫ R1/20 | ⏱ 4с | TICKER"
- Chart: large candlestick with entry price line
- Sidebar: Leaderboard with balances + "Ставки: 3/5 сделали"

### Reveal + Waiting Phase
- Chart: new candles drawing in real-time
- Sidebar: bets grouped by direction (UP players + amounts, DOWN players + amounts, total pool)
- Visual bar: UP pool vs DOWN pool proportions

### Result Phase
- Soft background glow (not eye-burning flash)
- Large "▲ UP WINS" or "▼ DOWN WINS"
- Quick payout list → immediate transition to next round

## Architecture

Follows existing modular pattern (same as Classic/Market Maker split):

| Layer | New Files |
|-------|-----------|
| Types | `src/lib/types/binary.ts` |
| Engine | `src/lib/engine/binary.ts` |
| Hook | `src/lib/useBinaryGame.ts` |
| Server | `src/server/binary-handler.ts` |
| Pages | `src/app/play-binary/page.tsx` + `src/app/tv-binary/page.tsx` |
| Home | Add button in `src/app/page.tsx` |

### Modified Files
- `src/lib/types/shared.ts` — extend GameMode: `'classic' | 'market_maker' | 'binary'`
- `src/lib/types/index.ts` — re-export binary types
- `src/lib/engine/index.ts` — re-export binary engine
- `src/server/socket-handler.ts` — route binary events to binary-handler

### Reused
- `engine/shared.ts` — createGame, addPlayer
- `chart-generator.ts` — random ticker candle fetching
- CandlestickChart / MiniChart components
- `shared-state.ts` — rooms, broadcastState
- `useGame.ts` — base hook
- Color palette, fonts, layout patterns

### New Phases
`'binary_betting' | 'binary_reveal' | 'binary_waiting' | 'binary_result'`

### New Socket Events

Client → Server:
- `placeBet` → `{ direction: 'up' | 'down', percent: number }`

Server → Client:
- `binaryRound` → round state (bets hidden until reveal)
- `binaryReveal` → `{ bets, upPool, downPool }`
- `binaryCandle` → `{ candle, index }` (each of 5 new candles)
- `binaryResult` → `{ direction, finalPrice, payouts }`
- `playerEliminated` → `{ nickname }`

## Types

```typescript
type BinaryDirection = 'up' | 'down';

interface BinaryBet {
  playerId: string;
  nickname: string;
  direction: BinaryDirection;
  amount: number;
}

interface BinaryRoundState {
  roundNumber: number;
  maxRounds: number;          // 20
  ticker: string;
  candles: Candle[];
  entryPrice: number;
  bets: BinaryBet[];
  result: BinaryDirection | null;
  candlesRevealed: number;    // 0-5
  finalPrice: number | null;
  upPool: number;
  downPool: number;
}

interface BinaryPlayerState {
  balance: number;
  myBet: BinaryBet | null;
  eliminated: boolean;
  lastWin: number | null;
}
```

## Not Included

- No skills
- No leverage / positions / liquidations
- No bonus phase
- No voting between rounds
- No Market Maker role
