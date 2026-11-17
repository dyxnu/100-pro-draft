'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import { MoonBladeEmblem } from '@/components/Logo';

export interface RingChamp { id: string; name: string; title: string }

/**
 * Desfile 3D de cartas de campeão (arte de carregamento) girando em anel.
 * O anel inclina seguindo o mouse; passar o mouse pausa o giro.
 */
export function ChampionRing({ champs }: { champs: RingChamp[] }) {
  const stage = useRef<HTMLDivElement>(null);
  const tilt = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stage.current, t = tilt.current;
    if (!el || !t) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0, nx = 0, ny = 0;
    const apply = () => {
      raf = 0;
      t.style.setProperty('--ry', `${nx * 16}deg`);
      t.style.setProperty('--rx', `${ny * -10}deg`);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      nx = (e.clientX - r.left) / r.width - 0.5;
      ny = (e.clientY - r.top) / r.height - 0.5;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const leave = () => { nx = 0; ny = 0; if (!raf) raf = requestAnimationFrame(apply); };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); cancelAnimationFrame(raf); };
  }, []);

  const n = champs.length;
  return (
    <div ref={stage} className="hm-stage" role="img" aria-label={`Desfile de campeões: ${champs.map(c => c.name).join(', ')}`}>
      <div className="hm-floor" />
      <div ref={tilt} className="hm-tilt">
        <div className="hm-ring">
          {champs.map((c, i) => (
            <figure key={c.id} className="hm-card" style={{ '--i': i, '--n': n } as CSSProperties}>
              <div className="hm-face">
                <img
                  src={`https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${c.id}_0.jpg`}
                  alt="" loading={i < 3 || i > n - 3 ? 'eager' : 'lazy'} decoding="async" draggable={false}
                />
                <figcaption>
                  <p className="text-sm font-black leading-tight text-white drop-shadow sm:text-base">{c.name}</p>
                  <p className="truncate text-[10px] font-semibold italic text-[#e8e5ff]/80 sm:text-[11px]">{c.title}</p>
                </figcaption>
              </div>
              <div className="hm-back"><MoonBladeEmblem /></div>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}
