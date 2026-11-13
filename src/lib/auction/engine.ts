// NEXUS DRAFT: motor do leilão (autoritativo), regras v2 (inspiradas no 100pracada).
// Funções puras sobre um estado 100% serializável (JSON). Roda no servidor; o cliente
// só envia intenções (placeBid / passLot / chooseRoute). Valores em CENTAVOS.
//
// Regras:
// - R$ 100 por jogador; lances em reais inteiros (+1, +5, +10, Tudo). Guardar R$ 1 por vaga vazia.
// - Cada lote dura 10 s; todo lance garante pelo menos 3 s no relógio.
// - Há mais lotes que vagas (ex.: 6 por jogador para times de 5), equilibrados por rota.
//   Cada campeão aparece uma vez só: passou, passou.
// - "Passar" tira o jogador daquele lote; se todos que podem dar lance passarem, o lote fecha.
// - O leilão acaba quando todos completam o time (ou os lotes acabam). Vagas que sobrarem são
//   preenchidas de graça com campeões não vendidos; fora da rota, o campeão rende metade.

export const ROLES = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPORTE'] as const;
export type Role = (typeof ROLES)[number];

export interface Champion {
  id: string;
  name: string;
  routes: Role[]; // routes[0] = rota principal
  tier: 1 | 2 | 3;
}

export interface AuctionConfig {
  budget: number;
  minBid: number;        // lance inicial e reserva por vaga
  minIncrement: number;
  bidTimeMs: number;     // duração inicial do lote
  bidExtendMs: number;   // todo lance garante pelo menos isso no relógio
  routePickMs: number;
  intermissionMs: number;
  teamSize: number;
  lotsPerPlayer: number;
  showOverall: boolean;  // overall à mostra durante o leilão (ou escondido: "leilão no olho")
}

export const DEFAULT_CONFIG: AuctionConfig = {
  budget: 10000,
  minBid: 100,
  minIncrement: 100,
  bidTimeMs: 10000,
  bidExtendMs: 3000,
  routePickMs: 10000,
  intermissionMs: 1200,
  teamSize: 5,
  lotsPerPlayer: 6,
  showOverall: true,
};

export type BotProfile = 'economico' | 'equilibrado' | 'agressivo' | 'estrategico';
export type AcquiredHow = 'leilao' | 'sobra';

export interface RosterSlot { champId: string; price: number; how: AcquiredHow; offRole: boolean }

export interface Player {
  id: string;
  name: string;
  isBot: boolean;
  botProfile: BotProfile | null;
  budget: number;
  roster: Record<Role, RosterSlot | null>;
}

export interface Bid { seq: number; champId: string; playerId: string; amount: number; at: number }

export interface Lot {
  champId: string;
  index: number;          // número do lote (1..total)
  highBid: Bid | null;
  bidCount: number;
  passes: string[];
  startedAt: number;
  endsAt: number;
}

export interface RoutePick {
  playerId: string;
  champId: string;
  price: number;
  options: Role[];
  deadline: number;
}

export interface Sale { champId: string; playerId: string; price: number; role: Role; how: AcquiredHow; offRole: boolean; at: number }

export type AuctionEvent =
  | { type: 'lot_start'; champId: string; index: number; at: number }
  | { type: 'bid'; champId: string; playerId: string; amount: number; at: number }
  | { type: 'pass'; champId: string; playerId: string; at: number }
  | { type: 'sold'; champId: string; playerId: string; amount: number; at: number }
  | { type: 'unsold'; champId: string; at: number }
  | { type: 'route_pick'; champId: string; playerId: string; options: Role[]; at: number }
  | { type: 'placed'; champId: string; playerId: string; role: Role; via: 'escolha' | 'auto' | 'unica' | 'sobra'; price: number; offRole: boolean; at: number }
  | { type: 'finished'; at: number };

export type Phase = 'bidding' | 'routePick' | 'finished';

export interface AuctionState {
  config: AuctionConfig;
  rngState: number;
  champions: Record<string, Champion>;
  players: Player[];
  queue: string[];
  totalLots: number;
  leftovers: string[];
  current: Lot | null;
  routePick: RoutePick | null;
  phase: Phase;
  intermissionUntil: number;
  sales: Sale[];
  bids: Bid[];
  events: AuctionEvent[];
  seq: number;
  version: number;
}

export type Result<T = object> = ({ ok: true } & T) | { ok: false; reason: string };

// ---------- aleatoriedade determinística e serializável ----------
export function nextRandom(s: { rngState: number }): number {
  s.rngState = (s.rngState + 0x6d2b79f5) | 0;
  let t = s.rngState;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function shuffle<T>(arr: readonly T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function formatBRL(cents: number): string {
  return cents % 100 === 0 ? `R$ ${cents / 100}` : 'R$ ' + (cents / 100).toFixed(2).replace('.', ',');
}

// ---------- consultas ----------
export const getPlayer = (s: AuctionState, id: string) => s.players.find(p => p.id === id);
export const openRoles = (p: Player): Role[] => ROLES.filter(r => !p.roster[r]);
const allFull = (s: AuctionState) => s.players.every(p => openRoles(p).length === 0);

function emit(s: AuctionState, event: AuctionEvent) {
  s.events.push(event);
  s.version++;
}

/** Rotas livres do jogador em que o campeão pode jogar. */
export function validRoles(s: AuctionState, playerId: string, champId: string): Role[] {
  const p = getPlayer(s, playerId);
  const champ = s.champions[champId];
  if (!p || !champ) return [];
  return champ.routes.filter(r => !p.roster[r]);
}

/** Lance máximo = saldo − R$ 1 para cada outra vaga vazia. */
export function maxBid(s: AuctionState, playerId: string): number {
  const p = getPlayer(s, playerId);
  if (!p) return 0;
  const open = openRoles(p).length;
  if (!open) return 0;
  return p.budget - (open - 1) * s.config.minBid;
}

export function minNextBid(s: AuctionState): number {
  return s.current?.highBid ? s.current.highBid.amount + s.config.minIncrement : s.config.minBid;
}

export function bidEligibility(s: AuctionState, playerId: string): Result {
  if (s.phase !== 'bidding' || !s.current) return { ok: false, reason: 'Nenhum campeão em disputa.' };
  const p = getPlayer(s, playerId);
  if (!p) return { ok: false, reason: 'Jogador inválido.' };
  if (!openRoles(p).length) return { ok: false, reason: 'Seu time já está completo.' };
  if (!validRoles(s, playerId, s.current.champId).length) return { ok: false, reason: 'Você não tem rota livre para este campeão.' };
  if (s.current.passes.includes(playerId)) return { ok: false, reason: 'Você passou neste campeão.' };
  if (maxBid(s, playerId) < minNextBid(s)) return { ok: false, reason: 'Saldo insuficiente para cobrir.' };
  return { ok: true };
}

// ---------- criação ----------
export interface CreateGameInput {
  players: { id: string; name: string; isBot?: boolean; botProfile?: BotProfile | null }[];
  champions: Champion[];
  seed: number;
  now: number;
  config?: Partial<AuctionConfig>;
}

export function createGame(input: CreateGameInput): AuctionState {
  const config: AuctionConfig = { ...DEFAULT_CONFIG, ...input.config };
  const slots = input.players.length * config.teamSize;
  if (input.champions.length < slots) {
    throw new Error(`Precisa de pelo menos ${slots} campeões para ${input.players.length} jogadores.`);
  }
  const champions: Record<string, Champion> = {};
  input.champions.forEach(c => { champions[c.id] = c; });

  const emptyRoster = () => Object.fromEntries(ROLES.map(r => [r, null])) as Record<Role, RosterSlot | null>;
  const s: AuctionState = {
    config,
    rngState: input.seed | 0,
    champions,
    players: input.players.map(p => ({
      id: p.id, name: p.name, isBot: !!p.isBot, botProfile: p.botProfile ?? null,
      budget: config.budget, roster: emptyRoster(),
    })),
    queue: [], totalLots: 0, leftovers: [],
    current: null, routePick: null, phase: 'bidding', intermissionUntil: input.now,
    sales: [], bids: [], events: [], seq: 0, version: 0,
  };
  s.queue = pickLots(s, Math.min(input.champions.length, input.players.length * config.lotsPerPlayer));
  s.totalLots = s.queue.length;
  return s;
}

/** Sorteia os lotes com equilíbrio entre as rotas (pela rota principal) e embaralha a ordem. */
function pickLots(s: AuctionState, n: number): string[] {
  const rand = () => nextRandom(s);
  const byRole = ROLES.map(r => shuffle(Object.values(s.champions).filter(c => c.routes[0] === r).map(c => c.id), rand));
  const chosen: string[] = [];
  for (let i = 0; chosen.length < n && byRole.some(l => l.length); i = (i + 1) % ROLES.length) {
    const id = byRole[i].shift();
    if (id) chosen.push(id);
  }
  return shuffle(chosen, rand);
}

// ---------- ações ----------
export function placeBid(s: AuctionState, playerId: string, amount: number, now: number): Result<{ bid: Bid }> {
  const el = bidEligibility(s, playerId);
  if (!el.ok) return el;
  const cur = s.current!;
  if (now >= cur.endsAt) return { ok: false, reason: 'Tempo esgotado.' };
  if (cur.highBid?.playerId === playerId) return { ok: false, reason: 'Você já tem o maior lance.' };
  if (!Number.isInteger(amount) || amount % s.config.minIncrement !== 0)
    return { ok: false, reason: `Use múltiplos de ${formatBRL(s.config.minIncrement)}.` };
  const min = minNextBid(s);
  if (amount < min) return { ok: false, reason: `Lance mínimo: ${formatBRL(min)}.` };
  const max = maxBid(s, playerId);
  if (amount > max) return { ok: false, reason: `Seu lance máximo é ${formatBRL(max)}.` };

  s.seq++;
  const bid: Bid = { seq: s.seq, champId: cur.champId, playerId, amount, at: now };
  cur.highBid = bid;
  cur.bidCount++;
  cur.endsAt = Math.max(cur.endsAt, now + s.config.bidExtendMs);
  s.bids.push(bid);
  emit(s, { type: 'bid', champId: cur.champId, playerId, amount, at: now });
  return { ok: true, bid };
}

export function passLot(s: AuctionState, playerId: string, now: number): Result {
  if (s.phase !== 'bidding' || !s.current) return { ok: false, reason: 'Nenhum campeão em disputa.' };
  const cur = s.current;
  if (cur.highBid?.playerId === playerId) return { ok: false, reason: 'Você tem o maior lance: não dá para passar.' };
  if (cur.passes.includes(playerId)) return { ok: true };
  cur.passes.push(playerId);
  emit(s, { type: 'pass', champId: cur.champId, playerId, at: now });
  closeIfEveryonePassed(s, now);
  return { ok: true };
}

/** Se ninguém mais pode cobrir (todos passaram ou não podem), o lote fecha na hora. */
function closeIfEveryonePassed(s: AuctionState, now: number) {
  const cur = s.current;
  if (!cur) return;
  const contenders = s.players.filter(p => p.id !== cur.highBid?.playerId && bidEligibility(s, p.id).ok);
  if (!contenders.length) cur.endsAt = Math.min(cur.endsAt, now);
}

export function chooseRoute(s: AuctionState, playerId: string, role: Role, now: number): Result {
  if (s.phase !== 'routePick' || !s.routePick || s.routePick.playerId !== playerId)
    return { ok: false, reason: 'Não é sua vez de escolher rota.' };
  if (!s.routePick.options.includes(role)) return { ok: false, reason: 'Rota inválida.' };
  placeChampion(s, role, now, 'escolha');
  return { ok: true };
}

// ---------- relógio ----------
export function tick(s: AuctionState, now: number): void {
  if (s.phase === 'finished') return;
  if (s.phase === 'routePick') {
    if (now >= s.routePick!.deadline) autoPickRoute(s, now);
    return;
  }
  if (!s.current) {
    if (now >= s.intermissionUntil) startNextLot(s, now);
    return;
  }
  if (now >= s.current.endsAt) resolveLot(s, now);
}

/** Próximo instante em que tick() precisa rodar. */
export function nextDeadline(s: AuctionState): number | null {
  if (s.phase === 'finished') return null;
  if (s.phase === 'routePick') return s.routePick!.deadline;
  return s.current ? s.current.endsAt : s.intermissionUntil;
}

function startNextLot(s: AuctionState, now: number) {
  if (allFull(s) || !s.queue.length) return finish(s, now);
  const champId = s.queue.shift()!;
  s.current = {
    champId, index: s.totalLots - s.queue.length, highBid: null, bidCount: 0, passes: [],
    startedAt: now, endsAt: now + s.config.bidTimeMs,
  };
  emit(s, { type: 'lot_start', champId, index: s.current.index, at: now });
  closeIfEveryonePassed(s, now); // ninguém pode receber este campeão: fecha direto
}

function resolveLot(s: AuctionState, now: number) {
  const cur = s.current!;
  if (cur.highBid) {
    const p = getPlayer(s, cur.highBid.playerId)!;
    p.budget -= cur.highBid.amount;
    emit(s, { type: 'sold', champId: cur.champId, playerId: p.id, amount: cur.highBid.amount, at: now });
    beginPlacement(s, p.id, cur.champId, cur.highBid.amount, now);
    return;
  }
  s.leftovers.push(cur.champId);
  s.current = null;
  s.intermissionUntil = now + s.config.intermissionMs;
  emit(s, { type: 'unsold', champId: cur.champId, at: now });
}

function beginPlacement(s: AuctionState, playerId: string, champId: string, price: number, now: number) {
  const options = validRoles(s, playerId, champId);
  s.current = null;
  s.routePick = { playerId, champId, price, options, deadline: now + s.config.routePickMs };
  if (options.length === 1) {
    placeChampion(s, options[0], now, 'unica');
    return;
  }
  s.phase = 'routePick';
  emit(s, { type: 'route_pick', champId, playerId, options, at: now });
}

function autoPickRoute(s: AuctionState, now: number) {
  const rp = s.routePick!;
  const role = s.champions[rp.champId].routes.find(r => rp.options.includes(r))!;
  placeChampion(s, role, now, 'auto');
}

function placeChampion(s: AuctionState, role: Role, now: number, via: 'escolha' | 'auto' | 'unica') {
  const rp = s.routePick!;
  const p = getPlayer(s, rp.playerId)!;
  p.roster[role] = { champId: rp.champId, price: rp.price, how: 'leilao', offRole: false };
  s.sales.push({ champId: rp.champId, playerId: p.id, price: rp.price, role, how: 'leilao', offRole: false, at: now });
  s.routePick = null;
  s.phase = 'bidding';
  s.intermissionUntil = now + s.config.intermissionMs;
  emit(s, { type: 'placed', champId: rp.champId, playerId: p.id, role, via, price: rp.price, offRole: false, at: now });
  if (allFull(s)) finish(s, now);
}

/** Completa as vagas vazias de graça com os campeões não vendidos (na rota, se possível). */
function fillWithLeftovers(s: AuctionState, now: number) {
  const pool = [...s.leftovers, ...s.queue];
  s.queue = [];
  const take = (pred: (id: string) => boolean) => {
    const i = pool.findIndex(pred);
    return i === -1 ? null : pool.splice(i, 1)[0];
  };
  // Primeiro tenta encaixar na rota certa (campeões mais fortes primeiro), depois fora da rota.
  pool.sort((a, b) => s.champions[b].tier - s.champions[a].tier);
  for (const pass of ['inRole', 'any'] as const) {
    for (const p of s.players) {
      for (const role of openRoles(p)) {
        const id = take(c => pass === 'any' || s.champions[c].routes.includes(role));
        if (!id) continue;
        const offRole = !s.champions[id].routes.includes(role);
        p.roster[role] = { champId: id, price: 0, how: 'sobra', offRole };
        s.sales.push({ champId: id, playerId: p.id, price: 0, role, how: 'sobra', offRole, at: now });
        emit(s, { type: 'placed', champId: id, playerId: p.id, role, via: 'sobra', price: 0, offRole, at: now });
      }
    }
  }
  s.leftovers = pool;
}

function finish(s: AuctionState, now: number) {
  s.current = null;
  if (!allFull(s)) fillWithLeftovers(s, now);
  s.phase = 'finished';
  emit(s, { type: 'finished', at: now });
}
