import { Server as SocketServer } from 'socket.io';
import type { GameState, ClientGameState } from '../lib/types';
import { TRADER_INACTIVITY_THRESHOLD_SEC } from '../lib/types';
import { getPlayer, getLeaderboard, getUnrealizedPnl, getVoteResult } from '../lib/engine';

// ---- Shared state (used by all handlers) ----

export const rooms = new Map<string, GameState>();
export const playerRooms = new Map<string, string>(); // socketId -> roomCode
export const playerNicknames = new Map<string, string>(); // socketId -> nickname
export const timers = new Map<string, NodeJS.Timeout>();

// ---- Shared helpers ----

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
    // Binary Options mode
    binaryRound: game.binaryState?.roundNumber ?? null,
    binaryEntryPrice: game.binaryState?.entryPrice ?? null,
    binaryUpPool: game.binaryState?.upPool ?? 0,
    binaryDownPool: game.binaryState?.downPool ?? 0,
    binaryRevealedCount: game.binaryState?.revealedCount ?? 0,
  };
}

export function broadcastState(io: SocketServer, game: GameState) {
  io.to(game.roomCode).emit('gameState', getClientGameState(game));
}

export function broadcastLeaderboard(io: SocketServer, game: GameState) {
  io.to(game.roomCode).emit('leaderboard', getLeaderboard(game));
}

export function sendPlayerUpdate(io: SocketServer, game: GameState, playerId: string) {
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

export function shouldEndGame(game: GameState): boolean {
  const playersWithBalance = game.players.filter((p) => p.connected && p.balance > 0);
  return playersWithBalance.length <= 1;
}

export function clearTimer(roomCode: string) {
  const timer = timers.get(roomCode);
  if (timer) {
    clearInterval(timer);
    timers.delete(roomCode);
  }
}

// --- Persistent Lobby ---

export const lobbyTimers = new Map<string, NodeJS.Timeout>();
const LOBBY_INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes

export function closeRoomNow(roomCode: string, io: SocketServer, message = 'Комната закрыта') {
  const game = rooms.get(roomCode);
  if (!game) return;

  io.to(roomCode).emit('roomClosed', { message });
  clearTimer(roomCode);
  const lobbyTimer = lobbyTimers.get(roomCode);
  if (lobbyTimer) {
    clearTimeout(lobbyTimer);
    lobbyTimers.delete(roomCode);
  }
  rooms.delete(roomCode);
  for (const player of game.players) {
    playerRooms.delete(player.id);
    playerNicknames.delete(player.id);
  }
  console.log(`[WS] Room ${roomCode} closed: ${message}`);
}

export function startLobbyInactivityTimer(roomCode: string, io: SocketServer) {
  const existing = lobbyTimers.get(roomCode);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    lobbyTimers.delete(roomCode);
    closeRoomNow(roomCode, io, 'Комната закрыта (неактивность)');
  }, LOBBY_INACTIVITY_MS);

  lobbyTimers.set(roomCode, timer);
}

export function cancelLobbyInactivityTimer(roomCode: string) {
  const timer = lobbyTimers.get(roomCode);
  if (timer) {
    clearTimeout(timer);
    lobbyTimers.delete(roomCode);
  }
}
