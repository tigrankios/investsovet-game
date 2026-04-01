'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useGame } from '@/lib/useGame';
import { AVAILABLE_LEVERAGES, SKILL_NAMES, SKILL_EMOJIS, SKILL_DESCRIPTIONS } from '@/lib/types';
import type { Leverage } from '@/lib/types';

const RANDOM_NICKS = [
  'CryptoБабушка', 'LunaHodler', 'ДиамантРуки', 'PumpKing',
  'ShortСлив', 'МаржинКолл', 'BullishПацан', 'DumpМастер',
  'ToTheMoon', 'РугПуллер', 'Х100Мечтатель', 'ДноПробито',
  'WenLambo', 'ХоДлЕр', 'Liquidated', 'МедвежийКапкан',
];

export default function PlayPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white text-xl animate-pulse">Загрузка...</div>}>
      <PlayContent />
    </Suspense>
  );
}

function PlayContent() {
  const searchParams = useSearchParams();
  const roomFromUrl = searchParams.get('room') || '';

  const {
    gameState, playerState, countdown, roundResult, currentPrice,
    tradeMessage, error, voteData, liquidationAlert,
    bonusResult, bonusData, skillAlert,
    joinRoom, openPosition, closePosition, usePlayerSkill, spinSlots, spinWheel, openLootbox, playLoto, voteNextRound,
  } = useGame();

  // Reconnect: достаём данные из sessionStorage
  const [joined, setJoined] = useState(false);
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState(roomFromUrl);
  const [sizePercent, setSizePercent] = useState(25);
  const [leverage, setLeverage] = useState<Leverage>(5);
  const [hasVoted, setHasVoted] = useState(false);
  const [bonusBetPercent, setBonusBetPercent] = useState(10);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [animating, setAnimating] = useState(false);
  // Slots animation
  const [displayReels, setDisplayReels] = useState<string[]>(['?', '?', '?']);
  // Lootbox state
  const [lootboxRevealed, setLootboxRevealed] = useState(false);
  const [revealedBoxes, setRevealedBoxes] = useState<boolean[]>([false, false, false, false]);
  // Loto state
  const [lotoNumbers, setLotoNumbers] = useState<number[]>([]);

  // Автоматический reconnect
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

  // Сброс голоса и слотов при новом раунде
  useEffect(() => {
    setHasVoted(false);
    setHasPlayed(false);
    setAnimating(false);
    setDisplayReels(['?', '?', '?']);
    setLootboxRevealed(false);
    setRevealedBoxes([false, false, false, false]);
    setLotoNumbers([]);
  }, [gameState?.roundNumber]);

  // Lootbox reveal animation
  useEffect(() => {
    if (!bonusResult || bonusResult.type !== 'lootbox' || lootboxRevealed) return;
    const chosen = bonusResult.result.chosenIndex;
    setRevealedBoxes((prev) => { const next = [...prev]; next[chosen] = true; return next; });
    const others = [0, 1, 2, 3].filter((i) => i !== chosen);
    const timeouts = others.map((idx, i) =>
      setTimeout(() => {
        setRevealedBoxes((prev) => { const next = [...prev]; next[idx] = true; return next; });
      }, 1000 + i * 300)
    );
    setLootboxRevealed(true);
    return () => timeouts.forEach(clearTimeout);
  }, [bonusResult, lootboxRevealed]);

  // --- JOIN SCREEN ---
  if (!joined) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
        <h1 className="text-4xl font-black mb-2">
          <span className="text-green-400">INVEST</span>
          <span className="text-yellow-400">SOVET</span>
        </h1>
        <p className="text-gray-500 mb-8">Trading Arena</p>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4 text-red-400 text-center w-full max-w-sm">
            {error}
          </div>
        )}

        <div className="w-full max-w-sm space-y-4">
          <input
            type="text"
            placeholder="Код комнаты"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-4 text-center text-2xl font-mono tracking-widest focus:border-green-500 focus:outline-none text-white"
            maxLength={6}
          />
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Никнейм"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-lg focus:border-green-500 focus:outline-none text-white"
              maxLength={16}
            />
            <button
              onClick={() => setNickname(RANDOM_NICKS[Math.floor(Math.random() * RANDOM_NICKS.length)])}
              className="bg-gray-900 border border-gray-800 rounded-xl px-4 text-xl active:scale-95"
            >
              🎲
            </button>
          </div>
          <button
            onClick={() => {
              if (!roomCode || !nickname) return;
              joinRoom(roomCode, nickname);
              setJoined(true);
            }}
            disabled={!roomCode || !nickname}
            className="w-full bg-green-500 text-black font-bold text-xl py-4 rounded-xl disabled:opacity-30 active:scale-95 transition-all"
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
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
        <div className="text-5xl mb-4 animate-bounce">📈</div>
        <h2 className="text-2xl font-bold">{nickname}</h2>
        <p className="text-gray-500 mt-8 animate-pulse text-lg">Ждём старта...</p>
        {gameState && <p className="text-gray-600 mt-2">Игроков: {gameState.playerCount}</p>}
      </div>
    );
  }

  // --- COUNTDOWN ---
  if (gameState.phase === 'countdown') {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
        <p className="text-gray-400 text-lg">Раунд {gameState.roundNumber}</p>
        <p className="text-yellow-400 text-xl">{gameState.ticker}</p>
        <div className="text-[120px] font-black text-green-400 animate-pulse leading-none mt-4">
          {countdown}
        </div>
      </div>
    );
  }

  // --- TRADING ---
  if (gameState.phase === 'trading' && playerState) {
    const balance = playerState.balance;
    const position = playerState.position;
    const unrealizedPnl = playerState.unrealizedPnl;
    const totalBalance = balance + (unrealizedPnl || 0);
    const tradeSize = Math.floor(balance * sizePercent / 100);

    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        {/* Toast */}
        {tradeMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm z-50">
            {tradeMessage}
          </div>
        )}
        {liquidationAlert && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white font-bold rounded-lg px-4 py-2 z-50 animate-bounce">
            {liquidationAlert}
          </div>
        )}
        {skillAlert && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-purple-600 text-white font-bold rounded-lg px-4 py-2 z-50 animate-bounce">
            {skillAlert}
          </div>
        )}

        {/* Header */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-gray-500 text-xs uppercase">Баланс</p>
              <p className="text-2xl font-mono font-bold">${totalBalance.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-500 text-xs uppercase">PnL</p>
              <p className={`text-2xl font-mono font-bold ${playerState.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {playerState.pnl >= 0 ? '+' : ''}{playerState.pnl.toFixed(2)}$
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 mt-3">
            <span className="text-yellow-400 font-bold">{gameState.ticker}</span>
            <span className="text-xl font-mono font-bold">{formatPrice(currentPrice)}</span>
          </div>
        </div>

        {/* Position */}
        {position && (
          <div className={`mx-4 mt-2 p-3 rounded-xl border ${
            position.direction === 'long' ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
          }`}>
            <div className="flex justify-between items-center">
              <div>
                <span className={`font-bold ${position.direction === 'long' ? 'text-green-400' : 'text-red-400'}`}>
                  {position.direction === 'long' ? '📈 LONG' : '📉 SHORT'} x{position.leverage}
                </span>
                <span className="text-gray-400 ml-2">${position.size}</span>
              </div>
              <div className="text-right">
                <p className={`font-mono font-bold ${unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {unrealizedPnl >= 0 ? '+' : ''}{unrealizedPnl.toFixed(2)}$
                </p>
                <p className="text-gray-500 text-xs">Ликв: {formatPrice(position.liquidationPrice)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Skill Button */}
        {playerState.skill && !playerState.skillUsed && (
          <div className="mx-4 mt-3">
            <button
              onClick={usePlayerSkill}
              className="w-full py-3 rounded-xl font-bold text-lg active:scale-95 transition-all bg-gradient-to-r from-purple-600 to-pink-600 text-white animate-pulse"
            >
              {SKILL_EMOJIS[playerState.skill]} {SKILL_NAMES[playerState.skill]}
              <span className="block text-xs font-normal opacity-80">{SKILL_DESCRIPTIONS[playerState.skill]}</span>
            </button>
          </div>
        )}
        {playerState.skill && playerState.skillUsed && (
          <div className="mx-4 mt-2 text-center">
            <span className="text-gray-500 text-sm">{SKILL_EMOJIS[playerState.skill]} {SKILL_NAMES[playerState.skill]} — использован</span>
            {playerState.shieldActive && <span className="text-yellow-400 text-sm ml-2">🛡️ Щит активен</span>}
            {playerState.freezeTicksLeft > 0 && <span className="text-cyan-400 text-sm ml-2">🧊 Заморозка: {playerState.freezeTicksLeft}</span>}
          </div>
        )}

        <div className="flex-1" />

        {/* Controls */}
        <div className="px-4 pb-6 space-y-3">
          {position ? (
            <button
              onClick={closePosition}
              className={`w-full py-5 rounded-xl font-bold text-xl active:scale-95 transition-all ${
                unrealizedPnl >= 0 ? 'bg-green-500 text-black' : 'bg-red-500 text-white'
              }`}
            >
              ЗАКРЫТЬ {unrealizedPnl >= 0 ? '+' : ''}{unrealizedPnl.toFixed(2)}$
            </button>
          ) : (
            <>
              {/* Leverage */}
              <div>
                <p className="text-gray-500 text-xs mb-1">Плечо</p>
                <div className="flex gap-1.5">
                  {AVAILABLE_LEVERAGES.map((lev) => (
                    <button
                      key={lev}
                      onClick={() => setLeverage(lev)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                        leverage === lev
                          ? lev >= 200 ? 'bg-purple-600 text-white' : lev >= 50 ? 'bg-red-500 text-white' : lev >= 10 ? 'bg-orange-500 text-black' : 'bg-yellow-400 text-black'
                          : 'bg-gray-900 text-gray-400 border border-gray-800'
                      }`}
                    >
                      {lev === 1 ? '1x' : `${lev}x`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Size */}
              <div>
                <div className="flex justify-between text-sm text-gray-400 mb-1">
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
                          ? 'bg-yellow-400 text-black'
                          : 'bg-gray-900 text-gray-400 border border-gray-800'
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
                  disabled={tradeSize <= 0}
                  className="bg-green-500 text-black font-bold text-xl py-6 rounded-xl active:scale-95 transition-all disabled:opacity-30"
                >
                  📈 LONG
                </button>
                <button
                  onClick={() => openPosition('short', tradeSize, leverage)}
                  disabled={tradeSize <= 0}
                  className="bg-red-500 text-white font-bold text-xl py-6 rounded-xl active:scale-95 transition-all disabled:opacity-30"
                >
                  📉 SHORT
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
    const timer = bonusData?.timer || gameState.bonusTimer;
    const bonusType = bonusData?.bonusType || gameState.bonusType;

    const BONUS_TITLES: Record<string, string> = {
      wheel: 'КОЛЕСО ФОРТУНЫ',
      slots: 'СЛОТ-МАШИНА',
      lootbox: 'ЛУТБОКС',
      loto: 'ЛОТО',
    };

    const SLOT_SYMBOLS_DISPLAY = ['₿', 'Ξ', '🐕', '🚀', '💎', '🌕'];

    // --- Slots spin handler ---
    const handleSlotSpin = () => {
      if (hasPlayed || bonusBet <= 0) return;
      setAnimating(true);
      let ticks = 0;
      const spinInterval = setInterval(() => {
        setDisplayReels([
          SLOT_SYMBOLS_DISPLAY[Math.floor(Math.random() * 6)],
          SLOT_SYMBOLS_DISPLAY[Math.floor(Math.random() * 6)],
          SLOT_SYMBOLS_DISPLAY[Math.floor(Math.random() * 6)],
        ]);
        ticks++;
        if (ticks >= 15) {
          clearInterval(spinInterval);
          spinSlots(bonusBet);
          setHasPlayed(true);
          setAnimating(false);
        }
      }, 100);
    };

    // --- Wheel spin handler ---
    const handleWheelSpin = () => {
      if (hasPlayed || bonusBet <= 0) return;
      setAnimating(true);
      setTimeout(() => {
        spinWheel(bonusBet);
        setHasPlayed(true);
        setAnimating(false);
      }, 2000);
    };

    // --- Lootbox handler ---
    const handleLootboxChoice = (index: number) => {
      if (hasPlayed || bonusBet <= 0) return;
      setHasPlayed(true);
      openLootbox(bonusBet, index);
    };

    // --- Loto handlers ---
    const toggleLotoNumber = (n: number) => {
      if (hasPlayed) return;
      setLotoNumbers((prev) =>
        prev.includes(n) ? prev.filter((x) => x !== n) : prev.length < 5 ? [...prev, n] : prev
      );
    };

    const handleLotoPlay = () => {
      if (hasPlayed || bonusBet <= 0 || lotoNumbers.length !== 5) return;
      setHasPlayed(true);
      playLoto(bonusBet, lotoNumbers);
    };

    // Derive slot display reels from result
    const showReels = hasPlayed && bonusResult?.type === 'slots' ? [...bonusResult.result.reels] : displayReels;

    // Get win info from any bonus result
    const winAmount = bonusResult ? bonusResult.result.winAmount : null;
    const multiplier = bonusResult ? bonusResult.result.multiplier : null;

    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
        <p className="text-yellow-400 text-lg font-mono mb-2">{timer}с</p>
        <h2 className="text-3xl font-black mb-6 text-yellow-400">{BONUS_TITLES[bonusType || 'slots']}</h2>

        {/* === WHEEL UI === */}
        {bonusType === 'wheel' && (
          <>
            {/* Wheel sectors display */}
            <div className="grid grid-cols-4 gap-2 mb-6 w-full max-w-sm">
              {[
                { label: 'BUST', color: 'bg-red-600', mult: 0 },
                { label: 'x0.5', color: 'bg-orange-500', mult: 0.5 },
                { label: 'x1.5', color: 'bg-gray-600', mult: 1.5 },
                { label: 'x2', color: 'bg-green-600', mult: 2 },
                { label: 'x3', color: 'bg-blue-600', mult: 3 },
                { label: 'x5', color: 'bg-purple-600', mult: 5 },
                { label: 'x10', color: 'bg-yellow-600', mult: 10 },
                { label: 'x25', color: 'bg-gradient-to-r from-pink-500 to-yellow-500', mult: 25 },
              ].map((sector) => (
                <div
                  key={sector.label}
                  className={`${sector.color} rounded-lg py-3 text-center font-bold text-sm ${
                    hasPlayed && bonusResult?.type === 'wheel' && bonusResult.result.multiplier === sector.mult
                      ? 'ring-4 ring-white scale-110'
                      : hasPlayed ? 'opacity-30' : ''
                  } transition-all`}
                >
                  {sector.label}
                </div>
              ))}
            </div>

            {animating && (
              <div className="text-6xl mb-6 animate-spin">🎡</div>
            )}
          </>
        )}

        {/* === SLOTS UI === */}
        {bonusType === 'slots' && (
          <div className="flex gap-4 mb-8">
            {showReels.map((sym, i) => (
              <div
                key={i}
                className={`w-24 h-24 bg-gray-900 border-2 ${animating ? 'border-yellow-400' : hasPlayed && bonusResult?.type === 'slots' && bonusResult.result.multiplier > 0 ? 'border-green-400' : 'border-gray-700'} rounded-xl flex items-center justify-center text-5xl ${animating ? 'animate-pulse' : ''}`}
              >
                {sym}
              </div>
            ))}
          </div>
        )}

        {/* === LOOTBOX UI === */}
        {bonusType === 'lootbox' && (
          <div className="grid grid-cols-2 gap-4 mb-6 w-full max-w-sm">
            {[0, 1, 2, 3].map((i) => {
              const isRevealed = revealedBoxes[i];
              const isChosen = bonusResult?.type === 'lootbox' && bonusResult.result.chosenIndex === i;
              const boxValue = bonusResult?.type === 'lootbox' ? bonusResult.result.boxes[i] : null;

              return (
                <button
                  key={i}
                  onClick={() => handleLootboxChoice(i)}
                  disabled={hasPlayed}
                  className={`h-28 rounded-xl font-black text-2xl transition-all active:scale-95 ${
                    isRevealed
                      ? isChosen
                        ? boxValue !== null && boxValue >= 2 ? 'bg-green-600 ring-4 ring-green-400' : 'bg-red-600 ring-4 ring-red-400'
                        : 'bg-gray-800 opacity-60'
                      : 'bg-gradient-to-br from-yellow-500 to-orange-600 hover:scale-105'
                  }`}
                >
                  {isRevealed && boxValue !== null
                    ? boxValue === 0 ? 'BUST' : `x${boxValue}`
                    : hasPlayed ? '...' : '🎁'
                  }
                </button>
              );
            })}
          </div>
        )}

        {/* === LOTO UI === */}
        {bonusType === 'loto' && (
          <div className="w-full max-w-sm mb-6">
            <div className="grid grid-cols-5 gap-2 mb-4">
              {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => {
                const isSelected = lotoNumbers.includes(n);
                const isDrawn = bonusResult?.type === 'loto' && bonusResult.result.drawnNumbers.includes(n);
                const isMatch = isDrawn && bonusResult?.type === 'loto' && bonusResult.result.playerNumbers.includes(n);
                const isPlayerOnly = !isDrawn && bonusResult?.type === 'loto' && bonusResult.result.playerNumbers.includes(n);

                return (
                  <button
                    key={n}
                    onClick={() => toggleLotoNumber(n)}
                    disabled={hasPlayed}
                    className={`h-12 rounded-lg font-bold text-lg transition-all active:scale-95 ${
                      hasPlayed
                        ? isMatch
                          ? 'bg-green-500 text-black ring-2 ring-green-300 scale-110'
                          : isDrawn
                            ? 'bg-yellow-500 text-black'
                            : isPlayerOnly
                              ? 'bg-red-500/50 text-white'
                              : 'bg-gray-900 text-gray-600'
                        : isSelected
                          ? 'bg-yellow-400 text-black scale-105'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            {!hasPlayed && (
              <p className="text-center text-gray-400 text-sm">
                Выбрано: {lotoNumbers.length}/5
              </p>
            )}
            {hasPlayed && bonusResult?.type === 'loto' && (
              <div className="text-center mt-2">
                <p className="text-gray-400 text-sm">
                  Выпало: {bonusResult.result.drawnNumbers.join(', ')}
                </p>
                <p className="text-white text-sm">
                  Совпадений: {bonusResult.result.matches}/5
                </p>
              </div>
            )}
          </div>
        )}

        {/* === Result display (all types) === */}
        {hasPlayed && winAmount !== null && multiplier !== null && !animating && (
          <div className="mb-6 text-center">
            <p className={`text-3xl font-black ${winAmount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {multiplier > 0 ? `x${multiplier}` : 'МИМО'}
            </p>
            <p className={`text-xl font-bold mt-1 ${winAmount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {winAmount >= 0 ? '+' : ''}{winAmount.toFixed(0)}$
            </p>
            {multiplier >= 10 && (
              <p className="text-yellow-400 text-lg mt-2 animate-bounce font-black">JACKPOT!</p>
            )}
          </div>
        )}

        {/* === Bet controls (shared for all types) === */}
        {!hasPlayed && !animating && (
          <>
            <div className="w-full max-w-sm mb-4">
              <p className="text-gray-400 text-sm mb-2 text-center">Ставка: ${bonusBet.toLocaleString()}</p>
              <div className="flex gap-2">
                {[5, 10, 25, 50].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setBonusBetPercent(pct)}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all active:scale-95 ${
                      bonusBetPercent === pct
                        ? 'bg-yellow-400 text-black'
                        : 'bg-gray-900 text-gray-400 border border-gray-800'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {bonusType === 'lootbox' ? (
              <p className="text-gray-400 text-lg">Выбери коробку!</p>
            ) : bonusType === 'loto' ? (
              <button
                onClick={handleLotoPlay}
                disabled={bonusBet <= 0 || lotoNumbers.length !== 5}
                className="bg-yellow-400 text-black font-black text-2xl px-12 py-5 rounded-xl active:scale-95 transition-all disabled:opacity-30"
              >
                ИГРАТЬ
              </button>
            ) : (
              <button
                onClick={bonusType === 'wheel' ? handleWheelSpin : handleSlotSpin}
                disabled={bonusBet <= 0}
                className="bg-yellow-400 text-black font-black text-2xl px-12 py-5 rounded-xl active:scale-95 transition-all disabled:opacity-30"
              >
                КРУТИТЬ
              </button>
            )}
          </>
        )}

        {!hasPlayed && animating && (
          <p className="text-yellow-400 text-xl animate-pulse font-bold">
            {bonusType === 'wheel' ? 'Крутим колесо...' : bonusType === 'loto' ? 'Тянем шары...' : 'Крутим...'}
          </p>
        )}

        <p className="text-gray-600 text-sm mt-4">Баланс: ${bonusBalance.toFixed(0)}</p>
      </div>
    );
  }

  // --- VOTING ---
  if (gameState.phase === 'voting') {
    const yes = voteData?.yes || gameState.voteYes;
    const no = voteData?.no || gameState.voteNo;
    const timer = voteData?.timer || gameState.voteTimer;

    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
        {/* Мой результат за раунд */}
        {playerState && (
          <div className="mb-6 text-center">
            <p className="text-gray-400">Раунд {gameState.roundNumber}</p>
            <p className={`text-4xl font-bold mt-2 ${playerState.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {playerState.pnl >= 0 ? '+' : ''}{playerState.pnl.toFixed(2)}$
            </p>
            <p className="text-gray-500 mt-1">Баланс: ${playerState.balance.toFixed(0)}</p>
          </div>
        )}

        <h2 className="text-3xl font-black mb-6">ЕЩЁ РАУНД?</h2>
        <p className="text-yellow-400 text-2xl font-mono mb-6">{timer}с</p>

        {hasVoted ? (
          <div className="text-center">
            <p className="text-2xl text-green-400 font-bold">Голос принят ✓</p>
            <div className="flex gap-8 mt-4">
              <p className="text-green-400 text-xl">ДА: {yes}</p>
              <p className="text-red-400 text-xl">НЕТ: {no}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
            <button
              onClick={() => { voteNextRound(true); setHasVoted(true); }}
              className="bg-green-500 text-black font-bold text-2xl py-8 rounded-xl active:scale-95 transition-all"
            >
              ДА 🔥
            </button>
            <button
              onClick={() => { voteNextRound(false); setHasVoted(true); }}
              className="bg-red-500 text-white font-bold text-2xl py-8 rounded-xl active:scale-95 transition-all"
            >
              НЕТ ✋
            </button>
          </div>
        )}
      </div>
    );
  }

  // --- FINISHED ---
  if (gameState.phase === 'finished') {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
        <div className="text-6xl mb-4">🏁</div>
        <h2 className="text-3xl font-black text-yellow-400">ИГРА ОКОНЧЕНА</h2>
        {playerState && (
          <p className="text-2xl font-bold mt-4">${playerState.balance.toFixed(0)}</p>
        )}
        <button
          onClick={() => {
            sessionStorage.removeItem('investsovet_room');
            sessionStorage.removeItem('investsovet_nick');
            window.location.href = '/play';
          }}
          className="mt-8 bg-gray-800 text-white px-8 py-3 rounded-xl text-lg active:scale-95"
        >
          Новая игра
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <p className="animate-pulse text-xl">Загрузка...</p>
    </div>
  );
}

function formatPrice(price: number): string {
  if (price < 0.001) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  if (price < 100) return price.toFixed(2);
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
