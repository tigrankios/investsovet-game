'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useGame } from '@/lib/useGame';
import { INITIAL_BALANCE } from '@/lib/types';

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
    tradeMessage, error,
    joinRoom, openPosition, closePosition,
  } = useGame();

  const [joined, setJoined] = useState(false);
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState(roomFromUrl);
  const [sizePercent, setSizePercent] = useState(25); // % от баланса

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
        {gameState && (
          <p className="text-gray-600 mt-2">Игроков: {gameState.playerCount}</p>
        )}
      </div>
    );
  }

  // --- COUNTDOWN ---
  if (gameState.phase === 'countdown') {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
        <p className="text-gray-400 text-xl">{gameState.ticker}</p>
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
        {/* Trade message toast */}
        {tradeMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm z-50 animate-pulse">
            {tradeMessage}
          </div>
        )}

        {/* Balance header */}
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

          {/* Ticker + price */}
          <div className="flex items-center justify-center gap-3 mt-3">
            <span className="text-yellow-400 font-bold">{gameState.ticker}</span>
            <span className="text-xl font-mono font-bold">{formatPrice(currentPrice)}</span>
          </div>
        </div>

        {/* Position info */}
        {position && (
          <div className={`mx-4 mt-2 p-3 rounded-xl border ${
            position.direction === 'long'
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-red-500/10 border-red-500/30'
          }`}>
            <div className="flex justify-between items-center">
              <div>
                <span className={`font-bold ${position.direction === 'long' ? 'text-green-400' : 'text-red-400'}`}>
                  {position.direction === 'long' ? '📈 LONG' : '📉 SHORT'}
                </span>
                <span className="text-gray-400 ml-2">${position.size}</span>
              </div>
              <div className="text-right">
                <p className={`font-mono font-bold ${unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {unrealizedPnl >= 0 ? '+' : ''}{unrealizedPnl.toFixed(2)}$
                </p>
                <p className="text-gray-500 text-xs">Вход: {formatPrice(position.entryPrice)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Trading controls */}
        <div className="px-4 pb-6 space-y-4">
          {position ? (
            /* Close position */
            <button
              onClick={closePosition}
              className={`w-full py-5 rounded-xl font-bold text-xl active:scale-95 transition-all ${
                unrealizedPnl >= 0
                  ? 'bg-green-500 text-black'
                  : 'bg-red-500 text-white'
              }`}
            >
              ЗАКРЫТЬ {unrealizedPnl >= 0 ? '+' : ''}{unrealizedPnl.toFixed(2)}$
            </button>
          ) : (
            <>
              {/* Size selector */}
              <div>
                <div className="flex justify-between text-sm text-gray-400 mb-2">
                  <span>Сумма: ${tradeSize.toLocaleString()}</span>
                  <span>{sizePercent}%</span>
                </div>
                <div className="flex gap-2">
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

              {/* Long / Short buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => openPosition('long', tradeSize)}
                  disabled={tradeSize <= 0}
                  className="bg-green-500 text-black font-bold text-xl py-6 rounded-xl active:scale-95 transition-all disabled:opacity-30"
                >
                  📈 LONG
                </button>
                <button
                  onClick={() => openPosition('short', tradeSize)}
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

  // --- FINISHED ---
  if (gameState.phase === 'finished' && roundResult) {
    const myResult = roundResult.leaderboard.find((e) => e.nickname === nickname);
    const myRank = roundResult.leaderboard.findIndex((e) => e.nickname === nickname) + 1;
    const isWinner = myRank === 1;

    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
        <div className="text-6xl mb-4">{isWinner ? '🏆' : myRank <= 3 ? '🥈' : '💀'}</div>
        <h2 className={`text-3xl font-black ${isWinner ? 'text-yellow-400' : 'text-gray-300'}`}>
          {isWinner ? 'ПОБЕДА!' : `#${myRank}`}
        </h2>
        {myResult && (
          <>
            <p className={`text-3xl font-bold mt-4 ${myResult.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {myResult.totalPnl >= 0 ? '+' : ''}{myResult.totalPnl.toFixed(2)}$
            </p>
            <p className="text-gray-400 mt-2">Баланс: ${myResult.balance.toFixed(2)}</p>
          </>
        )}
        <p className="text-gray-600 mt-8">{gameState.ticker} — {roundResult.duration}с</p>
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
