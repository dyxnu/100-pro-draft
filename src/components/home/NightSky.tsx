'use client';

import { useEffect, useRef } from 'react';

interface Star { x: number; y: number; s: number; p: number; v: number; c: string }
interface Mote { x: number; y: number; vx: number; vy: number; r: number; a: number; c: string }
interface Comet { x: number; y: number; vx: number; vy: number; life: number }

const STAR_COLORS = ['#ffffff', '#e8e5ff', '#c9c3f5', '#fff3c4'];
const MOTE_COLORS = ['232,229,255', '243,214,138', '157,148,240'];

/**
 * Céu noturno leve em canvas: estrelas "pixeladas" piscando, poeira lunar subindo e estrelas cadentes.
 * Pausa fora da tela; com movimento reduzido desenha um quadro estático.
 */
export function NightSky() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    let w = 0, h = 0, raf = 0, visible = true;
    let stars: Star[] = [];
    let motes: Mote[] = [];
    let comet: Comet | null = null;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(220, Math.round((w * h) / 2800));
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h * 0.9,
        s: Math.random() < 0.12 ? 3 : Math.random() < 0.5 ? 2 : 1,
        p: Math.random() * Math.PI * 2, v: 0.6 + Math.random() * 1.8,
        c: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
      }));
      motes = Array.from({ length: Math.min(36, Math.round(w / 30)) }, () => ({
        x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.15, vy: -(0.1 + Math.random() * 0.35),
        r: 0.8 + Math.random() * 1.8, a: 0.2 + Math.random() * 0.5, c: MOTE_COLORS[Math.floor(Math.random() * MOTE_COLORS.length)],
      }));
      if (reduce) draw(0);
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const time = t / 1000;
      for (const s of stars) {
        ctx.globalAlpha = reduce ? 0.8 : 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(time * s.v + s.p));
        ctx.fillStyle = s.c;
        const x = Math.round(s.x), y = Math.round(s.y);
        if (s.s === 3) { // brilho em cruz, estilo pixel
          ctx.fillRect(x - 1, y - 3, 2, 8); ctx.fillRect(x - 4, y, 8, 2);
        } else ctx.fillRect(x, y, s.s, s.s);
      }
      for (const m of motes) {
        if (!reduce) {
          m.x += m.vx; m.y += m.vy;
          if (m.y < -4) { m.y = h + 4; m.x = Math.random() * w; }
        }
        ctx.globalAlpha = m.a;
        ctx.fillStyle = `rgb(${m.c})`;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
      }
      if (!reduce) {
        if (!comet && Math.random() < 0.004) {
          comet = { x: Math.random() * w * 0.7, y: Math.random() * h * 0.3, vx: 7 + Math.random() * 4, vy: 2.5 + Math.random() * 2, life: 1 };
        }
        if (comet) {
          const c = comet;
          const g = ctx.createLinearGradient(c.x, c.y, c.x - c.vx * 12, c.y - c.vy * 12);
          g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(232,229,255,0)');
          ctx.globalAlpha = c.life; ctx.strokeStyle = g; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x - c.vx * 12, c.y - c.vy * 12); ctx.stroke();
          c.x += c.vx; c.y += c.vy; c.life -= 0.012;
          if (c.life <= 0 || c.x > w + 50 || c.y > h + 50) comet = null;
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = (t: number) => {
      draw(t);
      raf = visible ? requestAnimationFrame(loop) : 0;
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !reduce && !raf) raf = requestAnimationFrame(loop);
    });
    io.observe(canvas);
    if (!reduce) raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, []);

  return <canvas ref={ref} className="hm-sky" aria-hidden="true" />;
}
