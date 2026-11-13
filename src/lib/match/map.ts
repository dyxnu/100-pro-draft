// Mapa próprio do Nexus Draft (coordenadas 0–100, origem no canto superior esquerdo).
// Time A (azul) começa embaixo à esquerda; time B (vermelho) em cima à direita.
export type Lane = 'TOP' | 'MID' | 'BOT';
export type Side = 0 | 1;
export interface Pt { x: number; y: number }

export const LANES: Lane[] = ['TOP', 'MID', 'BOT'];
const reflect = (p: Pt): Pt => ({ x: 100 - p.x, y: 100 - p.y });

// Torres do time A por rota: [externa, interna, do inibidor], e o inibidor.
const A_TOWERS: Record<Lane, Pt[]> = {
  TOP: [{ x: 12, y: 30 }, { x: 12, y: 50 }, { x: 11, y: 68 }],
  MID: [{ x: 40, y: 60 }, { x: 33, y: 67 }, { x: 26, y: 74 }],
  BOT: [{ x: 70, y: 88 }, { x: 50, y: 88 }, { x: 32, y: 89 }],
};
const A_INHIB: Record<Lane, Pt> = { TOP: { x: 10, y: 75 }, MID: { x: 22, y: 78 }, BOT: { x: 25, y: 90 } };
const A_NEXUS_TOWERS: Pt[] = [{ x: 13, y: 83 }, { x: 17, y: 87 }];

// O time B é o reflexo do A pelo centro: a rota TOP de B é o reflexo da BOT de A.
const mirrorLane: Record<Lane, Lane> = { TOP: 'BOT', MID: 'MID', BOT: 'TOP' };

export function towerPos(side: Side, lane: Lane, tier: number): Pt {
  return side === 0 ? A_TOWERS[lane][tier] : reflect(A_TOWERS[mirrorLane[lane]][tier]);
}
export function inhibPos(side: Side, lane: Lane): Pt {
  return side === 0 ? A_INHIB[lane] : reflect(A_INHIB[mirrorLane[lane]]);
}
export function nexusTowerPos(side: Side, i: number): Pt {
  return side === 0 ? A_NEXUS_TOWERS[i] : reflect(A_NEXUS_TOWERS[i]);
}
export const NEXUS: Record<Side, Pt> = { 0: { x: 10, y: 90 }, 1: { x: 90, y: 10 } };
export const FOUNTAIN: Record<Side, Pt> = { 0: { x: 5, y: 95 }, 1: { x: 95, y: 5 } };
export const DRAGON_PIT: Pt = { x: 67, y: 67 };
export const BARON_PIT: Pt = { x: 33, y: 33 };

// Caminho de cada rota, do lado A para o lado B (para posicionar a "frente" da rota).
export const LANE_PATH: Record<Lane, Pt[]> = {
  TOP: [{ x: 12, y: 82 }, { x: 12, y: 12 }, { x: 88, y: 12 }],
  MID: [{ x: 20, y: 80 }, { x: 80, y: 20 }],
  BOT: [{ x: 18, y: 88 }, { x: 88, y: 88 }, { x: 88, y: 18 }],
};

/** Ponto a uma fração f (0 = base A, 1 = base B) ao longo da rota. */
export function alongLane(lane: Lane, f: number): Pt {
  const path = LANE_PATH[lane];
  const segs = path.slice(1).map((p, i) => ({ a: path[i], b: p, len: Math.hypot(p.x - path[i].x, p.y - path[i].y) }));
  const total = segs.reduce((s, x) => s + x.len, 0);
  let d = Math.max(0, Math.min(1, f)) * total;
  for (const s of segs) {
    if (d <= s.len) return { x: s.a.x + ((s.b.x - s.a.x) * d) / s.len, y: s.a.y + ((s.b.y - s.a.y) * d) / s.len };
    d -= s.len;
  }
  return path[path.length - 1];
}

export const JUNGLE_SPOTS: Record<Side, Pt[]> = {
  0: [{ x: 28, y: 58 }, { x: 44, y: 76 }, { x: 24, y: 44 }, { x: 56, y: 80 }],
  1: [{ x: 72, y: 42 }, { x: 56, y: 24 }, { x: 76, y: 56 }, { x: 44, y: 20 }],
};

export const ROLE_LANE = { TOP: 'TOP', JUNGLE: null, MID: 'MID', ADC: 'BOT', SUPORTE: 'BOT' } as const;
