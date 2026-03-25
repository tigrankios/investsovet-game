// ============================================
// InvestSovet — Trading Game Types
// ============================================

// --- Players ---
export interface Player {
  id: string;
  nickname: string;
  balance: number;
  position: Position | null;
  pnl: number; // реализованный PnL за раунд
  connected: boolean;
}

// --- Position ---
export type Leverage = 1 | 5 | 10 | 25 | 50 | 100 | 200 | 500;

export interface Position {
  direction: 'long' | 'short';
  size: number;        // маржа (сумма, вложенная игроком)
  leverage: Leverage;   // плечо
  entryPrice: number;  // цена входа
  openedAt: number;    // индекс свечи
  liquidationPrice: number; // цена ликвидации
}

// --- Candle ---
export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  time: number; // unix timestamp
}

// --- Slot Machine ---
export const SLOT_SYMBOLS = ['₿', 'Ξ', '🐕', '🚀', '💎', '🌕'] as const;
export type SlotSymbol = typeof SLOT_SYMBOLS[number];
export const SLOT_TIMER_SEC = 15;

export interface SlotResult {
  reels: [SlotSymbol, SlotSymbol, SlotSymbol];
  multiplier: number; // 0 = потерял, 1.5, 3, 5, 10
  bet: number;
  winAmount: number; // может быть отрицательным (потеря ставки)
}

// --- Game State ---
export type GamePhase =
  | 'lobby'
  | 'countdown'   // 3-2-1 перед стартом
  | 'trading'     // раунд идёт
  | 'slots'       // слот-машина после раунда
  | 'voting'      // голосование за следующую монету
  | 'finished';   // итоги

export interface VoteState {
  votes: Record<string, boolean>; // playerId -> true=да, false=нет
  timer: number;
}

export interface SlotState {
  played: Record<string, SlotResult>; // playerId -> результат
  timer: number;
}

export interface GameState {
  roomCode: string;
  phase: GamePhase;
  players: Player[];
  ticker: string;
  candles: Candle[];           // все свечи (на сервере)
  visibleCandleCount: number;  // сколько свечей видно сейчас
  currentPrice: number;
  roundDuration: number;       // скрыто от игроков
  elapsed: number;             // сколько секунд прошло
  roundNumber: number;
  voteState: VoteState | null;
  slotState: SlotState | null;
}

// --- Leaderboard entry (для ТВ) ---
export interface LeaderboardEntry {
  nickname: string;
  balance: number;
  pnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  hasPosition: boolean;
  positionDirection: 'long' | 'short' | null;
  positionLeverage: Leverage | null;
}

// --- Socket Events ---
export interface ServerToClientEvents {
  gameState: (state: ClientGameState) => void;
  candleUpdate: (data: { candle: Candle; price: number; index: number }) => void;
  leaderboard: (entries: LeaderboardEntry[]) => void;
  playerJoined: (player: { nickname: string }) => void;
  playerLeft: (nickname: string) => void;
  countdown: (seconds: number) => void;
  roundEnd: (results: RoundResult) => void;
  tradeResult: (data: { success: boolean; message: string }) => void;
  playerUpdate: (player: ClientPlayerState) => void;
  liquidated: (data: { nickname: string; loss: number }) => void;
  voteUpdate: (data: { yes: number; no: number; total: number; timer: number }) => void;
  slotResult: (result: SlotResult) => void;
  slotUpdate: (data: { timer: number; results: { nickname: string; result: SlotResult }[] }) => void;
  error: (message: string) => void;
}

export interface ClientToServerEvents {
  createRoom: () => void;
  joinRoom: (data: { roomCode: string; nickname: string }) => void;
  startGame: () => void;
  openPosition: (data: { direction: 'long' | 'short'; size: number; leverage: Leverage }) => void;
  closePosition: () => void;
  spinSlots: (data: { bet: number }) => void;
  voteNextRound: (data: { vote: boolean }) => void;
}

// --- Client-safe state (без скрытых данных) ---
export interface ClientGameState {
  roomCode: string;
  phase: GamePhase;
  playerCount: number;
  playerNames: string[];
  ticker: string;
  visibleCandles: Candle[];
  currentPrice: number;
  elapsed: number;
  roundNumber: number;
  voteYes: number;
  voteNo: number;
  voteTotal: number;
  voteTimer: number;
  slotTimer: number;
}

export interface ClientPlayerState {
  balance: number;
  position: Position | null;
  pnl: number;
  unrealizedPnl: number;
}

// --- Round Result ---
export interface RoundResult {
  ticker: string;
  duration: number;
  leaderboard: LeaderboardEntry[];
  winner: { nickname: string; totalPnl: number };
  roundNumber: number;
}

// --- Constants ---
export const INITIAL_BALANCE = 10000;
export const MIN_ROUND_DURATION = 30;
export const MAX_ROUND_DURATION = 120;
export const CANDLE_INTERVAL_MS = 1000;
export const VOTE_TIMER_SEC = 15;
export const AVAILABLE_LEVERAGES: Leverage[] = [1, 5, 10, 25, 50, 100, 200, 500];
