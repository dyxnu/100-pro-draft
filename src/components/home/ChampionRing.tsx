'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { MoonBladeEmblem } from '@/components/Logo';

export interface RingChamp { id: string; name: string; title: string; skins?: number[] }

const AUTO_SPEED = 7.5;   // graus por segundo girando sozinho
const FRICTION = 0.94;    // quanto a inércia do arraste diminui por quadro

/**
 * Desfile 3D de cartas de campeão. Gira sozinho; dá para arrastar (mouse ou dedo) e soltar com
 * inércia, ou tocar numa carta para trazê-la para a frente. A carta da frente acende e mostra
 * o nome grande; a arte não pode ser selecionada nem arrastada.
 */
export function ChampionRing({ champs }: { champs: RingChamp[] }) {
  const stage = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const n = champs.length;
  const step = 360 / n;
  const [front, setFront] = useState(0);

  useEffect(() => {
    const el = stage.current, r = ring.current;
    if (!el || !r) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let angle = 0, vel = 0, dragging = false, lastX = 0, lastT = 0, moved = 0, target: number | null = null;
    let hover = false, raf = 0, prev = performance.now(), shownFront = -1;

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      if (target != null) {
        const diff = target - angle;
        angle += diff * Math.min(1, dt * 7);
        if (Math.abs(diff) < 0.05) { angle = target; target = null; }
      } else if (!dragging) {
        if (Math.abs(vel) > 0.5) { angle += vel * dt; vel *= FRICTION; }
        else if (!hover && !reduce) angle -= AUTO_SPEED * dt;
      }
      r.style.transform = `rotateY(${angle}deg)`;
      const f = ((Math.round(-angle / step) % n) + n) % n;
      if (f !== shownFront) { shownFront = f; setFront(f); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const down = (e: PointerEvent) => {
      dragging = true; target = null; vel = 0; moved = 0;
      lastX = e.clientX; lastT = performance.now();
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX, t = performance.now();
      const deg = dx * (360 / Math.max(600, el.clientWidth * 1.6));
      angle += deg; moved += Math.abs(dx);
      vel = deg / Math.max(0.008, (t - lastT) / 1000);
      lastX = e.clientX; lastT = t;
    };
    const up = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (moved < 6) {  // foi um toque: traz a carta tocada para a frente
        vel = 0;
        const card = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-i]');
        if (card) {
          const i = Number(card.dataset.i);
          const base = -i * step;
          target = base + Math.round((angle - base) / 360) * 360;
        }
      } else {
        target = null;
        vel = Math.max(-420, Math.min(420, vel));
      }
    };
    const enter = (e: PointerEvent) => { if (e.pointerType === 'mouse') hover = true; };
    const leave = () => { hover = false; };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointerleave', leave);
    };
  }, [n, step]);

  const cur = champs[front];
  return (
    <div className="hm-stage-wrap">
      <div ref={stage} className="hm-stage" aria-label={`Desfile de campeões: ${champs.map(c => c.name).join(', ')}. Arraste para girar.`} role="region">
        <div className="hm-floor" />
        <div className="hm-tilt">
          <div ref={ring} className="hm-ring">
            {champs.map((c, i) => (
              <figure key={c.id} data-i={i} className={`hm-card ${i === front ? 'is-front' : ''}`} style={{ '--i': i, '--n': n } as CSSProperties}>
                <div className="hm-face">
                  <img
                    src={`https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${c.id}_0.jpg`}
                    alt="" loading={i < 3 || i > n - 3 ? 'eager' : 'lazy'} decoding="async" draggable={false}
                  />
                </div>
                <div className="hm-back"><MoonBladeEmblem /></div>
              </figure>
            ))}
          </div>
        </div>
      </div>
      <div className="hm-nameplate" aria-live="polite">
        {cur && (
          <div key={cur.id} className="hm-nameplate-in">
            <p className="hm-np-name">{cur.name}</p>
            <p className="hm-np-title">{cur.title}</p>
          </div>
        )}
        <p className="hm-np-hint">Arraste para girar · toque numa carta</p>
      </div>
    </div>
  );
}
