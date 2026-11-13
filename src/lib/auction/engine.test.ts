import { describe, expect, it } from 'vitest';
import {
  ROLES, type AuctionState,
  createGame, getPlayer, maxBid, nextDeadline, openRoles, passLot, placeBid, tick,
} from './engine';
import { createBrains, nextBotAction, stepBots } from './bots';
import { STARTER_CHAMPIONS } from './champions';
import { advance, nextWake } from './runner';

const PROFILES = ['agressivo', 'economico', 'equilibrado', 'estrategico', 'equilibrado', 'agressivo'] as const;

function newGame(bots: boolean, seed = 1, n = 6) {
  return createGame({
    players: PROFILES.slice(0, n).map((pr, i) => ({ id: `p${i}`, name: `P${i}`, isBot: bots, botProfile: pr })),
    champions: STARTER_CHAMPIONS,
    seed,
    now: 0,
  });
}

/** Avança o relógio pulando direto para o próximo evento, como o servidor fará. */
function simulate(bots: boolean, seed: number, n = 6) {
  const s = newGame(bots, seed, n);
  const brains = createBrains(s);
  let now = 0;
  for (let i = 0; i < 100_000 && s.phase !== 'finished'; i++) {
    stepBots(s, brains, now);
    tick(s, now);
    stepBots(s, brains, now);
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
      if (slot!.how === 'leilao') expect(s.champions[slot!.champId].routes).toContain(r);
      expect(slot!.offRole).toBe(!s.champions[slot!.champId].routes.includes(r));
      spent += slot!.price;
    }
    expect(p.budget).toBeGreaterThanOrEqual(0);
    expect(spent + p.budget).toBe(s.config.budget);
  }
  expect(seen.size).toBe(s.players.length * 5);
  expect(JSON.parse(JSON.stringify(s))).toEqual(s); // estado precisa ser JSON puro (vai para o banco)
}

describe('regras de lance (v2)', () => {
  it('lance em reais inteiros, mínimo R$ 1, garantia de 3 s, empate vale o primeiro', () => {
    const s = newGame(false);
    tick(s, 0);
    expect(s.current).not.toBeNull();
    expect(s.current!.endsAt).toBe(10_000);
    expect(placeBid(s, 'p0', 100, 1000).ok).toBe(true);
    expect(s.current!.endsAt).toBe(10_000); // ainda tinha mais de 3 s: não muda
    expect(placeBid(s, 'p1', 100, 2000).ok).toBe(false); // empate: vale o primeiro
    expect(placeBid(s, 'p1', 150, 2000).ok).toBe(false); // centavos não
    expect(placeBid(s, 'p1', 9700, 2000).ok).toBe(false); // máximo é R$ 96 (guarda R$ 1 x 4 vagas)
    expect(placeBid(s, 'p1', 9600, 9000).ok).toBe(true);
    expect(s.current!.endsAt).toBe(12_000); // faltava 1 s: lance garante 3 s
    tick(s, 12_000);
    expect(getPlayer(s, 'p1')!.budget).toBe(400);
    if (s.phase === 'routePick') tick(s, 30_000);
    expect(openRoles(getPlayer(s, 'p1')!)).toHaveLength(4);
    expect(maxBid(s, 'p1')).toBe(100);
  });

  it('se todos passam, o lote fecha na hora e o campeão vira sobra', () => {
    const s = newGame(false);
    tick(s, 0);
    const champ = s.current!.champId;
    for (let i = 0; i < 5; i++) passLot(s, `p${i}`, 500);
    expect(s.current!.endsAt).toBe(10_000);
    passLot(s, 'p5', 600);
    expect(s.current!.endsAt).toBe(600);
    tick(s, 600);
    expect(s.leftovers).toContain(champ);
  });

  it('quem lidera não pode passar; os outros passando encerram o lote', () => {
    const s = newGame(false);
    tick(s, 0);
    placeBid(s, 'p0', 300, 100);
    expect(passLot(s, 'p0', 200).ok).toBe(false);
    for (let i = 1; i < 6; i++) passLot(s, `p${i}`, 300);
    expect(s.current!.endsAt).toBe(300);
  });

  it('lotes: 6 por jogador, equilibrados por rota, cada campeão uma vez', () => {
    const s = newGame(false);
    expect(s.totalLots).toBe(36);
    expect(new Set(s.queue).size).toBe(36);
    const perRole = ROLES.map(r => s.queue.filter(id => s.champions[id].routes[0] === r).length);
    expect(Math.max(...perRole) - Math.min(...perRole)).toBeLessThanOrEqual(1);
    expect(newGame(false, 1, 3).totalLots).toBe(18);
  });
});

describe('drafts completos', () => {
  it('200 drafts só com bots terminam válidos', () => {
    let lotsUsed = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const { s } = simulate(true, seed);
      expectValidFinal(s);
      lotsUsed += s.totalLots - s.queue.length;
    }
    console.log(`lotes usados em média: ${(lotsUsed / 200).toFixed(1)} de 36`);
  });

  it('todos AFK: nenhum lance, times completados com sobras', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { s } = simulate(false, seed);
      expectValidFinal(s);
      expect(s.sales.every(x => x.how === 'sobra')).toBe(true);
    }
  });

  it('salas menores (2 e 4 jogadores) também funcionam', () => {
    for (const n of [2, 4]) for (let seed = 1; seed <= 30; seed++) expectValidFinal(simulate(true, seed, n).s);
  });

  it('servidor chamado em momentos irregulares chega no mesmo resultado', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const exact = simulate(true, seed).s;
      const s = newGame(true, seed);
      const brains = createBrains(s);
      let now = 0;
      let calls = 0;
      while (s.phase !== 'finished' && calls++ < 50_000) {
        now += Math.floor(((seed * 7919 + calls * 104729) % 15_000));
        advance(s, brains, now);
      }
      expectValidFinal(s);
      expect(s.sales.map(x => [x.champId, x.playerId, x.price, x.role])).toEqual(
        exact.sales.map(x => [x.champId, x.playerId, x.price, x.role]),
      );
      expect(nextWake(s, brains)).toBeNull();
    }
  });

  it('é determinístico pela seed', () => {
    expect(simulate(true, 42).s.sales).toEqual(simulate(true, 42).s.sales);
  });
});
