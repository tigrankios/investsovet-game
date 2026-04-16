import { Server as SocketServer } from 'socket.io';
import type { GameState } from '../lib/types';
import {
  endRound, setupNextRound,
  startBonus, getBonusResults,
  assignRandomSkill, getFinalStats,
} from '../lib/engine';
import { classicTickCandle } from '../lib/engine/classic';
import {
  timers,
  broadcastState, broadcastLeaderboard, sendPlayerUpdate,
  clearTimer, shouldEndGame, scheduleRoomCleanup,
} from './shared-state';

// ---- Classic-mode trading loop ----

export function classicStartTrading(io: SocketServer, game: GameState) {
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
        const { continues, liquidated } = classicTickCandle(game);

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
          classicFinishGame(io, game);
          return;
        }

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
            }, 3000);
            return;
          }

          // After 3 seconds, start bonus phase
          setTimeout(() => {
            classicStartBonusPhase(io, game);
          }, 3000);
        }
      }, 1000);

      timers.set(game.roomCode, candleTimer);
    }
  }, 1000);
}

function classicFinishGame(io: SocketServer, game: GameState) {
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
}

function classicStartBonusPhase(io: SocketServer, game: GameState) {
  startBonus(game);
  broadcastState(io, game);

  io.to(game.roomCode).emit('bonusUpdate', {
    timer: game.bonusState!.timer,
    bonusType: game.bonusState!.bonusType,
    results: [],
  });

  const bonusTimer = setInterval(() => {
    if (!game.bonusState) {
      clearInterval(bonusTimer);
      timers.delete(game.roomCode);
      return;
    }
    game.bonusState.timer--;

    io.to(game.roomCode).emit('bonusUpdate', {
      timer: game.bonusState.timer,
      bonusType: game.bonusState.bonusType,
      results: getBonusResults(game),
    });

    if (game.bonusState.timer <= 0) {
      clearInterval(bonusTimer);
      timers.delete(game.roomCode);
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
            scheduleRoomCleanup(game.roomCode, game);
          } else {
            await setupNextRound(game);
            broadcastState(io, game);
            classicStartTrading(io, game);
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

  timers.set(game.roomCode, bonusTimer);
}
