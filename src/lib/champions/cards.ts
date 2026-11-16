// Cartas dos campeões (estilo FIFA): atributos 40–99 e overall por rota.
// Fonte: dados oficiais da Riot (Data Dragon: classes, avaliações de ataque/defesa/magia,
// atributos base) + ajustes por kit (controle, mobilidade, utilidade, fases de força),
// que não existem nos arquivos oficiais. Os ajustes ficam em CURATED e podem ser balanceados.
import ddragon from './ddragon.json';
import meraki from './meraki.json';
import { roleWinrate, scalingDelta } from './riot';
import type { Role } from '@/lib/auction/engine';
import type { ChampClass, ChampionCard } from './card-types';

export { CLASS_LABEL, cardTier } from './card-types';
export type { ChampClass, ChampionCard } from './card-types';

export interface Curated {
  cc: number;      // controle de grupo 0–10
  dashes: number;  // avanços/saltos 0–3
  util: number;    // cura, escudo, visão, peel 0–10
  early: number;   // força no início 0–10
  mid: number;     // força no meio 0–10
  late: number;    // força no fim 0–10
  engage: number;  // capacidade de iniciar lutas 0–10
  aoe: number;     // dano/controle em área 0–10
}

// Ajustes por kit (balanceáveis). Valores de 0 a 10.
export const CURATED: Record<string, Curated> = {
  Garen:       { cc: 3, dashes: 0, util: 1, early: 6, mid: 7, late: 5, engage: 3, aoe: 4 },
  Darius:      { cc: 4, dashes: 0, util: 0, early: 9, mid: 7, late: 5, engage: 4, aoe: 5 },
  Malphite:    { cc: 9, dashes: 1, util: 2, early: 4, mid: 7, late: 7, engage: 10, aoe: 9 },
  Jax:         { cc: 4, dashes: 1, util: 0, early: 5, mid: 7, late: 9, engage: 5, aoe: 3 },
  Camille:     { cc: 5, dashes: 2, util: 0, early: 5, mid: 7, late: 8, engage: 6, aoe: 2 },
  Renekton:    { cc: 4, dashes: 2, util: 0, early: 9, mid: 7, late: 4, engage: 6, aoe: 4 },
  Warwick:     { cc: 6, dashes: 1, util: 1, early: 8, mid: 7, late: 5, engage: 6, aoe: 3 },
  Vi:          { cc: 7, dashes: 2, util: 0, early: 7, mid: 8, late: 5, engage: 8, aoe: 3 },
  Amumu:       { cc: 9, dashes: 1, util: 2, early: 4, mid: 7, late: 7, engage: 9, aoe: 9 },
  LeeSin:      { cc: 6, dashes: 3, util: 2, early: 9, mid: 7, late: 4, engage: 7, aoe: 4 },
  XinZhao:     { cc: 5, dashes: 1, util: 0, early: 8, mid: 7, late: 4, engage: 7, aoe: 3 },
  Sejuani:     { cc: 9, dashes: 1, util: 2, early: 6, mid: 8, late: 6, engage: 9, aoe: 7 },
  Ahri:        { cc: 5, dashes: 3, util: 1, early: 6, mid: 8, late: 7, engage: 4, aoe: 5 },
  Annie:       { cc: 8, dashes: 0, util: 2, early: 7, mid: 8, late: 6, engage: 7, aoe: 8 },
  Lux:         { cc: 7, dashes: 0, util: 5, early: 6, mid: 7, late: 7, engage: 3, aoe: 7 },
  Yasuo:       { cc: 6, dashes: 3, util: 3, early: 6, mid: 7, late: 8, engage: 5, aoe: 6 },
  Zed:         { cc: 1, dashes: 3, util: 0, early: 7, mid: 9, late: 6, engage: 3, aoe: 3 },
  Orianna:     { cc: 7, dashes: 0, util: 6, early: 5, mid: 7, late: 9, engage: 5, aoe: 9 },
  Ashe:        { cc: 7, dashes: 0, util: 6, early: 5, mid: 7, late: 7, engage: 6, aoe: 4 },
  Jinx:        { cc: 3, dashes: 0, util: 1, early: 4, mid: 6, late: 10, engage: 1, aoe: 6 },
  Caitlyn:     { cc: 3, dashes: 1, util: 3, early: 8, mid: 7, late: 7, engage: 1, aoe: 2 },
  MissFortune: { cc: 2, dashes: 0, util: 1, early: 7, mid: 8, late: 6, engage: 2, aoe: 9 },
  Kaisa:       { cc: 1, dashes: 2, util: 0, early: 4, mid: 7, late: 10, engage: 3, aoe: 3 },
  Jhin:        { cc: 4, dashes: 0, util: 3, early: 7, mid: 8, late: 6, engage: 1, aoe: 4 },
  Soraka:      { cc: 4, dashes: 0, util: 10, early: 5, mid: 7, late: 8, engage: 1, aoe: 3 },
  Leona:       { cc: 10, dashes: 1, util: 4, early: 8, mid: 7, late: 5, engage: 10, aoe: 6 },
  Nautilus:    { cc: 10, dashes: 1, util: 4, early: 7, mid: 7, late: 6, engage: 9, aoe: 6 },
  Lulu:        { cc: 6, dashes: 0, util: 10, early: 6, mid: 7, late: 8, engage: 2, aoe: 3 },
  Morgana:     { cc: 8, dashes: 0, util: 7, early: 6, mid: 7, late: 6, engage: 4, aoe: 6 },
  Thresh:      { cc: 9, dashes: 1, util: 9, early: 7, mid: 7, late: 7, engage: 8, aoe: 4 },
  Fiora:       { cc: 2, dashes: 2, util: 0, early: 6, mid: 8, late: 9, engage: 3, aoe: 1 },
  Sett:        { cc: 6, dashes: 1, util: 1, early: 8, mid: 7, late: 5, engage: 7, aoe: 5 },
  Graves:      { cc: 2, dashes: 2, util: 0, early: 8, mid: 8, late: 6, engage: 3, aoe: 4 },
  Ekko:        { cc: 5, dashes: 2, util: 2, early: 6, mid: 8, late: 7, engage: 5, aoe: 5 },
  Syndra:      { cc: 7, dashes: 0, util: 1, early: 6, mid: 9, late: 7, engage: 4, aoe: 6 },
  Katarina:    { cc: 0, dashes: 3, util: 0, early: 5, mid: 9, late: 7, engage: 4, aoe: 8 },
  Ezreal:      { cc: 1, dashes: 2, util: 2, early: 6, mid: 8, late: 7, engage: 1, aoe: 2 },
  Vayne:       { cc: 4, dashes: 2, util: 0, early: 3, mid: 6, late: 10, engage: 1, aoe: 1 },
  Nami:        { cc: 8, dashes: 0, util: 9, early: 7, mid: 7, late: 7, engage: 5, aoe: 5 },
  Blitzcrank:  { cc: 8, dashes: 0, util: 5, early: 8, mid: 6, late: 5, engage: 8, aoe: 2 },
  Diana:       { cc: 5, dashes: 1, util: 1, early: 6, mid: 8, late: 7, engage: 8, aoe: 8 },
};

const DEFAULT_CURATED: Curated = { cc: 5, dashes: 1, util: 3, early: 6, mid: 7, late: 6, engage: 4, aoe: 4 };

const CLASS_BY_TAG: Record<string, ChampClass> = {
  Tank: 'tanque', Fighter: 'lutador', Assassin: 'assassino', Mage: 'mago', Marksman: 'atirador', Support: 'encantador',
};
type DD = { version: string; champions: Record<string, { name: string; title: string; tags: string[]; info: { attack: number; defense: number; magic: number; difficulty: number }; stats: { hp: number; armor: number; mr: number; moveSpeed: number; range: number } }> };
const DATA = ddragon as DD;
type MerakiAbility = { name: string; damageType: string | null; text: string } | null;
type MerakiChamp = {
  ratings?: { damage: number; toughness: number; control: number; mobility: number; utility: number };
  roles?: string[]; positions?: string[]; adaptiveType?: string;
  abilities: Record<'P' | 'Q' | 'W' | 'E' | 'R', MerakiAbility>;
};
const MERAKI = meraki as unknown as Record<string, MerakiChamp>;

const clamp = (v: number, lo = 40, hi = 99) => Math.max(lo, Math.min(hi, Math.round(v)));
const scale10 = (v: number) => 40 + (v / 10) * 59; // 0–10 → 40–99
const norm = (v: number, lo: number, hi: number) => Math.max(0, Math.min(10, ((v - lo) / (hi - lo)) * 10));

// Peso de cada atributo por rota (soma 1). "fase" = a fase do jogo mais importante na rota.
const ROLE_WEIGHTS: Record<Role, { dmg: number; DEF: number; MOB: number; CTR: number; UTL: number; phase: number; phaseKey: 'early' | 'mid' | 'late' }> = {
  TOP:     { dmg: 0.25, DEF: 0.25, MOB: 0.12, CTR: 0.1, UTL: 0.03, phase: 0.25, phaseKey: 'early' },
  JUNGLE:  { dmg: 0.2, DEF: 0.15, MOB: 0.2, CTR: 0.2, UTL: 0.05, phase: 0.2, phaseKey: 'early' },
  MID:     { dmg: 0.35, DEF: 0.05, MOB: 0.15, CTR: 0.15, UTL: 0.05, phase: 0.25, phaseKey: 'mid' },
  ADC:     { dmg: 0.4, DEF: 0.05, MOB: 0.1, CTR: 0.05, UTL: 0.05, phase: 0.35, phaseKey: 'late' },
  SUPORTE: { dmg: 0.05, DEF: 0.2, MOB: 0.05, CTR: 0.3, UTL: 0.3, phase: 0.1, phaseKey: 'early' },
};

export function buildCard(id: string, routes: Role[]): ChampionCard {
  const d = DATA.champions[id];
  if (!d) throw new Error(`Campeão ${id} não está no Data Dragon.`);
  const c = CURATED[id] ?? DEFAULT_CURATED;
  const durability = norm(d.stats.hp * (1 + (d.stats.armor + d.stats.mr) / 100), 900, 1250);
  const speed = norm(d.stats.moveSpeed, 320, 350);

  // Avaliações oficiais (Meraki/Riot, escala 1–3) refinam os atributos quando existem.
  const m = MERAKI[id];
  const r10 = (v?: number) => (v == null ? null : ((v - 1) / 2) * 10);
  const blend = (base: number, rating: number | null, w: number) => (rating == null ? base : base * (1 - w) + rating * w);
  const magic = m?.adaptiveType === 'MAGIC_DAMAGE';
  const dmgRating = r10(m?.ratings?.damage);
  const attrs = {
    ATQ: clamp(scale10(blend(d.info.attack, magic ? null : dmgRating, 0.35))),
    MAG: clamp(scale10(blend(d.info.magic, magic ? dmgRating : null, 0.35))),
    DEF: clamp(scale10(blend(0.65 * d.info.defense + 0.35 * durability, r10(m?.ratings?.toughness), 0.4))),
    MOB: clamp(scale10(blend(0.4 * speed + 0.6 * (c.dashes / 3) * 10, r10(m?.ratings?.mobility), 0.4))),
    CTR: clamp(scale10(blend(c.cc, r10(m?.ratings?.control), 0.4))),
    UTL: clamp(scale10(blend(c.util, r10(m?.ratings?.utility), 0.4))),
  };
  // Curva de força: base curada, ajustada pelos dados reais de jogos curtos x longos (até ±1,5).
  const sc = scalingDelta(id);
  const shift = sc ? Math.max(-1.5, Math.min(1.5, sc.delta * 15)) : 0;
  const r1 = (v: number) => Math.max(0, Math.min(10, Math.round(v * 10) / 10));
  const curve = { early: r1(c.early - shift), mid: c.mid, late: r1(c.late + shift) };
  const dmg = Math.max(attrs.ATQ, attrs.MAG);

  const ovr = {} as Record<Role, number>;
  for (const role of Object.keys(ROLE_WEIGHTS) as Role[]) {
    const w = ROLE_WEIGHTS[role];
    const score = w.dmg * dmg + w.DEF * attrs.DEF + w.MOB * attrs.MOB + w.CTR * attrs.CTR + w.UTL * attrs.UTL
      + w.phase * scale10(curve[w.phaseKey]);
    // 40–99 → faixa de "overall" estilo FIFA (~60–95)
    let o = 52 + (score - 40) * 0.72;
    const idx = routes.indexOf(role);
    if (idx === 1) o -= 3;         // rota secundária
    else if (idx >= 2) o -= 6;     // terciária
    // Winrate real em alto elo (quando coletado): cada ponto percentual acima de 50% vale ~0,4 de overall.
    const wr = roleWinrate(id, role);
    if (wr) o += Math.max(-4, Math.min(4, (wr.wr - 0.5) * 40));
    ovr[role] = clamp(o, 20, 99);
  }
  // Fora das rotas do campeão vale metade da nota (regra do 100pracada).
  const inRole = Math.max(...routes.map(r => ovr[r]));
  for (const role of Object.keys(ovr) as Role[]) if (!routes.includes(role)) ovr[role] = Math.round(inRole / 2);

  const winrates: ChampionCard['winrates'] = {};
  for (const role of routes) { const w = roleWinrate(id, role); if (w) winrates[role] = w; }

  return {
    id, name: d.name, title: d.title,
    champClass: classOf(d.tags, m?.roles ?? []),
    tags: d.tags, attrs, curve, engage: c.engage, aoe: c.aoe,
    ranged: d.stats.range >= 300, difficulty: d.info.difficulty,
    ovr, bestOvr: Math.max(...Object.values(ovr)), patch: DATA.version,
    roles: displayRoles(id, m?.roles ?? []),
    abilities: m ? (['P', 'Q', 'W', 'E', 'R'] as const).flatMap(k => (m.abilities[k] ? [{ key: k, name: m.abilities[k]!.name, text: m.abilities[k]!.text }] : [])) : [],
    winrates,
  };
}

// Classe dos counters: a classe oficial do Data Dragon, corrigida pelo Meraki só nos casos claros.
function classOf(tags: string[], roles: string[]): ChampClass {
  if (roles.includes('MARKSMAN')) return 'atirador';
  if (roles.includes('ENCHANTER')) return 'encantador';
  if (roles.includes('VANGUARD') || roles.includes('WARDEN')) return 'tanque';
  return CLASS_BY_TAG[tags[0]] ?? 'lutador';
}
// Classe oficial principal (classes da Riot). O Meraki lista as funções em ordem alfabética,
// o que fazia "Assassino" aparecer primeiro para Jax, Vi, Lee Sin, Yasuo, Diana etc.
const PRIMARY_ROLE: Record<string, string> = {
  Garen: 'JUGGERNAUT', Darius: 'JUGGERNAUT', Sett: 'JUGGERNAUT',
  Malphite: 'VANGUARD', Amumu: 'VANGUARD', Sejuani: 'VANGUARD', Leona: 'VANGUARD', Nautilus: 'VANGUARD',
  Jax: 'SKIRMISHER', Fiora: 'SKIRMISHER', Yasuo: 'SKIRMISHER',
  Camille: 'DIVER', Renekton: 'DIVER', Warwick: 'DIVER', Vi: 'DIVER', LeeSin: 'DIVER', XinZhao: 'DIVER', Diana: 'DIVER',
  Ahri: 'BURST', Annie: 'BURST', Lux: 'BURST', Orianna: 'BURST', Syndra: 'BURST',
  Zed: 'ASSASSIN', Ekko: 'ASSASSIN', Katarina: 'ASSASSIN',
  Ashe: 'MARKSMAN', Jinx: 'MARKSMAN', Caitlyn: 'MARKSMAN', MissFortune: 'MARKSMAN', Kaisa: 'MARKSMAN',
  Jhin: 'MARKSMAN', Ezreal: 'MARKSMAN', Vayne: 'MARKSMAN', Graves: 'SPECIALIST',
  Soraka: 'ENCHANTER', Lulu: 'ENCHANTER', Nami: 'ENCHANTER',
  Morgana: 'CATCHER', Thresh: 'CATCHER', Blitzcrank: 'CATCHER',
};
// Funções genéricas só aparecem se não houver nada mais específico.
const GENERIC = new Set(['FIGHTER', 'MAGE', 'SUPPORT', 'TANK']);
function displayRoles(id: string, roles: string[]): string[] {
  const primary = PRIMARY_ROLE[id] ?? roles.find(r => !GENERIC.has(r)) ?? roles[0];
  if (!primary) return [];
  // Segunda etiqueta: outra função específica, sem "Assassino" para quem não é assassino de verdade.
  const second = roles.find(r => r !== primary && !GENERIC.has(r) && r !== 'ASSASSIN')
    ?? roles.find(r => r !== primary && GENERIC.has(r));
  return [primary, second].filter((x): x is string => !!x).map(x => ROLE_PT[x] ?? x);
}

const ROLE_PT: Record<string, string> = {
  ASSASSIN: 'Assassino', MARKSMAN: 'Atirador', ENCHANTER: 'Encantador', CATCHER: 'Capturador', TANK: 'Tanque',
  VANGUARD: 'Vanguarda', WARDEN: 'Guardião', MAGE: 'Mago', BURST: 'Explosivo', BATTLEMAGE: 'Mago de batalha',
  ARTILLERY: 'Artilharia', FIGHTER: 'Lutador', DIVER: 'Mergulhador', JUGGERNAUT: 'Colosso', SKIRMISHER: 'Escaramuçador',
  SUPPORT: 'Suporte', SPECIALIST: 'Especialista',
};
