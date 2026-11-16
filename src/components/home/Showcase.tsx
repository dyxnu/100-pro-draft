'use client';

import { useEffect, useState } from 'react';
import { ChampImg, ROLE_LABEL } from '@/components/draft/ui';
import type { Role } from '@/lib/auction/engine';

export interface ShowcaseChamp { id: string; name: string; title: string; roles: string[]; routes: Role[] }

/** Carta de vitrine que troca de campeão sozinha (Diana primeiro). */
export function Showcase({ champs, stats }: { champs: ShowcaseChamp[]; stats: { k: string; v: string }[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || champs.length < 2) return;
    const id = setInterval(() => setI(x => (x + 1) % champs.length), 4200);
    return () => clearInterval(id);
  }, [paused, champs.length]);
  const c = champs[i];

  return (
    <div className="showcase relative overflow-hidden rounded-3xl border-[3px] border-[#d8b75e] bg-gradient-to-b from-[#fff8e3] to-[#fbefcf] shadow-[0_20px_50px_-24px_rgba(38,42,114,.55)]">
      <div className="flex items-center justify-between px-4 py-2.5 text-xs font-bold text-[#7a6224]">
        <span>100 pro Draft</span>
        <button onClick={() => setPaused(p => !p)} className="rounded-md border border-[#d8b75e] px-2 py-0.5" aria-label={paused ? 'Continuar vitrine' : 'Pausar vitrine'}>
          {paused ? '▶' : '❚❚'}
        </button>
      </div>
      <div className="relative mx-3 h-[340px] overflow-hidden rounded-2xl bg-gradient-to-b from-[#2b2e6e] via-[#4b4fb5] to-[#8f86e6]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_18%,rgba(255,255,255,.55)_0,rgba(255,255,255,0)_22%)]" />
        <div key={c.id} className="anim-card-in absolute inset-0 flex flex-col items-center justify-end pb-4">
          <div className="anim-float h-[260px] w-[150px] overflow-hidden rounded-xl shadow-[0_18px_30px_-10px_rgba(0,0,0,.6)] ring-2 ring-white/50">
            <ChampImg id={c.id} name={c.name} big className="h-full w-full object-cover" />
          </div>
          <p className="mt-3 text-3xl font-black text-white drop-shadow-[0_2px_6px_rgba(0,0,0,.5)]">{c.name}</p>
          <div className="mt-1 flex flex-wrap justify-center gap-1">
            {c.routes.map(r => <span key={r} className="rounded-md bg-white/85 px-2 py-0.5 text-[11px] font-bold text-gold2">{ROLE_LABEL[r]}</span>)}
            {c.roles.slice(0, 2).map(r => <span key={r} className="rounded-md bg-[#fff3c4]/90 px-2 py-0.5 text-[11px] font-bold text-[#7a6224]">{r}</span>)}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 px-3 py-4 text-center">
        {stats.map(s => (
          <div key={s.k}>
            <p className="text-lg font-black text-gold2">{s.v}</p>
            <p className="text-[11px] font-semibold text-[#7a6224]">{s.k}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
