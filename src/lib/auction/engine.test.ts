import { describe, expect, it } from 'vitest';
import {
  ROLES, type AuctionState, type Champion,
  createGame, getPlayer, maxBid, nextDeadline, openRoles, placeBid, tick,
} from './engine';
import { createBrains, nextBotAction, stepBots } from './bots';
import { STARTER_CHAMPIONS } from './champions';

const PROFILES = ['agressivo', 'economico', 'equilibrado', 'estrategico', 'equilibrado', 'agressivo'] as const;

function newGame(bots: boolean, seed = 1) {
  return createGame({
    players: PROFILES.map((pr, i) => ({ id: `p${i}`, name: `P${i}`, isBot: bots, botProfile: pr })),
    champions: STARTER_CHAMPIONS,
    seed,
    now: 0,
  });
}

/** Avança o relógio pulando direto para o próximo evento, como o servidor fará. */
function simulate(bots: boolean, seed: number) {
  const s = newGame(bots, seed);
  const brains = createBrains(s);
  let now = 0;
  for (let i = 0; i < 100_000 && s.phase !== 'finished'; i++) {
    stepBots(s, brains, now);
    tick(s, now);
    stepBots(s, brains, now); // bots agendam a reação ao que o tick acabou de mudar
    const candidates = [nextDeadline(s), nextBotAction(s, brains)].filter((t): t is number => t != null);
    now = Math.max(now + 1, Math.min(...candidates));
  }
  return { s, now };
}

function expectValidFinal(s: AuctionState) {
  expect(s.phase).toBe('finished');
  const seen = new Set<string>();
  for (const p of s.players) {
    let spent = 0;
    for (const r of ROLES) {
      const slot = p.roster[r];
      expect(slot, `${p.id} sem ${r}`).not.toBeNull();
      expect(seen.has(slot!.champId)).toBe(false);
      seen.add(slot!.champId);
      expect(s.champions[slot!.champId].routes).toContain(r);
      spent += slot!.price;
    }
    expect(p.budget).toBeGreaterThanOrEqual(0);
    expect(spent + p.budget).toBe(s.config.budget);
  }
  expect(seen.size).toBe(30);
  // estado precisa ser JSON puro (vai para o banco)
  expect(JSON.parse(JSON.stringify(s))).toEqual(s);
}

describe('regras de lance', () => {
  it('valida mínimo, empate, múltiplos, teto e reinicia o cronômetro', () => {
    const s = newGame(false);
    tick(s, 0);
    expect(s.current).not.toBeNull();
    expect(placeBid(s, 'p0', 50, 10).ok).toBe(true);
    expect(placeBid(s, 'p1', 50, 20).ok).toBe(false); // empate: vale o primeiro
    expect(placeBid(s, 'p0', 100, 30).ok).toBe(false); // não cobre o próprio lance
    expect(placeBid(s, 'p1', 75, 40).ok).toBe(false); // múltiplo de R$ 0,50
    expect(placeBid(s, 'p1', 9850, 50).ok).toBe(false); // acima de R$ 98,00
    expect(placeBid(s, 'p1', 9800, 60).ok).toBe(true);
    expect(s.current!.endsAt).toBe(60 + 10_000);

    tick(s, 60 + 10_000);
    expect(getPlayer(s, 'p1')!.budget).toBe(200);
    if (s.phase === 'routePick') tick(s, 60 + 20_000);
    const p1 = getPlayer(s, 'p1')!;
    expect(openRoles(p1)).toHaveLength(4);
    expect(maxBid(s, 'p1')).toBe(50);
  });

  it('recusa lance depois do tempo', () => {
    const s = newGame(false);
    tick(s, 0);
    expect(placeBid(s, 'p0', 50, 10_000).ok).toBe(false);
  });
});

describe('catálogo', () => {
  it('recusa catálogo que não permite montar os times', () => {
    const bad: Champion[] = STARTER_CHAMPIONS.map(c =>
      c.routes[0] === 'SUPORTE' ? { ...c, routes: ['MID'] } : c,
    );
    expect(() =>
      createGame({ players: PROFILES.map((_, i) => ({ id: `p${i}`, name: 'x' })), champions: bad, seed: 1, now: 0 }),
    ).toThrow();
  });
});

describe('drafts completos', () => {
  it('200 drafts só com bots terminam válidos', () => {
    for (let seed = 1; seed <= 200; seed++) expectValidFinal(simulate(true, seed).s);
  });

  it('todos AFK: reenfileira, sorteia e ainda completa', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const { s } = simulate(false, seed);
      expectValidFinal(s);
      expect(s.events.some(e => e.type === 'requeue')).toBe(true);
    }
  });

  it('é determinístico pela seed', () => {
    const a = simulate(true, 42).s;
    const b = simulate(true, 42).s;
    expect(a.sales).toEqual(b.sales);
  });
});
