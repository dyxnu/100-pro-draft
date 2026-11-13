// Modelo de confronto: counters, sinergias, composição e estratégias.
import type { Role } from '@/lib/auction/engine';
import type { ChampClass, ChampionCard } from '@/lib/champions/cards';

// ---------------------------------------------------------------------------
// Estratégias (seção 9.2 do documento)
// ---------------------------------------------------------------------------
export interface Strategy {
  agressividade: 'defensiva' | 'equilibrada' | 'agressiva';
  prioridade: 'abates' | 'torres' | 'dragoes' | 'equilibrada';
  estilo: 'teamfight' | 'pickoff' | 'splitpush' | 'equilibrado';
  risco: 'conservador' | 'normal' | 'arriscado';
}

export const DEFAULT_STRATEGY: Strategy = {
  agressividade: 'equilibrada', prioridade: 'equilibrada', estilo: 'equilibrado', risco: 'normal',
};

export const STRATEGY_OPTIONS = {
  agressividade: [['defensiva', 'Defensiva'], ['equilibrada', 'Equilibrada'], ['agressiva', 'Agressiva']],
  prioridade: [['abates', 'Abates'], ['torres', 'Torres'], ['dragoes', 'Dragões'], ['equilibrada', 'Equilibrada']],
  estilo: [['teamfight', 'Team fight'], ['pickoff', 'Pick-off'], ['splitpush', 'Split push'], ['equilibrado', 'Equilibrado']],
  risco: [['conservador', 'Conservador'], ['normal', 'Normal'], ['arriscado', 'Arriscado']],
} as const;

export function isStrategy(v: unknown): v is Strategy {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return (Object.keys(STRATEGY_OPTIONS) as (keyof Strategy)[]).every(k =>
    (STRATEGY_OPTIONS[k] as readonly (readonly [string, string])[]).some(([val]) => val === s[k]));
}

// ---------------------------------------------------------------------------
// Counters entre classes (antissimétrico: A vs B = −(B vs A)), de −2 a +2
// ---------------------------------------------------------------------------
const CLASS_MATRIX: Record<ChampClass, Partial<Record<ChampClass, number>>> = {
  assassino:  { mago: 2, atirador: 2, encantador: 1, tanque: -2, lutador: -1 },
  tanque:     { assassino: 2, lutador: 1, mago: -1, atirador: -1 },
  lutador:    { assassino: 1, tanque: -1, atirador: 1, mago: -1, encantador: -1 },
  mago:       { assassino: -2, tanque: 1, lutador: 1 },
  atirador:   { assassino: -2, tanque: 1, lutador: -1 },
  encantador: { assassino: -1, lutador: 1 },
};
export const classEdge = (a: ChampClass, b: ChampClass) => CLASS_MATRIX[a][b] ?? 0;

// Counters específicos conhecidos (campeão → quem ele "amassa"). Ajustáveis.
export const SPECIFIC_COUNTERS: Record<string, string[]> = {
  Malphite: ['Yasuo', 'Jinx', 'Caitlyn', 'MissFortune', 'Kaisa', 'Jhin', 'Ashe', 'Darius', 'Renekton', 'XinZhao', 'Vi', 'Jax'],
  Morgana: ['Leona', 'Nautilus', 'Thresh', 'Amumu', 'Sejuani', 'Vi'],
  Renekton: ['Camille', 'Yasuo', 'Jax'],
  Darius: ['Garen', 'Jax', 'Camille'],
  Jax: ['Yasuo', 'Camille', 'Warwick'],
  Garen: ['Yasuo', 'Camille'],
  Ahri: ['Yasuo', 'Lux'],
  Annie: ['Yasuo', 'Zed'],
  Lux: ['Orianna', 'Annie'],
  Zed: ['Lux', 'Orianna', 'Ahri', 'Jinx', 'Jhin', 'Caitlyn'],
  Caitlyn: ['Jinx', 'MissFortune', 'Jhin'],
  Lulu: ['Zed', 'LeeSin', 'Kaisa'],
  Soraka: ['MissFortune', 'Jhin'],
  Leona: ['Lulu', 'Soraka'],
  Nautilus: ['Lulu', 'Soraka', 'Zed'],
  Thresh: ['Leona', 'Lulu'],
  Warwick: ['LeeSin', 'XinZhao', 'Vi'],
  Sejuani: ['XinZhao', 'Warwick'],
  Kaisa: ['Caitlyn', 'Ashe'],
};

/** Vantagem de A sobre B (≈ −4 a +4). */
export function matchupEdge(a: ChampionCard, b: ChampionCard): number {
  let edge = classEdge(a.champClass, b.champClass);
  if (SPECIFIC_COUNTERS[a.id]?.includes(b.id)) edge += 2;
  if (SPECIFIC_COUNTERS[b.id]?.includes(a.id)) edge -= 2;
  return edge;
}

// ---------------------------------------------------------------------------
// Sinergias
// ---------------------------------------------------------------------------
export const SYNERGIES: { pair: [string, string]; bonus: number; label: string }[] = [
  { pair: ['Yasuo', 'Malphite'], bonus: 3, label: 'Avalanche de arremessos' },
  { pair: ['Yasuo', 'Nautilus'], bonus: 2, label: 'Arremesso + Último Suspiro' },
  { pair: ['Yasuo', 'Sejuani'], bonus: 1, label: 'Combo de controle' },
  { pair: ['Orianna', 'Malphite'], bonus: 3, label: 'Bola na Força Imparável' },
  { pair: ['Orianna', 'Amumu'], bonus: 2, label: 'Combo em área' },
  { pair: ['Orianna', 'Sejuani'], bonus: 2, label: 'Combo em área' },
  { pair: ['MissFortune', 'Amumu'], bonus: 3, label: 'Wombo combo' },
  { pair: ['MissFortune', 'Leona'], bonus: 2, label: 'Rajada após atordoar' },
  { pair: ['MissFortune', 'Sejuani'], bonus: 2, label: 'Wombo combo' },
  { pair: ['Lulu', 'Jinx'], bonus: 3, label: 'Proteger o carregador' },
  { pair: ['Lulu', 'Kaisa'], bonus: 3, label: 'Proteger o carregador' },
  { pair: ['Soraka', 'Jinx'], bonus: 2, label: 'Sustentação' },
  { pair: ['Jhin', 'Leona'], bonus: 2, label: 'Raiz e tiro' },
  { pair: ['Jhin', 'Morgana'], bonus: 2, label: 'Raiz e tiro' },
  { pair: ['Lux', 'Leona'], bonus: 2, label: 'Luz solar' },
  { pair: ['Caitlyn', 'Morgana'], bonus: 2, label: 'Armadilhas em alvo preso' },
  { pair: ['Caitlyn', 'Lux'], bonus: 2, label: 'Armadilhas em alvo preso' },
  { pair: ['Ashe', 'Leona'], bonus: 2, label: 'Engajamento duplo' },
  { pair: ['Kaisa', 'Nautilus'], bonus: 2, label: 'Controle + mergulho' },
  { pair: ['Zed', 'LeeSin'], bonus: 1, label: 'Abate isolado' },
  { pair: ['Vi', 'Ahri'], bonus: 1, label: 'Pegar e explodir' },
  { pair: ['Amumu', 'Annie'], bonus: 2, label: 'Controle em área' },
];

export interface TeamProfile {
  synergy: number;
  synergyLabels: string[];
  teamfight: number; // 0–10
  pickoff: number;
  splitpush: number;
  engage: number;
  frontline: number;
  curve: { early: number; mid: number; late: number }; // média 0–10
}

export function teamProfile(cards: Record<Role, ChampionCard>): TeamProfile {
  const list = Object.values(cards);
  const ids = new Set(list.map(c => c.id));
  const syn = SYNERGIES.filter(s => ids.has(s.pair[0]) && ids.has(s.pair[1]));
  const avg = (f: (c: ChampionCard) => number) => list.reduce((a, c) => a + f(c), 0) / list.length;
  const top = cards.TOP;
  return {
    synergy: syn.reduce((a, s) => a + s.bonus, 0),
    synergyLabels: syn.map(s => `${s.label} (${s.pair.join(' + ')})`),
    engage: Math.max(...list.map(c => c.engage)),
    frontline: list.filter(c => c.attrs.DEF >= 70).length,
    teamfight: Math.min(10, avg(c => c.aoe) * 0.6 + Math.max(...list.map(c => c.engage)) * 0.4),
    pickoff: Math.min(10, avg(c => (c.attrs.CTR - 40) / 6) * 0.5 + list.filter(c => c.champClass === 'assassino' || c.attrs.MOB >= 80).length * 1.5),
    splitpush: Math.min(10, ((top.attrs.ATQ - 40) / 6) * 0.4 + ((top.attrs.MOB - 40) / 6) * 0.3 + top.curve.late * 0.3),
    curve: { early: avg(c => c.curve.early), mid: avg(c => c.curve.mid), late: avg(c => c.curve.late) },
  };
}

/** Quanto o estilo escolhido combina com a composição (multiplicador ~0.94–1.08). */
export function styleFit(profile: TeamProfile, s: Strategy): number {
  const v = s.estilo === 'teamfight' ? profile.teamfight
    : s.estilo === 'pickoff' ? profile.pickoff
    : s.estilo === 'splitpush' ? profile.splitpush
    : 6;
  return 1 + (v - 6) * 0.02;
}
