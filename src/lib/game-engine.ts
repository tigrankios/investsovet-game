import {
  GameState, Player, Position, LeaderboardEntry, RoundResult, Leverage, VoteState,
  BonusState, BonusType, BonusResult, WheelResult, LootboxResult,
  SlotResult, SlotSymbol, SLOT_SYMBOLS,
  WHEEL_SECTORS, LOOTBOX_POOL, BONUS_TIMER_SEC,
  INITIAL_BALANCE, MIN_ROUND_DURATION, MAX_ROUND_DURATION, VOTE_TIMER_SEC,
} from './types';
import { fetchHistoricalCandles, getRandomTicker, TICKER_LABELS } from './chart-generator';

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function createGame(): Promise<GameState> {
  const ticker = getRandomTicker();
  const duration = MIN_ROUND_DURATION + Math.floor(Math.random() * (MAX_ROUND_DURATION - MIN_ROUND_DURATION + 1));
  const candles = await fetchHistoricalCandles(ticker, duration + 20);

  console.log(`[Game] Loaded ${candles.length} historical candles for ${ticker}`);

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

  if (game.visibleCandleCount <= game.candles.length) {
    game.currentPrice = game.candles[game.visibleCandleCount - 1].close;
  }

  // Проверяем ликвидации
  const liquidated: { nickname: string; loss: number }[] = [];
  const candle = game.candles[game.visibleCandleCount - 1];
  if (candle) {
    for (const player of game.players) {
      if (!player.position || !player.connected) continue;
      if (isLiquidated(player.position, candle)) {
        const loss = player.position.size;
        player.balance -= loss;
        if (player.balance < 0) player.balance = 0;
        player.pnl -= loss;
        liquidated.push({ nickname: player.nickname, loss });
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
  if (player.position) return { success: false, message: 'Закрой текущую позицию' };
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
 * Закрыть позицию
 */
export function closePosition(
  game: GameState,
  playerId: string,
): { success: boolean; message: string; pnl: number } {
  const player = getPlayer(game, playerId);
  if (!player) return { success: false, message: 'Игрок не найден', pnl: 0 };
  if (!player.position) return { success: false, message: 'Нет открытой позиции', pnl: 0 };

  const pnl = calculatePnl(player.position, game.currentPrice);

  player.balance += pnl;
  player.pnl += pnl;
  if (player.balance < 0) player.balance = 0;

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
  return Math.max(-position.size, Math.round(pnl * 100) / 100);
}

export function getUnrealizedPnl(player: Player, currentPrice: number): number {
  if (!player.position) return 0;
  return calculatePnl(player.position, currentPrice);
}

export function getLeaderboard(game: GameState): LeaderboardEntry[] {
  return game.players
    .filter((p) => p.connected)
    .map((p) => {
      const unrealizedPnl = getUnrealizedPnl(p, game.currentPrice);
      return {
        nickname: p.nickname,
        balance: Math.round((p.balance + unrealizedPnl) * 100) / 100,
        pnl: p.pnl,
        unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
        totalPnl: Math.round((p.pnl + unrealizedPnl) * 100) / 100,
        hasPosition: !!p.position,
        positionDirection: p.position?.direction || null,
        positionLeverage: p.position?.leverage || null,
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
    if (a === '₿') return 10;  // джекпот
    if (a === '💎') return 5;
    return 3;
  }

  // 2 одинаковых
  if (a === b || b === c || a === c) return 1.5;

  // Ничего
  return 0;
}

export function spinSlots(
  game: GameState,
  playerId: string,
  bet: number,
): { success: boolean; message: string; result?: BonusResult } {
  const player = getPlayer(game, playerId);
  if (!player) return { success: false, message: 'Игрок не найден' };
  if (game.phase !== 'bonus') return { success: false, message: 'Бонус не активен' };
  if (!game.bonusState) return { success: false, message: 'Бонус не активен' };
  if (game.bonusState.bonusType !== 'slots') return { success: false, message: 'Сейчас не слоты' };
  if (game.bonusState.played[playerId]) return { success: false, message: 'Уже играл!' };
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

// --- Колесо фортуны ---

export function spinWheel(
  game: GameState,
  playerId: string,
  bet: number,
): { success: boolean; message: string; result?: BonusResult } {
  const player = getPlayer(game, playerId);
  if (!player) return { success: false, message: 'Игрок не найден' };
  if (game.phase !== 'bonus') return { success: false, message: 'Бонус не активен' };
  if (!game.bonusState) return { success: false, message: 'Бонус не активен' };
  if (game.bonusState.bonusType !== 'wheel') return { success: false, message: 'Сейчас не колесо' };
  if (game.bonusState.played[playerId]) return { success: false, message: 'Уже играл!' };
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

  return { success: true, message: `Колесо: x${multiplier}`, result: bonusResult };
}

// --- Лутбокс ---

function generateLootboxValues(): number[] {
  const boxes: number[] = [];
  for (let i = 0; i < 4; i++) {
    const idx = weightedRandomIndex(LOOTBOX_POOL.map((p) => p.weight));
    boxes.push(LOOTBOX_POOL[idx].multiplier);
  }

  // Гарантируем минимум 1 бокс >= x2
  if (!boxes.some((m) => m >= 2)) {
    const replaceIdx = Math.floor(Math.random() * 4);
    const highPool = LOOTBOX_POOL.filter((p) => p.multiplier >= 2);
    const highIdx = weightedRandomIndex(highPool.map((p) => p.weight));
    boxes[replaceIdx] = highPool[highIdx].multiplier;
  }

  // Гарантируем минимум 1 бокс <= x1.5
  if (!boxes.some((m) => m <= 1.5)) {
    // Выбираем случайный индекс, который не тот же что заменили выше
    let replaceIdx = Math.floor(Math.random() * 4);
    // Если все боксы >= 2, просто заменяем любой другой
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
  const player = getPlayer(game, playerId);
  if (!player) return { success: false, message: 'Игрок не найден' };
  if (game.phase !== 'bonus') return { success: false, message: 'Бонус не активен' };
  if (!game.bonusState) return { success: false, message: 'Бонус не активен' };
  if (game.bonusState.bonusType !== 'lootbox') return { success: false, message: 'Сейчас не лутбокс' };
  if (game.bonusState.played[playerId]) return { success: false, message: 'Уже играл!' };
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

  return { success: true, message: `Лутбокс: x${multiplier}`, result: bonusResult };
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

  // Сброс PnL (баланс сохраняется между раундами)
  for (const player of game.players) {
    player.pnl = 0;
    player.position = null;
  }

  console.log(`[Game] Round ${game.roundNumber}: ${game.ticker}, ${duration}s, ${candles.length} candles`);
}
