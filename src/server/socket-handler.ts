import { Server as SocketServer, Socket } from 'socket.io';
import type {
  ClientToServerEvents, ServerToClientEvents, Leverage,
} from '../lib/types';
import { AVAILABLE_LEVERAGES } from '../lib/types';
import {
  createGame, addPlayer, removePlayer, getPlayer,
  getVoteResult, resetToLobby,
  spinSlots, spinWheel, openLootbox, playLoto, getBonusResults,
  useSkill, castVote,
} from '../lib/engine';
import { classicOpenPosition, classicClosePosition } from '../lib/engine/classic';
import { mmOpenPosition, mmClosePosition } from '../lib/engine/market-maker';
import {
  rooms, playerRooms, playerNicknames, timers,
  broadcastState, broadcastLeaderboard, sendPlayerUpdate,
  clearTimer, shouldEndGame,
  closeRoomNow, startLobbyInactivityTimer, cancelLobbyInactivityTimer,
} from './shared-state';
import { classicStartTrading } from './classic-handler';
import { mmStartTrading, registerMMEvents } from './market-maker-handler';
import { binaryStartRound, registerBinaryEvents } from './binary-handler';
import { drawStartRound, registerDrawEvents } from './draw-handler';

// Re-export shared state and helpers for backward compatibility
export {
  rooms, playerRooms, playerNicknames, timers,
  broadcastState, broadcastLeaderboard, sendPlayerUpdate,
  clearTimer, shouldEndGame,
  closeRoomNow, startLobbyInactivityTimer, cancelLobbyInactivityTimer,
} from './shared-state';

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// ---- Main setup ----

export function setupSocketHandlers(io: SocketServer<ClientToServerEvents, ServerToClientEvents>) {
  io.on('connection', (socket: GameSocket) => {
    console.log(`[WS] Connected: ${socket.id}`);

    // --- Room management ---

    socket.on('createRoom', async ({ gameMode }) => {
      const game = await createGame(gameMode);
      game.hostId = socket.id;
      rooms.set(game.roomCode, game);
      socket.join(game.roomCode);
      playerRooms.set(socket.id, game.roomCode);
      console.log(`[WS] Room created: ${game.roomCode} (${game.ticker}, ${game.roundDuration}s, ${game.candles.length} candles)`);
      broadcastState(io, game);
      startLobbyInactivityTimer(game.roomCode, io);
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

      // Reconnect
      const existing = game.players.find((p) => p.nickname === nickname);
      if (existing) {
        const oldId = existing.id;
        existing.id = socket.id;
        existing.connected = true;
        if (game.hostId === oldId) {
          game.hostId = socket.id;
        }
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

    // --- Host validation helper ---

    function isHost() {
      const roomCode = playerRooms.get(socket.id);
      if (!roomCode) return null;
      const game = rooms.get(roomCode);
      if (!game) return null;
      if (game.hostId !== socket.id) {
        socket.emit('error', 'Only the host can do this');
        return null;
      }
      return { game, roomCode };
    }

    // --- Start game (delegates to mode-specific handler) ---

    socket.on('startGame', () => {
      const ctx = isHost();
      if (!ctx) return;
      const { game, roomCode } = ctx;
      if (game.phase !== 'lobby') return;
      if (game.players.filter((p) => p.connected).length < 1) {
        socket.emit('error', 'Нужен хотя бы 1 игрок');
        return;
      }
      cancelLobbyInactivityTimer(roomCode);
      console.log(`[WS] Game starting in ${roomCode} (mode: ${game.gameMode})`);
      if (game.gameMode === 'binary') {
        binaryStartRound(roomCode, io);
      } else if (game.gameMode === 'market_maker') {
        mmStartTrading(io, game);
      } else if (game.gameMode === 'draw') {
        drawStartRound(roomCode, io);
      } else {
        classicStartTrading(io, game);
      }
    });

    // --- Persistent lobby events ---

    socket.on('selectGameMode', ({ gameMode }) => {
      const ctx = isHost();
      if (!ctx) return;
      const { game } = ctx;
      if (game.phase !== 'lobby') {
        socket.emit('error', 'Can only change mode in lobby');
        return;
      }
      game.gameMode = gameMode;
      broadcastState(io, game);
      console.log(`[WS] Mode changed to ${gameMode} in ${game.roomCode}`);
    });

    socket.on('returnToLobby', () => {
      const ctx = isHost();
      if (!ctx) return;
      const { game, roomCode } = ctx;
      if (game.phase !== 'finished') {
        socket.emit('error', 'Game must be finished first');
        return;
      }
      clearTimer(roomCode);
      resetToLobby(game);
      broadcastState(io, game);
      for (const player of game.players) {
        if (player.connected) {
          sendPlayerUpdate(io, game, player.id);
        }
      }
      startLobbyInactivityTimer(roomCode, io);
      console.log(`[WS] Room ${roomCode} returned to lobby`);
    });

    socket.on('closeRoom', () => {
      const ctx = isHost();
      if (!ctx) return;
      closeRoomNow(ctx.roomCode, io);
    });

    // --- Trading events (shared across modes) ---

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

      // Draw mode: MM cannot trade
      if (game.gameMode === 'draw' && socket.id === game.marketMakerId) {
        socket.emit('tradeResult', { success: false, message: 'ММ не может торговать в Draw режиме' });
        return;
      }

      const result = game.gameMode === 'market_maker'
        ? mmOpenPosition(game, socket.id, direction, size, leverage)
        : classicOpenPosition(game, socket.id, direction, size, leverage);
      socket.emit('tradeResult', result);
      sendPlayerUpdate(io, game, socket.id);
      broadcastLeaderboard(io, game);
    });

    socket.on('closePosition', () => {
      const roomCode = playerRooms.get(socket.id);
      if (!roomCode) return;
      const game = rooms.get(roomCode);
      if (!game) return;

      const result = game.gameMode === 'market_maker'
        ? mmClosePosition(game, socket.id)
        : classicClosePosition(game, socket.id);
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

    // --- Bonus events (shared across modes) ---

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

    // --- Vote events ---

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

    // --- Mode-specific events ---

    registerMMEvents(socket, io);
    registerBinaryEvents(socket, io);
    registerDrawEvents(socket, io);

    // --- Disconnect ---

    socket.on('disconnect', () => {
      const roomCode = playerRooms.get(socket.id);
      if (roomCode) {
        const game = rooms.get(roomCode);
        if (game) {
          removePlayer(game, socket.id);
          const nick = playerNicknames.get(socket.id);
          if (nick) io.to(roomCode).emit('playerLeft', nick);
          broadcastState(io, game);

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
