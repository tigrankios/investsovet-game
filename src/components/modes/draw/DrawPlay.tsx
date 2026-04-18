'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSocket } from '@/lib/useGame';
import { SKILL_NAMES, SKILL_DESCRIPTIONS } from '@/lib/types';
import type { ClientGameState, ClientPlayerState, LeaderboardEntry, Candle, Leverage, DrawPoint } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import { IconLong, IconShort, IconSkillShield, IconSkillBlind, SKILL_ICON_MAP } from '@/components/icons';
import { MiniChart } from '@/components/charts/MiniChart';

interface DrawPlayProps {
  gameState: ClientGameState;
  playerState: ClientPlayerState;
  leaderboard: LeaderboardEntry[];
  candles: Candle[];
  currentPrice: number;
  nickname: string;
  openPosition: (direction: 'long' | 'short', size: number, leverage: Leverage) => void;
  closePosition: () => void;
  tradeMessage: string;
  liquidationAlert: string;
  skillAlert: string;
}

export function DrawPlay({
  gameState, playerState, leaderboard, candles, currentPrice, nickname,
  openPosition, closePosition, tradeMessage, liquidationAlert, skillAlert,
}: DrawPlayProps) {
  const [sizePercent, setSizePercent] = useState(25);
  const [leverage, setLeverage] = useState<Leverage>(25);

  // Draw-specific state
  const [drawTimer, setDrawTimer] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mmLiquidationAlert, setMmLiquidationAlert] = useState<string | null>(null);

  // Draw-specific socket listeners
  useEffect(() => {
    const socket = getSocket();

    socket.on('drawPhase', ({ timer }: { timer: number }) => {
      setDrawTimer(timer);
      setIsDrawing(true);
    });

    socket.on('mmLiquidationBonus', ({ nickname: nick, amount }: { nickname: string; amount: number }) => {
      setMmLiquidationAlert(`${nick} ликвидирован! +$${amount.toFixed(0)}`);
      setTimeout(() => setMmLiquidationAlert(null), 3000);
    });

    return () => {
      socket.off('drawPhase');
      socket.off('mmLiquidationBonus');
    };
  }, []);

  // Reset draw state on phase changes
  useEffect(() => {
    if (gameState.phase === 'countdown') {
      setIsDrawing(false);
    }
  }, [gameState.phase]);

  const submitDrawing = useCallback((points: DrawPoint[]) => {
    getSocket().emit('submitDrawing', { points });
  }, []);

  const usePlayerSkill = useCallback(() => {
    getSocket().emit('useSkill');
  }, []);

  // Auto-select leverage if current became unavailable
  useEffect(() => {
    const avail = gameState.availableLeverages;
    if (avail && avail.length > 0 && !avail.includes(leverage)) {
      setLeverage(avail[0]);
    }
  }, [gameState.roundNumber]);

  const isMM = playerState.role === 'market_maker';

  // --- DRAW_DRAWING PHASE ---
  if (gameState.phase === 'draw_drawing') {
    if (isMM) {
      return <MMDrawingScreen drawTimer={drawTimer} submitDrawing={submitDrawing} playerState={playerState} />;
    }
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

  // --- TRADING PHASE ---
  if (gameState.phase === 'trading') {
    if (isMM) {
      return <MMTradingScreen gameState={gameState} playerState={playerState} leaderboard={leaderboard} candles={candles} currentPrice={currentPrice} mmLiquidationAlert={mmLiquidationAlert} nickname={nickname} />;
    }

    // Trader trading UI
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

  // Fallback
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
  playerState: ClientPlayerState;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<DrawPoint[]>([]);
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const submittedRef = useRef(false);
  const pointsRef = useRef<DrawPoint[]>([]);
  const cssSizeRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

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

    ctx.clearRect(0, 0, canvas.width, canvas.height);

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
      <div className="px-4 pt-4 pb-2 flex justify-between items-center">
        <span className="font-display font-bold text-accent-purple">MM DRAW</span>
        <span className="font-mono text-accent-gold">{drawTimer}с</span>
      </div>

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
  gameState: ClientGameState;
  playerState: ClientPlayerState;
  leaderboard: LeaderboardEntry[];
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
      {mmLiquidationAlert && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-accent-purple text-white font-bold rounded-lg px-4 py-2 z-50 animate-alert">
          {mmLiquidationAlert}
        </div>
      )}

      <div className="px-4 pt-4 pb-2">
        <div className="flex justify-between items-center">
          <span className="font-display font-bold text-accent-purple">MM</span>
          <span className="text-xl font-mono font-bold">{formatPrice(currentPrice)}</span>
          <span className="text-text-secondary text-sm">R{gameState.roundNumber}</span>
        </div>
      </div>

      {candles.length > 0 && (
        <div className="mx-2 mt-2 rounded-xl overflow-hidden" style={{ height: '40vw', maxHeight: '220px', minHeight: '140px' }}>
          <MiniChart candles={candles} positions={leaderboard} />
        </div>
      )}

      <div className="px-4 mt-4 space-y-3">
        <div className="bg-surface rounded-xl border border-border p-3 text-center">
          <p className="text-text-secondary text-xs uppercase mb-1">Твой рисунок vs реальность</p>
          <p className="text-accent-purple font-display font-bold text-lg">Наблюдай...</p>
        </div>

        <div className="bg-surface rounded-xl border border-accent-purple/30 p-3">
          <div className="flex justify-between items-center">
            <span className="text-text-secondary text-sm">Заработок</span>
            <span className="text-accent-purple font-mono font-bold text-xl">${playerState.balance.toFixed(0)}</span>
          </div>
        </div>

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
