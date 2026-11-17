// Bots: usam só as ações públicas do motor, igual a um humano.
// O "cérebro" também é serializável, para poder ser salvo junto com o estado da sala.
import {
  ROLES, type AuctionState, type BotProfile, type Player, type Role,
  bidEligibility, chooseRoute, maxBid, minNextBid, nextRandom, openRoles, passLot, placeBid,
} from './engine';

export const BOT_PROFILES: Record<BotProfile, { label: string; mult: number; jump: number; prefMult?: number }> = {
  economico: { label: 'Econômico', mult: 0.6, jump: 0.0 },
  equilibrado: { label: 'Equilibrado', mult: 0.85, jump: 0.08 },
  agressivo: { label: 'Agressivo', mult: 1.2, jump: 0.25 },
  estrategico: { label: 'Estratégico', mult: 0.7, jump: 0.12, prefMult: 1.7 },
};

const TIER_FACTOR = { 1: 0.6, 2: 1.0, 3: 1.5 } as const;

export interface BotBrain {
  prefRole: Role;
  lotKey: string | null;
  seen: number;
  nextAt: number | null; // null = passou nesta rodada de preço
  noise: number;
  routeAt: number | null;
}
export type BotBrains = Record<string, BotBrain>;

export function createBrains(s: AuctionState): BotBrains {
  const brains: BotBrains = {};
  s.players.filter(p => p.isBot).forEach(p => {
    brains[p.id] = {
      prefRole: ROLES[Math.floor(nextRandom(s) * ROLES.length)],
      lotKey: null, seen: -1, nextAt: null, noise: 1, routeAt: null,
    };
  });
  return brains;
}

function valuation(s: AuctionState, p: Player, brain: BotBrain): number {
  const champ = s.champions[s.current!.champId];
  const prof = BOT_PROFILES[p.botProfile ?? 'equilibrado'];
  const avgPerSlot = p.budget / openRoles(p).length;
  let mult = prof.mult;
  if (prof.prefMult && champ.routes.includes(brain.prefRole) && !p.roster[brain.prefRole]) mult = prof.prefMult;
  // Paciência: com muitos lotes ainda por vir para poucas vagas, o bot segura o dinheiro.
  const lotsLeft = Math.max(1, s.totalLots - (s.current!.index - 1));
  const openAll = s.players.reduce((n, q) => n + openRoles(q).length, 0);
  const scarcity = openAll / lotsLeft;                        // ~0.83 no começo; perto de 1 = acabando
  const patience = Math.max(0.75, Math.min(1.15, 0.3 + scarcity * 0.7));
  const v = avgPerSlot * mult * TIER_FACTOR[champ.tier] * brain.noise * patience;
  const unit = s.config.minIncrement;
  return Math.min(Math.floor(v / unit) * unit, maxBid(s, p.id));
}

export function stepBots(s: AuctionState, brains: BotBrains, now: number): void {
  const rand = () => nextRandom(s);
  for (const p of s.players) {
    if (!p.isBot) continue;
    const b = brains[p.id];
    if (!b) continue;

    if (s.phase === 'routePick') {
      const rp = s.routePick!;
      b.nextAt = null; // nada de lances durante a escolha de rota
      if (rp.playerId !== p.id) { b.routeAt = null; continue; }
      if (b.routeAt == null) b.routeAt = now + 500 + rand() * 900;
      if (now < b.routeAt) continue;
      b.routeAt = null;
      const role = p.botProfile === 'estrategico' && rp.options.includes(b.prefRole)
        ? b.prefRole
        : s.champions[rp.champId].routes.find(r => rp.options.includes(r))!;
      chooseRoute(s, p.id, role, now);
      continue;
    }
    b.routeAt = null;
    if (s.phase !== 'bidding' || !s.current) { b.nextAt = null; continue; }

    const key = `${s.current.champId}@${s.current.startedAt}`;
    if (b.lotKey !== key) {
      b.lotKey = key; b.noise = 0.8 + rand() * 0.4; b.seen = -1;
      // Sem pressa e fora da rota preferida: às vezes nem disputa (deixa o lote para os outros).
      const champ = s.champions[s.current.champId];
      const lotsLeft = s.totalLots - (s.current.index - 1);
      const relaxed = s.players.reduce((n, q) => n + openRoles(q).length, 0) * 1.15 < lotsLeft;
      if (relaxed && !champ.routes.includes(b.prefRole) && rand() < 0.3) b.noise = 0.35;
    }
    if (b.seen !== s.seq) {
      b.seen = s.seq;
      // Reage em um momento aleatório antes do relógio acabar.
      const window = Math.max(600, Math.min(s.config.bidTimeMs, s.current.endsAt - now) * 0.8);
      b.nextAt = now + 300 + rand() * window;
    }
    if (b.nextAt == null || now < b.nextAt) continue;
    b.nextAt = null;

    if (s.current.highBid?.playerId === p.id) continue;
    if (!bidEligibility(s, p.id).ok) continue;
    const v = valuation(s, p, b);
    const min = minNextBid(s);
    if (min > v) { passLot(s, p.id, now); continue; } // passou do que ele aceita pagar
    const prof = BOT_PROFILES[p.botProfile ?? 'equilibrado'];
    const frac = 0.2 + rand() * 0.3 + (rand() < prof.jump ? 0.25 : 0);
    const unit = s.config.minIncrement;
    placeBid(s, p.id, min + Math.floor(((v - min) * frac) / unit) * unit, now);
  }
}

/** Próximo instante em que algum bot quer agir (para o servidor agendar). */
export function nextBotAction(s: AuctionState, brains: BotBrains): number | null {
  if (s.phase === 'finished') return null;
  let best: number | null = null;
  for (const b of Object.values(brains)) {
    for (const t of [b.nextAt, b.routeAt]) if (t != null && (best == null || t < best)) best = t;
  }
  return best;
}
