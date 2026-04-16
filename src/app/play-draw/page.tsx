'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDrawGame } from '@/lib/useDrawGame';
import { useGameModeRedirect } from '@/lib/useGameModeRedirect';
import { SKILL_NAMES, SKILL_DESCRIPTIONS, BONUS_TITLES } from '@/lib/types';
import type { Leverage, Candle, DrawPoint } from '@/lib/types';

import { formatPrice } from '@/lib/utils';
import { RANDOM_NICKS } from '@/lib/constants';
import { IconLong, IconShort, IconTrophy, IconSilver, IconBronze, IconFinish, IconSkillShield, IconSkillBlind, SKILL_ICON_MAP, BONUS_ICON_MAP } from '@/components/icons';
import { WheelGame } from '@/components/games/WheelGame';
import { SlotsGame } from '@/components/games/SlotsGame';
import { LootboxGame } from '@/components/games/LootboxGame';
import { LotoGame } from '@/components/games/LotoGame';

export default function PlayDrawPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-white text-xl animate-pulse">Загрузка...</div>}>
      <PlayDrawContent />
    </Suspense>
  );
}

function PlayDrawContent() {
  const searchParams = useSearchParams();
  const roomFromUrl = searchParams.get('room') || '';
  const {
    gameState, playerState, leaderboard, countdown, roundResult, candles, currentPrice,
    tradeMessage, error, liquidationAlert, skillAlert,
    bonusResult, bonusData, finalStats,
    drawTimer, isDrawing, mmLiquidationAlert,
    joinRoom, openPosition, closePosition, usePlayerSkill, submitDrawing,
    spinSlots, spinWheel, openLootbox, playLoto,
  } = useDrawGame();

  const [joined, setJoined] = useState(false);
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState(roomFromUrl);

  useGameModeRedirect(gameState, 'draw', roomCode);
  const [sizePercent, setSizePercent] = useState(25);
  const [leverage, setLeverage] = useState<Leverage>(25);
  const [bonusBetPercent, setBonusBetPercent] = useState(10);
  const [wheelLanded, setWheelLanded] = useState(false);

  // Auto-reconnect
  useEffect(() => {
    if (joined) return;
    const savedRoom = sessionStorage.getItem('investsovet_room');
    const savedNick = sessionStorage.getItem('investsovet_nick');
    if (savedRoom && savedNick) {
      setRoomCode(savedRoom);
      setNickname(savedNick);
      joinRoom(savedRoom, savedNick);
      setJoined(true);
    }
  }, [joined, joinRoom]);

  // Reset on reconnect failure
  useEffect(() => {
    if (error && joined && !gameState) {
      sessionStorage.removeItem('investsovet_room');
      sessionStorage.removeItem('investsovet_nick');
      setJoined(false);
      setNickname('');
      setRoomCode(roomFromUrl);
    }
  }, [error, joined, gameState, roomFromUrl]);

  // Reset on new round
  useEffect(() => {
    setWheelLanded(false);
    const avail = gameState?.availableLeverages;
    if (avail && avail.length > 0 && !avail.includes(leverage)) {
      setLeverage(avail[0]);
    }
  }, [gameState?.roundNumber]);

  const isMM = playerState?.role === 'market_maker';

  // --- JOIN SCREEN ---
  if (!joined) {
    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center p-6">
        <h1 className="text-4xl font-display font-black mb-2">
          <span className="font-display text-accent-purple" style={{ textShadow: '0 0 30px rgba(179,136,255,0.4)' }}>DRAW</span>
          <span className="font-display text-accent-gold" style={{ textShadow: '0 0 30px rgba(255,215,64,0.4)' }}> MODE</span>
        </h1>
        <p className="text-text-secondary mb-8">Нарисуй график</p>

        {error && (
          <div className="bg-accent-red/20 border border-accent-red/50 rounded-lg p-3 mb-4 text-accent-red text-center w-full max-w-sm">
            {error}
          </div>
        )}

        <div className="w-full max-w-sm space-y-4">
          <input
            type="text"
            placeholder="Код комнаты"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            className="w-full bg-surface border border-border rounded-xl px-4 py-4 text-center text-2xl font-display tracking-[0.3em] focus:border-accent-purple focus:outline-none text-white"
            maxLength={6}
          />
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Никнейм"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-lg focus:border-accent-purple focus:outline-none text-white"
              maxLength={16}
            />
            <button
              onClick={() => setNickname(RANDOM_NICKS[Math.floor(Math.random() * RANDOM_NICKS.length)])}
              className="bg-surface border border-border rounded-xl px-4 text-xl active:scale-95"
            >
              ?
            </button>
          </div>
          <button
            onClick={() => {
              if (!roomCode || !nickname) return;
              joinRoom(roomCode, nickname);
              setJoined(true);
            }}
            disabled={roomCode.length === 0 || nickname.length === 0}
            className="w-full bg-accent-purple text-white font-display font-bold text-xl py-4 rounded-xl disabled:opacity-30 active:scale-95 transition-all glow-purple"
          >
            ВОЙТИ
          </button>
        </div>
      </div>
    );
  }

  // --- WAITING IN LOBBY ---
  if (!gameState || gameState.phase === 'lobby') {
    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center p-6">
        <div className="text-2xl font-display font-bold text-accent-purple mb-4 animate-pulse tracking-widest">DRAW MODE</div>
        <h2 className="text-2xl font-bold">{nickname}</h2>
        <p className="text-text-secondary mt-8 animate-shimmer text-lg">Ждём старта...</p>
        {gameState && <p className="text-text-muted mt-2">Игроков: {gameState.playerCount}</p>}
      </div>
    );
  }

  // --- DRAW_DRAWING PHASE ---
  if (gameState.phase === 'draw_drawing') {
    if (isMM && playerState) {
      return <MMDrawingScreen drawTimer={drawTimer} submitDrawing={submitDrawing} playerState={playerState} />;
    }
    // Trader: waiting for MM to draw
    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center p-6">
        <p className="text-text-secondary text-sm uppercase tracking-wider mb-2">Раунд {gameState.roundNumber}</p>
        <div className="mb-6">
          <DrawingPencilIcon />
        </div>
        <p className="text-2xl font-display font-bold text-accent-purple animate-pulse">MM рисует график...</p>
        <p className="text-text-secondary mt-2">{drawTimer}с</p>
      </div>
    );
  }

  // --- COUNTDOWN ---
  if (gameState.phase === 'countdown') {
    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center">
        <p className="text-text-secondary text-lg">Раунд {gameState.roundNumber}</p>
        <p className="text-accent-gold text-xl">{gameState.ticker}</p>
        <div className="text-[120px] font-display font-black text-accent-green animate-countdown leading-none mt-4" style={{ textShadow: '0 0 60px rgba(0,230,118,0.5)' }}>
          {countdown}
        </div>
      </div>
    );
  }

  // --- ROUND END (between trading end and bonus start) ---
  if (roundResult && gameState.phase === 'trading' && playerState) {
    if (isMM) {
      return (
        <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center p-6">
          <p className="text-text-secondary text-sm uppercase tracking-wider mb-2">Раунд {roundResult.roundNumber} завершён</p>
          <p className="text-accent-purple font-display font-bold text-lg mb-6">Market Maker</p>
          <p className="text-3xl font-display font-black text-accent-purple mb-2">
            ${playerState.balance.toFixed(0)}
          </p>
          <p className="text-text-secondary font-mono">Заработок за раунд</p>
          <div className="mt-8 w-12 h-1 bg-accent-purple/30 rounded-full overflow-hidden">
            <div className="h-full bg-accent-purple rounded-full animate-shimmer" />
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center p-6">
        <p className="text-text-secondary text-sm uppercase tracking-wider mb-2">Раунд {roundResult.roundNumber} завершён</p>
        <p className="text-accent-gold font-display font-bold text-lg mb-6">{roundResult.ticker}</p>
        <p className={`text-5xl font-display font-black mb-2 ${playerState.pnl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
          {playerState.pnl >= 0 ? '+' : ''}{playerState.pnl.toFixed(0)}$
        </p>
        <p className="text-text-secondary font-mono">Баланс: ${playerState.balance.toFixed(0)}</p>
        <div className="mt-8 w-12 h-1 bg-accent-gold/30 rounded-full overflow-hidden">
          <div className="h-full bg-accent-gold rounded-full animate-shimmer" />
        </div>
      </div>
    );
  }

  // --- TRADING PHASE ---
  if (gameState.phase === 'trading' && playerState) {
    if (isMM) {
      return <MMTradingScreen gameState={gameState} playerState={playerState} leaderboard={leaderboard} candles={candles} currentPrice={currentPrice} mmLiquidationAlert={mmLiquidationAlert} nickname={nickname} />;
    }

    // Trader trading UI — identical to Classic
    const balance = playerState.balance;
    const position = playerState.position;
    const unrealizedPnl = playerState.unrealizedPnl;
    const totalBalance = balance + (unrealizedPnl || 0);
    const tradeSize = Math.floor(balance * sizePercent / 100);
    const isBlind = playerState.blindTicksLeft > 0;

    return (
      <div className="min-h-screen bg-background text-white flex flex-col">
        {/* Toast */}
        {tradeMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-surface-light border border-border-light rounded-lg px-4 py-2 text-sm z-50">
            {tradeMessage}
          </div>
        )}
        {liquidationAlert && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-accent-red text-white font-bold rounded-lg px-4 py-2 z-50 animate-alert">
            {liquidationAlert}
          </div>
        )}
        {skillAlert && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-accent-purple text-white font-bold rounded-lg px-4 py-2 z-50 animate-alert">
            {skillAlert}
          </div>
        )}

        {/* Header */}
        <div className="px-4 pt-4 pb-2">
          {isBlind ? (
            <div className="flex flex-col items-center py-4">
              <div className="mb-2"><IconSkillBlind size={40} /></div>
              <p className="text-xl font-display font-black text-accent-gold animate-pulse">СЛЕПОЙ ТРЕЙД</p>
              <p className="text-text-secondary mt-1">{playerState.blindTicksLeft}с</p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-text-secondary text-xs uppercase">Баланс</p>
                  <p className="text-2xl font-mono font-bold">${totalBalance.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-text-secondary text-xs uppercase">PnL</p>
                  <p className={`text-2xl font-mono font-bold ${playerState.pnl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                    {playerState.pnl >= 0 ? '+' : ''}{playerState.pnl.toFixed(2)}$
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-3 mt-3">
                <span className="text-accent-gold font-bold">{gameState.ticker}</span>
                <span className="text-xl font-mono font-bold">{formatPrice(currentPrice)}</span>
              </div>
            </>
          )}
        </div>

        {/* Chart */}
        {!isBlind && candles.length > 0 && (
          <div className="mx-2 mt-2 rounded-xl overflow-hidden" style={{ height: '40vw', maxHeight: '220px', minHeight: '140px' }}>
            <MiniChart candles={candles} positions={leaderboard} />
          </div>
        )}

        {/* Position Awareness Strip */}
        {(() => {
          const others = leaderboard.filter(e => e.nickname !== nickname);
          const longCount = others.filter(e => e.hasPosition && e.positionDirection === 'long').length;
          const shortCount = others.filter(e => e.hasPosition && e.positionDirection === 'short').length;
          const idleCount = others.filter(e => !e.hasPosition).length;
          const groups = [
            ...(longCount > 0 ? [{ count: longCount, arrow: '\u25B2', label: 'LONG', color: 'text-accent-green' }] : []),
            ...(shortCount > 0 ? [{ count: shortCount, arrow: '\u25BC', label: 'SHORT', color: 'text-accent-red' }] : []),
            ...(idleCount > 0 ? [{ count: idleCount, arrow: '\u2014', label: 'IDLE', color: 'text-text-muted' }] : []),
          ];
          if (groups.length === 0) return null;
          return (
            <div className="mx-2 mt-2 flex items-center justify-center gap-4 py-2 bg-surface rounded-xl border border-border">
              {groups.map((g, i) => (
                <div key={g.label} className="flex items-center gap-1.5">
                  {i > 0 && <div className="w-px h-5 bg-border -ml-2 mr-1.5" />}
                  <span className={`text-lg font-mono font-bold transition-all duration-300 ${g.color}`}>{g.count}</span>
                  <span className={`text-xs font-bold uppercase opacity-80 ${g.color}`}>{g.arrow} {g.label}</span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Position */}
        {position && (
          <div className={`mx-4 mt-2 p-3 rounded-xl border ${
            position.direction === 'long' ? 'bg-accent-green/10 border-accent-green/30' : 'bg-accent-red/10 border-accent-red/30'
          }`}>
            <div className="flex justify-between items-center">
              <div>
                <span className={`font-bold ${position.direction === 'long' ? 'text-accent-green' : 'text-accent-red'}`}>
                  {position.direction === 'long' ? 'LONG' : 'SHORT'} x{position.leverage}
                </span>
                <span className="text-text-secondary ml-2">${position.size}</span>
              </div>
              {isBlind ? (
                <span className="text-text-secondary font-mono">???</span>
              ) : (
                <div className="text-right">
                  <p className={`font-mono font-bold ${unrealizedPnl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                    {unrealizedPnl >= 0 ? '+' : ''}{unrealizedPnl.toFixed(2)}$
                  </p>
                  <p className="text-text-secondary text-xs">Ликв: {formatPrice(position.liquidationPrice)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Skill Button (only for traders) */}
        {playerState.skill && !playerState.skillUsed && (
          <div className="mx-4 mt-3">
            <button
              onClick={usePlayerSkill}
              disabled={playerState.frozen}
              className={`w-full rounded-xl active:scale-95 transition-all border ${playerState.frozen ? 'opacity-40 border-border bg-surface' : 'border-accent-purple/50 bg-surface hover:bg-surface-light'}`}
              style={!playerState.frozen ? { boxShadow: '0 0 20px rgba(179,136,255,0.15), inset 0 0 30px rgba(179,136,255,0.05)' } : undefined}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-10 h-10 rounded-lg bg-accent-purple/20 flex items-center justify-center flex-shrink-0">
                  {SKILL_ICON_MAP[playerState.skill]?.({ size: 22 })}
                </div>
                <div className="text-left flex-1">
                  <p className="font-display font-bold text-sm text-text-primary">{SKILL_NAMES[playerState.skill]}</p>
                  <p className="text-xs text-text-secondary">{SKILL_DESCRIPTIONS[playerState.skill]}</p>
                </div>
                <div className="text-accent-purple text-xs font-display font-bold uppercase tracking-wider">USE</div>
              </div>
            </button>
          </div>
        )}
        {playerState.skill && playerState.skillUsed && (
          <div className="mx-4 mt-2">
            <div className="flex items-center gap-2 justify-center text-sm text-text-muted">
              <span className="inline-flex items-center gap-1">{SKILL_ICON_MAP[playerState.skill]?.({ size: 14 })} {SKILL_NAMES[playerState.skill]}</span>
              <span className="text-text-muted">— использован</span>
              {playerState.shieldActive && <span className="inline-flex items-center gap-1 text-accent-green"><IconSkillShield size={14} /> активен</span>}
              {playerState.blindTicksLeft > 0 && <span className="inline-flex items-center gap-1 text-accent-blue"><IconSkillBlind size={14} /> {playerState.blindTicksLeft}с</span>}
            </div>
          </div>
        )}

        <div className="flex-1" />

        {/* Frozen indicator */}
        {playerState.frozen && (
          <div className="mx-4 mt-2 bg-blue-600/20 border border-blue-500/50 rounded-xl px-3 py-2 text-blue-400 text-sm font-bold text-center animate-pulse">
            Заморожен!
          </div>
        )}

        {/* Controls (traders only) */}
        <div className="px-4 pb-6 space-y-3">
          {position ? (
            <button
              onClick={closePosition}
              disabled={playerState.isFreezed || playerState.frozen}
              className={`w-full py-5 rounded-xl font-display font-bold text-xl active:scale-95 transition-all ${
                (playerState.isFreezed || playerState.frozen) ? 'bg-blue-600 text-white opacity-60' :
                unrealizedPnl >= 0 ? 'bg-accent-green text-white glow-green' : 'bg-accent-red text-white glow-red'
              }`}
            >
              {(playerState.isFreezed || playerState.frozen) ? 'ЗАМОРОЖЕНО' : `ЗАКРЫТЬ ${unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)}$`}
            </button>
          ) : (
            <>
              {/* Leverage */}
              <div>
                <p className="text-text-secondary text-xs mb-1">Плечо</p>
                <div className="flex gap-1.5">
                  {(gameState.availableLeverages || [500]).map((lev) => (
                    <button
                      key={lev}
                      onClick={() => setLeverage(lev)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                        leverage === lev
                          ? lev >= 200 ? 'bg-accent-purple text-white' : lev >= 50 ? 'bg-accent-red text-white' : lev >= 10 ? 'bg-orange-500 text-black' : 'bg-accent-gold text-black'
                          : 'bg-surface text-text-secondary border border-border'
                      }`}
                    >
                      {`${lev}x`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Size */}
              <div>
                <div className="flex justify-between text-sm text-text-secondary mb-1">
                  <span>Маржа: ${tradeSize.toLocaleString()}</span>
                  <span>Позиция: ${(tradeSize * leverage).toLocaleString()}</span>
                </div>
                <div className="flex gap-1.5">
                  {[10, 25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setSizePercent(pct)}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all active:scale-95 ${
                        sizePercent === pct
                          ? 'bg-accent-gold text-black'
                          : 'bg-surface text-text-secondary border border-border'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Long/Short */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => openPosition('long', tradeSize, leverage)}
                  disabled={tradeSize <= 0 || playerState.frozen}
                  className="bg-accent-green text-white font-display font-bold text-xl py-6 rounded-xl active:scale-95 transition-all disabled:opacity-30 glow-green"
                >
                  <span className="flex items-center justify-center gap-1"><IconLong size={16} /> LONG</span>
                </button>
                <button
                  onClick={() => openPosition('short', tradeSize, leverage)}
                  disabled={tradeSize <= 0 || playerState.frozen}
                  className="bg-accent-red text-white font-display font-bold text-xl py-6 rounded-xl active:scale-95 transition-all disabled:opacity-30 glow-red"
                >
                  <span className="flex items-center justify-center gap-1"><IconShort size={16} /> SHORT</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // --- BONUS PHASE ---
  if (gameState.phase === 'bonus' && playerState) {
    const bonusBalance = playerState.balance;
    const bonusBet = Math.floor(bonusBalance * bonusBetPercent / 100);
    const timer = bonusData?.timer ?? gameState.bonusTimer;
    const bonusType = bonusData?.bonusType ?? gameState.bonusType;

    const showWheelResult = bonusResult?.type === 'wheel' && wheelLanded;
    const canShowResult = bonusResult && (bonusResult.type !== 'wheel' || showWheelResult);
    const winAmount = canShowResult ? bonusResult.result.winAmount : null;
    const multiplier = canShowResult ? bonusResult.result.multiplier : null;

    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center p-6">
        <p className="text-accent-gold text-lg font-mono mb-2">{timer}с</p>
        <h2 className="text-3xl font-display font-black mb-6 text-accent-gold flex items-center gap-2">{BONUS_ICON_MAP[bonusType || 'slots']?.({ size: 28 })} {BONUS_TITLES[bonusType || 'slots']}</h2>

        {bonusType === 'wheel' && (
          <WheelGame
            key={`${gameState.roundNumber}-wheel`}
            onSpin={() => spinWheel(bonusBet)}
            resultSectorIndex={bonusResult?.type === 'wheel' ? bonusResult.result.sectorIndex : null}
            disabled={bonusBet <= 0}
            onLanded={() => setWheelLanded(true)}
          />
        )}
        {bonusType === 'slots' && (
          <SlotsGame
            key={`${gameState.roundNumber}-slots`}
            onSpin={() => spinSlots(bonusBet)}
            resultReels={bonusResult?.type === 'slots' ? [...bonusResult.result.reels] : null}
            resultMultiplier={bonusResult?.type === 'slots' ? bonusResult.result.multiplier : null}
            disabled={bonusBet <= 0}
          />
        )}
        {bonusType === 'lootbox' && (
          <LootboxGame
            key={`${gameState.roundNumber}-lootbox`}
            onChoose={(idx) => openLootbox(bonusBet, idx)}
            resultBoxes={bonusResult?.type === 'lootbox' ? bonusResult.result.boxes : null}
            resultChosenIndex={bonusResult?.type === 'lootbox' ? bonusResult.result.chosenIndex : null}
            disabled={bonusBet <= 0}
          />
        )}
        {bonusType === 'loto' && (
          <LotoGame
            key={`${gameState.roundNumber}-loto`}
            onPlay={(nums) => playLoto(bonusBet, nums)}
            resultDrawn={bonusResult?.type === 'loto' ? bonusResult.result.drawnNumbers : null}
            resultPlayerNumbers={bonusResult?.type === 'loto' ? bonusResult.result.playerNumbers : null}
            resultMatches={bonusResult?.type === 'loto' ? bonusResult.result.matches : null}
            disabled={bonusBet <= 0}
          />
        )}

        {bonusResult && winAmount !== null && multiplier !== null && (
          <div className="mb-6 text-center">
            <p className={`text-3xl font-black ${winAmount >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
              {multiplier > 0 ? `x${multiplier}` : 'МИМО'}
            </p>
            <p className={`text-xl font-bold mt-1 ${winAmount >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
              {winAmount >= 0 ? '+' : ''}{winAmount.toFixed(0)}$
            </p>
            {multiplier >= 10 && (
              <p className="text-accent-gold text-lg mt-2 animate-bounce font-black">JACKPOT!</p>
            )}
          </div>
        )}

        {!bonusResult && (
          <div className="w-full max-w-sm mb-4">
            <p className="text-text-secondary text-sm mb-2 text-center">Ставка: ${bonusBet.toLocaleString()}</p>
            <div className="flex gap-2">
              {[5, 10, 25, 50].map((pct) => (
                <button
                  key={pct}
                  onClick={() => setBonusBetPercent(pct)}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all active:scale-95 ${
                    bonusBetPercent === pct
                      ? 'bg-accent-gold text-black'
                      : 'bg-surface text-text-secondary border border-border'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        )}

        {canShowResult || !bonusResult ? (
          <p className="text-text-muted text-sm mt-4">Баланс: ${bonusBalance.toFixed(0)}</p>
        ) : (
          <p className="text-text-muted text-sm mt-4 animate-pulse">...</p>
        )}
      </div>
    );
  }

  // --- FINISHED ---
  if (gameState.phase === 'finished') {
    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center p-4 overflow-y-auto">
        <div className="mt-6 mb-2"><IconFinish size={48} /></div>

        <h2 className="text-2xl font-display font-black text-accent-gold mb-4">ИГРА ОКОНЧЕНА</h2>

        {finalStats.length > 0 ? (
          <div className="w-full max-w-md space-y-3 mb-6">
            {finalStats.map((s) => (
              <div key={s.nickname} className={`rounded-xl p-4 ${s.rank === 1 ? 'bg-accent-gold/10 border border-accent-gold/30' : 'glass border border-border'}`}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xl font-bold flex items-center gap-1">
                    {s.rank === 1 ? <IconTrophy size={24} /> : s.rank === 2 ? <IconSilver size={24} /> : s.rank === 3 ? <IconBronze size={24} /> : `${s.rank}.`} {s.nickname}
                  </span>
                  <span className="text-xl font-mono font-bold text-accent-gold">${s.balance.toFixed(0)}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="text-text-secondary">Макс. баланс</span>
                  <span className="text-right font-mono text-accent-green">${s.maxBalance.toFixed(0)}</span>
                  <span className="text-text-secondary">Лучшая сделка</span>
                  <span className="text-right font-mono text-accent-green">+${s.bestTrade.toFixed(0)}</span>
                  <span className="text-text-secondary">Худшая сделка</span>
                  <span className="text-right font-mono text-accent-red">{s.worstTrade.toFixed(0)}$</span>
                  <span className="text-text-secondary">Сделок</span>
                  <span className="text-right font-mono">{s.totalTrades}</span>
                  <span className="text-text-secondary">Ликвидаций</span>
                  <span className="text-right font-mono text-accent-red">{s.liquidations}</span>
                </div>
              </div>
            ))}
          </div>
        ) : playerState && (
          <p className="text-2xl font-bold mt-4 mb-6">${playerState.balance.toFixed(0)}</p>
        )}

        <button
          onClick={() => {
            sessionStorage.removeItem('investsovet_room');
            sessionStorage.removeItem('investsovet_nick');
            window.location.href = '/play-draw';
          }}
          className="bg-surface-light text-white px-8 py-3 rounded-xl text-lg active:scale-95"
        >
          Новая игра
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white flex items-center justify-center">
      <p className="animate-pulse text-xl">Загрузка...</p>
    </div>
  );
}

// ============================================
// MM Drawing Screen Component
// ============================================

function MMDrawingScreen({
  drawTimer,
  submitDrawing,
  playerState,
}: {
  drawTimer: number;
  submitDrawing: (points: DrawPoint[]) => void;
  playerState: NonNullable<ReturnType<typeof useDrawGame>['playerState']>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<DrawPoint[]>([]);
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const submittedRef = useRef(false);
  const pointsRef = useRef<DrawPoint[]>([]);
  const cssSizeRef = useRef({ w: 0, h: 0 });

  // Keep pointsRef in sync
  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  // Auto-submit when timer hits 1 (gives 1s buffer for network delivery before server processes)
  useEffect(() => {
    if (drawTimer <= 1 && drawTimer >= 0 && !submittedRef.current && pointsRef.current.length > 0) {
      submittedRef.current = true;
      setSubmitted(true);
      submitDrawing(pointsRef.current);
    }
  }, [drawTimer, submitDrawing]);

  const getNormalizedPoint = useCallback((clientX: number, clientY: number): DrawPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    };
  }, []);

  const drawLine = useCallback((pts: DrawPoint[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = cssSizeRef.current.w || canvas.width;
    const h = cssSizeRef.current.h || canvas.height;

    // Clear using full pixel dimensions
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid (using CSS dimensions since ctx is scaled)
    ctx.strokeStyle = 'rgba(30, 35, 51, 0.6)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const gy = (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }
    for (let i = 1; i < 4; i++) {
      const gx = (w / 4) * i;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }

    if (pts.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = '#B388FF';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.moveTo(pts[0].x * w, pts[0].y * h);
    for (let i = 1; i < pts.length; i++) {
      if (i < pts.length - 1) {
        const midX = (pts[i].x * w + pts[i + 1].x * w) / 2;
        const midY = (pts[i].y * h + pts[i + 1].y * h) / 2;
        ctx.quadraticCurveTo(pts[i].x * w, pts[i].y * h, midX, midY);
      } else {
        ctx.lineTo(pts[i].x * w, pts[i].y * h);
      }
    }
    ctx.stroke();
  }, []);

  // Set canvas resolution on mount and resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      cssSizeRef.current = { w: rect.width, h: rect.height };
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
      drawLine(pointsRef.current);
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [drawLine]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (submitted) return;
    e.preventDefault();
    setIsPointerDown(true);
    const pt = getNormalizedPoint(e.clientX, e.clientY);
    if (pt) {
      setPoints([pt]);
    }
  }, [submitted, getNormalizedPoint]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPointerDown || submitted) return;
    e.preventDefault();
    const pt = getNormalizedPoint(e.clientX, e.clientY);
    if (pt) {
      setPoints(prev => {
        const next = [...prev, pt];
        drawLine(next);
        return next;
      });
    }
  }, [isPointerDown, submitted, getNormalizedPoint, drawLine]);

  const handlePointerUp = useCallback(() => {
    setIsPointerDown(false);
  }, []);

  // Redraw when points change externally (e.g. clear)
  useEffect(() => {
    drawLine(points);
  }, [points, drawLine]);

  const handleClear = useCallback(() => {
    setPoints([]);
  }, []);

  const handleConfirm = useCallback(() => {
    if (points.length < 2 || submitted) return;
    submittedRef.current = true;
    setSubmitted(true);
    submitDrawing(points);
  }, [points, submitted, submitDrawing]);

  return (
    <div className="min-h-screen bg-background text-white flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex justify-between items-center">
        <span className="font-display font-bold text-accent-purple">MM DRAW</span>
        <span className="font-mono text-accent-gold">{drawTimer}с</span>
      </div>

      {/* Canvas */}
      <div className="flex-1 px-4 pb-2">
        <div
          className="w-full rounded-xl border border-accent-purple/30 overflow-hidden bg-surface relative"
          style={{ height: '50vh' }}
        >
          {submitted && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
              <p className="text-accent-purple font-display font-bold text-xl">Отправлено!</p>
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="w-full h-full touch-none cursor-crosshair"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
          {points.length === 0 && !submitted && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-text-muted text-lg">Нарисуйте линию цены</p>
            </div>
          )}
        </div>
      </div>

      {/* Buttons */}
      <div className="px-4 pb-2 flex gap-3">
        <button
          onClick={handleClear}
          disabled={submitted || points.length === 0}
          className="flex-1 py-3 rounded-xl font-display font-bold text-lg bg-surface border border-border text-text-secondary active:scale-95 transition-all disabled:opacity-30"
        >
          CLEAR
        </button>
        <button
          onClick={handleConfirm}
          disabled={submitted || points.length < 2}
          className="flex-1 py-3 rounded-xl font-display font-bold text-lg bg-accent-purple text-white active:scale-95 transition-all disabled:opacity-30 glow-purple"
        >
          CONFIRM
        </button>
      </div>

      {/* MM Earnings */}
      <div className="px-4 pb-6 pt-2">
        <div className="bg-surface rounded-xl border border-border p-3">
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Заработок:</span>
            <span className="text-accent-purple font-mono font-bold">${playerState.balance.toFixed(0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MM Trading Screen Component
// ============================================

function MMTradingScreen({
  gameState,
  playerState,
  leaderboard,
  candles,
  currentPrice,
  mmLiquidationAlert,
  nickname,
}: {
  gameState: NonNullable<ReturnType<typeof useDrawGame>['gameState']>;
  playerState: NonNullable<ReturnType<typeof useDrawGame>['playerState']>;
  leaderboard: ReturnType<typeof useDrawGame>['leaderboard'];
  candles: Candle[];
  currentPrice: number;
  mmLiquidationAlert: string | null;
  nickname: string;
}) {
  const others = leaderboard.filter(e => e.nickname !== nickname && e.role !== 'market_maker');
  const longCount = others.filter(e => e.hasPosition && e.positionDirection === 'long').length;
  const shortCount = others.filter(e => e.hasPosition && e.positionDirection === 'short').length;

  return (
    <div className="min-h-screen bg-background text-white flex flex-col">
      {/* Liquidation alert */}
      {mmLiquidationAlert && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-accent-purple text-white font-bold rounded-lg px-4 py-2 z-50 animate-alert">
          {mmLiquidationAlert}
        </div>
      )}

      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex justify-between items-center">
          <span className="font-display font-bold text-accent-purple">MM</span>
          <span className="text-xl font-mono font-bold">{formatPrice(currentPrice)}</span>
          <span className="text-text-secondary text-sm">R{gameState.roundNumber}</span>
        </div>
      </div>

      {/* Chart */}
      {candles.length > 0 && (
        <div className="mx-2 mt-2 rounded-xl overflow-hidden" style={{ height: '40vw', maxHeight: '220px', minHeight: '140px' }}>
          <MiniChart candles={candles} positions={leaderboard} />
        </div>
      )}

      {/* Info */}
      <div className="px-4 mt-4 space-y-3">
        <div className="bg-surface rounded-xl border border-border p-3 text-center">
          <p className="text-text-secondary text-xs uppercase mb-1">Твой рисунок vs реальность</p>
          <p className="text-accent-purple font-display font-bold text-lg">Наблюдай...</p>
        </div>

        {/* MM Earnings */}
        <div className="bg-surface rounded-xl border border-accent-purple/30 p-3">
          <div className="flex justify-between items-center">
            <span className="text-text-secondary text-sm">Заработок</span>
            <span className="text-accent-purple font-mono font-bold text-xl">${playerState.balance.toFixed(0)}</span>
          </div>
        </div>

        {/* Position awareness */}
        <div className="bg-surface rounded-xl border border-border p-3">
          <p className="text-text-secondary text-xs uppercase mb-2">Позиции трейдеров</p>
          <div className="flex items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-accent-green font-mono font-bold text-2xl">{longCount}</span>
              <span className="text-accent-green text-sm font-bold">{'\u25B2'} LONG</span>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="flex items-center gap-2">
              <span className="text-accent-red font-mono font-bold text-2xl">{shortCount}</span>
              <span className="text-accent-red text-sm font-bold">{'\u25BC'} SHORT</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Animated Drawing Pencil Icon
// ============================================

function DrawingPencilIcon() {
  return (
    <svg width={64} height={64} viewBox="0 0 64 64" fill="none" className="animate-bounce">
      <path
        d="M10 54L14 40L44 10L54 20L24 50L10 54Z"
        stroke="#B388FF"
        strokeWidth="2.5"
        fill="#B388FF"
        fillOpacity={0.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M40 14L50 24"
        stroke="#B388FF"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M14 40L24 50"
        stroke="#B388FF"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="52" r="2" fill="#B388FF" />
    </svg>
  );
}

// ============================================
// MiniChart (copied from play/page.tsx)
// ============================================

function MiniChart({ candles, positions = [] }: { candles: Candle[]; positions?: import('@/lib/types').LeaderboardEntry[] }) {
  if (candles.length === 0) return null;

  const width = 600;
  const height = 220;
  const pad = { top: 10, right: 50, bottom: 10, left: 10 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const maxCandles = Math.min(candles.length, Math.floor(chartW / 4));
  const visible = candles.slice(-maxCandles);
  const visibleOffset = candles.length - visible.length;
  const maxP = Math.max(...visible.map((c) => c.high));
  const minP = Math.min(...visible.map((c) => c.low));
  const range = maxP - minP || 1;

  const gap = chartW / visible.length;
  const candleW = Math.max(2, gap * 0.65);
  const scaleY = (p: number) => pad.top + chartH - ((p - minP) / range) * chartH;

  const lastPrice = visible[visible.length - 1]?.close || 0;
  const lastPriceY = scaleY(lastPrice);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      <rect x={0} y={0} width={width} height={height} fill="#0B0E17" rx={8} />

      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((pct) => {
        const price = minP + range * pct;
        const y = scaleY(price);
        return (
          <g key={pct}>
            <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#1E2333" strokeWidth={0.5} />
            <text x={width - pad.right + 4} y={y + 3} fill="#4A5168" fontSize={8} fontFamily="monospace">{formatPrice(price)}</text>
          </g>
        );
      })}

      {/* Candles */}
      {visible.map((c, i) => {
        const x = pad.left + i * gap + gap / 2;
        const isGreen = c.close >= c.open;
        const color = isGreen ? '#00E676' : '#FF1744';
        const bodyTop = scaleY(Math.max(c.open, c.close));
        const bodyBot = scaleY(Math.min(c.open, c.close));
        return (
          <g key={i}>
            <line x1={x} y1={scaleY(c.high)} x2={x} y2={scaleY(c.low)} stroke={color} strokeWidth={1} />
            <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={Math.max(1, bodyBot - bodyTop)} fill={color} />
          </g>
        );
      })}

      {/* Current price line + label */}
      <line x1={pad.left} y1={lastPriceY} x2={width - pad.right} y2={lastPriceY} stroke="#FFD740" strokeWidth={1} strokeDasharray="3,3" />
      <rect x={width - pad.right} y={lastPriceY - 8} width={60} height={16} rx={3} fill="#FFD740" />
      <text x={width - pad.right + 30} y={lastPriceY + 4} fill="#0B0E17" fontSize={9} fontFamily="monospace" textAnchor="middle" fontWeight="bold">
        {formatPrice(lastPrice)}
      </text>

      {/* Position markers */}
      {positions.filter((p) => p.hasPosition && p.positionOpenedAt !== null && p.positionEntryPrice !== null).map((p, idx) => {
        const candleIdx = p.positionOpenedAt! - visibleOffset;
        if (candleIdx < 0 || candleIdx >= visible.length) return null;
        const x = pad.left + candleIdx * gap + gap / 2;
        const y = scaleY(p.positionEntryPrice!);
        const isLong = p.positionDirection === 'long';
        const color = isLong ? '#00E676' : '#FF1744';
        const labelY = Math.max(16, Math.min(height - 8, y - 12 - idx * 16));
        return (
          <g key={p.nickname}>
            <line x1={x} y1={y} x2={width - pad.right} y2={y} stroke={color} strokeWidth={0.8} strokeDasharray="3,2" opacity={0.5} />
            <circle cx={x} cy={y} r={4} fill={color} stroke="#0B0E17" strokeWidth={1.5} />
            <rect x={x + 6} y={labelY - 8} width={p.nickname.length * 6 + 20} height={14} rx={3} fill={color} opacity={0.15} />
            <text x={x + 10} y={labelY + 3} fill={color} fontSize={10} fontWeight="bold">
              {isLong ? '\u25B2' : '\u25BC'} {p.nickname}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
