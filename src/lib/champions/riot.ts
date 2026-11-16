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
  champions: Record<string, WL & { roles: Partial<Record<Role, WL>> }>;
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

/** Winrate da dupla atirador + suporte; null se a amostra for pequena. */
export function duoWinrate(adc: string, sup: string): { wr: number; games: number } | null {
  const d = STATS.duos[`${adc}|${sup}`];
  return d && d.games >= MIN_DUO_GAMES ? { wr: d.wins / d.games, games: d.games } : null;
}
