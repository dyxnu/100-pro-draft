// Summoner's Rift com as coordenadas reais do jogo (unidades do mapa, 0 a ~15000),
// convertidas para porcentagem da imagem oficial do minimapa (Data Dragon map11.png).
// Lado 0 = time azul (base embaixo à esquerda); lado 1 = time vermelho (em cima à direita).
export type Lane = 'TOP' | 'MID' | 'BOT';
export type Side = 0 | 1;
export interface Pt { x: number; y: number }

export const LANES: Lane[] = ['TOP', 'MID', 'BOT'];

// Faixa do mapa coberta pela imagem do minimapa (transformação usada pela Riot).
const MIN = { x: -120, y: -120 };
const MAX = { x: 14870, y: 14980 };
/** Unidades do jogo → porcentagem da imagem (y do jogo cresce para cima; o da tela, para baixo). */
export const fromGame = (x: number, y: number): Pt => ({
  x: ((x - MIN.x) / (MAX.x - MIN.x)) * 100,
  y: ((MAX.y - y) / (MAX.y - MIN.y)) * 100,
});

// Torres: [externa, interna, do inibidor] por rota.
const TOWERS: Record<Side, Record<Lane, Pt[]>> = {
  0: {
    TOP: [fromGame(981, 10441), fromGame(1512, 6699), fromGame(1169, 4287)],
    MID: [fromGame(5846, 6396), fromGame(5048, 4812), fromGame(3651, 3696)],
    BOT: [fromGame(10504, 1029), fromGame(6919, 1483), fromGame(4281, 1253)],
  },
  1: {
    TOP: [fromGame(4318, 13875), fromGame(7943, 13411), fromGame(10481, 13650)],
    MID: [fromGame(8955, 8510), fromGame(9767, 10113), fromGame(11134, 11207)],
    BOT: [fromGame(13866, 4505), fromGame(13327, 8226), fromGame(13624, 10572)],
  },
};
const INHIBS: Record<Side, Record<Lane, Pt>> = {
  0: { TOP: fromGame(1171, 3571), MID: fromGame(3203, 3208), BOT: fromGame(3452, 1236) },
  1: { TOP: fromGame(11261, 13676), MID: fromGame(11598, 11667), BOT: fromGame(13604, 11316) },
};
const NEXUS_TOWERS: Record<Side, Pt[]> = {
  0: [fromGame(1748, 2270), fromGame(2177, 1807)],
  1: [fromGame(12611, 13084), fromGame(13052, 12612)],
};

export const towerPos = (side: Side, lane: Lane, tier: number): Pt => TOWERS[side][lane][tier];
export const inhibPos = (side: Side, lane: Lane): Pt => INHIBS[side][lane];
export const nexusTowerPos = (side: Side, i: number): Pt => NEXUS_TOWERS[side][i];
export const NEXUS: Record<Side, Pt> = { 0: fromGame(1551, 1659), 1: fromGame(13142, 12964) };
export const FOUNTAIN: Record<Side, Pt> = { 0: fromGame(500, 500), 1: fromGame(14250, 14350) };
export const DRAGON_PIT: Pt = fromGame(9866, 4414);
export const BARON_PIT: Pt = fromGame(5007, 10471);

// Caminho de cada rota, do lado azul para o lado vermelho (para posicionar a "frente" da rota).
export const LANE_PATH: Record<Lane, Pt[]> = {
  TOP: [fromGame(1100, 3600), fromGame(1300, 13400), fromGame(11000, 13750)],
  MID: [fromGame(3700, 3700), fromGame(11100, 11150)],
  BOT: [fromGame(3600, 1150), fromGame(13500, 1400), fromGame(13750, 11000)],
};

/** Ponto a uma fração f (0 = base azul, 1 = base vermelha) ao longo da rota. */
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

// Acampamentos da selva de cada lado (azul, vermelho, gromp, lobos, aves, krugs).
export const JUNGLE_SPOTS: Record<Side, Pt[]> = {
  0: [fromGame(3821, 8101), fromGame(7765, 4021), fromGame(2090, 8428), fromGame(3800, 6500), fromGame(6943, 5422), fromGame(8226, 2726)],
  1: [fromGame(10931, 6990), fromGame(7016, 10775), fromGame(12703, 6443), fromGame(11008, 8387), fromGame(7852, 9471), fromGame(6317, 12146)],
};

export const ROLE_LANE = { TOP: 'TOP', JUNGLE: null, MID: 'MID', ADC: 'BOT', SUPORTE: 'BOT' } as const;

/** Imagem oficial do minimapa de Summoner's Rift. */
export const MINIMAP_URL = 'https://ddragon.leagueoflegends.com/cdn/16.22.1/img/map/map11.png';
