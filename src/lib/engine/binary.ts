import {
  GameState, Player,
  BinaryDirection, BinaryBet, BinaryRoundState,
  BINARY_MAX_ROUNDS, BINARY_AUTO_BET_PERCENT,
} from '../types';
import { getPlayer, roundBalance } from './shared';

// --- Place a bet for a player ---

export function placeBinaryBet(
  game: GameState,
  playerId: string,
  direction: BinaryDirection,
  percent: number,
): BinaryBet | null {
  if (game.phase !== 'binary_betting') return null;
  if (!game.binaryRound) return null;

  const player = getPlayer(game, playerId);
  if (!player) return null;
  if (!player.connected) return null;
  if (player.balance <= 0) return null;

  // Check if player already bet this round
  const existingBet = game.binaryRound.bets.find((b) => b.playerId === playerId);
  if (existingBet) return null;

  // Clamp percent to 1-100
  const clampedPercent = Math.max(1, Math.min(100, percent));
  const amount = roundBalance(player.balance * clampedPercent / 100);
  if (amount <= 0) return null;

  const bet: BinaryBet = {
    playerId,
    nickname: player.nickname,
    direction,
    amount,
  };

  game.binaryRound.bets.push(bet);

  // Update pools
  if (direction === 'up') {
    game.binaryRound.upPool = roundBalance(game.binaryRound.upPool + amount);
  } else {
    game.binaryRound.downPool = roundBalance(game.binaryRound.downPool + amount);
  }

  return bet;
}

// --- Auto-bet for players who didn't bet in time ---

export function autoPlaceBets(game: GameState): void {
  if (!game.binaryRound) return;

  const activePlayers = game.players.filter((p) => p.connected && p.balance > 0);
  const bettedIds = new Set(game.binaryRound.bets.map((b) => b.playerId));

  for (const player of activePlayers) {
    if (bettedIds.has(player.id)) continue;

    const amount = roundBalance(player.balance * BINARY_AUTO_BET_PERCENT / 100);
    if (amount <= 0) continue;

    const direction: BinaryDirection = Math.random() < 0.5 ? 'up' : 'down';

    const bet: BinaryBet = {
      playerId: player.id,
      nickname: player.nickname,
      direction,
      amount,
    };

    game.binaryRound.bets.push(bet);

    if (direction === 'up') {
      game.binaryRound.upPool = roundBalance(game.binaryRound.upPool + amount);
    } else {
      game.binaryRound.downPool = roundBalance(game.binaryRound.downPool + amount);
    }
  }
}

// --- Check if all active (non-eliminated) players have bet ---

export function allBetsPlaced(game: GameState): boolean {
  if (!game.binaryRound) return false;

  const activePlayers = game.players.filter((p) => p.connected && p.balance > 0);
  const bettedIds = new Set(game.binaryRound.bets.map((b) => b.playerId));

  return activePlayers.every((p) => bettedIds.has(p.id));
}

// --- Calculate payouts after round resolves ---
// Returns map of playerId -> win/loss amount

export function calculateBinaryPayouts(
  bets: BinaryBet[],
  winDirection: BinaryDirection,
): Map<string, number> {
  const payouts = new Map<string, number>();

  const winPool = bets
    .filter((b) => b.direction === winDirection)
    .reduce((sum, b) => sum + b.amount, 0);
  const losePool = bets
    .filter((b) => b.direction !== winDirection)
    .reduce((sum, b) => sum + b.amount, 0);

  for (const bet of bets) {
    if (bet.direction === winDirection) {
      // Winner gets proportional share of the losing pool
      if (winPool > 0) {
        const share = bet.amount / winPool;
        const winnings = roundBalance(share * losePool);
        payouts.set(bet.playerId, winnings);
      } else {
        payouts.set(bet.playerId, 0);
      }
    } else {
      // Loser loses their bet amount
      payouts.set(bet.playerId, -bet.amount);
    }
  }

  return payouts;
}

// --- Apply payouts to player balances, return eliminated players ---

export function applyBinaryPayouts(
  game: GameState,
  payouts: Map<string, number>,
): string[] {
  const eliminated: string[] = [];

  for (const [playerId, amount] of payouts) {
    const player = getPlayer(game, playerId);
    if (!player) continue;

    player.balance = roundBalance(player.balance + amount);
    if (player.balance < 0) player.balance = 0;

    // Update stats
    if (player.balance > player.maxBalance) player.maxBalance = player.balance;
    player.totalTrades++;
    if (amount < player.worstTrade) player.worstTrade = amount;
    if (amount > player.bestTrade) player.bestTrade = amount;

    // Check elimination
    if (player.balance <= 0) {
      eliminated.push(playerId);
    }
  }

  return eliminated;
}

// --- Check if game should end (1 player left or max rounds) ---

export function shouldBinaryGameEnd(game: GameState): boolean {
  if (!game.binaryRound) return true;

  // Max rounds reached
  if (game.binaryRound.roundNumber >= game.binaryRound.maxRounds) return true;

  // Count players with balance > 0
  const activePlayers = game.players.filter((p) => p.connected && p.balance > 0);
  if (activePlayers.length <= 1) return true;

  return false;
}

// --- Get the winner(s) ---

export function getBinaryWinner(game: GameState): Player | null {
  const activePlayers = game.players
    .filter((p) => p.connected && p.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  return activePlayers[0] || null;
}

// --- Create initial binary round state ---

export function createBinaryRoundState(
  roundNumber: number,
  ticker: string,
  entryPrice: number,
): BinaryRoundState {
  return {
    roundNumber,
    maxRounds: BINARY_MAX_ROUNDS,
    ticker,
    candles: [],
    entryPrice,
    bets: [],
    result: null,
    candlesRevealed: 0,
    finalPrice: null,
    upPool: 0,
    downPool: 0,
  };
}
