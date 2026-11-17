// Elos iguais aos do LoL: Ferro → Desafiante. Divisões IV..I com 100 PDL cada até Diamante;
// Mestre, Grão-Mestre e Desafiante não têm divisão (PDL acumula).

export const TIERS = ['FERRO', 'BRONZE', 'PRATA', 'OURO', 'PLATINA', 'ESMERALDA', 'DIAMANTE', 'MESTRE', 'GRAO_MESTRE', 'DESAFIANTE'] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_LABEL: Record<Tier, string> = {
  FERRO: 'Ferro', BRONZE: 'Bronze', PRATA: 'Prata', OURO: 'Ouro', PLATINA: 'Platina', ESMERALDA: 'Esmeralda',
  DIAMANTE: 'Diamante', MESTRE: 'Mestre', GRAO_MESTRE: 'Grão-Mestre', DESAFIANTE: 'Desafiante',
};
/** Cor de destaque de cada elo (emblemas, bordas). */
export const TIER_COLOR: Record<Tier, string> = {
  FERRO: '#6b5e5b', BRONZE: '#a0643b', PRATA: '#8a9bab', OURO: '#d6a34a', PLATINA: '#3fa9a0', ESMERALDA: '#2fb36b',
  DIAMANTE: '#6a8cff', MESTRE: '#a24fd1', GRAO_MESTRE: '#d63a3a', DESAFIANTE: '#f0c96a',
};

export interface Rank { tier: Tier | null; division: number | null; lp: number }
export const UNRANKED: Rank = { tier: null, division: null, lp: 0 };
/** Onde começa quem joga a primeira ranqueada. */
export const START_RANK: Rank = { tier: 'FERRO', division: 4, lp: 0 };

const APEX = new Set<Tier>(['MESTRE', 'GRAO_MESTRE', 'DESAFIANTE']);
const GM_LP = 200;          // Mestre com 200+ PDL vira Grão-Mestre
const CHALLENGER_LP = 500;  // 500+ PDL vira Desafiante
const ROMAN = ['', 'I', 'II', 'III', 'IV'];

export const isApex = (t: Tier | null) => !!t && APEX.has(t);

/** Número único para ordenar o ranking (maior = melhor). Sem elo = -1. */
export function rankScore(r: Rank): number {
  if (!r.tier) return -1;
  const ti = TIERS.indexOf(r.tier);
  if (isApex(r.tier)) return 7 * 400 + r.lp; // Mestre+ ordenado pelo PDL total
  return ti * 400 + (4 - (r.division ?? 4)) * 100 + r.lp;
}

export function rankLabel(r: Rank): string {
  if (!r.tier) return 'Sem elo';
  if (isApex(r.tier)) return `${TIER_LABEL[r.tier]} · ${r.lp} PDL`;
  return `${TIER_LABEL[r.tier]} ${ROMAN[r.division ?? 4]} · ${r.lp} PDL`;
}

/** Aplica ganho/perda de PDL com promoção e rebaixamento (sem cair abaixo de Ferro IV 0). */
export function applyLp(r: Rank, delta: number): Rank {
  const start = r.tier ? r : START_RANK;
  const division = start.division;
  let { tier, lp } = start;
  lp += delta;
  if (isApex(tier)) {
    if (lp < 0) {  // cai de Mestre para Diamante I
      return { tier: 'DIAMANTE', division: 1, lp: Math.max(0, 75 + lp) };
    }
    tier = lp >= CHALLENGER_LP ? 'DESAFIANTE' : lp >= GM_LP ? 'GRAO_MESTRE' : 'MESTRE';
    return { tier, division: null, lp };
  }
  let ti = TIERS.indexOf(tier!);
  let div = division ?? 4;
  while (lp >= 100) {
    lp -= 100;
    if (div > 1) div--;
    else if (ti + 1 < TIERS.length && isApex(TIERS[ti + 1])) return { tier: 'MESTRE', division: null, lp };
    else { ti++; div = 4; }
  }
  while (lp < 0) {
    if (div < 4) { div++; lp += 100; }
    else if (ti > 0) { ti--; div = 1; lp += 100; }
    else { lp = 0; }
  }
  return { tier: TIERS[ti], division: div, lp };
}

/** Maior elo entre dois (para o "pico"). */
export const higherTier = (a: Tier | null, b: Tier | null): Tier | null =>
  !a ? b : !b ? a : TIERS.indexOf(a) >= TIERS.indexOf(b) ? a : b;
