'use client';

import { useEffect, useState, useCallback } from 'react';
import { useGame, getSocket } from './useGame';
import type {
  BinaryDirection,
  BinaryBet,
  BinaryRoundState,
  BinaryPayout,
  BinaryRevealedBets,
  BinaryRoundResult,
  Candle,
} from './types';

export function useBinaryGame() {
  const game = useGame();

  const [binaryRound, setBinaryRound] = useState<BinaryRoundState | null>(null);
  const [myBet, setMyBet] = useState<BinaryBet | null>(null);
  const [betTimer, setBetTimer] = useState<number>(0);
  const [lastResult, setLastResult] = useState<{ direction: BinaryDirection; amount: number } | null>(null);
  const [eliminated, setEliminated] = useState(false);
  const [revealedBets, setRevealedBets] = useState<BinaryRevealedBets | null>(null);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);
  const [initialCandleCount, setInitialCandleCount] = useState(0);

  useEffect(() => {
    const socket = getSocket();

    // New round starts — reset local state
    socket.on('binaryRound', (round: BinaryRoundState) => {
      setBinaryRound(round);
      setInitialCandleCount(round.candles.length);
      setMyBet(null);
      setLastResult(null);
      setRevealedBets(null);
      setCancelMessage(null);
    });

    // Bets revealed (1s reveal phase)
    socket.on('binaryReveal', (data: BinaryRevealedBets) => {
      setRevealedBets(data);
    });

    // New candle appears during waiting phase
    socket.on('binaryCandle', ({ candle }: { candle: Candle }) => {
      setBinaryRound((prev) => {
        if (!prev) return prev;
        return { ...prev, candles: [...prev.candles, candle] };
      });
    });

    // Round result
    socket.on('binaryResult', (result: BinaryRoundResult) => {
      // Find my payout
      const myId = socket.id;
      const myPayout = result.payouts.find((p: BinaryPayout) => p.playerId === myId);
      if (myPayout) {
        setLastResult({ direction: result.direction, amount: myPayout.payout });
      }
      setBinaryRound((prev) => {
        if (!prev) return prev;
        return { ...prev, phase: 'result' };
      });
    });

    // Player eliminated (balance = 0)
    socket.on('playerEliminated', ({ playerId }: { playerId: string }) => {
      if (playerId === socket.id) {
        setEliminated(true);
      }
    });

    // Bet timer countdown
    socket.on('betTimer', (seconds: number) => {
      setBetTimer(seconds);
    });

    // Round cancelled (all bets same direction)
    socket.on('binaryRoundCancelled', (data: { message: string }) => {
      setMyBet(null);
      setCancelMessage(data.message);
      setTimeout(() => setCancelMessage(null), 3000);
    });

    return () => {
      socket.off('binaryRound');
      socket.off('binaryReveal');
      socket.off('binaryCandle');
      socket.off('binaryResult');
      socket.off('playerEliminated');
      socket.off('betTimer');
      socket.off('binaryRoundCancelled');
    };
  }, []);

  const placeBet = useCallback((direction: BinaryDirection, percent: number) => {
    const socket = getSocket();
    socket.emit('placeBet', { direction, percent });
    // Optimistically set myBet
    const balance = game.playerState?.balance ?? 0;
    const amount = Math.floor(balance * percent / 100);
    setMyBet({
      playerId: socket.id ?? '',
      nickname: '',
      direction,
      amount,
      percent,
    });
  }, [game.playerState?.balance]);

  return {
    ...game,
    binaryRound,
    myBet,
    betTimer,
    lastResult,
    eliminated,
    revealedBets,
    cancelMessage,
    initialCandleCount,
    placeBet,
  };
}
