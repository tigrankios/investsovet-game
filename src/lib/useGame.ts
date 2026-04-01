'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket } from './socket-client';
import type {
  ClientGameState, ClientPlayerState, LeaderboardEntry,
  RoundResult, Candle, Leverage, BonusResult, BonusType, SkillType,
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
  const [bonusResult, setBonusResult] = useState<BonusResult | null>(null);
  const [bonusData, setBonusData] = useState<{ timer: number; bonusType: BonusType; results: { nickname: string; result: BonusResult }[] } | null>(null);
  const [skillAlert, setSkillAlert] = useState('');
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

    socket.on('bonusResult', (result) => setBonusResult(result));
    socket.on('bonusUpdate', (data) => setBonusData(data));

    socket.on('skillAssigned', () => {
      // playerUpdate will carry the skill info
    });
    socket.on('skillUsed', ({ nickname, skill }) => {
      const names: Record<string, string> = {
        trump_tweet: '🇺🇸 ТВИТ ТРАМПА',
        inverse: '🔄 ИНВЕРСИЯ',
        shield: '🛡️ ЩИТ',
        double_or_nothing: '💰 ВА-БАНК',
        freeze: '🧊 ЗАМОРОЗКА',
      };
      setSkillAlert(`${nickname}: ${names[skill] || skill}!`);
      setTimeout(() => setSkillAlert(''), 3000);
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
      socket.off('skillAssigned');
      socket.off('skillUsed');
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
  const usePlayerSkill = useCallback(() => getSocket().emit('useSkill'), []);

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
    bonusResult, bonusData, skillAlert,
    createRoom, joinRoom, startGame, openPosition, closePosition, usePlayerSkill,
    spinSlots, spinWheel, openLootbox, playLoto, voteNextRound,
  };
}
