import { Server as SocketServer, Socket } from 'socket.io';
import type {
  ClientToServerEvents, ServerToClientEvents, GameState, ClientGameState, Leverage,
  MMLeverType,
} from '../lib/types';
import { AVAILABLE_LEVERAGES, TRADER_INACTIVITY_THRESHOLD_SEC } from '../lib/types';
import {
  createGame, addPlayer, removePlayer, getPlayer,
  tickCandle, openPosition, closePosition, getLeaderboard, endRound,
  getUnrealizedPnl, startVoting, castVote, getVoteResult, setupNextRound,
  startBonus, spinSlots, spinWheel, openLootbox, playLoto, getBonusResults,
  assignRandomSkill, useSkill, getFinalStats,
  assignMarketMaker, useMMLever, getMarketMakerResult,
} from '../lib/game-engine';

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const rooms = new Map<string, GameState>();
const playerRooms = new Map<string, string>(); // socketId -> roomCode
const playerNicknames = new Map<string, string>(); // socketId -> nickname (для reconnect)
const timers = new Map<string, NodeJS.Timeout>();

function getClientGameState(game: GameState): ClientGameState {
  const voteResult = getVoteResult(game);
  const mm = game.marketMakerId ? game.players.find((p) => p.id === game.marketMakerId) : null;
  return {
    roomCode: game.roomCode,
    phase: game.phase,
    playerCount: game.players.filter((p) => p.connected).length,
    playerNames: game.players.filter((p) => p.connected).map((p) => p.nickname),
    ticker: game.ticker,
    visibleCandles: game.candles.slice(0, game.visibleCandleCount),
    currentPrice: game.currentPrice,
    elapsed: game.elapsed,
    roundNumber: game.roundNumber,
    voteYes: voteResult.yes,
    voteNo: voteResult.no,
    voteTotal: voteResult.total,
    voteTimer: game.voteState?.timer || 0,
    bonusTimer: game.bonusState?.timer || 0,
    bonusType: game.bonusState?.bonusType || null,
    availableLeverages: game.availableLeverages,
    gameMode: game.gameMode,
    marketMakerNickname: mm?.nickname || null,
    mmLevers: game.mmCasino?.levers || null,
    mmBalance: game.marketMakerId
      ? Math.round((game.players.find((p) => p.id === game.marketMakerId)?.balance || 0) * 100) / 100
      : 0,
    blindActive: game.players.some((p) => p.blindTicksLeft > 0),
  };
}

function broadcastState(io: SocketServer, game: GameState) {
  io.to(game.roomCode).emit('gameState', getClientGameState(game));
}

function broadcastLeaderboard(io: SocketServer, game: GameState) {
  io.to(game.roomCode).emit('leaderboard', getLeaderboard(game));
}

function sendPlayerUpdate(io: SocketServer, game: GameState, playerId: string) {
  const player = getPlayer(game, playerId);
  if (!player) return;
  io.to(playerId).emit('playerUpdate', {
    balance: Math.round(player.balance * 100) / 100,
    position: player.position,
    pnl: Math.round(player.pnl * 100) / 100,
    unrealizedPnl: Math.round(getUnrealizedPnl(player, game.currentPrice) * 100) / 100,
    skill: player.skill,
    skillUsed: player.skillUsed,
    shieldActive: player.shieldActive,
    frozen: !!player.frozenBy,
    blindTicksLeft: player.blindTicksLeft,
    role: player.role,
    rentDrain: game.mmCasino
      ? (() => {
          const lastOpen = game.mmCasino.traderLastOpenTime[playerId] ?? 0;
          const isInactive = (game.elapsed - lastOpen) >= TRADER_INACTIVITY_THRESHOLD_SEC;
          return isInactive ? 200 : 100;
        })()
      : 0,
    isFreezed: !!(game.mmCasino?.levers.freeze.active && player.role === 'trader'),
  });
}

function clearTimer(roomCode: string) {
  const timer = timers.get(roomCode);
  if (timer) {
    clearInterval(timer);
    timers.delete(roomCode);
  }
}

function scheduleRoomCleanup(roomCode: string, game: GameState) {
  setTimeout(() => {
    rooms.delete(roomCode);
    for (const player of game.players) {
      playerRooms.delete(player.id);
      playerNicknames.delete(player.id);
    }
    clearTimer(roomCode);
    console.log(`[WS] Room ${roomCode} cleaned up (finished game)`);
  }, 5 * 60 * 1000);
}

function startTrading(io: SocketServer, game: GameState) {
  // Assign Market Maker on first round
  if (game.gameMode === 'market_maker' && game.roundNumber === 1) {
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

      // Раздать скиллы всем игрокам
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

        // Ликвидации
        for (const liq of liquidated) {
          io.to(game.roomCode).emit('liquidated', liq);
        }

        // Обновить PnL каждого игрока
        for (const player of game.players) {
          if (player.connected) sendPlayerUpdate(io, game, player.id);
        }

        // MM Casino: broadcast state every tick for lever timers
        if (game.gameMode === 'market_maker') {
          broadcastState(io, game);
        }

        if (game.elapsed % 2 === 0) broadcastLeaderboard(io, game);

        if (!continues) {
          clearInterval(candleTimer);
          timers.delete(game.roomCode);

          const result = endRound(game);
          io.to(game.roomCode).emit('roundEnd', result);
          broadcastLeaderboard(io, game);

          // Обновить балансы после закрытия позиций
          for (const player of game.players) {
            if (player.connected) sendPlayerUpdate(io, game, player.id);
          }

          // Через 3 секунды — бонусная мини-игра
          setTimeout(() => {
            startBonusPhase(io, game);
          }, 3000);
        }
      }, 1000);

      timers.set(game.roomCode, candleTimer);
    }
  }, 1000);
}

function startBonusPhase(io: SocketServer, game: GameState) {
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
      // Обновить балансы после бонуса
      for (const player of game.players) {
        if (player.connected) sendPlayerUpdate(io, game, player.id);
      }
      broadcastLeaderboard(io, game);

      // Через 2 секунды — новый раунд или конец игры
      setTimeout(async () => {
        try {
          if (game.roundNumber >= 6) {
            game.phase = 'finished';
            broadcastState(io, game);
            broadcastLeaderboard(io, game);
            io.to(game.roomCode).emit('gameFinished', getFinalStats(game));
            // Market Maker result
            const mmResult = getMarketMakerResult(game);
            if (mmResult) {
              io.to(game.roomCode).emit('marketMakerResult', mmResult);
            }
            // Schedule room cleanup after 5 minutes
            scheduleRoomCleanup(game.roomCode, game);
          } else {
            await setupNextRound(game);
            broadcastState(io, game);
            startTrading(io, game);
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

function startVotingPhase(io: SocketServer, game: GameState) {
  startVoting(game);
  broadcastState(io, game);

  const voteResult = getVoteResult(game);
  io.to(game.roomCode).emit('voteUpdate', {
    yes: voteResult.yes,
    no: voteResult.no,
    total: voteResult.total,
    timer: game.voteState!.timer,
  });

  const voteTimer = setInterval(() => {
    if (!game.voteState) { clearInterval(voteTimer); return; }
    game.voteState.timer--;

    const result = getVoteResult(game);
    io.to(game.roomCode).emit('voteUpdate', {
      yes: result.yes, no: result.no, total: result.total,
      timer: game.voteState.timer,
    });

    if (game.voteState.timer <= 0) {
      clearInterval(voteTimer);
      resolveVote(io, game);
    }
  }, 1000);
}

async function resolveVote(io: SocketServer, game: GameState) {
  try {
    const result = getVoteResult(game);
    if (result.majority) {
      // Большинство за — новый раунд
      await setupNextRound(game);
      broadcastState(io, game);
      startTrading(io, game);
    } else {
      // Большинство против — игра окончена
      game.phase = 'finished';
      game.voteState = null;
      broadcastState(io, game);
      broadcastLeaderboard(io, game);
      scheduleRoomCleanup(game.roomCode, game);
    }
  } catch (err) {
    console.error('[Game] Failed to resolve vote:', err);
    game.phase = 'finished';
    broadcastState(io, game);
    scheduleRoomCleanup(game.roomCode, game);
  }
}

export function setupSocketHandlers(io: SocketServer<ClientToServerEvents, ServerToClientEvents>) {
  io.on('connection', (socket: GameSocket) => {
    console.log(`[WS] Connected: ${socket.id}`);

    socket.on('createRoom', async ({ gameMode }) => {
      const game = await createGame(gameMode);
      rooms.set(game.roomCode, game);
      socket.join(game.roomCode);
      playerRooms.set(socket.id, game.roomCode);
      console.log(`[WS] Room created: ${game.roomCode} (${game.ticker}, ${game.roundDuration}s, ${game.candles.length} candles)`);
      broadcastState(io, game);
    });

    socket.on('joinRoom', ({ roomCode, nickname }) => {
      if (typeof roomCode !== 'string' || roomCode.trim().length === 0) {
        socket.emit('error', 'Invalid room code');
        return;
      }
      if (typeof nickname !== 'string' || nickname.trim().length === 0 || nickname.trim().length > 30) {
        socket.emit('error', 'Nickname must be 1-30 characters');
        return;
      }
      nickname = nickname.trim();

      const game = rooms.get(roomCode);
      if (!game) {
        socket.emit('error', 'Комната не найдена');
        return;
      }

      // Reconnect — если игрок с таким ником уже есть
      const existing = game.players.find((p) => p.nickname === nickname);
      if (existing) {
        // Обновить ID сокета
        const oldId = existing.id;
        existing.id = socket.id;
        existing.connected = true;
        playerRooms.delete(oldId);
        playerRooms.set(socket.id, roomCode);
        playerNicknames.set(socket.id, nickname);
        socket.join(roomCode);
        broadcastState(io, game);
        sendPlayerUpdate(io, game, socket.id);
        console.log(`[WS] ${nickname} reconnected to ${roomCode}`);
        return;
      }

      if (game.phase !== 'lobby') {
        socket.emit('error', 'Игра уже началась');
        return;
      }

      const player = addPlayer(game, socket.id, nickname);
      socket.join(roomCode);
      playerRooms.set(socket.id, roomCode);
      playerNicknames.set(socket.id, nickname);
      io.to(roomCode).emit('playerJoined', { nickname: player.nickname });
      broadcastState(io, game);
      sendPlayerUpdate(io, game, socket.id);
      console.log(`[WS] ${nickname} joined ${roomCode}`);
    });

    socket.on('startGame', () => {
      const roomCode = playerRooms.get(socket.id);
      if (!roomCode) return;
      const game = rooms.get(roomCode);
      if (!game || game.phase !== 'lobby') return;
      if (game.players.filter((p) => p.connected).length < 1) {
        socket.emit('error', 'Нужен хотя бы 1 игрок');
        return;
      }
      console.log(`[WS] Game starting in ${roomCode}`);
      startTrading(io, game);
    });

    socket.on('openPosition', ({ direction, size, leverage }) => {
      if (direction !== 'long' && direction !== 'short') {
        socket.emit('error', 'Invalid direction');
        return;
      }
      if (typeof size !== 'number' || size <= 0 || !isFinite(size)) {
        socket.emit('error', 'Invalid position size');
        return;
      }
      if (!AVAILABLE_LEVERAGES.includes(leverage as Leverage)) {
        socket.emit('error', 'Invalid leverage');
        return;
      }

      const roomCode = playerRooms.get(socket.id);
      if (!roomCode) return;
      const game = rooms.get(roomCode);
      if (!game) return;

      const result = openPosition(game, socket.id, direction, size, leverage);
      socket.emit('tradeResult', result);
      sendPlayerUpdate(io, game, socket.id);
      broadcastLeaderboard(io, game);
    });

    socket.on('closePosition', () => {
      const roomCode = playerRooms.get(socket.id);
      if (!roomCode) return;
      const game = rooms.get(roomCode);
      if (!game) return;

      const result = closePosition(game, socket.id);
      socket.emit('tradeResult', { success: result.success, message: result.message });
      sendPlayerUpdate(io, game, socket.id);
      broadcastLeaderboard(io, game);
    });

    socket.on('useSkill', () => {
      const roomCode = playerRooms.get(socket.id);
      if (!roomCode) return;
      const game = rooms.get(roomCode);
      if (!game) return;

      const result = useSkill(game, socket.id);
      if (result.success) {
        socket.emit('tradeResult', result);
        sendPlayerUpdate(io, game, socket.id);
        if (result.skill) {
          const player = getPlayer(game, socket.id);
          if (player) {
            io.to(roomCode).emit('skillUsed', { nickname: player.nickname, skill: result.skill });
          }
        }
        // Inverse affects all players — broadcast state
        if (result.affectsAll) {
          broadcastState(io, game);
          for (const p of game.players) {
            if (p.connected) sendPlayerUpdate(io, game, p.id);
          }
        }
        broadcastLeaderboard(io, game);
      } else {
        socket.emit('error', result.message);
      }
    });

    socket.on('spinSlots', ({ bet }) => {
      if (typeof bet !== 'number' || bet <= 0 || !isFinite(bet)) {
        socket.emit('error', 'Invalid bet amount');
        return;
      }
      const roomCode = playerRooms.get(socket.id);
      if (!roomCode) return;
      const game = rooms.get(roomCode);
      if (!game || game.phase !== 'bonus') return;

      const result = spinSlots(game, socket.id, bet);
      if (result.success && result.result) {
        socket.emit('bonusResult', result.result);
        sendPlayerUpdate(io, game, socket.id);
        broadcastLeaderboard(io, game);
        io.to(roomCode).emit('bonusUpdate', {
          timer: game.bonusState?.timer || 0,
          bonusType: game.bonusState?.bonusType || 'slots',
          results: getBonusResults(game),
        });
      } else {
        socket.emit('error', result.message);
      }
    });

    socket.on('spinWheel', ({ bet }) => {
      if (typeof bet !== 'number' || bet <= 0 || !isFinite(bet)) {
        socket.emit('error', 'Invalid bet amount');
        return;
      }
      const roomCode = playerRooms.get(socket.id);
      if (!roomCode) return;
      const game = rooms.get(roomCode);
      if (!game || game.phase !== 'bonus') return;

      const result = spinWheel(game, socket.id, bet);
      if (result.success && result.result) {
        socket.emit('bonusResult', result.result);
        sendPlayerUpdate(io, game, socket.id);
        broadcastLeaderboard(io, game);
        io.to(roomCode).emit('bonusUpdate', {
          timer: game.bonusState?.timer || 0,
          bonusType: game.bonusState?.bonusType || 'wheel',
          results: getBonusResults(game),
        });
      } else {
        socket.emit('error', result.message);
      }
    });

    socket.on('openLootbox', ({ bet, chosenIndex }) => {
      if (typeof bet !== 'number' || bet <= 0 || !isFinite(bet)) {
        socket.emit('error', 'Invalid bet amount');
        return;
      }
      if (typeof chosenIndex !== 'number' || chosenIndex < 0 || chosenIndex > 3 || !Number.isInteger(chosenIndex)) {
        socket.emit('error', 'Invalid lootbox choice (must be 0-3)');
        return;
      }
      const roomCode = playerRooms.get(socket.id);
      if (!roomCode) return;
      const game = rooms.get(roomCode);
      if (!game || game.phase !== 'bonus') return;

      const result = openLootbox(game, socket.id, bet, chosenIndex);
      if (result.success && result.result) {
        socket.emit('bonusResult', result.result);
        sendPlayerUpdate(io, game, socket.id);
        broadcastLeaderboard(io, game);
        io.to(roomCode).emit('bonusUpdate', {
          timer: game.bonusState?.timer || 0,
          bonusType: game.bonusState?.bonusType || 'lootbox',
          results: getBonusResults(game),
        });
      } else {
        socket.emit('error', result.message);
      }
    });

    socket.on('playLoto', ({ bet, numbers }) => {
      if (typeof bet !== 'number' || bet <= 0 || !isFinite(bet)) {
        socket.emit('error', 'Invalid bet amount');
        return;
      }
      if (!Array.isArray(numbers) || numbers.some((n) => typeof n !== 'number' || !isFinite(n))) {
        socket.emit('error', 'Invalid loto numbers');
        return;
      }
      const roomCode = playerRooms.get(socket.id);
      if (!roomCode) return;
      const game = rooms.get(roomCode);
      if (!game || game.phase !== 'bonus') return;

      const result = playLoto(game, socket.id, bet, numbers);
      if (result.success && result.result) {
        socket.emit('bonusResult', result.result);
        sendPlayerUpdate(io, game, socket.id);
        broadcastLeaderboard(io, game);
        io.to(roomCode).emit('bonusUpdate', {
          timer: game.bonusState?.timer || 0,
          bonusType: game.bonusState?.bonusType || 'loto',
          results: getBonusResults(game),
        });
      } else {
        socket.emit('error', result.message);
      }
    });

    socket.on('voteNextRound', ({ vote }) => {
      const roomCode = playerRooms.get(socket.id);
      if (!roomCode) return;
      const game = rooms.get(roomCode);
      if (!game || game.phase !== 'voting') return;

      castVote(game, socket.id, vote);
      const result = getVoteResult(game);
      io.to(roomCode).emit('voteUpdate', {
        yes: result.yes, no: result.no, total: result.total,
        timer: game.voteState?.timer || 0,
      });
    });

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

    socket.on('disconnect', () => {
      const roomCode = playerRooms.get(socket.id);
      if (roomCode) {
        const game = rooms.get(roomCode);
        if (game) {
          removePlayer(game, socket.id);
          const nick = playerNicknames.get(socket.id);
          if (nick) io.to(roomCode).emit('playerLeft', nick);
          broadcastState(io, game);

          // Не удаляем комнату сразу — дадим шанс на реконнект
          setTimeout(() => {
            if (game.players.every((p) => !p.connected)) {
              clearTimer(roomCode);
              rooms.delete(roomCode);
              console.log(`[WS] Room ${roomCode} deleted (empty)`);
            }
          }, 30000);
        }
        playerRooms.delete(socket.id);
      }
      console.log(`[WS] Disconnected: ${socket.id}`);
    });
  });
}
