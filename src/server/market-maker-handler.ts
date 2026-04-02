import { Server as SocketServer, Socket } from 'socket.io';
import type {
  ClientToServerEvents, ServerToClientEvents, GameState, MMLeverType,
} from '../lib/types';
import {
  tickCandle, endRound, setupNextRound,
  startBonus, getBonusResults,
  assignRandomSkill, getFinalStats,
  assignMarketMaker, useMMLever, getMarketMakerResult,
} from '../lib/engine';
import {
  rooms, playerRooms, timers,
  broadcastState, broadcastLeaderboard, sendPlayerUpdate,
  clearTimer, shouldEndGame, scheduleRoomCleanup,
} from './shared-state';

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// ---- Market Maker mode trading loop ----

export function mmStartTrading(io: SocketServer, game: GameState) {
  // Assign Market Maker on first round
  if (game.roundNumber === 1) {
    assignMarketMaker(game);
  }

  game.phase = 'countdown';
  broadcastState(io, game);

  let count = 3;
  io.to(game.roomCode).emit('countdown', count);

  const countdownTimer = setInterval(() => {
    count--;
    if (count > 0) {
      io.to(game.roomCode).emit('countdown', count);
    } else {
      clearInterval(countdownTimer);

      game.phase = 'trading';
      game.visibleCandleCount = 1;
      game.currentPrice = game.candles[0].close;

      // Assign skills to all players
      for (const player of game.players) {
        if (player.connected) {
          const skill = assignRandomSkill(player);
          io.to(player.id).emit('skillAssigned', skill);
        }
      }

      broadcastState(io, game);
      broadcastLeaderboard(io, game);

      const candleTimer = setInterval(() => {
        const { continues, liquidated } = tickCandle(game);

        const idx = game.visibleCandleCount - 1;
        if (idx < game.candles.length) {
          io.to(game.roomCode).emit('candleUpdate', {
            candle: game.candles[idx],
            price: game.currentPrice,
            index: idx,
          });
        }

        for (const liq of liquidated) {
          io.to(game.roomCode).emit('liquidated', liq);
        }

        for (const player of game.players) {
          if (player.connected) sendPlayerUpdate(io, game, player.id);
        }

        if (liquidated.length > 0 && shouldEndGame(game)) {
          mmFinishGame(io, game);
          return;
        }

        // MM Casino: broadcast state every tick for lever timers
        broadcastState(io, game);

        if (game.elapsed % 2 === 0) broadcastLeaderboard(io, game);

        if (!continues) {
          clearInterval(candleTimer);
          timers.delete(game.roomCode);

          const result = endRound(game);
          io.to(game.roomCode).emit('roundEnd', result);
          broadcastLeaderboard(io, game);

          for (const player of game.players) {
            if (player.connected) sendPlayerUpdate(io, game, player.id);
          }

          if (shouldEndGame(game)) {
            setTimeout(() => {
              game.phase = 'finished';
              broadcastState(io, game);
              io.to(game.roomCode).emit('gameFinished', getFinalStats(game));
              const mmRes = getMarketMakerResult(game);
              if (mmRes) io.to(game.roomCode).emit('marketMakerResult', mmRes);
            }, 3000);
            return;
          }

          // After 3 seconds, start bonus phase
          setTimeout(() => {
            mmStartBonusPhase(io, game);
          }, 3000);
        }
      }, 1000);

      timers.set(game.roomCode, candleTimer);
    }
  }, 1000);
}

function mmFinishGame(io: SocketServer, game: GameState) {
  clearTimer(game.roomCode);
  const result = endRound(game);
  game.phase = 'finished';
  io.to(game.roomCode).emit('roundEnd', result);
  broadcastState(io, game);
  broadcastLeaderboard(io, game);
  io.to(game.roomCode).emit('gameFinished', getFinalStats(game));
  const mmResult = getMarketMakerResult(game);
  if (mmResult) {
    io.to(game.roomCode).emit('marketMakerResult', mmResult);
  }
  for (const player of game.players) {
    if (player.connected) sendPlayerUpdate(io, game, player.id);
  }
}

function mmStartBonusPhase(io: SocketServer, game: GameState) {
  startBonus(game);
  broadcastState(io, game);

  io.to(game.roomCode).emit('bonusUpdate', {
    timer: game.bonusState!.timer,
    bonusType: game.bonusState!.bonusType,
    results: [],
  });

  const bonusTimer = setInterval(() => {
    if (!game.bonusState) { clearInterval(bonusTimer); return; }
    game.bonusState.timer--;

    io.to(game.roomCode).emit('bonusUpdate', {
      timer: game.bonusState.timer,
      bonusType: game.bonusState.bonusType,
      results: getBonusResults(game),
    });

    if (game.bonusState.timer <= 0) {
      clearInterval(bonusTimer);
      for (const player of game.players) {
        if (player.connected) sendPlayerUpdate(io, game, player.id);
      }
      broadcastLeaderboard(io, game);

      setTimeout(async () => {
        try {
          if (game.roundNumber >= 6 || shouldEndGame(game)) {
            game.phase = 'finished';
            broadcastState(io, game);
            broadcastLeaderboard(io, game);
            io.to(game.roomCode).emit('gameFinished', getFinalStats(game));
            const mmResult = getMarketMakerResult(game);
            if (mmResult) {
              io.to(game.roomCode).emit('marketMakerResult', mmResult);
            }
            scheduleRoomCleanup(game.roomCode, game);
          } else {
            await setupNextRound(game);
            broadcastState(io, game);
            mmStartTrading(io, game);
          }
        } catch (err) {
          console.error('[Game] Failed to setup next round:', err);
          game.phase = 'finished';
          broadcastState(io, game);
          scheduleRoomCleanup(game.roomCode, game);
        }
      }, 2000);
    }
  }, 1000);
}

// ---- Register MM-specific socket events ----

export function registerMMEvents(
  socket: GameSocket,
  io: SocketServer<ClientToServerEvents, ServerToClientEvents>,
) {
  socket.on('useMMLever', ({ lever }) => {
    if (!['commission', 'freeze', 'squeeze'].includes(lever)) {
      socket.emit('error', 'Invalid lever');
      return;
    }
    const roomCode = playerRooms.get(socket.id);
    if (!roomCode) return;
    const game = rooms.get(roomCode);
    if (!game) return;

    const result = useMMLever(game, socket.id, lever as MMLeverType);
    if (result.success) {
      io.to(roomCode).emit('mmLeverUsed', { lever: lever as MMLeverType, duration: result.duration! });
      broadcastState(io, game);
    } else {
      socket.emit('error', result.message);
    }
  });
}
