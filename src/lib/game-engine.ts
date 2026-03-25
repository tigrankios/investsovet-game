import {
  GameState, Player, Position, LeaderboardEntry, RoundResult, Leverage, VoteState,
  SlotState, SlotResult, SlotSymbol, SLOT_SYMBOLS, SLOT_TIMER_SEC,
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
    slotState: null,
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
    .sort((a, b) => b.totalPnl - a.totalPnl);
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

// --- Слот-машина ---

export function startSlots(game: GameState): SlotState {
  game.phase = 'slots';
  game.slotState = {
    played: {},
    timer: SLOT_TIMER_SEC,
  };
  return game.slotState;
}

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
): { success: boolean; message: string; result?: SlotResult } {
  const player = getPlayer(game, playerId);
  if (!player) return { success: false, message: 'Игрок не найден' };
  if (game.phase !== 'slots') return { success: false, message: 'Слоты не активны' };
  if (!game.slotState) return { success: false, message: 'Слоты не активны' };
  if (game.slotState.played[playerId]) return { success: false, message: 'Уже крутил!' };
  if (bet <= 0) return { success: false, message: 'Некорректная ставка' };
  if (bet > player.balance) return { success: false, message: 'Недостаточно средств' };

  const reels: [SlotSymbol, SlotSymbol, SlotSymbol] = [randomSymbol(), randomSymbol(), randomSymbol()];
  const multiplier = getSlotMultiplier(reels);

  // winAmount: при multiplier=0 теряет ставку, иначе получает bet * multiplier - bet
  const winAmount = multiplier === 0 ? -bet : Math.round((bet * multiplier - bet) * 100) / 100;

  player.balance = Math.round((player.balance + winAmount) * 100) / 100;
  if (player.balance < 0) player.balance = 0;

  const result: SlotResult = { reels, multiplier, bet, winAmount };
  game.slotState.played[playerId] = result;

  return { success: true, message: `${reels.join(' ')} — x${multiplier}`, result };
}

export function getSlotResults(game: GameState): { nickname: string; result: SlotResult }[] {
  if (!game.slotState) return [];
  return Object.entries(game.slotState.played).map(([playerId, result]) => {
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
  game.slotState = null;

  // Сброс PnL (баланс сохраняется между раундами)
  for (const player of game.players) {
    player.pnl = 0;
    player.position = null;
  }

  console.log(`[Game] Round ${game.roundNumber}: ${game.ticker}, ${duration}s, ${candles.length} candles`);
}
