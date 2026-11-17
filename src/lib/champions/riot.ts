// Estatísticas reais de partidas (Riot Match-V5, alto elo), geradas por `npm run riot:collect`.
// Enquanto não houver coleta, tudo aqui retorna null e o jogo usa o modelo estimado.
import data from './riot-stats.json';
import type { Role } from '@/lib/auction/engine';

interface WL { games: number; wins: number }
interface RiotStats {
  source: string;
  collectedAt: string | null;
  matches: number;
  patches: string[];
  champions: Record<string, WL & { roles: Partial<Record<Role, WL>>; short?: WL; long?: WL }>;
  matchups: Record<string, WL>;
  duos: Record<string, WL>;
  /** `A|B` em ordem alfabética: os dois no mesmo time (vitórias do time). */
  pairs?: Record<string, WL>;
  /** `A|B` em ordem alfabética: times opostos, rotas diferentes (vitórias de A). */
  versus?: Record<string, WL>;
}
const STATS = data as unknown as RiotStats;

export const RIOT_SAMPLE = { matches: STATS.matches, source: STATS.source, patches: STATS.patches, collectedAt: STATS.collectedAt };

const MIN_ROLE_GAMES = 30;
const MIN_MATCHUP_GAMES = 6;
const MIN_DUO_GAMES = 6;
// Encolhimento bayesiano: com poucas partidas o número fica perto de 50%, e só se afasta
// dele conforme a amostra cresce (evita que 4 vitórias em 6 jogos virem "counter").
const PRIOR = 40;
const shrink = (wins: number, games: number) => (wins + PRIOR / 2) / (games + PRIOR);

/** Winrate do campeão na rota (0–1) e número de partidas; null se a amostra for pequena. */
export function roleWinrate(champ: string, role: Role): { wr: number; games: number } | null {
  const r = STATS.champions[champ]?.roles?.[role];
  return r && r.games >= MIN_ROLE_GAMES ? { wr: shrink(r.wins, r.games), games: r.games } : null;
}

/** Winrate de A contra B na mesma rota; null se a amostra for pequena. */
export function laneMatchup(a: string, b: string, role: Role): { wr: number; games: number } | null {
  const ab = STATS.matchups[`${a}|${b}|${role}`];
  const ba = STATS.matchups[`${b}|${a}|${role}`];
  const games = (ab?.games ?? 0) + (ba?.games ?? 0);
  if (games < MIN_MATCHUP_GAMES) return null;
  const wins = (ab?.wins ?? 0) + ((ba?.games ?? 0) - (ba?.wins ?? 0));
  return { wr: shrink(wins, games), games };
}

const MIN_PHASE_GAMES = 20;

/**
 * Quanto o campeão "escala": winrate em jogos longos (> 32 min) menos em jogos curtos (< 25 min),
 * encolhido conforme o tamanho da amostra. Positivo = forte no fim; negativo = forte no começo.
 */
export function scalingDelta(champ: string): { delta: number; short: number; long: number } | null {
  const c = STATS.champions[champ];
  if (!c?.short || !c?.long || c.short.games < MIN_PHASE_GAMES || c.long.games < MIN_PHASE_GAMES) return null;
  const n = Math.min(c.short.games, c.long.games);
  const raw = c.long.wins / c.long.games - c.short.wins / c.short.games;
  return { delta: raw * (n / (n + 60)), short: c.short.games, long: c.long.games };
}

/** Winrate da dupla atirador + suporte; null se a amostra for pequena. */
export function duoWinrate(adc: string, sup: string): { wr: number; games: number } | null {
  const d = STATS.duos[`${adc}|${sup}`];
  return d && d.games >= MIN_DUO_GAMES ? { wr: shrink(d.wins, d.games), games: d.games } : null;
}

// ---------------------------------------------------------------------------
// Pares de campeões fora da dupla do bot. O winrate de um par já carrega a força de cada
// campeão sozinho; aqui só interessa o que sobra: quanto o par ganha (ou perde) ALÉM do
// esperado pelos dois individualmente. Pares são ruidosos, então o encolhimento é mais forte
// e puxa para o esperado (não para 50%).
// ---------------------------------------------------------------------------
const MIN_PAIR_GAMES = 20;
const PAIR_PRIOR = 300;
const champWr = (c: string) => {
  const s = STATS.champions[c];
  return s ? shrink(s.wins, s.games) : 0.5;
};
const clamp01 = (x: number) => Math.max(0.05, Math.min(0.95, x));

/**
 * Sinergia real de dois campeões do mesmo time (qualquer rota): winrate do par menos o
 * esperado pelos dois sozinhos (≈ −0.08 a +0.08). null se a amostra for pequena.
 */
export function pairSynergy(a: string, b: string): { delta: number; wr: number; games: number } | null {
  if (a === b) return null;
  const p = STATS.pairs?.[a < b ? `${a}|${b}` : `${b}|${a}`];
  if (!p || p.games < MIN_PAIR_GAMES) return null;
  const expected = clamp01(champWr(a) + champWr(b) - 0.5);
  const wr = (p.wins + PAIR_PRIOR * expected) / (p.games + PAIR_PRIOR);
  return { delta: wr - expected, wr: p.wins / p.games, games: p.games };
}

/**
 * Counter real entre campeões de times opostos em rotas diferentes (ex.: assassino do meio
 * contra o atirador): vitórias de A além do esperado pela força de cada um (≈ −0.03 a +0.03,
 * já encolhido). `weight` (0–1) diz quanto a amostra pesa: quem usa pode completar o resto
 * com uma estimativa própria (ex.: a tabela de classes).
 */
export function versusEdge(a: string, b: string): { delta: number; games: number; weight: number } | null {
  if (a === b) return null;
  const v = STATS.versus?.[a < b ? `${a}|${b}` : `${b}|${a}`];
  if (!v || v.games < MIN_PAIR_GAMES) return null;
  const winsA = a < b ? v.wins : v.games - v.wins;
  const expected = clamp01(0.5 + champWr(a) - champWr(b));
  const wr = (winsA + PAIR_PRIOR * expected) / (v.games + PAIR_PRIOR);
  return { delta: wr - expected, games: v.games, weight: v.games / (v.games + PAIR_PRIOR) };
}
