import {
  GameState, Player, Position, LeaderboardEntry, RoundResult, Leverage, VoteState,
  BonusState, BonusType, BonusResult, WheelResult, LootboxResult, LotoResult,
  SlotResult, SlotSymbol, SLOT_SYMBOLS,
  WHEEL_SECTORS, LOOTBOX_POOL, BONUS_TIMER_SEC,
  LOTO_NUMBERS_TOTAL, LOTO_PICK_COUNT, LOTO_DRAW_COUNT, LOTO_PAYOUTS,
  SkillType, ALL_SKILLS, FREEZE_DURATION, INVERSE_DURATION,
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
    skill: null,
    skillUsed: false,
    pnlMultiplier: 1,
    shieldActive: false,
    freezePrice: null,
    freezeTicksLeft: 0,
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

  // Обновить freeze таймеры
  for (const player of game.players) {
    if (player.freezeTicksLeft > 0) {
      player.freezeTicksLeft--;
      if (player.freezeTicksLeft <= 0) {
        player.freezePrice = null;
      }
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

  // Double or nothing: удвоить маржу если скилл использован и нет позиции
  let actualSize = size;
  let doubledMsg = '';
  if (player.skillUsed && player.skill === 'double_or_nothing' && !player.position) {
    if (size * 2 <= player.balance) {
      actualSize = size * 2;
      doubledMsg = ' (ВА-БАНК x2!)';
    }
  }

  player.position = {
    direction,
    size: actualSize,
    leverage,
    entryPrice: game.currentPrice,
    openedAt: game.visibleCandleCount,
    liquidationPrice: liqPrice,
  };

  return {
    success: true,
    message: `${direction.toUpperCase()} x${leverage} $${actualSize} @ ${game.currentPrice}${doubledMsg}`,
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

  const price = player.freezePrice ?? game.currentPrice;
  const basePnl = calculatePnl(player.position, price);
  const pnl = Math.round(basePnl * player.pnlMultiplier * 100) / 100;

  player.balance += pnl;
  player.pnl += pnl;
  if (player.balance < 0) player.balance = 0;

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
  return Math.max(-position.size, Math.round(pnl * 100) / 100);
}

export function getUnrealizedPnl(player: Player, currentPrice: number): number {
  if (!player.position) return 0;
  const price = player.freezePrice ?? currentPrice;
  const basePnl = calculatePnl(player.position, price);
  return Math.round(basePnl * player.pnlMultiplier * 100) / 100;
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

// --- Скиллы ---

export function assignRandomSkill(player: Player): SkillType {
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
  let highFixedIdx = -1;
  if (!boxes.some((m) => m >= 2)) {
    highFixedIdx = Math.floor(Math.random() * 4);
    const highPool = LOOTBOX_POOL.filter((p) => p.multiplier >= 2);
    const highIdx = weightedRandomIndex(highPool.map((p) => p.weight));
    boxes[highFixedIdx] = highPool[highIdx].multiplier;
  }

  // Гарантируем минимум 1 бокс <= x1.5 (не трогая индекс, зафиксированный выше)
  if (!boxes.some((m) => m <= 1.5)) {
    const candidates = [0, 1, 2, 3].filter((i) => i !== highFixedIdx);
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
  const player = getPlayer(game, playerId);
  if (!player) return { success: false, message: 'Игрок не найден' };
  if (game.phase !== 'bonus') return { success: false, message: 'Бонус не активен' };
  if (!game.bonusState) return { success: false, message: 'Бонус не активен' };
  if (game.bonusState.bonusType !== 'lootbox') return { success: false, message: 'Сейчас не лутбокс' };
  if (game.bonusState.played[playerId]) return { success: false, message: 'Уже играл!' };
  if (bet <= 0) return { success: false, message: 'Некорректная ставка' };
  if (bet > player.balance) return { success: false, message: 'Недостаточно средств' };
  if (!Number.isInteger(chosenIndex) || chosenIndex < 0 || chosenIndex > 3) return { success: false, message: 'Некорректный выбор' };

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
  const player = getPlayer(game, playerId);
  if (!player) return { success: false, message: 'Игрок не найден' };
  if (game.phase !== 'bonus') return { success: false, message: 'Бонус не активен' };
  if (!game.bonusState) return { success: false, message: 'Бонус не активен' };
  if (game.bonusState.bonusType !== 'loto') return { success: false, message: 'Сейчас не лото' };
  if (game.bonusState.played[playerId]) return { success: false, message: 'Уже играл!' };
  if (bet <= 0) return { success: false, message: 'Некорректная ставка' };
  if (bet > player.balance) return { success: false, message: 'Недостаточно средств' };
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
  const winAmount = multiplier === 0 ? -bet : Math.round((bet * multiplier - bet) * 100) / 100;

  player.balance = Math.round((player.balance + winAmount) * 100) / 100;
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
  game.bonusState.played[playerId] = bonusResult;

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

  // Сброс PnL и скиллов (баланс сохраняется между раундами)
  for (const player of game.players) {
    player.pnl = 0;
    player.position = null;
    resetPlayerSkillEffects(player);
  }

  console.log(`[Game] Round ${game.roundNumber}: ${game.ticker}, ${duration}s, ${candles.length} candles`);
}
