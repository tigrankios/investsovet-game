// ============================================
// InvestSovet — Market Maker Types & Constants
// ============================================

// --- Market Maker Types ---
export type MMLeverType = 'commission' | 'freeze' | 'squeeze';

export interface MMLeverState {
  commission: { active: boolean; ticksLeft: number; cooldownLeft: number };
  freeze: { active: boolean; ticksLeft: number; cooldownLeft: number };
  squeeze: { active: boolean; ticksLeft: number; cooldownLeft: number };
}

export interface MMCasinoState {
  levers: MMLeverState;
  lastLeverTime: number;
  rentPausedTicksLeft: number;
  traderLastOpenTime: Record<string, number>;
}

// --- MM Casino Mode Constants ---
export const MM_STARTING_BALANCE = 0;
export const MAX_POSITION_PERCENT = 30;
export const RENT_AMOUNT = 100;
export const RENT_INTERVAL_SEC = 5;
export const COMMISSION_PERCENT = 3;
export const COMMISSION_DURATION_SEC = 6;
export const COMMISSION_COOLDOWN_SEC = 20;
export const FREEZE_DURATION_SEC_MM = 5;
export const FREEZE_COOLDOWN_SEC = 20;
export const SQUEEZE_TIGHTENING_PERCENT = 30;
export const SQUEEZE_DURATION_SEC = 8;
export const SQUEEZE_COOLDOWN_SEC = 20;
export const MM_LIQUIDATION_BONUS_PERCENT = 25;
export const MM_INACTIVITY_THRESHOLD_SEC = 8;
export const MM_INACTIVITY_RENT_PAUSE_SEC = 5;
export const MM_INACTIVITY_TRADER_BONUS = 200;
export const TRADER_INACTIVITY_THRESHOLD_SEC = 15;
export const TRADER_INACTIVITY_RENT_MULTIPLIER = 2;
export const SYNERGY_MIN_TRADERS = 3;
export const SYNERGY_THRESHOLD_WIDENING_PERCENT = 30;
