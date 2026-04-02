'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket } from './socket-client';
import type {
  ClientGameState, ClientPlayerState, LeaderboardEntry,
  RoundResult, Candle, Leverage, BonusResult, BonusType, FinalPlayerStats,
  GameMode,
} from './types';

// Re-export socket getter so mode-specific hooks can reuse it
export { getSocket } from './socket-client';

export function useGame() {
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [playerState, setPlayerState] = useState<ClientPlayerState | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [countdown, setCountdown] = useState(0);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [tradeMessage, setTradeMessage] = useState('');
  const [error, setError] = useState('');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [voteData, setVoteData] = useState<{ yes: number; no: number; total: number; timer: number } | null>(null);
  const [liquidationAlert, setLiquidationAlert] = useState('');
  const [bonusResult, setBonusResult] = useState<BonusResult | null>(null);
  const [bonusData, setBonusData] = useState<{ timer: number; bonusType: BonusType; results: { nickname: string; result: BonusResult }[] } | null>(null);
  const [finalStats, setFinalStats] = useState<FinalPlayerStats[]>([]);
  const [priceAlert, setPriceAlert] = useState('');
  const candlesRef = useRef<Candle[]>([]);

  useEffect(() => {
    const socket = getSocket();

    socket.on('gameState', (state) => {
      setGameState(state);
      candlesRef.current = state.visibleCandles;
      setCandles([...state.visibleCandles]);
      setCurrentPrice(state.currentPrice);
      if (state.phase !== 'voting') setVoteData(null);
      if (state.phase !== 'bonus') { setBonusResult(null); setBonusData(null); }
      if (state.phase === 'countdown') setRoundResult(null);
    });

    socket.on('playerUpdate', (state) => setPlayerState(state));
    socket.on('leaderboard', (entries) => setLeaderboard(entries));
    socket.on('countdown', (sec) => setCountdown(sec));

    socket.on('candleUpdate', ({ candle, price }) => {
      candlesRef.current = [...candlesRef.current, candle];
      setCandles([...candlesRef.current]);
      setCurrentPrice(price);
    });

    socket.on('roundEnd', (result) => setRoundResult(result));

    socket.on('tradeResult', ({ message }) => {
      setTradeMessage(message);
      setTimeout(() => setTradeMessage(''), 2000);
    });

    socket.on('liquidated', ({ nickname, loss }) => {
      setLiquidationAlert(`\u{1F480} ${nickname} \u041B\u0418\u041A\u0412\u0418\u0414\u0418\u0420\u041E\u0412\u0410\u041D! -$${loss.toFixed(0)}`);
      setTimeout(() => setLiquidationAlert(''), 3000);
    });

    socket.on('voteUpdate', (data) => setVoteData(data));

    socket.on('gameFinished', (stats) => setFinalStats(stats));
    socket.on('bonusResult', (result) => setBonusResult(result));
    socket.on('bonusUpdate', (data) => setBonusData(data));

    socket.on('playerJoined', () => {
      // handled via gameState update
    });
    socket.on('playerLeft', () => {
      // handled via gameState update
    });

    socket.on('error', (msg) => {
      setError(msg);
      setTimeout(() => setError(''), 3000);
    });

    return () => {
      socket.off('gameState');
      socket.off('playerUpdate');
      socket.off('leaderboard');
      socket.off('countdown');
      socket.off('candleUpdate');
      socket.off('roundEnd');
      socket.off('tradeResult');
      socket.off('liquidated');
      socket.off('voteUpdate');
      socket.off('bonusResult');
      socket.off('bonusUpdate');
      socket.off('gameFinished');
      socket.off('playerJoined');
      socket.off('playerLeft');
      socket.off('error');
    };
  }, []);

  const createRoom = useCallback((gameMode: GameMode = 'classic') => {
    getSocket().emit('createRoom', { gameMode });
  }, []);

  const joinRoom = useCallback((roomCode: string, nickname: string) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('investsovet_room', roomCode);
      sessionStorage.setItem('investsovet_nick', nickname);
    }
    getSocket().emit('joinRoom', { roomCode, nickname });
  }, []);

  const startGame = useCallback(() => getSocket().emit('startGame'), []);

  const openPosition = useCallback((direction: 'long' | 'short', size: number, leverage: Leverage) => {
    getSocket().emit('openPosition', { direction, size, leverage });
  }, []);

  const closePosition = useCallback(() => getSocket().emit('closePosition'), []);

  const spinSlots = useCallback((bet: number) => {
    getSocket().emit('spinSlots', { bet });
  }, []);

  const spinWheel = useCallback((bet: number) => {
    getSocket().emit('spinWheel', { bet });
  }, []);

  const openLootbox = useCallback((bet: number, chosenIndex: number) => {
    getSocket().emit('openLootbox', { bet, chosenIndex });
  }, []);

  const playLoto = useCallback((bet: number, numbers: number[]) => {
    getSocket().emit('playLoto', { bet, numbers });
  }, []);

  const voteNextRound = useCallback((vote: boolean) => {
    getSocket().emit('voteNextRound', { vote });
  }, []);

  return {
    gameState, playerState, leaderboard, countdown, roundResult,
    candles, currentPrice, tradeMessage, error, voteData, liquidationAlert,
    bonusResult, bonusData, finalStats, priceAlert,
    createRoom, joinRoom, startGame, openPosition, closePosition,
    spinSlots, spinWheel, openLootbox, playLoto, voteNextRound,
  };
}
