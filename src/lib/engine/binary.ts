// ============================================
// InvestSovet — Binary Options Engine
// ============================================

import type { GameState, Player } from '../types';
import type {
  BinaryDirection, BinaryBet, BinaryRoundState,
  BinaryPayoutEntry, BinaryRoundResult,
} from '../types/binary';
import {
  BINARY_DEFAULT_BET_PERCENT,
  BINARY_MAX_ROUNDS,
} from '../types/binary';
import { roundBalance } from './shared';

// --- Bet placement ---

export function placeBinaryBet(
  game: GameState,
  playerId: string,
  direction: BinaryDirection,
): { success: boolean; message: string } {
  const binary = game.binaryState;
  if (!binary) return { success: false, message: 'Binary round not active' };

  const player = game.players.find((p) => p.id === playerId);
  if (!player) return { success: false, message: 'Player not found' };

  if (binary.eliminatedPlayerIds.has(playerId)) {
    return { success: false, message: 'You are eliminated' };
  }

  if (binary.bets.some((b) => b.playerId === playerId)) {
    return { success: false, message: 'Already placed a bet this round' };
  }

  const amount = roundBalance(player.balance * (BINARY_DEFAULT_BET_PERCENT / 100));
  if (amount <= 0) return { success: false, message: 'Insufficient balance' };

  const bet: BinaryBet = { playerId, direction, amount };
  binary.bets.push(bet);

  if (direction === 'up') {
    binary.upPool += amount;
  } else {
    binary.downPool += amount;
  }

  player.balance = roundBalance(player.balance - amount);

  return {
    success: true,
    message: `Bet ${direction.toUpperCase()} $${amount.toFixed(2)}`,
  };
}

// --- Auto-bet for players who didn't bet ---

export function autoPlaceBets(game: GameState): void {
  const binary = game.binaryState;
  if (!binary) return;

  const activePlayers = game.players.filter(
    (p) => p.connected && !binary.eliminatedPlayerIds.has(p.id),
  );

  for (const player of activePlayers) {
    if (binary.bets.some((b) => b.playerId === player.id)) continue;

    const direction: BinaryDirection = Math.random() < 0.5 ? 'up' : 'down';
    const amount = roundBalance(player.balance * (BINARY_DEFAULT_BET_PERCENT / 100));
    if (amount <= 0) continue;

    const bet: BinaryBet = { playerId: player.id, direction, amount };
    binary.bets.push(bet);

    if (direction === 'up') {
      binary.upPool += amount;
    } else {
      binary.downPool += amount;
    }

    player.balance = roundBalance(player.balance - amount);
  }
}

// --- Check if all bets are in same direction ---

export function allBetsSameDirection(game: GameState): boolean {
  const binary = game.binaryState;
  if (!binary || binary.bets.length === 0) return false;

  const firstDir = binary.bets[0].direction;
  return binary.bets.every((b) => b.direction === firstDir);
}

// --- Cancel round (return bets) ---

export function cancelRound(game: GameState): void {
  const binary = game.binaryState;
  if (!binary) return;

  for (const bet of binary.bets) {
    const player = game.players.find((p) => p.id === bet.playerId);
    if (player) {
      player.balance = roundBalance(player.balance + bet.amount);
    }
  }

  binary.bets = [];
  binary.upPool = 0;
  binary.downPool = 0;
}

// --- Calculate payouts (pari-mutuel) ---

export function calculateBinaryPayouts(
  game: GameState,
  result: BinaryDirection,
): BinaryPayoutEntry[] {
  const binary = game.binaryState;
  if (!binary) return [];

  const totalPool = binary.upPool + binary.downPool;
  const winningPool = result === 'up' ? binary.upPool : binary.downPool;

  const payouts: BinaryPayoutEntry[] = [];

  for (const bet of binary.bets) {
    const player = game.players.find((p) => p.id === bet.playerId);
    if (!player) continue;

    if (bet.direction === result) {
      // Winner gets proportional share of total pool
      const share = winningPool > 0 ? bet.amount / winningPool : 0;
      const winnings = roundBalance(totalPool * share);
      const payout = roundBalance(winnings - bet.amount); // net gain

      payouts.push({
        playerId: bet.playerId,
        nickname: player.nickname,
        betDirection: bet.direction,
        betAmount: bet.amount,
        payout,
        newBalance: roundBalance(player.balance + winnings),
      });
    } else {
      // Loser gets nothing (bet already deducted)
      payouts.push({
        playerId: bet.playerId,
        nickname: player.nickname,
        betDirection: bet.direction,
        betAmount: bet.amount,
        payout: roundBalance(-bet.amount),
        newBalance: player.balance,
      });
    }
  }

  return payouts;
}

// --- Apply payouts to player balances ---

export function applyBinaryPayouts(
  game: GameState,
  result: BinaryDirection,
  payouts: BinaryPayoutEntry[],
): void {
  const binary = game.binaryState;
  if (!binary) return;

  const totalPool = binary.upPool + binary.downPool;
  const winningPool = result === 'up' ? binary.upPool : binary.downPool;

  for (const bet of binary.bets) {
    const player = game.players.find((p) => p.id === bet.playerId);
    if (!player) continue;

    if (bet.direction === result) {
      const share = winningPool > 0 ? bet.amount / winningPool : 0;
      const winnings = roundBalance(totalPool * share);
      player.balance = roundBalance(player.balance + winnings);
    }
    // Losers already had balance deducted when bet was placed
  }

  // Update stats
  for (const p of payouts) {
    const player = game.players.find((pl) => pl.id === p.playerId);
    if (!player) continue;
    player.totalTrades++;
    if (p.payout < player.worstTrade) player.worstTrade = p.payout;
    if (p.payout > player.bestTrade) player.bestTrade = p.payout;
    if (player.balance > player.maxBalance) player.maxBalance = player.balance;
  }
}

// --- Check eliminated players ---

export function checkEliminated(game: GameState): string[] {
  const binary = game.binaryState;
  if (!binary) return [];

  const newlyEliminated: string[] = [];

  for (const player of game.players) {
    if (!player.connected) continue;
    if (binary.eliminatedPlayerIds.has(player.id)) continue;
    if (player.balance <= 0) {
      binary.eliminatedPlayerIds.add(player.id);
      newlyEliminated.push(player.id);
    }
  }

  return newlyEliminated;
}

// --- Should game end ---

export function shouldBinaryGameEnd(game: GameState): boolean {
  const binary = game.binaryState;
  if (!binary) return true;

  // Max rounds reached
  if (binary.roundNumber >= BINARY_MAX_ROUNDS) return true;

  // Count active (non-eliminated, connected) players
  const activePlayers = game.players.filter(
    (p) => p.connected && !binary.eliminatedPlayerIds.has(p.id) && p.balance > 0,
  );

  // Need at least 2 active players to continue
  return activePlayers.length < 2;
}

// --- Get final stats for binary mode ---

export function getBinaryFinalStats(game: GameState): import('../types').FinalPlayerStats[] {
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
      role: p.role as import('../types').PlayerRole,
    }));
}
