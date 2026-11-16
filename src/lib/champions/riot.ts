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
}
const STATS = data as unknown as RiotStats;

export const RIOT_SAMPLE = { matches: STATS.matches, source: STATS.source, patches: STATS.patches, collectedAt: STATS.collectedAt };

const MIN_ROLE_GAMES = 30;
const MIN_MATCHUP_GAMES = 15;
const MIN_DUO_GAMES = 15;

/** Winrate do campeão na rota (0–1) e número de partidas; null se a amostra for pequena. */
export function roleWinrate(champ: string, role: Role): { wr: number; games: number } | null {
  const r = STATS.champions[champ]?.roles?.[role];
  return r && r.games >= MIN_ROLE_GAMES ? { wr: r.wins / r.games, games: r.games } : null;
}

/** Winrate de A contra B na mesma rota; null se a amostra for pequena. */
export function laneMatchup(a: string, b: string, role: Role): { wr: number; games: number } | null {
  const ab = STATS.matchups[`${a}|${b}|${role}`];
  const ba = STATS.matchups[`${b}|${a}|${role}`];
  const games = (ab?.games ?? 0) + (ba?.games ?? 0);
  if (games < MIN_MATCHUP_GAMES) return null;
  const wins = (ab?.wins ?? 0) + ((ba?.games ?? 0) - (ba?.wins ?? 0));
  return { wr: wins / games, games };
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
  return d && d.games >= MIN_DUO_GAMES ? { wr: d.wins / d.games, games: d.games } : null;
}
