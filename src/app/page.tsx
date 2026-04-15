'use client';

import { useRouter } from 'next/navigation';
import { IconTV, IconPhone } from '@/components/icons';

export default function Home() {
  const router = useRouter();

  return (
    <div
      className="min-h-screen bg-background text-text-primary flex flex-col items-center justify-center p-6"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(0,230,118,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(255,215,64,0.05) 0%, transparent 50%), #0B0E17' }}
    >
      <div className="text-center animate-slide-up">
        <h1 className="text-7xl font-display font-black tracking-tight mb-2">
          <span className="text-accent-green" style={{ textShadow: '0 0 40px rgba(0,230,118,0.4)' }}>INVEST</span>
          <span className="text-accent-gold" style={{ textShadow: '0 0 40px rgba(255,215,64,0.4)' }}>SOVET</span>
        </h1>
        <p className="text-text-secondary text-xl mb-12">Командная игра для пацанов</p>

        <div className="flex flex-col gap-4 max-w-sm mx-auto">
          <p className="text-text-secondary text-sm font-semibold uppercase tracking-wider mb-1">Режим: Классика</p>
          <button
            onClick={() => router.push('/tv')}
            className="bg-gradient-to-r from-accent-gold to-amber-500 text-background font-display font-bold text-xl py-5 rounded-2xl glow-gold hover:scale-105 transition-all active:scale-95"
          >
            <span className="flex items-center justify-center gap-2"><IconTV size={24} color="#0B0E17" /> Классика — на ТВ</span>
          </button>

          <p className="text-text-secondary text-sm font-semibold uppercase tracking-wider mb-1 mt-4">Режим: Маркет-Мейкер</p>
          <button
            onClick={() => router.push('/tv-mm')}
            className="bg-gradient-to-r from-accent-purple to-purple-500 text-white font-display font-bold text-xl py-5 rounded-2xl hover:scale-105 transition-all active:scale-95"
            style={{ boxShadow: '0 0 30px rgba(139,92,246,0.3)' }}
          >
            <span className="flex items-center justify-center gap-2"><IconTV size={24} /> Маркет-Мейкер — на ТВ</span>
          </button>

          <p className="text-text-secondary text-sm font-semibold uppercase tracking-wider mb-1 mt-4">Режим: Бинарные Опционы</p>
          <button
            onClick={() => router.push('/tv-binary')}
            className="bg-gradient-to-r from-accent-gold to-orange-500 text-background font-display font-bold text-xl py-5 rounded-2xl hover:scale-105 transition-all active:scale-95"
            style={{ boxShadow: '0 0 30px rgba(255,152,0,0.3)' }}
          >
            <span className="flex items-center justify-center gap-2"><IconTV size={24} color="#0B0E17" /> Бинарные Опционы — на ТВ</span>
          </button>

          <p className="text-text-secondary text-sm font-semibold uppercase tracking-wider mb-1 mt-4">Режим: Нарисуй график</p>
          <button
            onClick={() => router.push('/tv-draw')}
            className="bg-gradient-to-r from-accent-purple to-violet-500 text-white font-display font-bold text-xl py-5 rounded-2xl hover:scale-105 transition-all active:scale-95"
            style={{ boxShadow: '0 0 30px rgba(179,136,255,0.3)' }}
          >
            <span className="flex items-center justify-center gap-2"><IconTV size={24} /> Нарисуй график — на ТВ</span>
          </button>

          <div className="border-t border-border mt-4 pt-4">
            <button
              onClick={() => router.push('/play')}
              className="w-full glass text-accent-green font-display font-bold text-xl py-5 rounded-2xl hover:border-accent-green/60 transition-all active:scale-95"
            >
              <span className="flex items-center justify-center gap-2"><IconPhone size={24} /> Войти как игрок</span>
            </button>
          </div>
        </div>

        <div className="mt-16 text-text-muted text-sm max-w-md mx-auto">
          <p>Быки vs Медведи. Крипта, трейдинг, тачки, и не только.</p>
          <p className="mt-1">Собирайтесь перед экраном и играйте с телефонов.</p>
        </div>
      </div>
    </div>
  );
}
