# Draw Mode — Game Design Spec

## Overview

Fourth game mode: "Draw Mode". One player is the Market Maker who draws the price chart with their finger before each round. Traders then trade against the drawn chart with full Classic mechanics (leverage, skills, liquidations). MM earns a percentage of all liquidations — the more devious the chart, the bigger the reward.

## Core Asymmetry

- **MM knows the future** — they drew it
- **Traders see candles reveal one-by-one** during the trading phase
- **MM's income = liquidation bounty** — motivated to draw traps, fakeouts, reversals

## Round Flow

1. **Drawing phase** (15s) — MM draws a line on their phone screen (touch canvas). Other players see "MM рисует график..." on their phones, TV shows waiting screen.
2. **Countdown** (3s) — 3-2-1 before trading starts.
3. **Trading phase** (40s) — 40 candles at 1s each. Candles appear one-by-one. Full Classic mechanics: leverage (25-500x), positions, skills, liquidations.
4. **Round result** (3s) — Leaderboard update, MM earnings shown.
5. **Bonus phase** — Same rotating mini-games as Classic (every round).
6. **Next round** — Automatically proceeds to the next round. Max 8 rounds.

## Candle Generation Algorithm

### Input
MM draws a line on a canvas (touch events → array of {x, y} points normalized to 0-1 range).

### Processing
1. **Resample** the drawn line to exactly 41 evenly-spaced points along X axis (0 to 40 segments → 40 candles)
2. **Map Y to price**: Y range [0,1] maps to price range. Starting price is random (e.g., $100). Y=0 → price + 10%, Y=1 → price - 10%. So the canvas is inverted (draw up = price goes up visually).
3. **Generate candles** from segments:
   - For segment i (point[i] to point[i+1]):
   - `open = priceFromY(point[i].y)`
   - `close = priceFromY(point[i+1].y)`
   - Slope = `abs(close - open)`
   - Volatility = `baseVolatility + slope * slopeFactor`
   - `high = max(open, close) + random(0, volatility)`
   - `low = min(open, close) - random(0, volatility)`
   - Ensure `high >= max(open, close)` and `low <= min(open, close)`
4. **Auto-draw fallback**: If MM doesn't draw in 15s, generate random candles (same as Classic chart-generator).

### Parameters
- `baseVolatility`: 0.03% of price — minimum wick size (tiny wicks, safe for all leverages)
- `slopeFactor`: 0.03 — minimal slope amplification
- Starting price: random $50-$500

## MM Economics

- **Starting balance**: $0 (like current MM mode)
- **Liquidation bounty**: MM receives 50% of every liquidated player's lost margin
- **No rent, no levers** — pure drawing skill
- **Win condition**: MM balance > average trader balance at game end

## Trader Mechanics

Identical to Classic mode:
- Starting balance: $10,000
- Leverages: 25x, 50x, 100x, 200x, 500x
- Skills: all 8 (trump_tweet, inverse, shield, double_or_nothing, freeze, blind, steal, chaos)
- Positions: long/short with margin, entry price, liquidation price
- Liquidation: when price hits liquidation price
- Position auto-close at round end

## MM Role Assignment

- Random player becomes MM at game start (same as current MM mode)
- MM stays for entire game
- MM cannot trade

## Mobile Screen — MM (Drawing)

### Drawing Phase (15s)
```
┌─────────────────────────────┐
│ MM DRAW     ⏱ 8s    R1/12  │
├─────────────────────────────┤
│                             │
│  ┌───────────────────────┐  │
│  │                       │  │
│  │   [Touch Canvas]      │  │
│  │   Draw price line     │  │
│  │   with your finger    │  │
│  │                       │  │
│  │   ~~~~/\___/~~        │  │
│  │                       │  │
│  └───────────────────────┘  │
│                             │
│  [CLEAR]        [CONFIRM]   │
├─────────────────────────────┤
│  Заработок: $0              │
│  Ликвидаций: 0              │
└─────────────────────────────┘
```

### Trading Phase (MM watches)
```
┌─────────────────────────────┐
│ MM      $450     R1/12      │
├─────────────────────────────┤
│                             │
│  [Chart — MM sees full      │
│   drawn line as overlay +   │
│   actual candles appearing] │
│                             │
├─────────────────────────────┤
│  Твой рисунок vs реальность │
│  Ликвидаций: 2  (+$1,200)   │
│                             │
│  Позиции трейдеров:         │
│  3 ▲ LONG | 1 ▼ SHORT      │
└─────────────────────────────┘
```

## Mobile Screen — Traders

Same as Classic mode play page but:
- Candles appear 1 per second during the trading phase
- Skills work identically
- Position awareness strip shows other players

## TV Screen

### Drawing Phase
```
┌──────────────────────────────────────────────────────────────┐
│ DRAW MODE  R1/12  │  ⏱ 8с  │  MM: Alice рисует...         │
├──────────────────────────────┬───────────────────────────────┤
│                              │ ЛИДЕРБОРД                    │
│   [Empty chart area]         │                              │
│   "Маркет-мейкер рисует     │ 1. Bob      $10,000          │
│    график..."                │ 2. Charlie  $10,000          │
│                              │ 3. Diana    $10,000          │
│   [Animated pencil icon]     │                              │
│                              │ MM: Alice   $0               │
└──────────────────────────────┴───────────────────────────────┘
```

### Trading Phase
Same as Classic TV but chart shows drawn candles + position markers.

## Architecture

Follows existing modular pattern:

| Layer | New Files |
|-------|-----------|
| Types | `src/lib/types/draw.ts` |
| Engine | `src/lib/engine/draw.ts` — candle generation from drawing |
| Hook | `src/lib/useDrawGame.ts` |
| Server | `src/server/draw-handler.ts` |
| Pages | `src/app/play-draw/page.tsx` + `src/app/tv-draw/page.tsx` |
| Home | Add button in `src/app/page.tsx` |

### Modified Files
- `src/lib/types/shared.ts` — GameMode += 'draw', new phases
- `src/lib/types/index.ts` — re-export
- `src/lib/engine/index.ts` — re-export
- `src/server/socket-handler.ts` — route draw events
- `src/lib/useGameModeRedirect.ts` — add draw route
- `src/app/page.tsx` — add button

### Reused from Classic
- All skill logic (engine/classic.ts)
- Position/leverage/liquidation (engine/shared.ts)
- MiniChart / CandlestickChart components
- Bonus phase + voting
- Leaderboard
- Position awareness strip

### New Phases
- `'draw_drawing'` — MM is drawing
- Then standard `'countdown'` → `'trading'` → `'bonus'`

### New Socket Events
Client → Server:
- `submitDrawing` → `{ points: {x: number, y: number}[] }` — MM submits their drawing

Server → Client:
- `drawPhase` → `{ timer: number }` — drawing phase countdown
- `mmLiquidationBonus` → `{ nickname: string, amount: number }` — MM gets notified of earnings

### Drawing Canvas Component
New component in play-draw page:
- Full-width touch canvas
- Records touch points as normalized {x: 0-1, y: 0-1}
- Shows drawn line in real-time
- Clear button to restart
- Confirm button to submit early
- Auto-submits at timer end

## Types

```typescript
interface DrawPoint {
  x: number; // 0-1, normalized X position
  y: number; // 0-1, normalized Y position (0=top=high price, 1=bottom=low price)
}

interface DrawRoundState {
  roundNumber: number;
  maxRounds: number;
  drawingPoints: DrawPoint[] | null; // null until MM submits
  generatedCandles: Candle[]; // all 40 candles (server only)
  visibleCandleCount: number; // how many candles revealed so far
  startingPrice: number;
  mmEarnings: number; // total MM earnings this round
  liquidationCount: number; // liquidations this round
}

// Candle generation config
const DRAW_CANDLES_PER_ROUND = 40;
const DRAW_CANDLE_INTERVAL_MS = 1000;
const DRAW_DRAWING_TIME_SEC = 15;
const DRAW_MAX_ROUNDS = 8;
const DRAW_MM_LIQUIDATION_PERCENT = 50; // MM gets 50% of liquidated margin
const DRAW_BASE_VOLATILITY = 0.0003; // 0.03% of price — tiny wicks
const DRAW_SLOPE_FACTOR = 0.03;
```

## Not Included

- No MM levers (commission/freeze/squeeze) — pure drawing
- No rent system
- No binary betting mechanics
