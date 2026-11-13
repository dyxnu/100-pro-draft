'use client';

import { useMemo, useState } from 'react';
import { ROLES, type Role } from '@/lib/auction/engine';
import { ChampionCard } from '@/components/cards/ChampionCard';
import { ROLE_LABEL } from '@/components/draft/ui';
import type { CardWithInsights } from '@/lib/champions/catalog';

export function CardGallery({ items }: { items: CardWithInsights[] }) {
  const [role, setRole] = useState<Role | 'ALL'>('ALL');
  const [selected, setSelected] = useState<string | null>(null);

  const list = useMemo(() => items
    .filter(i => role === 'ALL' || i.routes.includes(role))
    .sort((a, b) => (role === 'ALL' ? b.card.bestOvr - a.card.bestOvr : b.card.ovr[role] - a.card.ovr[role])),
  [items, role]);
  const sel = items.find(i => i.card.id === selected);

  return (
    <>
      <div className="mt-6 flex flex-wrap gap-2">
        {(['ALL', ...ROLES] as const).map(r => (
          <button
            key={r} onClick={() => setRole(r)}
            className={`rounded-full border px-3 py-1 text-sm ${role === r ? 'border-gold bg-gold/15 text-gold2' : 'border-line text-muted hover:text-text'}`}
          >
            {r === 'ALL' ? 'Todas as rotas' : ROLE_LABEL[r]}
          </button>
        ))}
      </div>

      {sel && (
        <section className="panel mt-6 grid gap-6 p-6 md:grid-cols-[auto_1fr]">
          <ChampionCard card={sel.card} role={role === 'ALL' ? undefined : role} />
          <div className="space-y-4 text-sm">
            <div>
              <h2 className="text-2xl font-bold text-gold2">{sel.card.name}</h2>
              <p className="text-muted">{sel.card.title} · {sel.card.ranged ? 'à distância' : 'corpo a corpo'} · dificuldade {sel.card.difficulty}/10</p>
            </div>
            <div>
              <p className="eyebrow">Overall por rota</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {ROLES.map(r => (
                  <span key={r} className={`rounded-lg border px-3 py-1 ${sel.routes.includes(r) ? 'border-gold/60 text-gold2' : 'border-line text-muted line-through'}`}>
                    {ROLE_LABEL[r]} <b>{sel.card.ovr[r]}</b>
                  </span>
                ))}
              </div>
            </div>
            <Insight title="Forte contra" items={sel.strongVs} empty="Sem vantagem marcante." tone="text-teal" />
            <Insight title="Fraco contra" items={sel.weakVs} empty="Sem fraqueza marcante." tone="text-danger" />
            <Insight title="Sinergias" items={sel.synergies.map(s => `${s.with}: ${s.label}`)} empty="Nenhuma sinergia especial cadastrada." tone="text-gold" />
            <button className="text-muted underline" onClick={() => setSelected(null)}>Fechar</button>
          </div>
        </section>
      )}

      <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] justify-items-center gap-5">
        {list.map(i => (
          <ChampionCard
            key={i.card.id} card={i.card} role={role === 'ALL' ? undefined : role}
            selected={selected === i.card.id}
            onClick={() => { setSelected(i.card.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />
        ))}
      </div>
    </>
  );
}

function Insight({ title, items, empty, tone }: { title: string; items: string[]; empty: string; tone: string }) {
  return (
    <div>
      <p className="eyebrow">{title}</p>
      <p className={`mt-1 ${items.length ? tone : 'text-muted'}`}>{items.length ? items.join(' · ') : empty}</p>
    </div>
  );
}
