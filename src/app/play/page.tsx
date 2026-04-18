'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useGame, getSocket } from '@/lib/useGame';
import { BONUS_TITLES } from '@/lib/types';
import type { Leverage } from '@/lib/types';

import { formatPrice } from '@/lib/utils';
import { RANDOM_NICKS } from '@/lib/constants';
import { IconTrophy, IconSilver, IconBronze, IconCrown, IconFinish, BONUS_ICON_MAP } from '@/components/icons';
import { WheelGame } from '@/components/games/WheelGame';
import { SlotsGame } from '@/components/games/SlotsGame';
import { LootboxGame } from '@/components/games/LootboxGame';
import { LotoGame } from '@/components/games/LotoGame';

import { ClassicPlay } from '@/components/modes/classic/ClassicPlay';
import { MarketMakerPlay } from '@/components/modes/market-maker/MarketMakerPlay';
import { BinaryPlay } from '@/components/modes/binary/BinaryPlay';
import { DrawPlay } from '@/components/modes/draw/DrawPlay';

export default function PlayPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-white text-xl animate-pulse">Загрузка...</div>}>
      <PlayContent />
    </Suspense>
  );
}

function PlayContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomFromUrl = searchParams.get('room') || '';
  const {
    gameState, playerState, leaderboard, countdown, roundResult, candles, currentPrice,
    tradeMessage, error, liquidationAlert,
    bonusResult, bonusData, skillAlert, finalStats, roomClosed,
    joinRoom, openPosition, closePosition, spinSlots, spinWheel, openLootbox, playLoto,
  } = useGame();

  const [joined, setJoined] = useState(false);
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState(roomFromUrl);

  const [bonusBetPercent, setBonusBetPercent] = useState(10);
  const [wheelLanded, setWheelLanded] = useState(false);

  // MM-specific finished state (listened inside orchestrator since finished is shared)
  const [mmResult, setMmResult] = useState<{ mmWon: boolean; mmBalance: number; tradersAvg: number; mmNickname: string } | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socket.on('marketMakerResult', (data: { mmWon: boolean; mmBalance: number; tradersAvg: number; mmNickname: string }) => setMmResult(data));
    return () => { socket.off('marketMakerResult'); };
  }, []);

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

  // Clear stale session on failed reconnect
  useEffect(() => {
    if (error && joined && !gameState) {
      sessionStorage.removeItem('investsovet_room');
      sessionStorage.removeItem('investsovet_nick');
      setJoined(false);
      setNickname('');
      setRoomCode(roomFromUrl);
    }
  }, [error, joined, gameState, roomFromUrl]);

  // Redirect on room closed
  useEffect(() => {
    if (roomClosed) {
      const t = setTimeout(() => router.push('/'), 3000);
      return () => clearTimeout(t);
    }
  }, [roomClosed, router]);

  // Reset wheel on new round
  useEffect(() => {
    setWheelLanded(false);
  }, [gameState?.roundNumber]);

  // --- JOIN SCREEN ---
  if (!joined) {
    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center p-6">
        <Link href="/" className="absolute top-4 left-4 text-sm text-text-secondary hover:text-white transition-colors">&larr; Назад</Link>
        <h1 className="text-4xl font-display font-black mb-2">
          <span className="font-display text-accent-green" style={{ textShadow: '0 0 30px rgba(0,230,118,0.4)' }}>INVEST</span>
          <span className="font-display text-accent-gold" style={{ textShadow: '0 0 30px rgba(255,215,64,0.4)' }}>SOVET</span>
        </h1>
        <p className="text-text-secondary mb-8">Trading Arena</p>

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
            className="w-full bg-surface border border-border rounded-xl px-4 py-4 text-center text-2xl font-display tracking-[0.3em] focus:border-accent-green focus:outline-none text-white"
            maxLength={6}
          />
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Никнейм"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-lg focus:border-accent-green focus:outline-none text-white"
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
            className="w-full bg-accent-green text-white font-display font-bold text-xl py-4 rounded-xl disabled:opacity-30 active:scale-95 transition-all glow-green"
          >
            ВОЙТИ
          </button>
        </div>
      </div>
    );
  }

  // --- ROOM CLOSED ---
  if (roomClosed) {
    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center p-6">
        <h2 className="text-2xl font-display font-bold text-accent-red mb-4">Комната закрыта</h2>
        <p className="text-text-secondary mb-6">{roomClosed}</p>
        <Link href="/" className="bg-accent-green text-white font-display font-bold py-3 px-6 rounded-xl">
          На главную
        </Link>
        <p className="text-text-muted mt-4">Перенаправление на главную...</p>
      </div>
    );
  }

  // --- WAITING IN LOBBY ---
  if (!gameState || gameState.phase === 'lobby') {
    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center p-6">
        <div className="text-2xl font-display font-bold text-accent-green mb-4 animate-pulse tracking-widest">READY</div>
        <h2 className="text-2xl font-bold">{nickname}</h2>
        <p className="text-text-secondary mt-8 animate-shimmer text-lg">Ждём старта...</p>
        {gameState && <p className="text-text-muted mt-2">Игроков: {gameState.playerCount}</p>}
      </div>
    );
  }

  // --- COUNTDOWN ---
  if (gameState.phase === 'countdown') {
    const isMM = playerState?.role === 'market_maker';
    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center">
        <p className="text-text-secondary text-lg">Раунд {gameState.roundNumber}</p>
        <p className="text-accent-gold text-xl">{gameState.ticker}</p>
        {gameState.gameMode === 'market_maker' && gameState.roundNumber === 1 && (
          <div className={`mt-4 text-2xl font-display font-black animate-pulse ${isMM ? 'text-accent-gold' : 'text-text-primary'}`}>
            {isMM ? '[MM] ТЫ МАРКЕТ-МЕЙКЕР!' : `[TR] ТЫ ТРЕЙДЕР vs ${gameState.marketMakerNickname}`}
          </div>
        )}
        <div className="text-[120px] font-display font-black text-accent-green animate-countdown leading-none mt-4" style={{ textShadow: '0 0 60px rgba(0,230,118,0.5)' }}>
          {countdown}
        </div>
      </div>
    );
  }

  // --- ROUND END (between trading end and bonus start) ---
  if (roundResult && gameState.phase === 'trading' && playerState) {
    const isMM = playerState.role === 'market_maker';
    if (isMM && gameState.gameMode === 'draw') {
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

  // --- GAME PHASES: delegate to mode components ---
  if ((gameState.phase === 'trading' || gameState.phase === 'draw_drawing') && playerState) {
    switch (gameState.gameMode) {
      case 'classic':
        return (
          <ClassicPlay
            gameState={gameState}
            playerState={playerState}
            leaderboard={leaderboard}
            candles={candles}
            currentPrice={currentPrice}
            nickname={nickname}
            openPosition={openPosition}
            closePosition={closePosition}
            tradeMessage={tradeMessage}
            liquidationAlert={liquidationAlert}
            skillAlert={skillAlert}
          />
        );
      case 'market_maker':
        return (
          <MarketMakerPlay
            gameState={gameState}
            playerState={playerState}
            leaderboard={leaderboard}
            candles={candles}
            currentPrice={currentPrice}
            nickname={nickname}
            openPosition={openPosition}
            closePosition={closePosition}
            tradeMessage={tradeMessage}
            liquidationAlert={liquidationAlert}
          />
        );
      case 'binary':
        return (
          <BinaryPlay
            gameState={gameState}
            playerState={playerState}
            leaderboard={leaderboard}
            candles={candles}
            currentPrice={currentPrice}
            nickname={nickname}
          />
        );
      case 'draw':
        return (
          <DrawPlay
            gameState={gameState}
            playerState={playerState}
            leaderboard={leaderboard}
            candles={candles}
            currentPrice={currentPrice}
            nickname={nickname}
            openPosition={openPosition}
            closePosition={closePosition}
            tradeMessage={tradeMessage}
            liquidationAlert={liquidationAlert}
            skillAlert={skillAlert}
          />
        );
    }
  }

  // --- BONUS PHASE (shared for classic, market_maker, draw) ---
  if (gameState.phase === 'bonus' && playerState) {
    const bonusBalance = playerState.balance;
    const bonusBet = Math.floor(bonusBalance * bonusBetPercent / 100);
    const timer = bonusData?.timer ?? gameState.bonusTimer;
    const bonusType = bonusData?.bonusType ?? gameState.bonusType;

    // For wheel: delay showing result until wheel stops spinning
    const showWheelResult = bonusResult?.type === 'wheel' && wheelLanded;
    const canShowResult = bonusResult && (bonusResult.type !== 'wheel' || showWheelResult);
    const winAmount = canShowResult ? bonusResult.result.winAmount : null;
    const multiplier = canShowResult ? bonusResult.result.multiplier : null;

    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center p-6">
        <p className="text-accent-gold text-lg font-mono mb-2">{timer}с</p>
        <h2 className="text-3xl font-display font-black mb-6 text-accent-gold flex items-center gap-2">{BONUS_ICON_MAP[bonusType || 'slots']?.({ size: 28 })} {BONUS_TITLES[bonusType || 'slots']}</h2>

        {/* === GAME COMPONENTS === */}
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

        {/* === Result display (all types) === */}
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

        {/* === Bet controls (shared for all types) === */}
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

        {/* Market Maker Result */}
        {mmResult && (
          <div className={`w-full max-w-md mb-4 rounded-xl p-4 text-center border ${mmResult.mmWon ? 'bg-accent-gold/10 border-accent-gold/50' : 'bg-accent-green/10 border-accent-green/50'}`}>
            <p className="text-xl font-black mb-2 flex items-center justify-center gap-1">
              {mmResult.mmWon ? <><IconCrown size={16} /> МАРКЕТ-МЕЙКЕР ПОБЕДИЛ!</> : 'ТРЕЙДЕРЫ ПОБЕДИЛИ!'}
            </p>
            <p className="text-sm text-text-secondary flex items-center justify-center gap-1">
              <IconCrown size={14} /> {mmResult.mmNickname}: ${mmResult.mmBalance.toFixed(0)} vs Трейдеры: ${mmResult.tradersAvg.toFixed(0)}
            </p>
          </div>
        )}

        <h2 className="text-2xl font-display font-black text-accent-gold mb-4">ИГРА ОКОНЧЕНА</h2>

        {finalStats.length > 0 ? (
          <div className="w-full max-w-md space-y-3 mb-6">
            {finalStats.map((s) => {
              const isMM = s.role === 'market_maker';
              return (
              <div key={s.nickname} className={`rounded-xl p-4 ${isMM ? 'bg-accent-gold/10 border border-accent-gold/30' : s.rank === 1 ? 'bg-accent-gold/10 border border-accent-gold/30' : 'glass border border-border'}`}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xl font-bold flex items-center gap-1">
                    {s.rank === 1 ? <IconTrophy size={24} /> : s.rank === 2 ? <IconSilver size={24} /> : s.rank === 3 ? <IconBronze size={24} /> : `${s.rank}.`} {isMM ? <IconCrown size={16} /> : null}{s.nickname}
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
            );
            })}
          </div>
        ) : playerState && (
          <p className="text-2xl font-bold mt-4 mb-6">${playerState.balance.toFixed(0)}</p>
        )}

        <button
          onClick={() => {
            sessionStorage.removeItem('investsovet_room');
            sessionStorage.removeItem('investsovet_nick');
            window.location.href = '/play';
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
