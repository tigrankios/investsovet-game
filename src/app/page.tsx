'use client';

import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-7xl font-black tracking-tight mb-2">
          <span className="text-green-400">INVEST</span>
          <span className="text-yellow-400">SOVET</span>
        </h1>
        <p className="text-gray-400 text-xl mb-12">Командная игра для пацанов</p>

        <div className="flex flex-col gap-4 max-w-sm mx-auto">
          <button
            onClick={() => router.push('/tv')}
            className="bg-yellow-400 text-black font-bold text-xl py-5 rounded-xl hover:bg-yellow-300 transition-all hover:scale-105 active:scale-95"
          >
            📺 Запустить на ТВ
          </button>
          <button
            onClick={() => router.push('/play')}
            className="bg-green-400/10 text-green-400 border border-green-400/30 font-bold text-xl py-5 rounded-xl hover:bg-green-400/20 transition-all active:scale-95"
          >
            📱 Войти как игрок
          </button>
        </div>

        <div className="mt-16 text-gray-600 text-sm max-w-md mx-auto">
          <p>Быки vs Медведи. Крипта, трейдинг, тачки, и не только.</p>
          <p className="mt-1">Собирайтесь перед экраном и играйте с телефонов.</p>
        </div>
      </div>
    </div>
  );
}
