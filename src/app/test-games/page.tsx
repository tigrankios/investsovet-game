'use client';

import { IconWheel, IconSlots, IconLootbox, IconLoto } from '@/components/icons';

const games = [
  { name: 'Колесо Фортуны', desc: '8 секторов, крути и молись', href: '/test-wheel', icon: IconWheel, color: '#FFD740' },
  { name: 'Слот-Машина', desc: '3 барабана, собери комбо', href: '/test-slots', icon: IconSlots, color: '#FFD740' },
  { name: 'Лутбокс', desc: '4 коробки, выбери одну', href: '/test-lootbox', icon: IconLootbox, color: '#FFD740' },
  { name: 'Лото', desc: 'Выбери 5 чисел из 20', href: '/test-loto', icon: IconLoto, color: '#FFD740' },
];

export default function TestGames() {
  return (
    <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center p-6">
      <a href="/" className="absolute top-4 left-4 text-text-secondary hover:text-text-primary text-sm">&larr; Главная</a>

      <h1 className="text-4xl font-display font-black text-accent-gold mb-2" style={{ textShadow: '0 0 30px rgba(255,215,64,0.4)' }}>
        МИНИ-ИГРЫ
      </h1>
      <p className="text-text-secondary mb-10">Тестовые страницы — играй без подключения к комнате</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
        {games.map((g) => (
          <a key={g.href} href={g.href}
            className="glass rounded-2xl p-6 hover:bg-surface-light transition-all hover:scale-[1.02] active:scale-95 group cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-accent-gold/10 flex items-center justify-center flex-shrink-0 group-hover:bg-accent-gold/20 transition-all">
                <g.icon size={32} color={g.color} />
              </div>
              <div>
                <p className="font-display font-bold text-lg text-text-primary">{g.name}</p>
                <p className="text-text-secondary text-sm">{g.desc}</p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
