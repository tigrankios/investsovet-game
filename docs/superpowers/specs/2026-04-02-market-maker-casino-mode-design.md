# Market Maker "Casino" Mode — Game Design Spec

## Overview

A new game mode where one player becomes the **Market Maker (MM)** — a casino boss who doesn't trade but controls market conditions. All other players are **Traders** competing individually but incentivized to cooperate against the MM.

**Core fantasy:** MM is the house. Traders are the gamblers trying to beat the house.

---

## Roles

### Market Maker
- **Does not trade.** No long/short buttons, no positions.
- **Starts with $0.** All income comes from trader activity.
- **Has 3 lever buttons** to manipulate market conditions.
- **Sees all trader positions** (direction, size, leverage, liquidation price) in real-time.

### Traders
- **Trade normally** with long/short, leverage, positions.
- **Start with $10,000 each.**
- **Max 30% of balance per position** (no all-in).
- **Get random skills each round** (same as classic mode).
- **Incentivized to coordinate** via synergy bonus.

---

## Economy

### Rent ("Market Tax")
- Every **5 seconds**, each trader pays **$100** to the MM.
- Per trader per round (60s): **$1,200** (12 ticks).
- Total MM rent income (4 traders): **$4,800/round**.
- This is the baseline pressure forcing traders to trade actively.

### MM Lever Income
Additional income from commissions and liquidations (see Levers section).

### Liquidation Bonus
When a trader is liquidated, MM receives **25% of the liquidated margin**.

---

## MM Levers

Three buttons, each with independent cooldowns:

### 1. COMMISSION x3
- **Cooldown:** 20 seconds
- **Duration:** 6 seconds
- **Effect:** Opening or closing a position costs the trader **3% of margin**, paid to MM.
- **Visual:** Red banner on all screens "COMMISSION x3 ACTIVE"
- **Uses per round:** 3

### 2. FREEZE
- **Cooldown:** 20 seconds
- **Duration:** 5 seconds
- **Effect:** Traders **cannot close** positions. Can still open new ones.
- **Visual:** Blue banner "POSITIONS FROZEN"
- **Uses per round:** 3
- **Strategy:** Combo with Squeeze to trap traders in risky positions.

### 3. SQUEEZE
- **Cooldown:** 20 seconds
- **Duration:** 8 seconds
- **Effect:** Liquidation threshold tightens by **30%** for all positions.
  - Example: 100x leverage normally liquidates at 1% move. During squeeze: 0.7%.
  - Example: 500x leverage normally liquidates at 0.2% move. During squeeze: 0.14%.
- **Visual:** Yellow banner "SQUEEZE! Liquidation closer!"
- **Uses per round:** 3

---

## Inactivity Penalties

### MM Inactivity
- If MM doesn't press any lever for **8 seconds**:
  - Rent collection **pauses for 5 seconds**
  - Each trader receives **$200 bonus**
- Forces MM to actively engage, prevents AFK strategy.

### Trader Inactivity
- If a trader hasn't opened a position in **15 seconds**:
  - Their rent **doubles** to $200/5s until they open a position.
- Forces traders to take risk, prevents passive waiting.

---

## Trader Synergy Bonus

- When **3+ traders** have **open positions simultaneously** in the **same direction** (all long or all short):
  - Their liquidation threshold **widens by 30%**
  - This nearly neutralizes the Squeeze lever (0.7 squeeze x 1.3 synergy = 0.91)
- Requires coordination on **timing** (positions must be open at the same time), not just direction.

---

## Position Size Limit

- Maximum margin per position: **30% of current balance**
- At $10,000 balance: max $3,000 per trade
- Even full liquidation only costs 30% of balance — trader stays in the game.
- Leverages work as normal (25x-500x with removal per round).

---

## Leverage Progression (Modified)

Unlike classic mode, the final round keeps 200x available:

| Round | Available Leverages | Removed |
|-------|-------------------|---------|
| 1 | 25x, 50x, 100x, 200x, 500x | -- |
| 2 | 50x, 100x, 200x, 500x | 25x |
| 3 | 100x, 200x, 500x | 50x |
| 4 | 200x, 500x | 100x |
| 5 | 200x, 500x | -- |
| 6 | 200x, 500x | -- |

Rationale: 500x-only rounds are too punishing. Keeping 200x gives traders a "safer" option throughout.

---

## Win Condition

- **MM wins** if MM balance > average trader balance after 6 rounds.
- **Traders win** collectively if average trader balance > MM balance.
- **MVP Trader:** individual trader with highest balance (bragging rights).
- Expected win rate with equal skill: **~55% MM / ~45% Traders**.

---

## MM UI (Phone)

The MM sees a completely different interface from traders:

### During Trading
- **No chart** (or simplified chart — MM doesn't need candles to trade).
- **Dashboard showing all trader positions:**
  - Nickname, direction (LONG/SHORT), margin, leverage, unrealized PnL, liquidation price.
  - Highlighted in green (profitable for trader) or red (losing).
- **3 large lever buttons** with cooldown timers:
  - COMMISSION x3 (red button)
  - FREEZE (blue button)
  - SQUEEZE (yellow button)
- **Balance display** showing total MM income.
- **Rent ticker** showing income flowing in real-time.

### During Bonus Phase
- MM participates in bonus mini-games like everyone else.

---

## Trader UI Changes (Phone)

### During Trading
- Small indicator: "vs Market Maker: [nickname]"
- **Active effect banners** when MM uses levers:
  - Red banner: "COMMISSION x3 — 3% fee on trades!"
  - Blue banner: "FREEZE — Can't close positions!"
  - Yellow banner: "SQUEEZE — Liquidation closer!"
- Banner shows countdown timer for effect duration.
- Close button disabled during Freeze.
- Rent drain visible: small "-$100" animation every 5 seconds.

---

## TV Display Changes

### During Trading
- MM shown separately at top with crown icon and balance.
- Trader leaderboard below.
- Active lever effects shown as overlays.
- Live "MM vs Traders (avg)" comparison bar.

### Finished
- "MM vs TRADERS" result banner.
- MM balance vs average trader balance.
- MVP Trader highlighted.

---

## Balance Analysis (Simulated)

| Scenario | MM Balance | Avg Trader | Winner |
|----------|-----------|------------|--------|
| Passive MM (1 round) | $3,200 | $10,600 | Traders |
| Aggressive MM (1 round) | $6,176 | $10,006 | Traders |
| Smart Traders (1 round) | $4,075 | $10,181 | Traders |
| Reckless Traders + Combo (1 round) | $8,496 | $6,976 | MM |
| 6 Rounds (moderate play) | $37,500 | $6,700 | MM |
| 6 Rounds (smart traders) | $30,000 | $6,340 | MM |

Single rounds favor traders. Full games favor MM. This creates a compelling arc of tension.

---

## Constants Summary

```
MM_STARTING_BALANCE = 0
TRADER_STARTING_BALANCE = 10000
MAX_POSITION_PERCENT = 30
RENT_AMOUNT = 100
RENT_INTERVAL_SEC = 5
COMMISSION_PERCENT = 3
COMMISSION_DURATION_SEC = 6
COMMISSION_COOLDOWN_SEC = 20
FREEZE_DURATION_SEC = 5
FREEZE_COOLDOWN_SEC = 20
SQUEEZE_TIGHTENING_PERCENT = 30
SQUEEZE_DURATION_SEC = 8
SQUEEZE_COOLDOWN_SEC = 20
MM_LIQUIDATION_BONUS_PERCENT = 25
MM_INACTIVITY_THRESHOLD_SEC = 8
MM_INACTIVITY_RENT_PAUSE_SEC = 5
MM_INACTIVITY_TRADER_BONUS = 200
TRADER_INACTIVITY_THRESHOLD_SEC = 15
TRADER_INACTIVITY_RENT_MULTIPLIER = 2
SYNERGY_MIN_TRADERS = 3
SYNERGY_THRESHOLD_WIDENING_PERCENT = 30
```

---

## What Changes from Current Implementation

The current MM implementation (2 buttons: +50%/-50% price manipulation, MM trades normally) will be **fully replaced** by this Casino design:

1. **MM role completely redesigned:** no trading, no price manipulation. Instead: 3 lever buttons + rent income.
2. **New server-side systems:** rent ticking, lever cooldowns, commission processing, squeeze mechanics, synergy detection, inactivity tracking.
3. **New MM phone UI:** dashboard with trader positions + lever buttons (no chart/trading controls).
4. **Modified trader UI:** effect banners, rent drain animation, close button disabled during freeze.
5. **Position size limit:** 30% max in MM mode.
6. **Leverage progression modified:** keep 200x in rounds 5-6.
7. **Win condition:** MM $0 start, income-based, vs trader average.
