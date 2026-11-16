'use client';

import { useEffect, useState } from 'react';
import { ROLE_LABEL } from '@/components/draft/ui';

// Ponto horizontal (0–100%) para centralizar o campeão na splash quando ela é recortada.
const FOCUS: Record<string, number> = {};
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
      <div className="relative mx-3 h-[380px] overflow-hidden rounded-2xl bg-[#1d2148]">
        {/* Splash art oficial ocupando o bloco todo, com zoom lento (efeito Ken Burns) e troca em fade */}
        <div key={c.id} className="showcase-slide absolute inset-0">
          <img
            src={`https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${c.id}_0.jpg`}
            alt={c.name}
            className="showcase-splash absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: `${FOCUS[c.id] ?? 50}% 30%` }}
          />
          <div className="showcase-shine absolute inset-0" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#141738]/95 via-[#141738]/55 to-transparent" />
          <div className="anim-fade-up absolute inset-x-0 bottom-0 flex flex-col items-center pb-5">
            <p className="text-4xl font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.6)]">{c.name}</p>
            <p className="text-sm font-semibold italic text-white/80">{c.title}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-1">
              {c.routes.map(r => <span key={r} className="rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-bold text-gold2">{ROLE_LABEL[r]}</span>)}
              {c.roles.slice(0, 2).map(r => <span key={r} className="rounded-md bg-[#fff3c4]/90 px-2 py-0.5 text-[11px] font-bold text-[#7a6224]">{r}</span>)}
            </div>
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
