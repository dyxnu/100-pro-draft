'use client';

// Efeito da tela de vitória sobre o mini-mapa.
// "Fogos Hextec" continua em CSS puro; os demais são desenhados num canvas com física simples
// (gravidade, arrasto, rastros e brilho). Com "reduzir movimento" fica só o brilho parado.
import { useEffect, useRef, type CSSProperties } from 'react';
import type { VictoryFx } from './victory-fx';

/** Número pseudoaleatório estável (0–1) para a partícula i. */
const rnd = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
type Vars = CSSProperties & Record<`--${string}`, string>;

interface P {
  x: number; y: number; vx: number; vy: number; life: number; max: number; size: number;
  color: string; spin: number; rot: number; kind: number; trail?: { x: number; y: number }[];
}

const R = (a: number, b: number) => a + Math.random() * (b - a);

/** Desenha o efeito escolhido num canvas que ocupa o mini-mapa inteiro. */
function useCanvasFx(kind: VictoryFx, color: string) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || kind === 'victory:fogos') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const t0 = performance.now();
    let W = 0, H = 0, raf = 0, last = t0, spawnAcc = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const fit = () => {
      const r = cv.getBoundingClientRect();
      W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(cv);
    const ps: P[] = [];
    const gold = '#f3d68a', silver = '#e9e6ff';
    const pal = [color, gold, silver, '#ff5fa2', '#3fa9e0', '#2fb36b'];

    // Disparos iniciais
    const confettiBurst = (fromLeft: boolean) => {
      for (let i = 0; i < 70; i++) {
        const a = (fromLeft ? -60 : -120) * Math.PI / 180 + R(-0.35, 0.35);
        const sp = R(380, 720);
        ps.push({ x: fromLeft ? -6 : W + 6, y: H * 0.95, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: R(3.5, 5.5),
          size: R(5, 9), color: pal[i % pal.length], spin: R(4, 12), rot: R(0, 6.28), kind: i % 5 === 0 ? 1 : 0 });
      }
    };
    if (kind === 'victory:confete') { confettiBurst(true); confettiBurst(false); }

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      spawnAcc += dt;

      if (kind === 'victory:confete') {
        if (t > 1.2 && spawnAcc > 0.05) {  // chuva contínua mais leve depois do estouro
          spawnAcc = 0;
          ps.push({ x: R(0, W), y: -10, vx: R(-20, 20), vy: R(40, 90), life: 0, max: 6, size: R(5, 8), color: pal[(Math.random() * pal.length) | 0], spin: R(3, 9), rot: R(0, 6.28), kind: 0 });
        }
        if (t > 0 && Math.floor(t / 4.5) !== Math.floor((t - dt) / 4.5)) { confettiBurst(true); confettiBurst(false); }
      } else if (kind === 'victory:estrelas') {
        if (spawnAcc > 0.32) {
          spawnAcc = 0;
          const fromTop = Math.random() < 0.6;
          ps.push({ x: fromTop ? R(W * 0.1, W * 1.1) : W + 20, y: fromTop ? -20 : R(0, H * 0.4), vx: R(-520, -380), vy: R(220, 320), life: 0, max: 1.8,
            size: R(1.6, 2.8), color: Math.random() < 0.3 ? color : Math.random() < 0.5 ? gold : silver, spin: 0, rot: 0, kind: 2, trail: [] });
        }
        if (Math.random() < 0.5) ps.push({ x: R(0, W), y: R(0, H * 0.8), vx: 0, vy: 0, life: 0, max: R(0.8, 1.6), size: R(1, 2.4), color: silver, spin: 0, rot: 0, kind: 3 });
      } else if (kind === 'victory:moonfall') {
        if (spawnAcc > 0.06) {
          spawnAcc = 0;
          ps.push({ x: R(0, W), y: H + 10, vx: R(-14, 14), vy: R(-70, -30), life: 0, max: R(3, 5), size: R(1.5, 3.5), color: Math.random() < 0.3 ? color : silver, spin: R(-2, 2), rot: 0, kind: 4 });
        }
      } else if (kind === 'victory:aurora') {
        if (spawnAcc > 0.08) {
          spawnAcc = 0;
          ps.push({ x: R(0, W), y: R(H * 0.1, H * 0.6), vx: R(-8, 8), vy: R(-6, 6), life: 0, max: R(1.5, 3), size: R(1, 2.2), color: silver, spin: 0, rot: 0, kind: 3 });
        }
      } else if (kind === 'victory:brasas') {
        for (let k = 0; k < 2; k++) {
          ps.push({ x: R(0, W), y: H + 6, vx: R(-20, 20), vy: R(-160, -70), life: 0, max: R(1.8, 3.2), size: R(1.2, 3.2),
            color: Math.random() < 0.5 ? '#ffb347' : Math.random() < 0.5 ? '#ff6a3d' : '#ffe08a', spin: R(1, 4), rot: R(0, 6.28), kind: 5 });
        }
      }

      // Fundos que não são partícula
      if (kind === 'victory:moonfall') drawMoon(ctx, W, H, t);
      if (kind === 'victory:aurora') drawAurora(ctx, W, H, t, color);
      if (kind === 'victory:brasas') {
        const g = ctx.createLinearGradient(0, H, 0, H * 0.45);
        g.addColorStop(0, 'rgba(255,106,61,.38)'); g.addColorStop(1, 'rgba(255,106,61,0)');
        ctx.fillStyle = g; ctx.fillRect(0, H * 0.45, W, H * 0.55);
      }

      ctx.globalCompositeOperation = kind === 'victory:confete' ? 'source-over' : 'lighter';
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.life += dt;
        if (p.life > p.max || p.y > H + 40 || p.x < -80 || p.x > W + 80 || p.y < -60) { ps.splice(i, 1); continue; }
        const fade = Math.min(1, (p.max - p.life) / 0.6);
        if (p.kind <= 1) {         // confete: gravidade, arrasto e balanço
          p.vy += 520 * dt; p.vx *= 1 - 2.2 * dt; p.vy *= 1 - 1.8 * dt;
          p.vx += Math.sin(p.life * 5 + p.rot) * 40 * dt;
          p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.scale(1, Math.abs(Math.cos(p.life * p.spin)) * 0.85 + 0.15);  // gira em 3D
          ctx.globalAlpha = fade; ctx.fillStyle = p.color;
          if (p.kind === 1) { ctx.fillRect(-p.size * 1.6, -1.5, p.size * 3.2, 3); } else { ctx.fillRect(-p.size / 2, -p.size * 0.35, p.size, p.size * 0.7); }
          ctx.restore();
        } else if (p.kind === 2) { // estrela cadente com rastro
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.trail!.push({ x: p.x, y: p.y });
          if (p.trail!.length > 18) p.trail!.shift();
          const tr = p.trail!;
          for (let k = 1; k < tr.length; k++) {
            ctx.strokeStyle = p.color; ctx.globalAlpha = (k / tr.length) * 0.8 * fade; ctx.lineWidth = p.size * (k / tr.length) * 1.6;
            ctx.beginPath(); ctx.moveTo(tr[k - 1].x, tr[k - 1].y); ctx.lineTo(tr[k].x, tr[k].y); ctx.stroke();
          }
          glowDot(ctx, p.x, p.y, p.size * 5, p.color, fade);
        } else if (p.kind === 3) { // cintilar
          const a = Math.sin((p.life / p.max) * Math.PI);
          star4(ctx, p.x, p.y, p.size * 3 * a, p.color, a * 0.9);
        } else if (p.kind === 4) { // brilho lunar subindo
          p.x += (p.vx + Math.sin(p.life * 2 + p.x) * 10) * dt; p.y += p.vy * dt;
          glowDot(ctx, p.x, p.y, p.size * 3.5, p.color, Math.sin((p.life / p.max) * Math.PI) * 0.8);
        } else if (p.kind === 5) { // brasa
          p.vx += Math.sin(p.life * 4 + p.rot) * 60 * dt; p.vy *= 1 - 0.4 * dt;
          p.x += p.vx * dt; p.y += p.vy * dt;
          glowDot(ctx, p.x, p.y, p.size * 3, p.color, fade * (0.6 + 0.4 * Math.sin(p.life * 18 + p.rot)));
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [kind, color]);
  return ref;
}

function glowDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: string, a: number) {
  if (a <= 0 || r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, c); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = Math.min(1, a); ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
function star4(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: string, a: number) {
  if (r <= 0.2) return;
  ctx.globalAlpha = a; ctx.fillStyle = c;
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.fill();
}
/** Lua crescente descendo com halo e ondas de luz. */
function drawMoon(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) {
  const cx = W / 2, R0 = Math.min(W, H) * 0.16;
  const k = Math.min(1, t / 1.6), ease = 1 - Math.pow(1 - k, 3);
  const cy = -R0 * 1.5 + ease * (H * 0.36 + R0 * 1.5) + Math.sin(t * 1.2) * 4;
  for (let i = 0; i < 3; i++) {  // ondas de luz saindo da lua
    const ph = ((t * 0.5 + i / 3) % 1);
    ctx.globalAlpha = (1 - ph) * 0.5 * ease; ctx.strokeStyle = '#c9c3f5'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R0 * (1.1 + ph * 2.6), 0, Math.PI * 2); ctx.stroke();
  }
  const halo = ctx.createRadialGradient(cx, cy, R0 * 0.5, cx, cy, R0 * 3.2);
  halo.addColorStop(0, 'rgba(233,230,255,.55)'); halo.addColorStop(0.4, 'rgba(143,134,224,.25)'); halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = ease; ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, R0 * 3.2, 0, Math.PI * 2); ctx.fill();
  // crescente: disco claro menos um disco deslocado
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R0, 0, Math.PI * 2); ctx.arc(cx + R0 * 0.45, cy - R0 * 0.2, R0 * 0.85, 0, Math.PI * 2, true);
  const body = ctx.createLinearGradient(cx - R0, cy - R0, cx + R0, cy + R0);
  body.addColorStop(0, '#ffffff'); body.addColorStop(1, '#bdb6f0');
  ctx.fillStyle = body; ctx.globalAlpha = ease; ctx.shadowColor = '#e9e6ff'; ctx.shadowBlur = 30; ctx.fill('evenodd');
  ctx.restore();
  ctx.globalAlpha = 1;
}
/** Faixas de aurora ondulando no alto do mapa. */
function drawAurora(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, color: string) {
  const bands = [['#3ff0c0', 0], ['#3fa9e0', 1.7], [color, 3.1], ['#a24fd1', 4.4]] as const;
  ctx.globalCompositeOperation = 'lighter';
  for (const [c, ph] of bands) {
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.45, c); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.globalAlpha = 0.22 + 0.08 * Math.sin(t * 0.9 + ph);
    ctx.beginPath();
    ctx.moveTo(0, H * 0.75);
    for (let x = 0; x <= W; x += 12) {
      const y = H * (0.22 + 0.08 * Math.sin(x / W * 6 + t * 0.8 + ph) + 0.04 * Math.sin(x / W * 15 - t * 1.3 + ph));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H * 0.75); ctx.closePath(); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

export function VictoryEffect({ kind, color }: { kind: VictoryFx; color: string }) {
  const canvas = useCanvasFx(kind, color);
  const palette = [color, '#d8b75e', '#c9c3f5', '#ffffff'];

  return (
    <div className={`nx-vfx ${kind.replace(':', '-')}`} style={{ '--team': color } as Vars} aria-hidden="true">
      <div className="glow" />
      {kind === 'victory:fogos'
        // Fogos: 4 explosões, cada uma com 14 faíscas saindo em círculo.
        ? Array.from({ length: 4 }, (_, b) => (
          <span key={b} className="burst" style={{
            '--x': `${18 + rnd(b, 1) * 64}%`, '--y': `${12 + rnd(b, 2) * 42}%`, '--d': `${b * 0.55 + rnd(b, 3) * 0.3}s`,
            '--c': palette[b % palette.length],
          } as Vars}>
            {Array.from({ length: 14 }, (_, i) => <i key={i} className="p" style={{ '--a': `${(i / 14) * 360}deg` } as Vars} />)}
          </span>
        ))
        : <canvas ref={canvas} className="vfx-canvas" />}
    </div>
  );
}
