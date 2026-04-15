import { Server as SocketServer, Socket } from 'socket.io';
import type {
  ClientToServerEvents, ServerToClientEvents, GameState,
} from '../lib/types';
import { INITIAL_BALANCE } from '../lib/types';
import type { DrawPoint } from '../lib/types/draw';
import {
  DRAW_CANDLES_PER_ROUND,
  DRAW_PREVIEW_CANDLES,
  DRAW_CANDLE_INTERVAL_MS,
  DRAW_DRAWING_TIME_SEC,
  DRAW_PREVIEW_TIME_SEC,
  DRAW_MAX_ROUNDS,
  DRAW_MM_LIQUIDATION_PERCENT,
} from '../lib/types/draw';
import {
  generateCandlesFromDrawing,
  generateRandomDrawCandles,
  createDrawRoundState,
} from '../lib/engine/draw';
import {
  endRound, startBonus, getBonusResults,
  assignRandomSkill, getFinalStats,
  resetPlayerSkillEffects,
  startVoting, getVoteResult,
} from '../lib/engine';
import { roundBalance, calcLiquidationPrice, isLiquidated } from '../lib/engine/shared';
import {
  rooms, playerRooms, timers,
  broadcastState, broadcastLeaderboard, sendPlayerUpdate,
  clearTimer, shouldEndGame, scheduleRoomCleanup,
} from './shared-state';

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// Track pending drawing submissions per room
const pendingDrawings = new Map<string, DrawPoint[]>();

// ---- Draw mode: start a round ----

export function drawStartRound(roomCode: string, io: SocketServer): void {
  const game = rooms.get(roomCode);
  if (!game) return;

  // Create or increment round state
  const roundNumber = game.drawState
    ? game.drawState.roundNumber + 1
    : 1;

  // Assign Market Maker on round 1 only
  if (roundNumber === 1 && !game.marketMakerId) {
    const connected = game.players.filter((p) => p.connected);
    if (connected.length === 0) return;
    const mm = connected[Math.floor(Math.random() * connected.length)];
    mm.role = 'market_maker';
    mm.balance = 0;
    mm.maxBalance = 0;
    game.marketMakerId = mm.id;
    // Set other players as traders with initial balance
    for (const player of game.players) {
      if (player.id !== mm.id) {
        player.role = 'trader';
        player.balance = INITIAL_BALANCE;
        player.maxBalance = INITIAL_BALANCE;
      }
    }
    console.log(`[Draw] Market Maker assigned: ${mm.nickname}`);
  }

  // Generate random starting price ($50-$500)
  const startingPrice = Math.round((50 + Math.random() * 450) * 100) / 100;

  game.drawState = createDrawRoundState(roundNumber);
  game.drawState.startingPrice = startingPrice;

  // Set game-level fields
  game.ticker = `DRAW R${roundNumber}`;
  game.currentPrice = startingPrice;
  game.visibleCandleCount = 0;
  game.candles = [];
  game.elapsed = 0;

  // Reset player state for new round
  for (const player of game.players) {
    player.pnl = 0;
    player.position = null;
    resetPlayerSkillEffects(player);
  }

  // Remove lowest leverage (until only 500x remains)
  if (game.availableLeverages.length > 1 && roundNumber > 1) {
    game.availableLeverages = game.availableLeverages.slice(1);
  }

  // Clear any pending drawings
  pendingDrawings.delete(roomCode);

  // Set phase to draw_drawing
  game.phase = 'draw_drawing';
  broadcastState(io, game);

  console.log(`[Draw] Round ${roundNumber} starting in ${roomCode}: price=${startingPrice}`);

  // Start drawing timer
  let drawTimeLeft = DRAW_DRAWING_TIME_SEC;
  io.to(roomCode).emit('drawPhase', { timer: drawTimeLeft });

  const drawingTimer = setInterval(() => {
    drawTimeLeft--;
    io.to(roomCode).emit('drawPhase', { timer: drawTimeLeft });

    if (drawTimeLeft <= 0) {
      clearInterval(drawingTimer);
      timers.delete(roomCode);
      onDrawingComplete(roomCode, io);
    }
  }, 1000);

  timers.set(roomCode, drawingTimer);
}

// ---- Drawing phase complete ----

function onDrawingComplete(roomCode: string, io: SocketServer): void {
  const game = rooms.get(roomCode);
  if (!game || !game.drawState) return;

  const drawState = game.drawState;
  const startingPrice = drawState.startingPrice;

  // Check if MM submitted a drawing
  const points = pendingDrawings.get(roomCode);
  pendingDrawings.delete(roomCode);

  let candles;
  if (points && points.length >= 2) {
    drawState.drawingPoints = points;
    candles = generateCandlesFromDrawing(points, startingPrice);
  } else {
    candles = generateRandomDrawCandles(startingPrice);
  }

  // Store all candles
  drawState.generatedCandles = candles;
  game.candles = candles;
  game.roundDuration = DRAW_CANDLES_PER_ROUND;

  // Set phase to preview
  game.phase = 'draw_preview';

  // Show first PREVIEW candles
  const previewCandles = candles.slice(0, DRAW_PREVIEW_CANDLES);
  game.visibleCandleCount = DRAW_PREVIEW_CANDLES;
  game.currentPrice = previewCandles[previewCandles.length - 1].close;

  broadcastState(io, game);
  io.to(roomCode).emit('drawPreview', { candles: previewCandles });

  console.log(`[Draw] Preview phase in ${roomCode}: ${DRAW_PREVIEW_CANDLES} candles shown`);

  // After preview time, start countdown then trading
  setTimeout(() => {
    const g = rooms.get(roomCode);
    if (!g || g.phase === 'finished') return;
    startDrawCountdown(roomCode, io);
  }, DRAW_PREVIEW_TIME_SEC * 1000);
}

// ---- Countdown before trading ----

function startDrawCountdown(roomCode: string, io: SocketServer): void {
  const game = rooms.get(roomCode);
  if (!game) return;

  game.phase = 'countdown';
  broadcastState(io, game);

  let count = 3;
  io.to(roomCode).emit('countdown', count);

  const countdownTimer = setInterval(() => {
    count--;
    if (count > 0) {
      io.to(roomCode).emit('countdown', count);
    } else {
      clearInterval(countdownTimer);
      timers.delete(roomCode);
      startDrawTrading(roomCode, io);
    }
  }, 1000);

  timers.set(roomCode, countdownTimer);
}

// ---- Trading phase ----

function startDrawTrading(roomCode: string, io: SocketServer): void {
  const game = rooms.get(roomCode);
  if (!game || !game.drawState) return;

  game.phase = 'trading';
  game.elapsed = DRAW_PREVIEW_CANDLES; // We've already shown preview candles

  // Assign skills to traders (not MM)
  for (const player of game.players) {
    if (player.connected && player.role !== 'market_maker') {
      const skill = assignRandomSkill(player);
      io.to(player.id).emit('skillAssigned', skill);
    }
  }

  broadcastState(io, game);
  broadcastLeaderboard(io, game);

  // Tick remaining candles one by one
  let candleIndex = DRAW_PREVIEW_CANDLES;

  const candleTimer = setInterval(() => {
    const currentGame = rooms.get(roomCode);
    if (!currentGame || !currentGame.drawState) {
      clearInterval(candleTimer);
      timers.delete(roomCode);
      return;
    }

    // Manually tick: increment visible candles, update price
    if (candleIndex < DRAW_CANDLES_PER_ROUND) {
      currentGame.visibleCandleCount = candleIndex + 1;
      currentGame.elapsed = candleIndex + 1;
      const candle = currentGame.candles[candleIndex];
      currentGame.currentPrice = candle.close;

      // Emit candle update
      io.to(roomCode).emit('candleUpdate', {
        candle,
        price: currentGame.currentPrice,
        index: candleIndex,
      });

      // Decrement effect timers
      for (const player of currentGame.players) {
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
      const liquidated = checkDrawLiquidations(currentGame, candle, io, roomCode);

      for (const player of currentGame.players) {
        if (player.connected) sendPlayerUpdate(io, currentGame, player.id);
      }

      if (liquidated.length > 0 && shouldEndGame(currentGame)) {
        drawFinishGame(io, currentGame);
        clearInterval(candleTimer);
        timers.delete(roomCode);
        return;
      }

      if (candleIndex % 2 === 0) broadcastLeaderboard(io, currentGame);

      candleIndex++;
    }

    // All candles revealed
    if (candleIndex >= DRAW_CANDLES_PER_ROUND) {
      clearInterval(candleTimer);
      timers.delete(roomCode);
      onDrawRoundEnd(roomCode, io);
    }
  }, DRAW_CANDLE_INTERVAL_MS);

  timers.set(roomCode, candleTimer);
}

// ---- Check liquidations with MM bonus ----

function checkDrawLiquidations(
  game: GameState,
  candle: { high: number; low: number },
  io: SocketServer,
  roomCode: string,
): { nickname: string; loss: number }[] {
  const liquidated: { nickname: string; loss: number }[] = [];

  for (const player of game.players) {
    if (!player.position || !player.connected) continue;
    if (player.role === 'market_maker') continue; // MM doesn't trade

    if (isLiquidated(player.position, candle)) {
      // Shield protection
      if (player.shieldActive) {
        player.shieldActive = false;
        player.position.liquidationPrice = calcLiquidationPrice(
          player.position.direction, game.currentPrice, player.position.leverage,
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

      io.to(roomCode).emit('liquidated', { nickname: player.nickname, loss });

      // MM gets liquidation bonus
      if (game.drawState && game.marketMakerId) {
        const mm = game.players.find((p) => p.id === game.marketMakerId);
        if (mm && mm.connected) {
          const bonus = roundBalance(loss * DRAW_MM_LIQUIDATION_PERCENT / 100);
          mm.balance = roundBalance(mm.balance + bonus);
          mm.pnl = roundBalance(mm.pnl + bonus);
          game.drawState.mmEarnings = roundBalance(game.drawState.mmEarnings + bonus);
          game.drawState.liquidationCount++;

          io.to(mm.id).emit('mmLiquidationBonus', { nickname: player.nickname, amount: bonus });
          sendPlayerUpdate(io, game, mm.id);
        }
      }
    }
  }

  return liquidated;
}

// ---- Round end ----

function onDrawRoundEnd(roomCode: string, io: SocketServer): void {
  const game = rooms.get(roomCode);
  if (!game || !game.drawState) return;

  // Auto-close all positions
  const result = endRound(game);
  io.to(roomCode).emit('roundEnd', result);
  broadcastLeaderboard(io, game);

  for (const player of game.players) {
    if (player.connected) sendPlayerUpdate(io, game, player.id);
  }

  if (shouldEndGame(game)) {
    setTimeout(() => {
      game.phase = 'finished';
      broadcastState(io, game);
      io.to(game.roomCode).emit('gameFinished', getFinalStats(game));
      scheduleRoomCleanup(game.roomCode, game);
    }, 3000);
    return;
  }

  // After 3 seconds, start bonus phase
  setTimeout(() => {
    drawStartBonusPhase(roomCode, io);
  }, 3000);
}

// ---- Bonus phase (reuse Classic pattern) ----

function drawStartBonusPhase(roomCode: string, io: SocketServer): void {
  const game = rooms.get(roomCode);
  if (!game) return;

  startBonus(game);
  broadcastState(io, game);

  io.to(roomCode).emit('bonusUpdate', {
    timer: game.bonusState!.timer,
    bonusType: game.bonusState!.bonusType,
    results: [],
  });

  const bonusTimer = setInterval(() => {
    if (!game.bonusState) { clearInterval(bonusTimer); timers.delete(roomCode); return; }
    game.bonusState.timer--;

    io.to(roomCode).emit('bonusUpdate', {
      timer: game.bonusState.timer,
      bonusType: game.bonusState.bonusType,
      results: getBonusResults(game),
    });

    if (game.bonusState.timer <= 0) {
      clearInterval(bonusTimer);
      timers.delete(roomCode);
      for (const player of game.players) {
        if (player.connected) sendPlayerUpdate(io, game, player.id);
      }
      broadcastLeaderboard(io, game);

      setTimeout(() => {
        try {
          if (!game.drawState) return;

          if (game.drawState.roundNumber >= DRAW_MAX_ROUNDS || shouldEndGame(game)) {
            game.phase = 'finished';
            broadcastState(io, game);
            broadcastLeaderboard(io, game);
            io.to(roomCode).emit('gameFinished', getFinalStats(game));
            scheduleRoomCleanup(roomCode, game);
          } else {
            drawStartVotingPhase(roomCode, io);
          }
        } catch (err) {
          console.error('[Draw] Failed to start next round:', err);
          game.phase = 'finished';
          broadcastState(io, game);
          scheduleRoomCleanup(roomCode, game);
        }
      }, 2000);
    }
  }, 1000);

  timers.set(roomCode, bonusTimer);
}

// ---- Voting phase ----

function drawStartVotingPhase(roomCode: string, io: SocketServer): void {
  const game = rooms.get(roomCode);
  if (!game || !game.drawState) return;

  startVoting(game);
  broadcastState(io, game);

  const result = getVoteResult(game);
  io.to(roomCode).emit('voteUpdate', {
    yes: result.yes, no: result.no, total: result.total,
    timer: game.voteState?.timer || 0,
  });

  const voteTimer = setInterval(() => {
    if (!game.voteState) { clearInterval(voteTimer); timers.delete(roomCode); return; }
    game.voteState.timer--;

    const voteResult = getVoteResult(game);
    io.to(roomCode).emit('voteUpdate', {
      yes: voteResult.yes, no: voteResult.no, total: voteResult.total,
      timer: game.voteState.timer,
    });

    // Check if all players voted or timer expired
    const allVoted = (voteResult.yes + voteResult.no) >= voteResult.total;
    if (game.voteState.timer <= 0 || allVoted) {
      clearInterval(voteTimer);
      timers.delete(roomCode);

      const finalResult = getVoteResult(game);
      if (finalResult.majority) {
        // Majority voted yes → next round
        setTimeout(() => {
          drawStartRound(roomCode, io);
        }, 1000);
      } else {
        // Majority voted no or tie → finish game
        game.phase = 'finished';
        broadcastState(io, game);
        broadcastLeaderboard(io, game);
        io.to(roomCode).emit('gameFinished', getFinalStats(game));
        scheduleRoomCleanup(roomCode, game);
      }
    }
  }, 1000);

  timers.set(roomCode, voteTimer);
}

// ---- Finish game early ----

function drawFinishGame(io: SocketServer, game: GameState): void {
  clearTimer(game.roomCode);
  const result = endRound(game);
  game.phase = 'finished';
  io.to(game.roomCode).emit('roundEnd', result);
  broadcastState(io, game);
  broadcastLeaderboard(io, game);
  io.to(game.roomCode).emit('gameFinished', getFinalStats(game));
  for (const player of game.players) {
    if (player.connected) sendPlayerUpdate(io, game, player.id);
  }
  scheduleRoomCleanup(game.roomCode, game);
}

// ---- Register draw-specific socket events ----

export function registerDrawEvents(
  socket: GameSocket,
  io: SocketServer<ClientToServerEvents, ServerToClientEvents>,
): void {
  socket.on('submitDrawing', ({ points }) => {
    const roomCode = playerRooms.get(socket.id);
    if (!roomCode) return;
    const game = rooms.get(roomCode);
    if (!game) return;

    // Validate: must be draw game
    if (game.gameMode !== 'draw') {
      socket.emit('error', 'Not a draw mode game');
      return;
    }

    // Validate: must be in drawing phase
    if (game.phase !== 'draw_drawing') {
      socket.emit('error', 'Drawing phase is over');
      return;
    }

    // Validate: must be the market maker
    if (socket.id !== game.marketMakerId) {
      socket.emit('error', 'Only the market maker can draw');
      return;
    }

    // Validate: points array
    if (!Array.isArray(points) || points.length < 2) {
      socket.emit('error', 'Drawing must have at least 2 points');
      return;
    }

    // Validate each point
    for (const p of points) {
      if (typeof p.x !== 'number' || typeof p.y !== 'number' ||
          p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) {
        socket.emit('error', 'Invalid drawing points');
        return;
      }
    }

    // Store drawing and complete early
    pendingDrawings.set(roomCode, points);

    // Clear drawing timer and proceed
    clearTimer(roomCode);
    onDrawingComplete(roomCode, io);
  });
}
