'use client';

import { useEffect, useRef } from 'react';

/** Máscara redonda pixel a pixel (sem anti-aliasing) e a borda de 1 px em volta dela. */
function circleMask(res: number) {
  const inside: boolean[] = [];
  const c = (res - 1) / 2, r = res / 2 - 0.6;
  for (let y = 0; y < res; y++) for (let x = 0; x < res; x++) inside.push((x - c) ** 2 + (y - c) ** 2 <= r * r);
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < res && y < res && inside[y * res + x];
  const edge: [number, number][] = [];
  for (let y = 0; y < res; y++) for (let x = 0; x < res; x++) {
    if (at(x, y) && (!at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1))) edge.push([x, y]);
  }
  return { at, edge };
}

/** Reduz a paleta (efeito 8-bit). Só funciona se a imagem vier com CORS; senão, fica sem. */
function posterize(ctx: CanvasRenderingContext2D, res: number) {
  try {
    const img = ctx.getImageData(0, 0, res, res);
    const d = img.data, step = 255 / 5;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.round(d[i] / step) * step;
      d[i + 1] = Math.round(d[i + 1] / step) * step;
      d[i + 2] = Math.round(d[i + 2] / step) * step;
    }
    ctx.putImageData(img, 0, 0);
  } catch { /* canvas "contaminado": mantém as cores originais */ }
}

/**
 * Campeão em pixel art: o ícone do Data Dragon é desenhado minúsculo (ex.: 20×20) num canvas
 * e ampliado com image-rendering: pixelated. Carrega só quando chega perto da tela.
 */
export function PixelChamp({
  id, version, name, res = 20, size = 60, outline = '#14173f', className = '',
}: { id: string; /** Versão do Data Dragon (passe DD_VERSION do servidor para não levar o JSON ao navegador). */ version: string; name?: string; res?: number; size?: number; outline?: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return;
    let cancelled = false;
    const { at, edge } = circleMask(res);

    const paint = (img: HTMLImageElement, cors: boolean) => {
      if (cancelled) return;
      ctx.clearRect(0, 0, res, res);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      const m = img.naturalWidth * 0.07; // corta a moldura do ícone
      ctx.drawImage(img, m, m, img.naturalWidth - 2 * m, img.naturalHeight - 2 * m, 0, 0, res, res);
      if (cors) posterize(ctx, res);
      for (let y = 0; y < res; y++) for (let x = 0; x < res; x++) if (!at(x, y)) ctx.clearRect(x, y, 1, 1);
      ctx.fillStyle = outline;
      for (const [x, y] of edge) ctx.fillRect(x, y, 1, 1);
    };

    const load = (cors: boolean) => {
      const img = new Image();
      if (cors) img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.onload = () => paint(img, cors);
      img.onerror = () => { if (cors) load(false); };
      img.src = `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${id}.png`;
    };

    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      load(true);
    }, { rootMargin: '200px' });
    io.observe(canvas);
    return () => { cancelled = true; io.disconnect(); };
  }, [id, version, res, outline]);

  return (
    <canvas
      ref={ref} width={res} height={res}
      className={`hm-pixel ${className}`} style={{ width: size, height: size }}
      role={name ? 'img' : undefined} aria-label={name} aria-hidden={name ? undefined : true}
    />
  );
}
