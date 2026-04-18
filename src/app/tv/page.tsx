'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useGame } from '@/lib/useGame';
import { QRCodeSVG } from 'qrcode.react';
import { ClassicTV } from '@/components/modes/classic/ClassicTV';
import { MarketMakerTV } from '@/components/modes/market-maker/MarketMakerTV';
import { BinaryTV } from '@/components/modes/binary/BinaryTV';
import { DrawTV } from '@/components/modes/draw/DrawTV';

const MUSIC_URL = 'https://cdn.pixabay.com/audio/2022/10/25/audio_33f9de5e3a.mp3';

export default function TVPage() {
  const {
    gameState, leaderboard, countdown, roundResult, candles, currentPrice,
    liquidationAlert, bonusData, finalStats, roomClosed,
    createRoom, startGame, selectGameMode, returnToLobby, closeRoom,
  } = useGame();
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Redirect on room closed
  useEffect(() => {
    if (roomClosed) {
      const t = setTimeout(() => router.push('/'), 3000);
      return () => clearTimeout(t);
    }
  }, [roomClosed, router]);

  // Music
  useEffect(() => {
    if (!gameState) return;
    const activePhasesForMusic = ['trading', 'countdown', 'binary_betting', 'binary_reveal', 'binary_waiting'];
    if (activePhasesForMusic.includes(gameState.phase)) {
      if (!audioRef.current) {
        audioRef.current = new Audio(MUSIC_URL);
        audioRef.current.loop = true;
        audioRef.current.volume = 0.3;
      }
      audioRef.current.play().catch(() => {});
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  }, [gameState?.phase]);

  // Auto-create room on mount (default to classic)
  const roomCreatedRef = useRef(false);
  useEffect(() => {
    if (gameState || roomCreatedRef.current) return;
    roomCreatedRef.current = true;
    createRoom('classic');
  }, [gameState, createRoom]);

  // --- LOADING ---
  if (!gameState) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-accent-green text-4xl font-display animate-pulse">Загрузка...</div>
      </div>
    );
  }

  // --- ROOM CLOSED ---
  if (roomClosed) {
    return (
      <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center">
        <h2 className="text-3xl font-display font-bold text-accent-red mb-4">Комната закрыта</h2>
        <p className="text-text-secondary">{roomClosed}</p>
        <p className="text-text-muted mt-4">Перенаправление на главную...</p>
      </div>
    );
  }

  const { phase, roomCode, playerNames } = gameState;
  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/play?room=${roomCode}`
    : '';

  // --- LOBBY ---
  if (phase === 'lobby') {
    const minPlayers = gameState.gameMode === 'draw' ? 2 : 1;

    return (
      <div className="h-screen bg-background text-white flex flex-col relative">
        <Link href="/" className="absolute top-4 left-4 text-sm text-text-secondary hover:text-white transition-colors z-10">&larr; Назад</Link>
        <button
          onClick={closeRoom}
          className="absolute top-4 right-4 text-sm text-text-muted hover:text-accent-red transition-colors"
        >
          Закрыть комнату
        </button>
        <header className="text-center py-8">
          <h1 className="text-7xl font-display font-black tracking-tight">
            <span className="font-display text-accent-green" style={{ textShadow: '0 0 40px rgba(0,230,118,0.4)' }}>INVEST</span>
            <span className="font-display text-accent-gold" style={{ textShadow: '0 0 40px rgba(255,215,64,0.4)' }}>SOVET</span>
          </h1>
          <p className="text-text-secondary text-xl mt-2">Trading Arena</p>
        </header>

        <div className="flex-1 flex items-center justify-center gap-16 px-8">
          <div className="flex flex-col items-center gap-4">
            <div className="bg-white p-4 rounded-2xl">
              <QRCodeSVG value={joinUrl} size={220} />
            </div>
            <p className="text-5xl font-display font-mono font-bold text-accent-gold tracking-widest">{roomCode}</p>
            <p className="text-text-muted text-sm">Отсканируй QR или введи код</p>
          </div>

          <div className="glass border border-border rounded-2xl p-8 min-w-80">
            <h3 className="text-text-secondary text-lg mb-4">Игроки ({playerNames.length})</h3>
            {playerNames.length === 0 ? (
              <p className="text-text-muted animate-pulse">Ждём игроков...</p>
            ) : (
              <ul className="space-y-2">
                {playerNames.map((name) => (
                  <li key={name} className="text-xl text-white flex items-center gap-2">
                    <span className="text-accent-green">●</span> {name}
                  </li>
                ))}
              </ul>
            )}

            {/* Mode selector */}
            <div className="mt-6">
              <p className="text-text-secondary text-sm font-semibold uppercase tracking-wider mb-2">Режим</p>
              <div className="flex gap-2 flex-wrap">
                {([
                  { mode: 'classic' as const, label: 'Классика', color: 'from-accent-gold to-amber-500' },
                  { mode: 'market_maker' as const, label: 'Маркет-Мейкер', color: 'from-accent-purple to-purple-500' },
                  { mode: 'binary' as const, label: 'Бинарные', color: 'from-accent-gold to-orange-500' },
                  { mode: 'draw' as const, label: 'Нарисуй график', color: 'from-accent-purple to-violet-500' },
                ]).map(({ mode, label, color }) => (
                  <button
                    key={mode}
                    onClick={() => selectGameMode(mode)}
                    className={`px-4 py-2 rounded-lg font-display font-bold text-sm transition-all ${
                      gameState.gameMode === mode
                        ? `bg-gradient-to-r ${color} text-white scale-105`
                        : 'bg-surface border border-border text-text-secondary hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <footer className="text-center py-6">
          {playerNames.length >= minPlayers ? (
            <button
              onClick={startGame}
              className="bg-accent-green text-white font-display font-bold text-2xl px-12 py-4 rounded-xl hover:bg-accent-green/90 transition-all hover:scale-105 active:scale-95 glow-green animate-glow-pulse"
            >
              СТАРТ
            </button>
          ) : (
            <p className="text-text-muted text-xl">Минимум {minPlayers} игрок{minPlayers > 1 ? 'а' : ''}</p>
          )}
        </footer>
      </div>
    );
  }

  // --- GAME PHASES: delegate to mode components ---
  switch (gameState.gameMode) {
    case 'classic':
      return (
        <ClassicTV
          gameState={gameState}
          leaderboard={leaderboard}
          candles={candles}
          currentPrice={currentPrice}
          countdown={countdown}
          liquidationAlert={liquidationAlert}
          bonusData={bonusData}
          finalStats={finalStats}
          returnToLobby={returnToLobby}
        />
      );

    case 'market_maker':
      return (
        <MarketMakerTV
          gameState={gameState}
          leaderboard={leaderboard}
          candles={candles}
          currentPrice={currentPrice}
          countdown={countdown}
          liquidationAlert={liquidationAlert}
          bonusData={bonusData}
          finalStats={finalStats}
          returnToLobby={returnToLobby}
        />
      );

    case 'binary':
      return (
        <BinaryTV
          gameState={gameState}
          leaderboard={leaderboard}
          finalStats={finalStats}
          countdown={countdown}
          returnToLobby={returnToLobby}
        />
      );

    case 'draw':
      return (
        <DrawTV
          gameState={gameState}
          leaderboard={leaderboard}
          candles={candles}
          currentPrice={currentPrice}
          countdown={countdown}
          liquidationAlert={liquidationAlert}
          bonusData={bonusData}
          finalStats={finalStats}
          returnToLobby={returnToLobby}
        />
      );

    default:
      return (
        <div className="h-screen bg-background flex items-center justify-center text-white text-2xl">
          Загрузка...
        </div>
      );
  }
}
