import { Server as SocketServer, Socket } from 'socket.io';
import type {
  ClientToServerEvents, ServerToClientEvents, GameState, Candle,
} from '../lib/types';
import type { BinaryDirection, BinaryRoundState } from '../lib/types/binary';
import {
  BINARY_CHART_HISTORY, BINARY_CANDLES_COUNT, BINARY_TOTAL_CANDLES,
  BINARY_BET_TIME_SEC, BINARY_REVEAL_DELAY_SEC,
  BINARY_CANDLE_INTERVAL_SEC, BINARY_RESULT_DELAY_SEC,
  BINARY_MAX_ROUNDS,
} from '../lib/types/binary';
import {
  placeBinaryBet, autoPlaceBets, allBetsSameDirection,
  cancelRound, calculateBinaryPayouts, applyBinaryPayouts,
  checkEliminated, shouldBinaryGameEnd, getBinaryFinalStats,
} from '../lib/engine/binary';
import { fetchHistoricalCandles, getRandomTicker, TICKER_LABELS } from '../lib/chart-generator';
import {
  rooms, playerRooms, timers,
  broadcastState, broadcastLeaderboard, sendPlayerUpdate,
  clearTimer,
} from './shared-state';

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// ---- Binary Options round flow ----

export async function binaryStartRound(roomCode: string, io: SocketServer): Promise<void> {
  const game = rooms.get(roomCode);
  if (!game) return;

  // Step 1: Fetch candles for random ticker
  const rawTicker = getRandomTicker();
  const candles = await fetchHistoricalCandles(rawTicker, BINARY_TOTAL_CANDLES);

  if (candles.length < BINARY_TOTAL_CANDLES) {
    console.error(`[Binary] Not enough candles for ${rawTicker}, got ${candles.length}`);
    game.phase = 'finished';
    broadcastState(io, game);
    return;
  }

  const ticker = TICKER_LABELS[rawTicker] || rawTicker;
  const entryPrice = candles[BINARY_CHART_HISTORY - 1].close;

  // Initialize or increment round state
  const roundNumber = game.binaryState ? game.binaryState.roundNumber + 1 : 1;
  const eliminatedPlayerIds = game.binaryState?.eliminatedPlayerIds ?? new Set<string>();

  game.binaryState = {
    roundNumber,
    ticker,
    allCandles: candles,
    entryPrice,
    bets: [],
    upPool: 0,
    downPool: 0,
    revealedCount: 0,
    eliminatedPlayerIds,
  };

  game.ticker = ticker;
  game.candles = candles.slice(0, BINARY_CHART_HISTORY);
  game.visibleCandleCount = BINARY_CHART_HISTORY;
  game.currentPrice = entryPrice;

  console.log(`[Binary] Round ${roundNumber} starting in ${roomCode}: ${ticker}, entry=${entryPrice}`);

  // Step 2: Set phase to binary_betting, broadcast (WITHOUT bets)
  game.phase = 'binary_betting';
  broadcastState(io, game);

  io.to(roomCode).emit('binaryRound', {
    roundNumber,
    totalRounds: BINARY_MAX_ROUNDS,
    phase: 'betting' as const,
    entryPrice,
    candles: candles.slice(0, BINARY_CHART_HISTORY),
    candleTarget: BINARY_CANDLES_COUNT,
    ticker,
  });

  // Step 3: Start betting timer
  let bettingTimeLeft = BINARY_BET_TIME_SEC;
  io.to(roomCode).emit('betTimer', bettingTimeLeft);
  const bettingTimer = setInterval(() => {
    bettingTimeLeft--;
    io.to(roomCode).emit('betTimer', bettingTimeLeft);

    if (bettingTimeLeft <= 0) {
      clearInterval(bettingTimer);
      timers.delete(roomCode);
      onBettingEnd(roomCode, io);
    }
  }, 1000);

  timers.set(roomCode, bettingTimer);
}

function onBettingEnd(roomCode: string, io: SocketServer): void {
  const game = rooms.get(roomCode);
  if (!game || !game.binaryState) return;

  // Step 4: Auto-place bets for players who didn't bet
  autoPlaceBets(game);

  // Step 5: Check if all bet same direction
  if (allBetsSameDirection(game)) {
    cancelRound(game);
    io.to(roomCode).emit('binaryRoundCancelled', {
      message: 'All players bet the same direction — round cancelled, bets returned',
    });

    console.log(`[Binary] Round ${game.binaryState.roundNumber} cancelled in ${roomCode} (same direction)`);

    // Start new round with new chart after short delay
    setTimeout(() => {
      const g = rooms.get(roomCode);
      if (!g || g.phase === 'finished') return;
      binaryStartRound(roomCode, io);
    }, BINARY_RESULT_DELAY_SEC * 1000);
    return;
  }

  // Step 6: Set phase to binary_reveal, broadcast all bets
  game.phase = 'binary_reveal';
  broadcastState(io, game);

  const betsForClient = game.binaryState.bets.map((b) => {
    const player = game.players.find((p) => p.id === b.playerId);
    return {
      playerId: b.playerId,
      nickname: player?.nickname || '???',
      direction: b.direction,
      amount: b.amount,
    };
  });

  io.to(roomCode).emit('binaryReveal', {
    bets: betsForClient,
    upPool: game.binaryState.upPool,
    downPool: game.binaryState.downPool,
  });

  broadcastLeaderboard(io, game);

  // Step 7: After 1s delay, start candle reveal
  setTimeout(() => {
    const g = rooms.get(roomCode);
    if (!g || !g.binaryState) return;

    g.phase = 'binary_waiting';
    broadcastState(io, g);

    // Step 8: Reveal 5 candles one by one
    let candleIndex = 0;
    const revealTimer = setInterval(() => {
      const currentGame = rooms.get(roomCode);
      if (!currentGame || !currentGame.binaryState) {
        clearInterval(revealTimer);
        timers.delete(roomCode);
        return;
      }

      const binary = currentGame.binaryState;
      const allCandles = binary.allCandles;
      const revealIdx = BINARY_CHART_HISTORY + candleIndex;

      if (revealIdx >= allCandles.length || candleIndex >= BINARY_CANDLES_COUNT) {
        clearInterval(revealTimer);
        timers.delete(roomCode);
        onAllCandlesRevealed(roomCode, io);
        return;
      }

      const candle = allCandles[revealIdx];
      binary.revealedCount = candleIndex + 1;

      // Update game's visible candles and price
      currentGame.candles.push(candle);
      currentGame.visibleCandleCount++;
      currentGame.currentPrice = candle.close;

      io.to(roomCode).emit('binaryCandle', { candle });

      broadcastState(io, currentGame);
      candleIndex++;
    }, BINARY_CANDLE_INTERVAL_SEC * 1000);

    timers.set(roomCode, revealTimer);
  }, BINARY_REVEAL_DELAY_SEC * 1000);
}

function onAllCandlesRevealed(roomCode: string, io: SocketServer): void {
  const game = rooms.get(roomCode);
  if (!game || !game.binaryState) return;

  const binary = game.binaryState;
  const allCandles = binary.allCandles;
  const finalCandle = allCandles[BINARY_CHART_HISTORY + BINARY_CANDLES_COUNT - 1];
  const finalPrice = finalCandle.close;
  const entryPrice = binary.entryPrice;

  // Step 9: Determine result (finalPrice > entryPrice = 'up', else 'down'; equal = 'down')
  const result: BinaryDirection = finalPrice > entryPrice ? 'up' : 'down';

  // Step 10: Calculate and apply payouts
  const payouts = calculateBinaryPayouts(game, result);
  applyBinaryPayouts(game, result, payouts);

  // Step 11: Set phase to binary_result, broadcast
  game.phase = 'binary_result';
  broadcastState(io, game);

  io.to(roomCode).emit('binaryResult', {
    direction: result,
    entryPrice,
    finalPrice,
    payouts: payouts.map((p) => ({
      playerId: p.playerId,
      nickname: p.nickname,
      direction: p.betDirection,
      betAmount: p.betAmount,
      won: p.payout > 0,
      payout: p.payout,
      newBalance: p.newBalance,
    })),
  });

  broadcastLeaderboard(io, game);

  // Send updated balance to each player
  for (const player of game.players) {
    if (player.connected) {
      sendPlayerUpdate(io, game, player.id);
    }
  }

  // Step 12: Check eliminated players
  const newlyEliminated = checkEliminated(game);
  for (const playerId of newlyEliminated) {
    const player = game.players.find((p) => p.id === playerId);
    if (player) {
      io.to(roomCode).emit('playerEliminated', { playerId });
    }
  }

  // Step 13: Check game end
  if (shouldBinaryGameEnd(game)) {
    game.phase = 'finished';
    broadcastState(io, game);
    io.to(roomCode).emit('gameFinished', getBinaryFinalStats(game));
    console.log(`[Binary] Game finished in ${roomCode} after round ${binary.roundNumber}`);
    return;
  }

  // Step 14: After 2s, start next round
  setTimeout(() => {
    const g = rooms.get(roomCode);
    if (!g || g.phase === 'finished') return;
    binaryStartRound(roomCode, io);
  }, BINARY_RESULT_DELAY_SEC * 1000);
}

// ---- Register binary-specific socket events ----

export function registerBinaryEvents(
  socket: GameSocket,
  io: SocketServer<ClientToServerEvents, ServerToClientEvents>,
): void {
  socket.on('placeBet', ({ direction, percent }) => {
    if (direction !== 'up' && direction !== 'down') {
      socket.emit('error', 'Invalid direction');
      return;
    }

    const roomCode = playerRooms.get(socket.id);
    if (!roomCode) return;
    const game = rooms.get(roomCode);
    if (!game) return;

    // Validate: must be binary game
    if (game.gameMode !== 'binary') {
      socket.emit('error', 'Not a binary options game');
      return;
    }

    // Validate: must be in betting phase
    if (game.phase !== 'binary_betting') {
      socket.emit('error', 'Betting phase is over');
      return;
    }

    // Validate: binary state exists
    if (!game.binaryState) {
      socket.emit('error', 'No active binary round');
      return;
    }

    // Validate: not eliminated
    if (game.binaryState.eliminatedPlayerIds.has(socket.id)) {
      socket.emit('error', 'You are eliminated');
      return;
    }

    // Validate: hasn't already bet
    if (game.binaryState.bets.some((b) => b.playerId === socket.id)) {
      socket.emit('error', 'Already placed a bet this round');
      return;
    }

    const result = placeBinaryBet(game, socket.id, direction, percent);
    if (result.success) {
      socket.emit('tradeResult', result);
      broadcastLeaderboard(io, game);
    } else {
      socket.emit('error', result.message);
    }
  });
}
