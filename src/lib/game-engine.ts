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
import { fetchHistoricalCandles, getRandomTicker, TICKER_LABELS } from './chart-generator';

// --- Constants ---

const LIQUIDATION_BONUS_PERCENT = 0.3;
const STEAL_PERCENT = 0.1;
const STEAL_MAX = 1500;
const LOOTBOX_BOX_COUNT = 4;

const SLOT_MULTIPLIERS: Record<string, number> = {
  '₿': 10,   // джекпот
  '💎': 5,
  default_triple: 3,
  pair: 1.5,
  none: 0,
};

// --- Helpers ---

function roundBalance(n: number): number {
  return Math.round(n * 100) / 100;
}

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

// --- MM Casino Lever Configs ---

const MM_LEVER_CONFIG: Record<MMLeverType, { duration: number; cooldown: number }> = {
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

function calcLiquidationPriceSqueeze(
  direction: 'long' | 'short',
  entryPrice: number,
  leverage: Leverage,
  squeezeFactor: number,
  synergyFactor: number,
): number {
  // squeezeFactor: 0.3 means 30% tighter (closer to entry)
  // synergyFactor: 0.3 means 30% wider (further from entry)
  const base = 1 / leverage;
  const adjusted = base * (1 - squeezeFactor) * (1 + synergyFactor);
  if (direction === 'long') {
    return entryPrice * (1 - adjusted);
  } else {
    return entryPrice * (1 + adjusted);
  }
}

function validateBonusAction(
  game: GameState,
  playerId: string,
  expectedBonusType: string,
  bet: number,
): { success: false; message: string } | { success: true; player: Player } {
  const player = getPlayer(game, playerId);
  if (!player) return { success: false, message: 'Игрок не найден' };
  if (game.phase !== 'bonus') return { success: false, message: 'Бонус не активен' };
  if (!game.bonusState) return { success: false, message: 'Бонус не активен' };
  if (game.bonusState.bonusType !== expectedBonusType) {
    const names: Record<string, string> = { slots: 'слоты', wheel: 'колесо', lootbox: 'лутбокс', loto: 'лото' };
    return { success: false, message: `Сейчас не ${names[expectedBonusType] || expectedBonusType}` };
  }
  if (game.bonusState.played[playerId]) return { success: false, message: 'Уже играл!' };
  if (bet <= 0) return { success: false, message: 'Некорректная ставка' };
  if (bet > player.balance) return { success: false, message: 'Недостаточно средств' };
  return { success: true, player };
}

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function createGame(gameMode: GameMode = 'classic'): Promise<GameState> {
  const ticker = getRandomTicker();
  const duration = MIN_ROUND_DURATION + Math.floor(Math.random() * (MAX_ROUND_DURATION - MIN_ROUND_DURATION + 1));
  const candles = await fetchHistoricalCandles(ticker, duration + 20);

  console.log(`[Game] Loaded ${candles.length} historical candles for ${ticker} (mode: ${gameMode})`);

  return {
    roomCode: generateRoomCode(),
    phase: 'lobby',
    players: [],
    ticker: TICKER_LABELS[ticker] || ticker,
    candles,
    visibleCandleCount: 0,
    currentPrice: candles[0]?.open || 0,
    roundDuration: duration,
    elapsed: 0,
    roundNumber: 1,
    voteState: null,
    bonusState: null,
    lastAggressorId: null,
    availableLeverages: [...AVAILABLE_LEVERAGES],
    gameMode,
    marketMakerId: null,
    mmCasino: null,
  };
}

export function addPlayer(game: GameState, id: string, nickname: string): Player {
  const player: Player = {
    id,
    nickname,
    balance: INITIAL_BALANCE,
    position: null,
    pnl: 0,
    connected: true,
    role: 'trader',
    skill: null,
    skillUsed: false,
    pnlMultiplier: 1,
    shieldActive: false,
    freezePrice: null,
    freezeTicksLeft: 0,
    blindTicksLeft: 0,
    maxBalance: INITIAL_BALANCE,
    worstTrade: 0,
    bestTrade: 0,
    totalTrades: 0,
    liquidations: 0,
  };
  game.players.push(player);
  return player;
}

export function removePlayer(game: GameState, playerId: string): void {
  const player = game.players.find((p) => p.id === playerId);
  if (player) player.connected = false;
}

export function getPlayer(game: GameState, playerId: string): Player | undefined {
  return game.players.find((p) => p.id === playerId);
}

/**
 * Показать следующую свечу + проверить ликвидации.
 */
export function tickCandle(game: GameState): { continues: boolean; liquidated: { nickname: string; loss: number }[] } {
  if (game.phase !== 'trading') return { continues: false, liquidated: [] };

  game.visibleCandleCount++;
  game.elapsed++;

  // MM Casino: tick levers, rent, inactivity
  if (game.gameMode === 'market_maker' && game.mmCasino) {
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

    // MM inactivity check: if no lever pressed for threshold → pause rent + give traders bonus
    const timeSinceLastLever = game.elapsed - casino.lastLeverTime;
    if (casino.lastLeverTime > 0 && timeSinceLastLever >= MM_INACTIVITY_THRESHOLD_SEC && casino.rentPausedTicksLeft <= 0) {
      // Only trigger once per inactivity window (check if we just crossed the threshold)
      if (timeSinceLastLever === MM_INACTIVITY_THRESHOLD_SEC) {
        casino.rentPausedTicksLeft = MM_INACTIVITY_RENT_PAUSE_SEC;
        const traders = game.players.filter((p) => p.connected && p.role === 'trader');
        for (const trader of traders) {
          trader.balance = roundBalance(trader.balance + MM_INACTIVITY_TRADER_BONUS);
        }
      }
    }

    // Collect rent every RENT_INTERVAL_SEC seconds (unless paused)
    if (game.elapsed % RENT_INTERVAL_SEC === 0 && casino.rentPausedTicksLeft <= 0 && mm) {
      const traders = game.players.filter((p) => p.connected && p.role === 'trader');
      for (const trader of traders) {
        // Trader inactivity: no position opened for TRADER_INACTIVITY_THRESHOLD_SEC → rent doubled
        const lastOpen = casino.traderLastOpenTime[trader.id] || 0;
        const traderInactive = (game.elapsed - lastOpen) >= TRADER_INACTIVITY_THRESHOLD_SEC;
        const rentAmount = traderInactive ? RENT_AMOUNT * TRADER_INACTIVITY_RENT_MULTIPLIER : RENT_AMOUNT;
        const actualRent = Math.min(rentAmount, trader.balance);
        trader.balance = roundBalance(trader.balance - actualRent);
        if (trader.balance < 0) trader.balance = 0;
        mm.balance = roundBalance(mm.balance + actualRent);
      }
    }

    // Squeeze: recalculate liquidation prices with tightening factor (and synergy widening)
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

  if (game.visibleCandleCount <= game.candles.length) {
    game.currentPrice = game.candles[game.visibleCandleCount - 1].close;
  }

  // Обновить таймеры эффектов
  for (const player of game.players) {
    if (player.freezeTicksLeft > 0) {
      player.freezeTicksLeft--;
      if (player.freezeTicksLeft <= 0) {
        player.freezePrice = null;
      }
    }
    if (player.blindTicksLeft > 0) {
      player.blindTicksLeft--;
    }
  }

  // Проверяем ликвидации
  const liquidated: { nickname: string; loss: number }[] = [];
  const candle = game.candles[game.visibleCandleCount - 1];
  if (candle) {
    for (const player of game.players) {
      if (!player.position || !player.connected) continue;
      if (isLiquidated(player.position, candle)) {
        // Shield: защита от ликвидации один раз
        if (player.shieldActive) {
          player.shieldActive = false;
          // Сбросить цену ликвидации (дать второй шанс)
          player.position.liquidationPrice = calcLiquidationPrice(
            player.position.direction, game.currentPrice, player.position.leverage
          );
          continue;
        }
        const loss = player.position.size;
        player.balance -= loss;
        if (player.balance < 0) player.balance = 0;
        player.pnl -= loss;
        liquidated.push({ nickname: player.nickname, loss });
        // Статистика ликвидации
        player.liquidations++;
        player.totalTrades++;
        if (-loss < player.worstTrade) player.worstTrade = -loss;
        // Liquidation bonus: in MM mode → 25% to MM; in classic → 50% to aggressor
        if (game.gameMode === 'market_maker' && game.marketMakerId) {
          const mm = game.players.find((p) => p.id === game.marketMakerId);
          if (mm && mm.connected) {
            const bonus = roundBalance(loss * MM_LIQUIDATION_BONUS_PERCENT / 100);
            mm.balance = roundBalance(mm.balance + bonus);
          }
        } else if (game.lastAggressorId && game.lastAggressorId !== player.id) {
          const aggressor = game.players.find((p) => p.id === game.lastAggressorId);
          if (aggressor && aggressor.connected) {
            const bonus = roundBalance(loss * LIQUIDATION_BONUS_PERCENT);
            aggressor.balance = roundBalance(aggressor.balance + bonus);
            aggressor.pnl = roundBalance(aggressor.pnl + bonus);
          }
        }
        player.position = null;
      }
    }
  }

  return { continues: game.elapsed < game.roundDuration, liquidated };
}

function isLiquidated(position: Position, candle: { high: number; low: number }): boolean {
  if (position.direction === 'long') {
    return candle.low <= position.liquidationPrice;
  } else {
    return candle.high >= position.liquidationPrice;
  }
}

function calcLiquidationPrice(direction: 'long' | 'short', entryPrice: number, leverage: Leverage): number {
  // Ликвидация когда убыток = 100% маржи
  // Для лонга: entry * (1 - 1/leverage)
  // Для шорта: entry * (1 + 1/leverage)
  if (direction === 'long') {
    return entryPrice * (1 - 1 / leverage);
  } else {
    return entryPrice * (1 + 1 / leverage);
  }
}

/**
 * Открыть позицию с плечом
 */
export function openPosition(
  game: GameState,
  playerId: string,
  direction: 'long' | 'short',
  size: number,
  leverage: Leverage,
): { success: boolean; message: string } {
  const player = getPlayer(game, playerId);
  if (!player) return { success: false, message: 'Игрок не найден' };
  if (game.phase !== 'trading') return { success: false, message: 'Раунд не идёт' };

  // MM cannot trade in market_maker mode
  if (player.role === 'market_maker' && game.gameMode === 'market_maker') {
    return { success: false, message: 'Маркет-мейкер не может торговать' };
  }

  if (player.position) return { success: false, message: 'Закрой текущую позицию' };
  if (!game.availableLeverages.includes(leverage)) return { success: false, message: 'Это плечо больше недоступно' };
  if (size <= 0) return { success: false, message: 'Некорректная сумма' };
  if (size > player.balance) return { success: false, message: 'Недостаточно средств' };

  // Position cap: max 30% of balance in MM mode
  if (game.gameMode === 'market_maker') {
    const maxSize = roundBalance(player.balance * MAX_POSITION_PERCENT / 100);
    if (size > maxSize) {
      return { success: false, message: `Макс. позиция ${MAX_POSITION_PERCENT}% баланса ($${maxSize})` };
    }
  }

  const liqPrice = calcLiquidationPrice(direction, game.currentPrice, leverage);

  // Double or nothing: удвоить маржу если скилл использован и нет позиции
  let actualSize = size;
  let doubledMsg = '';
  if (player.skillUsed && player.skill === 'double_or_nothing' && !player.position) {
    if (size * 2 <= player.balance) {
      actualSize = size * 2;
      doubledMsg = ' (ВА-БАНК x2!)';
    }
  }

  // Commission: MM lever active → deduct 3% of margin to MM
  let commissionMsg = '';
  if (game.gameMode === 'market_maker' && game.mmCasino?.levers.commission.active) {
    const commissionFee = roundBalance(actualSize * COMMISSION_PERCENT / 100);
    player.balance = roundBalance(player.balance - commissionFee);
    if (player.balance < 0) player.balance = 0;
    const mm = game.players.find((p) => p.id === game.marketMakerId);
    if (mm) {
      mm.balance = roundBalance(mm.balance + commissionFee);
    }
    commissionMsg = ` (комиссия $${commissionFee.toFixed(2)})`;
  }

  player.position = {
    direction,
    size: actualSize,
    leverage,
    entryPrice: game.currentPrice,
    openedAt: game.visibleCandleCount,
    liquidationPrice: liqPrice,
  };

  // Track trader open time for inactivity
  if (game.gameMode === 'market_maker' && game.mmCasino) {
    game.mmCasino.traderLastOpenTime[playerId] = game.elapsed;
  }

  return {
    success: true,
    message: `${direction.toUpperCase()} x${leverage} $${actualSize} @ ${game.currentPrice}${doubledMsg}${commissionMsg}`,
  };
}

/**
 * Закрыть позицию
 */
export function closePosition(
  game: GameState,
  playerId: string,
): { success: boolean; message: string; pnl: number } {
  const player = getPlayer(game, playerId);
  if (!player) return { success: false, message: 'Игрок не найден', pnl: 0 };
  if (!player.position) return { success: false, message: 'Нет открытой позиции', pnl: 0 };

  // MM Freeze lever: traders cannot close during freeze
  if (game.gameMode === 'market_maker' && game.mmCasino?.levers.freeze.active && player.role === 'trader') {
    return { success: false, message: 'Заморозка! Нельзя закрыть позицию', pnl: 0 };
  }

  const price = player.freezePrice ?? game.currentPrice;
  const basePnl = calculatePnl(player.position, price);
  let pnl = roundBalance(basePnl * player.pnlMultiplier);

  // Commission on close if lever active
  if (game.gameMode === 'market_maker' && game.mmCasino?.levers.commission.active && player.role === 'trader') {
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

  // Обновить статистику
  player.totalTrades++;
  if (pnl < player.worstTrade) player.worstTrade = pnl;
  if (pnl > player.bestTrade) player.bestTrade = pnl;
  if (player.balance > player.maxBalance) player.maxBalance = player.balance;

  // Сбросить одноразовые эффекты после закрытия позиции
  player.pnlMultiplier = 1;
  player.freezePrice = null;
  player.freezeTicksLeft = 0;

  const msg = `Закрыто: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`;
  player.position = null;

  return { success: true, message: msg, pnl };
}

/**
 * PnL с учётом плеча
 */
export function calculatePnl(position: Position, currentPrice: number): number {
  const priceChange = (currentPrice - position.entryPrice) / position.entryPrice;
  const pnl = position.direction === 'long'
    ? position.size * priceChange * position.leverage
    : position.size * (-priceChange) * position.leverage;

  // Не может потерять больше маржи
  return Math.max(-position.size, roundBalance(pnl));
}

export function getUnrealizedPnl(player: Player, currentPrice: number): number {
  if (!player.position) return 0;
  const price = player.freezePrice ?? currentPrice;
  const basePnl = calculatePnl(player.position, price);
  return roundBalance(basePnl * player.pnlMultiplier);
}

export function getLeaderboard(game: GameState): LeaderboardEntry[] {
  return game.players
    .filter((p) => p.connected)
    .map((p) => {
      const unrealizedPnl = getUnrealizedPnl(p, game.currentPrice);
      return {
        nickname: p.nickname,
        balance: roundBalance(p.balance + unrealizedPnl),
        pnl: p.pnl,
        unrealizedPnl: roundBalance(unrealizedPnl),
        totalPnl: roundBalance(p.pnl + unrealizedPnl),
        hasPosition: !!p.position,
        positionDirection: p.position?.direction || null,
        positionLeverage: p.position?.leverage || null,
        positionOpenedAt: p.position?.openedAt ?? null,
        positionEntryPrice: p.position?.entryPrice ?? null,
        positionSize: p.position?.size ?? null,
        liquidationPrice: p.position?.liquidationPrice ?? null,
        role: p.role,
      };
    })
    .sort((a, b) => b.balance - a.balance);
}

/**
 * Завершить раунд — закрыть все позиции
 */
export function endRound(game: GameState): RoundResult {
  // Автоматически закрываем все открытые позиции
  for (const player of game.players) {
    if (player.position) {
      const pnl = calculatePnl(player.position, game.currentPrice);
      player.balance += pnl;
      player.pnl += pnl;
      if (player.balance < 0) player.balance = 0;
      // Статистика
      player.totalTrades++;
      if (pnl < player.worstTrade) player.worstTrade = pnl;
      if (pnl > player.bestTrade) player.bestTrade = pnl;
      if (player.balance > player.maxBalance) player.maxBalance = player.balance;
      player.position = null;
    }
  }

  const leaderboard = getLeaderboard(game);
  const winner = leaderboard[0] || { nickname: 'Никто', totalPnl: 0 };

  return {
    ticker: game.ticker,
    duration: game.elapsed,
    leaderboard,
    winner: { nickname: winner.nickname, totalPnl: winner.totalPnl },
    roundNumber: game.roundNumber,
  };
}

// --- Финальная статистика ---

export function getFinalStats(game: GameState): import('./types').FinalPlayerStats[] {
  return game.players
    .filter((p) => p.connected)
    .sort((a, b) => b.balance - a.balance)
    .map((p, i) => ({
      nickname: p.nickname,
      rank: i + 1,
      balance: roundBalance(p.balance),
      maxBalance: roundBalance(p.maxBalance),
      worstTrade: roundBalance(p.worstTrade),
      bestTrade: roundBalance(p.bestTrade),
      totalTrades: p.totalTrades,
      liquidations: p.liquidations,
      role: p.role,
    }));
}

// --- Market Maker ---

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

// --- Скиллы ---

export function assignRandomSkill(player: Player): SkillType | null {
  if (player.role === 'market_maker') return null;
  const skill = ALL_SKILLS[Math.floor(Math.random() * ALL_SKILLS.length)];
  player.skill = skill;
  player.skillUsed = false;
  return skill;
}

function resetPlayerSkillEffects(player: Player): void {
  player.skill = null;
  player.skillUsed = false;
  player.pnlMultiplier = 1;
  player.shieldActive = false;
  player.freezePrice = null;
  player.freezeTicksLeft = 0;
  player.blindTicksLeft = 0;
}

export function useSkill(
  game: GameState,
  playerId: string,
): { success: boolean; message: string; skill?: SkillType; affectsAll?: boolean } {
  const player = getPlayer(game, playerId);
  if (!player) return { success: false, message: 'Игрок не найден' };
  if (game.phase !== 'trading') return { success: false, message: 'Не время для скиллов' };
  if (!player.skill) return { success: false, message: 'Нет скилла' };
  if (player.skillUsed) return { success: false, message: 'Скилл уже использован' };

  const skill = player.skill;
  player.skillUsed = true;

  // Любой скилл, влияющий на других — запомнить агрессора для бонуса за ликвидации
  const aggressiveSkills: SkillType[] = ['inverse', 'chaos', 'blind'];
  if (aggressiveSkills.includes(skill)) {
    game.lastAggressorId = playerId;
  }

  switch (skill) {
    case 'trump_tweet':
      player.pnlMultiplier = 3;
      return { success: true, message: '🇺🇸 ТВИТ ТРАМПА! x3 к PnL!', skill };

    case 'inverse':
      // Инвертируем оставшиеся свечи для ВСЕХ на INVERSE_DURATION свечей
      const startIdx = game.visibleCandleCount;
      const endIdx = Math.min(startIdx + INVERSE_DURATION, game.candles.length);
      for (let i = startIdx; i < endIdx; i++) {
        const c = game.candles[i];
        const mid = (c.open + c.close) / 2;
        c.open = 2 * mid - c.open;
        c.close = 2 * mid - c.close;
        c.high = 2 * mid - c.high;
        c.low = 2 * mid - c.low;
        // Swap high/low after inversion
        const realHigh = Math.max(c.open, c.close, c.high, c.low);
        const realLow = Math.min(c.open, c.close, c.high, c.low);
        c.high = realHigh;
        c.low = realLow;
      }
      return { success: true, message: '🔄 ИНВЕРСИЯ! График перевернулся!', skill, affectsAll: true };

    case 'shield':
      player.shieldActive = true;
      return { success: true, message: '🛡️ ЩИТ АКТИВИРОВАН! Защита от ликвидации', skill };

    case 'double_or_nothing':
      if (player.position) {
        // Удвоить маржу текущей позиции
        const additionalSize = player.position.size;
        if (additionalSize <= player.balance) {
          player.position.size *= 2;
          return { success: true, message: '💰 ВА-БАНК! Маржа удвоена!', skill };
        } else {
          return { success: true, message: '💰 ВА-БАНК! Недостаточно средств для удвоения', skill };
        }
      }
      return { success: true, message: '💰 ВА-БАНК! Следующая позиция будет удвоена', skill };

    case 'freeze':
      player.freezePrice = game.currentPrice;
      player.freezeTicksLeft = FREEZE_DURATION;
      return { success: true, message: '🧊 ЗАМОРОЗКА! Цена зафиксирована на 5 свечей', skill };

    case 'blind':
      // Слепой трейд — скрыть график у ВСЕХ на 15 секунд
      for (const p of game.players) {
        if (p.connected) p.blindTicksLeft = BLIND_DURATION;
      }
      return { success: true, message: '🙈 СЛЕПОЙ ТРЕЙД! График скрыт у всех!', skill, affectsAll: true };

    case 'steal': {
      // Кража — украсть 10% баланса случайного другого игрока
      const others = game.players.filter((p) => p.connected && p.id !== playerId && p.balance > 0);
      if (others.length === 0) {
        return { success: true, message: '🦹 КРАЖА! Не у кого красть...', skill };
      }
      const victim = others[Math.floor(Math.random() * others.length)];
      const stolen = roundBalance(Math.min(victim.balance * STEAL_PERCENT, STEAL_MAX));
      victim.balance = roundBalance(victim.balance - stolen);
      player.balance = roundBalance(player.balance + stolen);
      return { success: true, message: `🦹 КРАЖА! Украл $${stolen.toFixed(0)} у ${victim.nickname}!`, skill, affectsAll: true };
    }

    case 'chaos':
      // Хаос — поменять направление ВСЕХ открытых позиций (long↔short)
      for (const p of game.players) {
        if (p.position && p.connected) {
          p.position.direction = p.position.direction === 'long' ? 'short' : 'long';
          // Пересчитать entry и ликвидацию от текущей цены (даёт шанс выжить на высоких плечах)
          p.position.entryPrice = game.currentPrice;
          p.position.liquidationPrice = calcLiquidationPrice(
            p.position.direction, game.currentPrice, p.position.leverage
          );
        }
      }
      return { success: true, message: '🌪️ ХАОС! Все позиции перевернулись!', skill, affectsAll: true };

    default:
      return { success: false, message: 'Неизвестный скилл' };
  }
}

// --- Голосование "Ещё раунд?" ---

export function startVoting(game: GameState): VoteState {
  game.phase = 'voting';
  game.voteState = {
    votes: {},
    timer: VOTE_TIMER_SEC,
  };
  return game.voteState;
}

export function castVote(game: GameState, playerId: string, vote: boolean): void {
  if (!game.voteState) return;
  game.voteState.votes[playerId] = vote;
}

export function getVoteResult(game: GameState): { yes: number; no: number; total: number; majority: boolean } {
  if (!game.voteState) return { yes: 0, no: 0, total: 0, majority: false };
  const votes = Object.values(game.voteState.votes);
  const yes = votes.filter((v) => v === true).length;
  const no = votes.filter((v) => v === false).length;
  const total = game.players.filter((p) => p.connected).length;
  return { yes, no, total, majority: yes > no };
}

// --- Бонусная фаза (ротация мини-игр) ---

function getBonusType(roundNumber: number): BonusType {
  const mod = roundNumber % 4;
  if (mod === 1) return 'wheel';
  if (mod === 2) return 'slots';
  if (mod === 3) return 'loto';
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

function weightedRandomIndex(weights: number[]): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    random -= weights[i];
    if (random <= 0) return i;
  }
  return weights.length - 1;
}

// --- Слоты ---

function randomSymbol(): SlotSymbol {
  return SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
}

function getSlotMultiplier(reels: [SlotSymbol, SlotSymbol, SlotSymbol]): number {
  const [a, b, c] = reels;

  // 3 одинаковых
  if (a === b && b === c) {
    return SLOT_MULTIPLIERS[a] ?? SLOT_MULTIPLIERS.default_triple;
  }

  // 2 одинаковых
  if (a === b || b === c || a === c) return SLOT_MULTIPLIERS.pair;

  // Ничего
  return SLOT_MULTIPLIERS.none;
}

export function spinSlots(
  game: GameState,
  playerId: string,
  bet: number,
): { success: boolean; message: string; result?: BonusResult } {
  const validation = validateBonusAction(game, playerId, 'slots', bet);
  if (!validation.success) return validation as { success: false; message: string };
  const { player } = validation;

  const reels: [SlotSymbol, SlotSymbol, SlotSymbol] = [randomSymbol(), randomSymbol(), randomSymbol()];
  const multiplier = getSlotMultiplier(reels);

  const winAmount = multiplier === 0 ? -bet : roundBalance(bet * multiplier - bet);

  player.balance = roundBalance(player.balance + winAmount);
  if (player.balance < 0) player.balance = 0;

  const slotResult: SlotResult = { reels, multiplier, bet, winAmount };
  const bonusResult: BonusResult = { type: 'slots', result: slotResult };
  game.bonusState!.played[playerId] = bonusResult;

  return { success: true, message: `${reels.join(' ')} — x${multiplier}`, result: bonusResult };
}

// --- Колесо фортуны ---

export function spinWheel(
  game: GameState,
  playerId: string,
  bet: number,
): { success: boolean; message: string; result?: BonusResult } {
  const validation = validateBonusAction(game, playerId, 'wheel', bet);
  if (!validation.success) return validation as { success: false; message: string };
  const { player } = validation;

  const sectorIndex = weightedRandomIndex(WHEEL_SECTORS.map((s) => s.weight));
  const multiplier = WHEEL_SECTORS[sectorIndex].multiplier;

  const winAmount = multiplier === 0 ? -bet : roundBalance(bet * multiplier - bet);

  player.balance = roundBalance(player.balance + winAmount);
  if (player.balance < 0) player.balance = 0;

  const wheelResult: WheelResult = { sectorIndex, multiplier, bet, winAmount };
  const bonusResult: BonusResult = { type: 'wheel', result: wheelResult };
  game.bonusState!.played[playerId] = bonusResult;

  return { success: true, message: `Колесо: x${multiplier}`, result: bonusResult };
}

// --- Лутбокс ---

function generateLootboxValues(): number[] {
  const boxes: number[] = [];
  for (let i = 0; i < LOOTBOX_BOX_COUNT; i++) {
    const idx = weightedRandomIndex(LOOTBOX_POOL.map((p) => p.weight));
    boxes.push(LOOTBOX_POOL[idx].multiplier);
  }

  // Гарантируем минимум 1 бокс >= x2
  let highFixedIdx = -1;
  if (!boxes.some((m) => m >= 2)) {
    highFixedIdx = Math.floor(Math.random() * LOOTBOX_BOX_COUNT);
    const highPool = LOOTBOX_POOL.filter((p) => p.multiplier >= 2);
    const highIdx = weightedRandomIndex(highPool.map((p) => p.weight));
    boxes[highFixedIdx] = highPool[highIdx].multiplier;
  }

  // Гарантируем минимум 1 бокс <= x1.5 (не трогая индекс, зафиксированный выше)
  if (!boxes.some((m) => m <= 1.5)) {
    const candidates = Array.from({ length: LOOTBOX_BOX_COUNT }, (_, i) => i).filter((i) => i !== highFixedIdx);
    const replaceIdx = candidates[Math.floor(Math.random() * candidates.length)];
    const lowPool = LOOTBOX_POOL.filter((p) => p.multiplier <= 1.5);
    const lowIdx = weightedRandomIndex(lowPool.map((p) => p.weight));
    boxes[replaceIdx] = lowPool[lowIdx].multiplier;
  }

  // Перемешиваем (Fisher-Yates)
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
  const validation = validateBonusAction(game, playerId, 'lootbox', bet);
  if (!validation.success) return validation as { success: false; message: string };
  const { player } = validation;
  if (!Number.isInteger(chosenIndex) || chosenIndex < 0 || chosenIndex > LOOTBOX_BOX_COUNT - 1) return { success: false, message: 'Некорректный выбор' };

  const boxes = generateLootboxValues();
  const multiplier = boxes[chosenIndex];

  const winAmount = multiplier === 0 ? -bet : roundBalance(bet * multiplier - bet);

  player.balance = roundBalance(player.balance + winAmount);
  if (player.balance < 0) player.balance = 0;

  const lootboxResult: LootboxResult = { boxes, chosenIndex, multiplier, bet, winAmount };
  const bonusResult: BonusResult = { type: 'lootbox', result: lootboxResult };
  game.bonusState!.played[playerId] = bonusResult;

  return { success: true, message: `Лутбокс: x${multiplier}`, result: bonusResult };
}

// --- Лото ---

function drawLotoNumbers(): number[] {
  const pool = Array.from({ length: LOTO_NUMBERS_TOTAL }, (_, i) => i + 1);
  const drawn: number[] = [];
  for (let i = 0; i < LOTO_DRAW_COUNT; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    drawn.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return drawn.sort((a, b) => a - b);
}

export function playLoto(
  game: GameState,
  playerId: string,
  bet: number,
  numbers: number[],
): { success: boolean; message: string; result?: BonusResult } {
  const validation = validateBonusAction(game, playerId, 'loto', bet);
  if (!validation.success) return validation as { success: false; message: string };
  const { player } = validation;
  if (!Array.isArray(numbers) || numbers.length !== LOTO_PICK_COUNT) return { success: false, message: `Выбери ${LOTO_PICK_COUNT} чисел` };
  const unique = new Set(numbers);
  if (unique.size !== LOTO_PICK_COUNT) return { success: false, message: 'Числа не должны повторяться' };
  if (numbers.some((n) => !Number.isInteger(n) || n < 1 || n > LOTO_NUMBERS_TOTAL)) {
    return { success: false, message: `Числа от 1 до ${LOTO_NUMBERS_TOTAL}` };
  }

  const drawnNumbers = drawLotoNumbers();
  const drawnSet = new Set(drawnNumbers);
  const matches = numbers.filter((n) => drawnSet.has(n)).length;
  const multiplier = LOTO_PAYOUTS[matches] ?? 0;
  const winAmount = multiplier === 0 ? -bet : roundBalance(bet * multiplier - bet);

  player.balance = roundBalance(player.balance + winAmount);
  if (player.balance < 0) player.balance = 0;

  const lotoResult: LotoResult = {
    playerNumbers: [...numbers].sort((a, b) => a - b),
    drawnNumbers,
    matches,
    multiplier,
    bet,
    winAmount,
  };
  const bonusResult: BonusResult = { type: 'loto', result: lotoResult };
  game.bonusState!.played[playerId] = bonusResult;

  return { success: true, message: `Лото: ${matches} совпадений`, result: bonusResult };
}

// --- Результаты бонуса ---

export function getBonusResults(game: GameState): { nickname: string; result: BonusResult }[] {
  if (!game.bonusState) return [];
  return Object.entries(game.bonusState.played).map(([playerId, result]) => {
    const player = game.players.find((p) => p.id === playerId);
    return { nickname: player?.nickname || '???', result };
  });
}

export async function setupNextRound(game: GameState): Promise<void> {
  const rawTicker = getRandomTicker();
  const duration = MIN_ROUND_DURATION + Math.floor(Math.random() * (MAX_ROUND_DURATION - MIN_ROUND_DURATION + 1));
  const candles = await fetchHistoricalCandles(rawTicker, duration + 20);

  game.ticker = TICKER_LABELS[rawTicker] || rawTicker;
  game.candles = candles;
  game.visibleCandleCount = 0;
  game.currentPrice = candles[0]?.open || 0;
  game.roundDuration = duration;
  game.elapsed = 0;
  game.roundNumber++;
  game.voteState = null;
  game.bonusState = null;
  game.lastAggressorId = null;

  // Reset MM Casino state for new round
  if (game.gameMode === 'market_maker') {
    game.mmCasino = createMMCasinoState();
  }

  // Убрать наименьшее плечо (пока не останется только 500x)
  // In MM mode, keep 200x available in rounds 5-6
  if (game.availableLeverages.length > 1) {
    const nextLeverages = game.availableLeverages.slice(1);
    if (game.gameMode === 'market_maker' && !nextLeverages.includes(200 as Leverage) && game.availableLeverages.includes(200 as Leverage)) {
      // Don't remove leverage if it would eliminate 200x in MM mode
    } else {
      game.availableLeverages = nextLeverages;
    }
  }

  // Сброс PnL и скиллов (баланс сохраняется между раундами)
  for (const player of game.players) {
    player.pnl = 0;
    player.position = null;
    resetPlayerSkillEffects(player);
  }

  console.log(`[Game] Round ${game.roundNumber}: ${game.ticker}, ${duration}s, ${candles.length} candles`);
}
