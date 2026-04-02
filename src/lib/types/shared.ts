// ============================================
// InvestSovet — Shared Types & Constants
// ============================================

import type { SkillType } from './classic';
import type { MMLeverType, MMLeverState, MMCasinoState } from './market-maker';
import type { BinaryRoundStateServer, BinaryRoundState, BinaryRevealedBets, BinaryRoundResult, BinaryDirection } from './binary';

// --- Game Modes ---
export type GameMode = 'classic' | 'market_maker' | 'binary';
export type PlayerRole = 'trader' | 'market_maker';

// --- Candle ---
export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  time: number; // unix timestamp
}

// --- Position ---
export type Leverage = 25 | 50 | 100 | 200 | 500;

export interface Position {
  direction: 'long' | 'short';
  size: number;        // маржа (сумма, вложенная игроком)
  leverage: Leverage;   // плечо
  entryPrice: number;  // цена входа
  openedAt: number;    // индекс свечи
  liquidationPrice: number; // цена ликвидации
}

// --- Bonus Phase (rotating mini-games) ---
export type BonusType = 'wheel' | 'slots' | 'lootbox' | 'loto';
export const BONUS_TIMER_SEC = 15;

// --- Slot Machine ---
export const SLOT_SYMBOLS = ['₿', 'Ξ', '🐕', '🚀', '💎', '🌕'] as const;
export type SlotSymbol = typeof SLOT_SYMBOLS[number];
export interface SlotResult {
  reels: [SlotSymbol, SlotSymbol, SlotSymbol];
  multiplier: number; // 0 = потерял, 1.5, 3, 5, 10
  bet: number;
  winAmount: number; // может быть отрицательным (потеря ставки)
}

// --- Wheel ---
export interface WheelSector {
  multiplier: number;
  label: string;
  weight: number;
}

export const WHEEL_SECTORS: WheelSector[] = [
  { multiplier: 0,    label: 'BUST',     weight: 3 },
  { multiplier: 0.5,  label: 'x0.5',     weight: 2 },
  { multiplier: 1.5,  label: 'x1.5',     weight: 3 },
  { multiplier: 2,    label: 'x2',       weight: 3 },
  { multiplier: 3,    label: 'x3',       weight: 2 },
  { multiplier: 5,    label: 'x5',       weight: 2 },
  { multiplier: 10,   label: 'x10',      weight: 0.8 },
  { multiplier: 25,   label: 'x25 JACKPOT', weight: 0.2 },
];

// --- Lootbox ---
export const LOOTBOX_POOL = [
  { multiplier: 0,   weight: 3 },
  { multiplier: 0.5, weight: 2 },
  { multiplier: 1.5, weight: 3 },
  { multiplier: 2,   weight: 3 },
  { multiplier: 3,   weight: 2 },
  { multiplier: 5,   weight: 1.5 },
  { multiplier: 10,  weight: 0.8 },
  { multiplier: 50,  weight: 0.2 },
];

export interface WheelResult {
  sectorIndex: number;
  multiplier: number;
  bet: number;
  winAmount: number;
}

export interface LootboxResult {
  boxes: number[];
  chosenIndex: number;
  multiplier: number;
  bet: number;
  winAmount: number;
}

// --- Loto ---
export const LOTO_NUMBERS_TOTAL = 20;
export const LOTO_PICK_COUNT = 5;
export const LOTO_DRAW_COUNT = 5;

export const LOTO_PAYOUTS: Record<number, number> = {
  0: 0,
  1: 1,
  2: 1.5,
  3: 3,
  4: 10,
  5: 50,
};

export interface LotoResult {
  playerNumbers: number[];
  drawnNumbers: number[];
  matches: number;
  multiplier: number;
  bet: number;
  winAmount: number;
}

export type BonusResult =
  | { type: 'slots'; result: SlotResult }
  | { type: 'wheel'; result: WheelResult }
  | { type: 'lootbox'; result: LootboxResult }
  | { type: 'loto'; result: LotoResult };

export interface BonusState {
  bonusType: BonusType;
  played: Record<string, BonusResult>;
  timer: number;
}

// --- Constants ---
export const INITIAL_BALANCE = 10000;
export const MIN_ROUND_DURATION = 30;
export const MAX_ROUND_DURATION = 120;
export const CANDLE_INTERVAL_MS = 1000;
export const VOTE_TIMER_SEC = 15;
export const AVAILABLE_LEVERAGES: Leverage[] = [25, 50, 100, 200, 500];

// --- Game State ---
export type GamePhase =
  | 'lobby'
  | 'countdown'        // 3-2-1 перед стартом
  | 'trading'          // раунд идёт
  | 'bonus'            // бонусная мини-игра после раунда
  | 'voting'           // голосование за следующую монету
  | 'binary_betting'   // binary: делаем ставки UP/DOWN
  | 'binary_reveal'    // binary: ставки раскрыты
  | 'binary_waiting'   // binary: свечи раскрываются
  | 'binary_result'    // binary: результат раунда
  | 'finished';        // итоги

export interface VoteState {
  votes: Record<string, boolean>; // playerId -> true=да, false=нет
  timer: number;
}

// --- Players ---
export interface Player {
  id: string;
  nickname: string;
  balance: number;
  position: Position | null;
  pnl: number; // реализованный PnL за раунд
  connected: boolean;
  role: PlayerRole;
  skill: SkillType | null;       // текущий скилл (выдаётся в начале раунда)
  skillUsed: boolean;            // использован ли скилл
  // Активные эффекты
  pnlMultiplier: number;         // множитель PnL (trump_tweet: 3, обычно 1)
  shieldActive: boolean;         // защита от ликвидации
  frozenBy: string | null;       // id игрока, который заморозил (null = не заморожен)
  freezeTicksLeft: number;       // сколько тиков осталось заморозки (заблокирован)
  blindTicksLeft: number;        // сколько тиков слепого трейда осталось
  // Статистика за всю игру
  maxBalance: number;            // максимальный баланс за игру
  worstTrade: number;            // наибольший убыток за одну сделку (отрицательное число)
  totalTrades: number;           // количество сделок
  liquidations: number;          // количество ликвидаций
  bestTrade: number;             // лучшая сделка (максимальный профит)
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
  bonusState: BonusState | null;
  lastAggressorId: string | null;
  availableLeverages: Leverage[];
  // Market Maker mode
  gameMode: GameMode;
  marketMakerId: string | null;
  mmCasino: MMCasinoState | null;
  mmNextCandleModifier: number;
  // Binary Options mode
  binaryState: BinaryRoundStateServer | null;
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
  positionOpenedAt: number | null;
  positionEntryPrice: number | null;
  positionSize: number | null;
  liquidationPrice: number | null;
  role: PlayerRole;
}

export interface FinalPlayerStats {
  nickname: string;
  rank: number;
  balance: number;
  maxBalance: number;
  role: PlayerRole;
  worstTrade: number;
  bestTrade: number;
  totalTrades: number;
  liquidations: number;
}

// --- Round Result ---
export interface RoundResult {
  ticker: string;
  duration: number;
  leaderboard: LeaderboardEntry[];
  winner: { nickname: string; totalPnl: number };
  roundNumber: number;
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
  bonusTimer: number;
  bonusType: BonusType | null;
  availableLeverages: Leverage[];
  // Market Maker mode
  gameMode: GameMode;
  marketMakerNickname: string | null;
  mmLevers: MMLeverState | null;
  mmBalance: number;
  blindActive: boolean;
  // Binary Options mode
  binaryRound: number | null;
  binaryEntryPrice: number | null;
  binaryUpPool: number;
  binaryDownPool: number;
  binaryRevealedCount: number;
}

export interface ClientPlayerState {
  balance: number;
  position: Position | null;
  pnl: number;
  unrealizedPnl: number;
  skill: SkillType | null;
  skillUsed: boolean;
  shieldActive: boolean;
  frozen: boolean;
  blindTicksLeft: number;
  role: PlayerRole;
  rentDrain: number;
  isFreezed: boolean;
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
  gameFinished: (stats: FinalPlayerStats[]) => void;
  skillAssigned: (skill: SkillType) => void;
  skillUsed: (data: { nickname: string; skill: SkillType }) => void;
  inversed: (data: { nickname: string; ticksLeft: number }) => void;
  voteUpdate: (data: { yes: number; no: number; total: number; timer: number }) => void;
  bonusResult: (result: BonusResult) => void;
  bonusUpdate: (data: { timer: number; bonusType: BonusType; results: { nickname: string; result: BonusResult }[] }) => void;
  mmLeverUsed: (data: { lever: MMLeverType; duration: number }) => void;
  mmPushApplied: (data: { direction: 'up' | 'down' }) => void;
  mmRentTick: (data: { amount: number; mmBalance: number }) => void;
  mmInactivityPenalty: () => void;
  marketMakerResult: (data: { mmWon: boolean; mmBalance: number; tradersAvg: number; mmNickname: string }) => void;
  // Binary Options mode
  binaryRound: (round: BinaryRoundState) => void;
  binaryReveal: (data: BinaryRevealedBets) => void;
  binaryCandle: (data: { candle: Candle }) => void;
  binaryResult: (result: BinaryRoundResult) => void;
  binaryRoundCancelled: (data: { message: string }) => void;
  playerEliminated: (data: { playerId: string }) => void;
  betTimer: (seconds: number) => void;
  error: (message: string) => void;
}

export interface ClientToServerEvents {
  createRoom: (data: { gameMode: GameMode }) => void;
  joinRoom: (data: { roomCode: string; nickname: string }) => void;
  startGame: () => void;
  openPosition: (data: { direction: 'long' | 'short'; size: number; leverage: Leverage }) => void;
  closePosition: () => void;
  useSkill: () => void;
  spinSlots: (data: { bet: number }) => void;
  spinWheel: (data: { bet: number }) => void;
  openLootbox: (data: { bet: number; chosenIndex: number }) => void;
  playLoto: (data: { bet: number; numbers: number[] }) => void;
  voteNextRound: (data: { vote: boolean }) => void;
  useMMLever: (data: { lever: MMLeverType }) => void;
  mmPush: (data: { direction: 'up' | 'down' }) => void;
  // Binary Options mode
  placeBet: (data: { direction: BinaryDirection; percent: number }) => void;
}

// --- Bonus display ---
export const BONUS_TITLES: Record<string, string> = {
  wheel: 'КОЛЕСО ФОРТУНЫ',
  slots: 'СЛОТ-МАШИНА',
  lootbox: 'ЛУТБОКС',
  loto: 'ЛОТО',
};

export const BONUS_EMOJIS: Record<string, string> = {
  wheel: '🎡',
  slots: '🎰',
  lootbox: '🎁',
  loto: '🎲',
};

export const MEDAL_EMOJIS = ['🏆', '🥈', '🥉'] as const;
