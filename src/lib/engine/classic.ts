import {
  GameState, Player, Leverage,
  SkillType, ALL_SKILLS, FREEZE_DURATION, INVERSE_DURATION, BLIND_DURATION,
} from '../types';
import {
  getPlayer, calcLiquidationPrice, calculatePnl, roundBalance,
  openPosition as sharedOpenPosition,
  closePosition as sharedClosePosition,
  tickCandle as sharedTickCandle,
  LIQUIDATION_BONUS_PERCENT, STEAL_PERCENT, STEAL_MAX,
} from './shared';

// --- Classic skill functions ---

export function assignRandomSkill(player: Player): SkillType | null {
  if (player.role === 'market_maker') return null;
  const skill = ALL_SKILLS[Math.floor(Math.random() * ALL_SKILLS.length)];
  player.skill = skill;
  player.skillUsed = false;
  return skill;
}

export function useSkill(
  game: GameState,
  playerId: string,
): { success: boolean; message: string; skill?: SkillType; affectsAll?: boolean } {
  const player = getPlayer(game, playerId);
  if (!player) return { success: false, message: 'Игрок не найден' };
  if (game.phase !== 'trading') return { success: false, message: 'Не время для скиллов' };
  if (!player.skill) return { success: false, message: 'Нет скилла' };
  if (player.skillUsed) return { success: false, message: 'Скилл уже использован' };
  if (player.frozenBy) return { success: false, message: 'Вы заморожены!' };

  const skill = player.skill;
  player.skillUsed = true;

  const aggressiveSkills: SkillType[] = ['inverse', 'chaos', 'blind'];
  if (aggressiveSkills.includes(skill)) {
    game.lastAggressorId = playerId;
  }

  switch (skill) {
    case 'trump_tweet':
      player.pnlMultiplier = 3;
      return { success: true, message: '🇺🇸 ТВИТ ТРАМПА! x3 к PnL!', skill };

    case 'inverse': {
      const startIdx = game.visibleCandleCount;
      const endIdx = Math.min(startIdx + INVERSE_DURATION, game.candles.length);
      for (let i = startIdx; i < endIdx; i++) {
        const c = game.candles[i];
        const mid = (c.open + c.close) / 2;
        c.open = 2 * mid - c.open;
        c.close = 2 * mid - c.close;
        c.high = 2 * mid - c.high;
        c.low = 2 * mid - c.low;
        const realHigh = Math.max(c.open, c.close, c.high, c.low);
        const realLow = Math.min(c.open, c.close, c.high, c.low);
        c.high = realHigh;
        c.low = realLow;
      }
      return { success: true, message: '🔄 ИНВЕРСИЯ! График перевернулся!', skill, affectsAll: true };
    }

    case 'shield':
      player.shieldActive = true;
      return { success: true, message: '🛡️ ЩИТ АКТИВИРОВАН! Защита от ликвидации', skill };

    case 'double_or_nothing':
      if (player.position) {
        const additionalSize = player.position.size;
        if (additionalSize <= player.balance) {
          player.position.size *= 2;
          return { success: true, message: '💰 ВА-БАНК! Маржа удвоена!', skill };
        } else {
          return { success: true, message: '💰 ВА-БАНК! Недостаточно средств для удвоения', skill };
        }
      }
      return { success: true, message: '💰 ВА-БАНК! Следующая позиция будет удвоена', skill };

    case 'freeze':
      for (const p of game.players) {
        if (p.connected && p.id !== playerId) {
          p.freezeTicksLeft = FREEZE_DURATION;
          p.frozenBy = playerId;
        }
      }
      return { success: true, message: '🧊 ЗАМОРОЗКА! Все игроки заблокированы на 5 сек!', skill, affectsAll: true };

    case 'blind':
      for (const p of game.players) {
        if (p.connected && p.id !== playerId) p.blindTicksLeft = BLIND_DURATION;
      }
      return { success: true, message: '🙈 СЛЕПОЙ ТРЕЙД! График скрыт у всех!', skill, affectsAll: true };

    case 'steal': {
      const others = game.players.filter((p) => p.connected && p.id !== playerId && p.balance > 0);
      if (others.length === 0) {
        return { success: true, message: '🦹 КРАЖА! Не у кого красть...', skill };
      }
      const victim = others[Math.floor(Math.random() * others.length)];
      const stolen = roundBalance(Math.min(victim.balance * STEAL_PERCENT, STEAL_MAX));
      victim.balance = roundBalance(victim.balance - stolen);
      player.balance = roundBalance(player.balance + stolen);
      return { success: true, message: `🦹 КРАЖА! Украл $${stolen.toFixed(0)} у ${victim.nickname}!`, skill, affectsAll: true };
    }

    case 'chaos':
      for (const p of game.players) {
        if (p.position && p.connected) {
          p.position.direction = p.position.direction === 'long' ? 'short' : 'long';
          p.position.entryPrice = game.currentPrice;
          p.position.liquidationPrice = calcLiquidationPrice(
            p.position.direction, game.currentPrice, p.position.leverage
          );
        }
      }
      return { success: true, message: '🌪️ ХАОС! Все позиции перевернулись!', skill, affectsAll: true };

    default:
      return { success: false, message: 'Неизвестный скилл' };
  }
}

// --- Classic wrappers ---

/**
 * Classic tickCandle: wraps shared tickCandle, adds aggressor bonus logic for liquidations.
 */
export function classicTickCandle(game: GameState): { continues: boolean; liquidated: { nickname: string; loss: number }[] } {
  // We need to replicate tickCandle but with aggressor bonus on liquidation.
  // Since shared tickCandle doesn't include aggressor bonus, we call it and then
  // apply the aggressor bonus post-hoc. But shared tickCandle already nulls the position,
  // so we need to handle liquidation bonus differently.
  // Actually, the shared tickCandle handles liquidation internally.
  // We need to override. Let's call shared tick for price/timer updates, but handle
  // liquidation ourselves. That's not clean. Instead, let's just replicate with additions.

  // Use shared tickCandle — it handles everything except mode-specific liquidation bonuses.
  // The aggressor bonus needs the loss amount, which is in the returned liquidated array.
  const result = sharedTickCandle(game);

  // Apply aggressor bonus for each liquidation
  if (result.liquidated.length > 0 && game.lastAggressorId) {
    for (const liq of result.liquidated) {
      const aggressor = game.players.find((p) => p.id === game.lastAggressorId);
      if (aggressor && aggressor.connected) {
        const bonus = roundBalance(liq.loss * LIQUIDATION_BONUS_PERCENT);
        aggressor.balance = roundBalance(aggressor.balance + bonus);
        aggressor.pnl = roundBalance(aggressor.pnl + bonus);
      }
    }
  }

  return result;
}

/**
 * Classic openPosition: wraps shared openPosition, adds frozen check and double_or_nothing.
 */
export function classicOpenPosition(
  game: GameState,
  playerId: string,
  direction: 'long' | 'short',
  size: number,
  leverage: Leverage,
): { success: boolean; message: string } {
  const player = getPlayer(game, playerId);
  if (!player) return { success: false, message: 'Игрок не найден' };
  if (player.frozenBy) return { success: false, message: 'Вы заморожены!' };

  // Double or nothing: double margin if skill used and no position
  let actualSize = size;
  let doubledMsg = '';
  if (player.skillUsed && player.skill === 'double_or_nothing' && !player.position) {
    if (size * 2 <= player.balance) {
      actualSize = size * 2;
      doubledMsg = ' (ВА-БАНК x2!)';
    }
  }

  const result = sharedOpenPosition(game, playerId, direction, actualSize, leverage);
  if (result.success && doubledMsg) {
    result.message += doubledMsg;
  }
  return result;
}

/**
 * Classic closePosition: wraps shared closePosition, adds frozen check, pnlMultiplier, skill reset.
 */
export function classicClosePosition(
  game: GameState,
  playerId: string,
): { success: boolean; message: string; pnl: number } {
  const player = getPlayer(game, playerId);
  if (!player) return { success: false, message: 'Игрок не найден', pnl: 0 };
  if (player.frozenBy) return { success: false, message: 'Вы заморожены!', pnl: 0 };
  if (!player.position) return { success: false, message: 'Нет открытой позиции', pnl: 0 };

  // Apply pnlMultiplier before closing
  const price = game.currentPrice;
  const basePnl = calculatePnl(player.position, price);
  const pnl = roundBalance(basePnl * player.pnlMultiplier);

  player.balance += pnl;
  player.pnl += pnl;
  if (player.balance < 0) player.balance = 0;

  // Update stats
  player.totalTrades++;
  if (pnl < player.worstTrade) player.worstTrade = pnl;
  if (pnl > player.bestTrade) player.bestTrade = pnl;
  if (player.balance > player.maxBalance) player.maxBalance = player.balance;

  // Reset one-time effects after closing
  player.pnlMultiplier = 1;

  const msg = `Закрыто: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`;
  player.position = null;

  return { success: true, message: msg, pnl };
}
