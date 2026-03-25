'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket } from './socket-client';
import type {
  ClientGameState, ClientPlayerState, LeaderboardEntry,
  RoundResult, Candle, Leverage, SlotResult,
} from './types';

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
  const [slotResult, setSlotResult] = useState<SlotResult | null>(null);
  const [slotData, setSlotData] = useState<{ timer: number; results: { nickname: string; result: SlotResult }[] } | null>(null);
  const candlesRef = useRef<Candle[]>([]);

  useEffect(() => {
    const socket = getSocket();

    socket.on('gameState', (state) => {
      setGameState(state);
      candlesRef.current = state.visibleCandles;
      setCandles([...state.visibleCandles]);
      setCurrentPrice(state.currentPrice);
      if (state.phase !== 'voting') setVoteData(null);
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
      setLiquidationAlert(`💀 ${nickname} ЛИКВИДИРОВАН! -$${loss.toFixed(0)}`);
      setTimeout(() => setLiquidationAlert(''), 3000);
    });

    socket.on('voteUpdate', (data) => setVoteData(data));

    socket.on('slotResult', (result) => setSlotResult(result));
    socket.on('slotUpdate', (data) => setSlotData(data));

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
      socket.off('slotResult');
      socket.off('slotUpdate');
      socket.off('error');
    };
  }, []);

  const createRoom = useCallback(() => getSocket().emit('createRoom'), []);

  const joinRoom = useCallback((roomCode: string, nickname: string) => {
    // Сохранить для reconnect
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

  const voteNextRound = useCallback((vote: boolean) => {
    getSocket().emit('voteNextRound', { vote });
  }, []);

  return {
    gameState, playerState, leaderboard, countdown, roundResult,
    candles, currentPrice, tradeMessage, error, voteData, liquidationAlert,
    slotResult, slotData,
    createRoom, joinRoom, startGame, openPosition, closePosition, spinSlots, voteNextRound,
  };
}
