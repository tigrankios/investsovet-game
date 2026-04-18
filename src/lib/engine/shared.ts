import {
  GameState, GameMode, Player, Position, LeaderboardEntry, RoundResult, Leverage, VoteState,
  BonusState, BonusType, BonusResult, WheelResult, LootboxResult, LotoResult,
  SlotResult, SlotSymbol, SLOT_SYMBOLS,
  WHEEL_SECTORS, LOOTBOX_POOL, BONUS_TIMER_SEC,
  LOTO_NUMBERS_TOTAL, LOTO_PICK_COUNT, LOTO_DRAW_COUNT, LOTO_PAYOUTS,
  INITIAL_BALANCE, MIN_ROUND_DURATION, MAX_ROUND_DURATION, VOTE_TIMER_SEC, AVAILABLE_LEVERAGES,
} from '../types';
import { fetchHistoricalCandles, getRandomTicker, TICKER_LABELS } from '../chart-generator';

// --- Constants ---

export const LIQUIDATION_BONUS_PERCENT = 0.3;
export const STEAL_PERCENT = 0.1;
export const STEAL_MAX = 1500;
export const LOOTBOX_BOX_COUNT = 4;

export const SLOT_MULTIPLIERS: Record<string, number> = {
  '₿': 10,   // джекпот
  '💎': 5,
  default_triple: 3,
  pair: 1.5,
  none: 0,
};

export const MM_PUSH_MODIFIER = 0.02;

// --- Helpers ---

export function roundBalance(n: number): number {
  return Math.round(n * 100) / 100;
}

export function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function validateBonusAction(
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

// --- Core game functions ---

/** Load fresh candles for a game that was reset to lobby (classic/MM modes) */
export async function prepareGameCandles(game: GameState): Promise<void> {
  const ticker = getRandomTicker();
  const duration = MIN_ROUND_DURATION + Math.floor(Math.random() * (MAX_ROUND_DURATION - MIN_ROUND_DURATION + 1));
  const candles = await fetchHistoricalCandles(ticker, duration + 20);

  game.ticker = TICKER_LABELS[ticker] || ticker;
  game.candles = candles;
  game.visibleCandleCount = 0;
  game.currentPrice = candles[0]?.open || 0;
  game.roundDuration = duration;
  game.elapsed = 0;
  game.roundNumber = 1;

  console.log(`[Game] Loaded ${candles.length} candles for ${ticker} (restart)`);
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
    mmNextCandleModifier: 0,
    binaryState: null,
    drawState: null,
    hostId: null,
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
    frozenBy: null,
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

// --- Position helpers ---

export function calcLiquidationPrice(direction: 'long' | 'short', entryPrice: number, leverage: Leverage): number {
  if (direction === 'long') {
    return entryPrice * (1 - 1 / leverage);
  } else {
    return entryPrice * (1 + 1 / leverage);
  }
}

export function isLiquidated(position: Position, candle: { high: number; low: number }): boolean {
  if (position.direction === 'long') {
    return candle.low <= position.liquidationPrice;
  } else {
    return candle.high >= position.liquidationPrice;
  }
}

export function calculatePnl(position: Position, currentPrice: number): number {
  const priceChange = (currentPrice - position.entryPrice) / position.entryPrice;
  const pnl = position.direction === 'long'
    ? position.size * priceChange * position.leverage
    : position.size * (-priceChange) * position.leverage;

  return Math.max(-position.size, roundBalance(pnl));
}

/**
 * Open position — BASE version (shared validation only).
 * No mode-specific checks (role, position cap, commission, frozen, double_or_nothing).
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
  if (player.position) return { success: false, message: 'Закрой текущую позицию' };
  if (!game.availableLeverages.includes(leverage)) return { success: false, message: 'Это плечо больше недоступно' };
  if (size <= 0) return { success: false, message: 'Некорректная сумма' };
  if (size > player.balance) return { success: false, message: 'Недостаточно средств' };

  const liqPrice = calcLiquidationPrice(direction, game.currentPrice, leverage);

  player.position = {
    direction,
    size,
    leverage,
    entryPrice: game.currentPrice,
    openedAt: game.visibleCandleCount,
    liquidationPrice: liqPrice,
  };

  return {
    success: true,
    message: `${direction.toUpperCase()} x${leverage} $${size} @ ${game.currentPrice}`,
  };
}

/**
 * Close position — BASE version (shared logic only).
 * No mode-specific checks (freeze lever, commission, pnlMultiplier reset).
 */
export function closePosition(
  game: GameState,
  playerId: string,
): { success: boolean; message: string; pnl: number } {
  const player = getPlayer(game, playerId);
  if (!player) return { success: false, message: 'Игрок не найден', pnl: 0 };
  if (!player.position) return { success: false, message: 'Нет открытой позиции', pnl: 0 };

  const price = game.currentPrice;
  const basePnl = calculatePnl(player.position, price);
  const pnl = roundBalance(basePnl);

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

export function getUnrealizedPnl(player: Player, currentPrice: number): number {
  if (!player.position) return 0;
  const price = currentPrice;
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

export function endRound(game: GameState): RoundResult {
  for (const player of game.players) {
    if (player.position) {
      const pnl = calculatePnl(player.position, game.currentPrice);
      player.balance += pnl;
      player.pnl += pnl;
      if (player.balance < 0) player.balance = 0;
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

export function getFinalStats(game: GameState): import('../types').FinalPlayerStats[] {
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

// --- Tick candle — BASE version ---

/**
 * BASE tickCandle: increment visible candles, update price, decrement effect timers,
 * check liquidations with basic bonus (no aggressor, no MM bonus).
 */
export function tickCandle(game: GameState): { continues: boolean; liquidated: { nickname: string; loss: number }[] } {
  if (game.phase !== 'trading') return { continues: false, liquidated: [] };

  game.visibleCandleCount++;
  game.elapsed++;

  if (game.visibleCandleCount <= game.candles.length) {
    const candle = game.candles[game.visibleCandleCount - 1];
    // Apply MM push modifier if set
    if (game.mmNextCandleModifier !== 0) {
      const mod = 1 + game.mmNextCandleModifier;
      candle.close = roundBalance(candle.close * mod);
      candle.high = Math.max(candle.high, candle.close);
      candle.low = Math.min(candle.low, candle.close);
      game.mmNextCandleModifier = 0;
    }
    game.currentPrice = candle.close;
  }

  // Decrement effect timers
  for (const player of game.players) {
    if (player.freezeTicksLeft > 0) {
      player.freezeTicksLeft--;
      if (player.freezeTicksLeft <= 0) {
        player.frozenBy = null;
      }
    }
    if (player.blindTicksLeft > 0) {
      player.blindTicksLeft--;
    }
  }

  // Check liquidations
  const liquidated: { nickname: string; loss: number }[] = [];
  const candle = game.candles[game.visibleCandleCount - 1];
  if (candle) {
    for (const player of game.players) {
      if (!player.position || !player.connected) continue;
      if (isLiquidated(player.position, candle)) {
        // Shield protection
        if (player.shieldActive) {
          player.shieldActive = false;
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
        player.liquidations++;
        player.totalTrades++;
        if (-loss < player.worstTrade) player.worstTrade = -loss;
        player.position = null;
      }
    }
  }

  return { continues: game.elapsed < game.roundDuration, liquidated };
}

// --- Voting ---

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

// --- Bonus phase ---

export function getBonusType(roundNumber: number): BonusType {
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

export function weightedRandomIndex(weights: number[]): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    random -= weights[i];
    if (random <= 0) return i;
  }
  return weights.length - 1;
}

// --- Slots ---

export function randomSymbol(): SlotSymbol {
  return SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
}

export function getSlotMultiplier(reels: [SlotSymbol, SlotSymbol, SlotSymbol]): number {
  const [a, b, c] = reels;
  if (a === b && b === c) {
    return SLOT_MULTIPLIERS[a] ?? SLOT_MULTIPLIERS.default_triple;
  }
  if (a === b || b === c || a === c) return SLOT_MULTIPLIERS.pair;
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

// --- Wheel ---

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

// --- Lootbox ---

export function generateLootboxValues(): number[] {
  const boxes: number[] = [];
  for (let i = 0; i < LOOTBOX_BOX_COUNT; i++) {
    const idx = weightedRandomIndex(LOOTBOX_POOL.map((p) => p.weight));
    boxes.push(LOOTBOX_POOL[idx].multiplier);
  }

  let highFixedIdx = -1;
  if (!boxes.some((m) => m >= 2)) {
    highFixedIdx = Math.floor(Math.random() * LOOTBOX_BOX_COUNT);
    const highPool = LOOTBOX_POOL.filter((p) => p.multiplier >= 2);
    const highIdx = weightedRandomIndex(highPool.map((p) => p.weight));
    boxes[highFixedIdx] = highPool[highIdx].multiplier;
  }

  if (!boxes.some((m) => m <= 1.5)) {
    const candidates = Array.from({ length: LOOTBOX_BOX_COUNT }, (_, i) => i).filter((i) => i !== highFixedIdx);
    const replaceIdx = candidates[Math.floor(Math.random() * candidates.length)];
    const lowPool = LOOTBOX_POOL.filter((p) => p.multiplier <= 1.5);
    const lowIdx = weightedRandomIndex(lowPool.map((p) => p.weight));
    boxes[replaceIdx] = lowPool[lowIdx].multiplier;
  }

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

// --- Loto ---

export function drawLotoNumbers(): number[] {
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

export function getBonusResults(game: GameState): { nickname: string; result: BonusResult }[] {
  if (!game.bonusState) return [];
  return Object.entries(game.bonusState.played).map(([playerId, result]) => {
    const player = game.players.find((p) => p.id === playerId);
    return { nickname: player?.nickname || '???', result };
  });
}

// --- Setup next round — BASE version ---

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
  game.mmNextCandleModifier = 0;

  // Remove lowest leverage (until only 500x remains)
  if (game.availableLeverages.length > 1) {
    game.availableLeverages = game.availableLeverages.slice(1);
  }

  // Reset PnL and skills (balance persists between rounds)
  for (const player of game.players) {
    player.pnl = 0;
    player.position = null;
    resetPlayerSkillEffects(player);
  }

  console.log(`[Game] Round ${game.roundNumber}: ${game.ticker}, ${duration}s, ${candles.length} candles`);
}

// Helper used by classic.ts — exported
export function resetPlayerSkillEffects(player: Player): void {
  player.skill = null;
  player.skillUsed = false;
  player.pnlMultiplier = 1;
  player.shieldActive = false;
  player.frozenBy = null;
  player.freezeTicksLeft = 0;
  player.blindTicksLeft = 0;
}

// --- Persistent Lobby ---

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
