// NEXUS DRAFT: motor do leilão (autoritativo).
// Funções puras sobre um estado 100% serializável (JSON). Roda no servidor; o cliente
// só envia intenções (placeBid / chooseRoute). Valores em CENTAVOS.

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
  minBid: number;
  minIncrement: number;
  bidTimeMs: number;
  routePickMs: number;
  intermissionMs: number;
  maxNoBidAttempts: number;
  teamSize: number;
  autoAssignSingleBidder: boolean;
}

export const DEFAULT_CONFIG: AuctionConfig = {
  budget: 10000,
  minBid: 50,
  minIncrement: 50,
  bidTimeMs: 10000,
  routePickMs: 10000,
  intermissionMs: 1500,
  maxNoBidAttempts: 2,
  teamSize: 5,
  autoAssignSingleBidder: true,
};

export type BotProfile = 'economico' | 'equilibrado' | 'agressivo' | 'estrategico';
export type AcquiredHow = 'leilao' | 'sorteio' | 'unico';

export interface RosterSlot { champId: string; price: number; how: AcquiredHow }

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
  highBid: Bid | null;
  bidCount: number;
  startedAt: number;
  endsAt: number;
  attempt: number;
}

export interface RoutePick {
  playerId: string;
  champId: string;
  price: number;
  how: AcquiredHow;
  options: Role[];
  deadline: number;
}

export interface Sale { champId: string; playerId: string; price: number; role: Role; how: AcquiredHow; at: number }

export type AuctionEvent =
  | { type: 'lot_start'; champId: string; attempt: number; at: number }
  | { type: 'bid'; champId: string; playerId: string; amount: number; at: number }
  | { type: 'sold'; champId: string; playerId: string; amount: number; at: number }
  | { type: 'requeue'; champId: string; at: number }
  | { type: 'forced'; champId: string; playerId: string; at: number }
  | { type: 'only_option'; champId: string; playerId: string; at: number }
  | { type: 'route_pick'; champId: string; playerId: string; options: Role[]; at: number }
  | { type: 'placed'; champId: string; playerId: string; role: Role; via: 'escolha' | 'auto' | 'unica'; price: number; how: AcquiredHow; at: number }
  | { type: 'finished'; at: number };

export type Phase = 'bidding' | 'routePick' | 'finished';

export interface AuctionState {
  config: AuctionConfig;
  rngState: number;
  champions: Record<string, Champion>;
  players: Player[];
  queue: string[];
  attempts: Record<string, number>;
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
  return 'R$ ' + (cents / 100).toFixed(2).replace('.', ',');
}

// ---------- consultas ----------
export const getPlayer = (s: AuctionState, id: string) => s.players.find(p => p.id === id);
export const openRoles = (p: Player): Role[] => ROLES.filter(r => !p.roster[r]);

function emit(s: AuctionState, event: AuctionEvent) {
  s.events.push(event);
  s.version++;
}

function unplacedChampIds(s: AuctionState): string[] {
  const ids = s.queue.slice();
  if (s.current) ids.push(s.current.champId);
  if (s.routePick) ids.push(s.routePick.champId);
  return ids;
}

interface Slot { playerId: string; role: Role }

function openSlots(s: AuctionState): Slot[] {
  const out: Slot[] = [];
  s.players.forEach(p => openRoles(p).forEach(role => out.push({ playerId: p.id, role })));
  return out;
}

/** Existe um jeito de preencher todas as vagas com os campeões restantes? (emparelhamento bipartido, Kuhn) */
export function canFillAllSlots(champIds: string[], slots: Slot[], champions: Record<string, Champion>): boolean {
  if (champIds.length < slots.length) return false;
  const adj = slots.map(sl =>
    champIds.map((cid, i) => (champions[cid].routes.includes(sl.role) ? i : -1)).filter(i => i >= 0),
  );
  const champMatch = new Array<number>(champIds.length).fill(-1);
  const tryAugment = (u: number, seen: boolean[]): boolean => {
    for (const v of adj[u]) {
      if (seen[v]) continue;
      seen[v] = true;
      if (champMatch[v] === -1 || tryAugment(champMatch[v], seen)) {
        champMatch[v] = u;
        return true;
      }
    }
    return false;
  };
  for (let u = 0; u < slots.length; u++) {
    if (!tryAugment(u, new Array<boolean>(champIds.length).fill(false))) return false;
  }
  return true;
}

/** Rotas em que o jogador pode colocar o campeão sem inviabilizar o draft de ninguém. */
export function validRoles(s: AuctionState, playerId: string, champId: string): Role[] {
  const p = getPlayer(s, playerId);
  const champ = s.champions[champId];
  if (!p || !champ) return [];
  const pool = unplacedChampIds(s).filter(id => id !== champId);
  const slots = openSlots(s);
  return champ.routes.filter(role => {
    if (p.roster[role]) return false;
    const rest = slots.filter(sl => !(sl.playerId === playerId && sl.role === role));
    return canFillAllSlots(pool, rest, s.champions);
  });
}

/** Lance máximo = saldo − (vagas restantes − 1) × lance mínimo */
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
  if (!validRoles(s, playerId, s.current.champId).length)
    return { ok: false, reason: 'Você não tem rota livre para este campeão.' };
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
  if (input.champions.length !== input.players.length * config.teamSize) {
    throw new Error(`Precisa de exatamente ${input.players.length * config.teamSize} campeões para ${input.players.length} jogadores.`);
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
    queue: [],
    attempts: {},
    current: null,
    routePick: null,
    phase: 'bidding',
    intermissionUntil: input.now,
    sales: [], bids: [], events: [],
    seq: 0, version: 0,
  };
  s.queue = shuffle(Object.keys(champions), () => nextRandom(s));
  if (!canFillAllSlots(Object.keys(champions), openSlots(s), champions)) {
    throw new Error('Catálogo inválido: as rotas não permitem montar todos os times.');
  }
  return s;
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
  cur.endsAt = now + s.config.bidTimeMs;
  s.bids.push(bid);
  emit(s, { type: 'bid', champId: cur.champId, playerId, amount, at: now });
  return { ok: true, bid };
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

/** Próximo instante em que tick() precisa rodar (útil para agendar no servidor). */
export function nextDeadline(s: AuctionState): number | null {
  if (s.phase === 'finished') return null;
  if (s.phase === 'routePick') return s.routePick!.deadline;
  return s.current ? s.current.endsAt : s.intermissionUntil;
}

function startNextLot(s: AuctionState, now: number) {
  if (!openSlots(s).length || !s.queue.length) return finish(s, now);
  const champId = s.queue.shift()!;
  s.current = {
    champId, highBid: null, bidCount: 0,
    startedAt: now, endsAt: now + s.config.bidTimeMs,
    attempt: (s.attempts[champId] ?? 0) + 1,
  };
  emit(s, { type: 'lot_start', champId, attempt: s.current.attempt, at: now });

  const eligible = s.players.filter(p => bidEligibility(s, p.id).ok);
  if (eligible.length === 0) {
    const any = s.players.find(p => validRoles(s, p.id, champId).length)!;
    emit(s, { type: 'forced', champId, playerId: any.id, at: now });
    beginPlacement(s, any.id, champId, 0, 'sorteio', now);
  } else if (eligible.length === 1 && s.config.autoAssignSingleBidder) {
    emit(s, { type: 'only_option', champId, playerId: eligible[0].id, at: now });
    beginPlacement(s, eligible[0].id, champId, 0, 'unico', now);
  }
}

function resolveLot(s: AuctionState, now: number) {
  const cur = s.current!;
  const champId = cur.champId;
  if (cur.highBid) {
    const p = getPlayer(s, cur.highBid.playerId)!;
    p.budget -= cur.highBid.amount;
    emit(s, { type: 'sold', champId, playerId: p.id, amount: cur.highBid.amount, at: now });
    beginPlacement(s, p.id, champId, cur.highBid.amount, 'leilao', now);
    return;
  }
  s.attempts[champId] = (s.attempts[champId] ?? 0) + 1;
  if (s.attempts[champId] < s.config.maxNoBidAttempts) {
    s.queue.push(champId);
    s.current = null;
    s.intermissionUntil = now + s.config.intermissionMs;
    emit(s, { type: 'requeue', champId, at: now });
    return;
  }
  const eligible = s.players.filter(p => validRoles(s, p.id, champId).length > 0);
  const pick = eligible[Math.floor(nextRandom(s) * eligible.length)];
  emit(s, { type: 'forced', champId, playerId: pick.id, at: now });
  beginPlacement(s, pick.id, champId, 0, 'sorteio', now);
}

function beginPlacement(s: AuctionState, playerId: string, champId: string, price: number, how: AcquiredHow, now: number) {
  const options = validRoles(s, playerId, champId);
  s.current = null;
  s.routePick = { playerId, champId, price, how, options, deadline: now + s.config.routePickMs };
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
  p.roster[role] = { champId: rp.champId, price: rp.price, how: rp.how };
  s.sales.push({ champId: rp.champId, playerId: p.id, price: rp.price, role, how: rp.how, at: now });
  s.routePick = null;
  s.phase = 'bidding';
  s.intermissionUntil = now + s.config.intermissionMs;
  emit(s, { type: 'placed', champId: rp.champId, playerId: p.id, role, via, price: rp.price, how: rp.how, at: now });
  if (!openSlots(s).length) finish(s, now);
}

function finish(s: AuctionState, now: number) {
  s.phase = 'finished';
  s.current = null;
  emit(s, { type: 'finished', at: now });
}
