// ============================================
// InvestSovet — Classic Mode Types & Constants
// ============================================

// --- Skills (Mario Kart style) ---
export type SkillType = 'trump_tweet' | 'inverse' | 'shield' | 'double_or_nothing' | 'freeze' | 'blind' | 'steal' | 'chaos';

export const SKILL_NAMES: Record<SkillType, string> = {
  trump_tweet: 'Твит Трампа',
  inverse: 'Инверсия',
  shield: 'Щит',
  double_or_nothing: 'Ва-банк',
  freeze: 'Заморозка',
  blind: 'Слепой трейд',
  steal: 'Кража',
  chaos: 'Хаос',
};

export const SKILL_EMOJIS: Record<SkillType, string> = {
  trump_tweet: '🇺🇸',
  inverse: '🔄',
  shield: '🛡️',
  double_or_nothing: '💰',
  freeze: '🧊',
  blind: '🙈',
  steal: '🦹',
  chaos: '🌪️',
};

export const SKILL_DESCRIPTIONS: Record<SkillType, string> = {
  trump_tweet: 'x3 к PnL следующей сделки',
  inverse: 'Инвертирует график на 10 свечей',
  shield: 'Защита от ликвидации (1 раз)',
  double_or_nothing: 'Удваивает маржу позиции',
  freeze: 'Блокирует действия других на 5 сек',
  blind: 'Скрывает график у ВСЕХ на 5 сек',
  steal: 'Крадёт 10% баланса случайного игрока',
  chaos: 'Меняет long/short у ВСЕХ открытых позиций',
};

export const ALL_SKILLS: SkillType[] = ['trump_tweet', 'inverse', 'shield', 'double_or_nothing', 'freeze', 'blind', 'steal', 'chaos'];

export const FREEZE_DURATION = 5;
export const INVERSE_DURATION = 7;
export const BLIND_DURATION = 5;
