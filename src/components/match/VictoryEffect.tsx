'use client';

// Efeito da tela de vitória sobre o mini-mapa. Só CSS (sem canvas nem bibliotecas):
// partículas com posições pseudoaleatórias fixas, então o servidor e o navegador desenham igual.
// Com "reduzir movimento" ligado, as partículas somem e fica só o brilho parado.
import type { CSSProperties } from 'react';
import type { VictoryFx } from './victory-fx';

/** Número pseudoaleatório estável (0–1) para a partícula i. */
const rnd = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

type Vars = CSSProperties & Record<`--${string}`, string>;

export function VictoryEffect({ kind, color }: { kind: VictoryFx; color: string }) {
  const palette = [color, '#d8b75e', '#c9c3f5', '#ffffff'];
  let parts: React.ReactNode[] = [];

  if (kind === 'victory:confete') {
    parts = Array.from({ length: 42 }, (_, i) => (
      <i key={i} className="p" style={{
        '--x': `${rnd(i, 1) * 100}%`, '--d': `${rnd(i, 2) * 1.6}s`, '--s': `${2.4 + rnd(i, 3) * 1.8}s`,
        '--r': `${rnd(i, 4) * 720 - 360}deg`, '--dx': `${rnd(i, 5) * 60 - 30}px`, '--c': palette[i % palette.length],
      } as Vars} />
    ));
  } else if (kind === 'victory:estrelas') {
    parts = Array.from({ length: 28 }, (_, i) => (
      <i key={i} className="p" style={{
        '--x': `${4 + rnd(i, 1) * 92}%`, '--y': `${4 + rnd(i, 2) * 70}%`, '--d': `${rnd(i, 3) * 2}s`,
        '--s': `${1.4 + rnd(i, 4) * 1.4}s`, '--z': `${0.6 + rnd(i, 5) * 1.1}`, '--c': i % 3 === 0 ? color : i % 3 === 1 ? '#f4dc8e' : '#e9e6ff',
      } as Vars}>✦</i>
    ));
  } else if (kind === 'victory:moonfall') {
    parts = Array.from({ length: 18 }, (_, i) => (
      <i key={i} className="p" style={{
        '--x': `${rnd(i, 1) * 96}%`, '--d': `${rnd(i, 2) * 3}s`, '--s': `${3.2 + rnd(i, 3) * 2.2}s`,
        '--z': `${0.7 + rnd(i, 4) * 0.9}`, '--r': `${rnd(i, 5) * 50 - 25}deg`,
      } as Vars}>☾</i>
    ));
  } else {
    // Fogos: 4 explosões, cada uma com 14 faíscas saindo em círculo.
    parts = Array.from({ length: 4 }, (_, b) => (
      <span key={b} className="burst" style={{
        '--x': `${18 + rnd(b, 1) * 64}%`, '--y': `${12 + rnd(b, 2) * 42}%`, '--d': `${b * 0.55 + rnd(b, 3) * 0.3}s`,
        '--c': palette[b % palette.length],
      } as Vars}>
        {Array.from({ length: 14 }, (_, i) => <i key={i} className="p" style={{ '--a': `${(i / 14) * 360}deg` } as Vars} />)}
      </span>
    ));
  }

  return (
    <div className={`nx-vfx ${kind.replace(':', '-')}`} style={{ '--team': color } as Vars} aria-hidden="true">
      <div className="glow" />
      {parts}
    </div>
  );
}
