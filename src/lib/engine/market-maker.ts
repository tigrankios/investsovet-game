import {
  GameState, Player, Leverage,
  MMLeverType, MMLeverState, MMCasinoState,
  MM_STARTING_BALANCE, MAX_POSITION_PERCENT, RENT_AMOUNT, RENT_INTERVAL_SEC,
  COMMISSION_PERCENT, COMMISSION_DURATION_SEC, COMMISSION_COOLDOWN_SEC,
  FREEZE_DURATION_SEC_MM, FREEZE_COOLDOWN_SEC,
  SQUEEZE_TIGHTENING_PERCENT, SQUEEZE_DURATION_SEC, SQUEEZE_COOLDOWN_SEC,
  MM_LIQUIDATION_BONUS_PERCENT, MM_INACTIVITY_THRESHOLD_SEC, MM_INACTIVITY_RENT_PAUSE_SEC,
  MM_INACTIVITY_TRADER_BONUS, TRADER_INACTIVITY_THRESHOLD_SEC, TRADER_INACTIVITY_RENT_MULTIPLIER,
  SYNERGY_MIN_TRADERS, SYNERGY_THRESHOLD_WIDENING_PERCENT,
  AVAILABLE_LEVERAGES,
} from '../types';
import {
  getPlayer, calcLiquidationPrice, isLiquidated, calculatePnl, roundBalance,
  openPosition as sharedOpenPosition,
  closePosition as sharedClosePosition,
  tickCandle as sharedTickCandle,
  setupNextRound as sharedSetupNextRound,
  resetPlayerSkillEffects,
  MM_PUSH_MODIFIER,
} from './shared';

// --- MM Casino State ---

export function createMMCasinoState(): MMCasinoState {
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

// --- MM Casino Lever Configs ---

export const MM_LEVER_CONFIG: Record<MMLeverType, { duration: number; cooldown: number }> = {
  commission: { duration: COMMISSION_DURATION_SEC, cooldown: COMMISSION_COOLDOWN_SEC },
  freeze: { duration: FREEZE_DURATION_SEC_MM, cooldown: FREEZE_COOLDOWN_SEC },
  squeeze: { duration: SQUEEZE_DURATION_SEC, cooldown: SQUEEZE_COOLDOWN_SEC },
};

// --- Synergy & Squeeze helpers ---

export function hasSynergyBonus(game: GameState): boolean {
  if (game.gameMode !== 'market_maker') return false;
  const traders = game.players.filter(
    (p) => p.connected && p.role === 'trader' && p.position,
  );
  if (traders.length < SYNERGY_MIN_TRADERS) return false;
  const longCount = traders.filter((p) => p.position!.direction === 'long').length;
  const shortCount = traders.filter((p) => p.position!.direction === 'short').length;
  return longCount >= SYNERGY_MIN_TRADERS || shortCount >= SYNERGY_MIN_TRADERS;
}

export function calcLiquidationPriceSqueeze(
  direction: 'long' | 'short',
  entryPrice: number,
  leverage: Leverage,
  squeezeFactor: number,
  synergyFactor: number,
): number {
  const base = 1 / leverage;
  const adjusted = base * (1 - squeezeFactor) * (1 + synergyFactor);
  if (direction === 'long') {
    return entryPrice * (1 - adjusted);
  } else {
    return entryPrice * (1 + adjusted);
  }
}

// --- Market Maker assignment ---

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
  console.log(`[Game] Market Maker assigned: ${mm.nickname}`);
  return mm;
}

// --- MM Lever usage ---

export function useMMLever(
  game: GameState,
  playerId: string,
  lever: MMLeverType,
): { success: boolean; message: string; duration?: number } {
  if (game.gameMode !== 'market_maker') return { success: false, message: 'Не тот режим' };
  if (game.phase !== 'trading') return { success: false, message: 'Раунд не идёт' };
  if (game.marketMakerId !== playerId) return { success: false, message: 'Ты не маркет-мейкер' };
  if (!game.mmCasino) return { success: false, message: 'Casino не инициализировано' };

  const leverState = game.mmCasino.levers[lever];
  if (!leverState) return { success: false, message: 'Неизвестный рычаг' };
  if (leverState.active) return { success: false, message: 'Рычаг уже активен' };
  if (leverState.cooldownLeft > 0) return { success: false, message: `Кулдаун: ${leverState.cooldownLeft}с` };

  const config = MM_LEVER_CONFIG[lever];
  leverState.active = true;
  leverState.ticksLeft = config.duration;
  leverState.cooldownLeft = config.cooldown;
  game.mmCasino.lastLeverTime = game.elapsed;

  const leverNames: Record<MMLeverType, string> = {
    commission: 'Комиссия',
    freeze: 'Заморозка',
    squeeze: 'Сквиз',
  };

  return {
    success: true,
    message: `${leverNames[lever]} активирован на ${config.duration}с`,
    duration: config.duration,
  };
}

// --- MM Push ---

export function mmPush(game: GameState): void {
  // Placeholder for MM push functionality
  // Uses MM_PUSH_MODIFIER from shared
}

// --- MM Result ---

export function getMarketMakerResult(game: GameState): { mmWon: boolean; mmBalance: number; tradersAvg: number; mmNickname: string } | null {
  if (game.gameMode !== 'market_maker' || !game.marketMakerId) return null;
  const mm = game.players.find((p) => p.id === game.marketMakerId);
  if (!mm) return null;
  const traders = game.players.filter((p) => p.role === 'trader' && p.connected);
  if (traders.length === 0) return { mmWon: true, mmBalance: mm.balance, tradersAvg: 0, mmNickname: mm.nickname };
  const tradersAvg = roundBalance(traders.reduce((s, t) => s + t.balance, 0) / traders.length);
  return {
    mmWon: mm.balance > tradersAvg,
    mmBalance: roundBalance(mm.balance),
    tradersAvg,
    mmNickname: mm.nickname,
  };
}

// --- MM Tick Candle ---

/**
 * MM tickCandle: wraps shared tickCandle, adds MM casino ticking
 * (lever cooldowns, rent collection, inactivity checks, squeeze recalculation),
 * and MM liquidation bonus.
 */
export function mmTickCandle(game: GameState): { continues: boolean; liquidated: { nickname: string; loss: number }[] } {
  if (game.phase !== 'trading') return { continues: false, liquidated: [] };

  // MM Casino: tick levers, rent, inactivity BEFORE price update
  if (game.mmCasino) {
    const casino = game.mmCasino;
    const mm = game.players.find((p) => p.id === game.marketMakerId);

    // Tick lever durations and cooldowns
    for (const leverKey of ['commission', 'freeze', 'squeeze'] as MMLeverType[]) {
      const lever = casino.levers[leverKey];
      if (lever.active && lever.ticksLeft > 0) {
        lever.ticksLeft--;
        if (lever.ticksLeft <= 0) {
          lever.active = false;
        }
      }
      if (lever.cooldownLeft > 0) {
        lever.cooldownLeft--;
      }
    }

    // Tick rent pause
    if (casino.rentPausedTicksLeft > 0) {
      casino.rentPausedTicksLeft--;
    }

    // MM inactivity check
    const timeSinceLastLever = (game.elapsed + 1) - casino.lastLeverTime;
    if (casino.lastLeverTime > 0 && timeSinceLastLever >= MM_INACTIVITY_THRESHOLD_SEC && casino.rentPausedTicksLeft <= 0) {
      if (timeSinceLastLever === MM_INACTIVITY_THRESHOLD_SEC) {
        casino.rentPausedTicksLeft = MM_INACTIVITY_RENT_PAUSE_SEC;
        const traders = game.players.filter((p) => p.connected && p.role === 'trader');
        for (const trader of traders) {
          trader.balance = roundBalance(trader.balance + MM_INACTIVITY_TRADER_BONUS);
        }
      }
    }

    // Collect rent every RENT_INTERVAL_SEC seconds (unless paused)
    if ((game.elapsed + 1) % RENT_INTERVAL_SEC === 0 && casino.rentPausedTicksLeft <= 0 && mm) {
      const traders = game.players.filter((p) => p.connected && p.role === 'trader');
      for (const trader of traders) {
        const lastOpen = casino.traderLastOpenTime[trader.id] || 0;
        const traderInactive = ((game.elapsed + 1) - lastOpen) >= TRADER_INACTIVITY_THRESHOLD_SEC;
        const rentAmount = traderInactive ? RENT_AMOUNT * TRADER_INACTIVITY_RENT_MULTIPLIER : RENT_AMOUNT;
        const actualRent = Math.min(rentAmount, trader.balance);
        trader.balance = roundBalance(trader.balance - actualRent);
        if (trader.balance < 0) trader.balance = 0;
        mm.balance = roundBalance(mm.balance + actualRent);
      }
    }

    // Squeeze: recalculate liquidation prices
    if (casino.levers.squeeze.active) {
      const synergy = hasSynergyBonus(game);
      const squeezeFactor = SQUEEZE_TIGHTENING_PERCENT / 100;
      const synergyFactor = synergy ? SYNERGY_THRESHOLD_WIDENING_PERCENT / 100 : 0;
      for (const player of game.players) {
        if (player.position && player.role === 'trader' && player.connected) {
          player.position.liquidationPrice = calcLiquidationPriceSqueeze(
            player.position.direction,
            player.position.entryPrice,
            player.position.leverage,
            squeezeFactor,
            synergyFactor,
          );
        }
      }
    }
  }

  // Call shared tickCandle for price update, timer decrements, and base liquidation handling
  const result = sharedTickCandle(game);

  // Apply MM liquidation bonus
  if (result.liquidated.length > 0 && game.marketMakerId) {
    const mm = game.players.find((p) => p.id === game.marketMakerId);
    if (mm && mm.connected) {
      for (const liq of result.liquidated) {
        const bonus = roundBalance(liq.loss * MM_LIQUIDATION_BONUS_PERCENT / 100);
        mm.balance = roundBalance(mm.balance + bonus);
      }
    }
  }

  return result;
}

// --- MM Open Position ---

/**
 * MM openPosition: wraps shared openPosition, adds MM role block, position cap,
 * commission, and trader open time tracking.
 */
export function mmOpenPosition(
  game: GameState,
  playerId: string,
  direction: 'long' | 'short',
  size: number,
  leverage: Leverage,
): { success: boolean; message: string } {
  const player = getPlayer(game, playerId);
  if (!player) return { success: false, message: 'Игрок не найден' };

  // MM cannot trade
  if (player.role === 'market_maker') {
    return { success: false, message: 'Маркет-мейкер не может торговать' };
  }

  // Position cap: max 30% of balance
  const maxSize = roundBalance(player.balance * MAX_POSITION_PERCENT / 100);
  if (size > maxSize) {
    return { success: false, message: `Макс. позиция ${MAX_POSITION_PERCENT}% баланса ($${maxSize})` };
  }

  // Commission: deduct from margin before opening
  let commissionMsg = '';
  if (game.mmCasino?.levers.commission.active) {
    const commissionFee = roundBalance(size * COMMISSION_PERCENT / 100);
    player.balance = roundBalance(player.balance - commissionFee);
    if (player.balance < 0) player.balance = 0;
    const mm = game.players.find((p) => p.id === game.marketMakerId);
    if (mm) {
      mm.balance = roundBalance(mm.balance + commissionFee);
    }
    commissionMsg = ` (комиссия $${commissionFee.toFixed(2)})`;
  }

  const result = sharedOpenPosition(game, playerId, direction, size, leverage);

  // Track trader open time for inactivity
  if (result.success && game.mmCasino) {
    game.mmCasino.traderLastOpenTime[playerId] = game.elapsed;
  }

  if (result.success && commissionMsg) {
    result.message += commissionMsg;
  }

  return result;
}

// --- MM Close Position ---

/**
 * MM closePosition: wraps shared closePosition, adds freeze lever block and commission.
 */
export function mmClosePosition(
  game: GameState,
  playerId: string,
): { success: boolean; message: string; pnl: number } {
  const player = getPlayer(game, playerId);
  if (!player) return { success: false, message: 'Игрок не найден', pnl: 0 };
  if (!player.position) return { success: false, message: 'Нет открытой позиции', pnl: 0 };

  // MM Freeze lever: traders cannot close during freeze
  if (game.mmCasino?.levers.freeze.active && player.role === 'trader') {
    return { success: false, message: 'Заморозка! Нельзя закрыть позицию', pnl: 0 };
  }

  // Calculate PnL with commission deduction
  const price = game.currentPrice;
  const basePnl = calculatePnl(player.position, price);
  let pnl = roundBalance(basePnl);

  // Commission on close if lever active
  if (game.mmCasino?.levers.commission.active && player.role === 'trader') {
    const commissionFee = roundBalance(player.position.size * COMMISSION_PERCENT / 100);
    pnl = roundBalance(pnl - commissionFee);
    const mm = game.players.find((p) => p.id === game.marketMakerId);
    if (mm) {
      mm.balance = roundBalance(mm.balance + commissionFee);
    }
  }

  player.balance += pnl;
  player.pnl += pnl;
  if (player.balance < 0) player.balance = 0;

  // Update stats
  player.totalTrades++;
  if (pnl < player.worstTrade) player.worstTrade = pnl;
  if (pnl > player.bestTrade) player.bestTrade = pnl;
  if (player.balance > player.maxBalance) player.maxBalance = player.balance;

  const msg = `Закрыто: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`;
  player.position = null;

  return { success: true, message: msg, pnl };
}

// --- MM Setup Next Round ---

/**
 * MM setupNextRound: wraps shared setupNextRound, adds MM casino reset and leverage preservation.
 */
export async function mmSetupNextRound(game: GameState): Promise<void> {
  await sharedSetupNextRound(game);

  // Reset MM Casino state for new round
  game.mmCasino = createMMCasinoState();

  // In MM mode, preserve 200x leverage in later rounds
  if (!game.availableLeverages.includes(200 as Leverage) && AVAILABLE_LEVERAGES.includes(200 as Leverage)) {
    game.availableLeverages = [200 as Leverage, ...game.availableLeverages.filter(l => l !== (200 as Leverage))];
    game.availableLeverages.sort((a, b) => a - b);
  }
}
