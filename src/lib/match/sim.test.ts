import { describe, expect, it } from 'vitest';
import { ROLES, type Role } from '@/lib/auction/engine';
import { STARTER_CHAMPIONS } from '@/lib/auction/champions';
import { buildCard, type ChampionCard } from '@/lib/champions/cards';
import { DEFAULT_STRATEGY, type Strategy } from './model';
import { type MatchTeam, preMatchChance, simulateMatch } from './sim';

const routes = Object.fromEntries(STARTER_CHAMPIONS.map(c => [c.id, c.routes]));
const team = (name: string, ids: string[], strategy: Strategy = DEFAULT_STRATEGY): MatchTeam => ({
  name,
  strategy,
  cards: Object.fromEntries(ROLES.map((r, i) => [r, buildCard(ids[i], routes[ids[i]])])) as Record<Role, ChampionCard>,
});

// Times montados à mão: um "dos sonhos" (sinergias e campeões fortes) e um fraco/fora de rota.
const STRONG = team('Fortes', ['Malphite', 'LeeSin', 'Yasuo', 'Jinx', 'Lulu']);
const WEAK = team('Fracos', ['Garen', 'Amumu', 'Annie', 'MissFortune', 'Soraka']);
const OFFROLE = team('Fora de rota', ['Soraka', 'Ashe', 'Garen', 'Leona', 'Zed']); // tudo fora do lugar

describe('simulador de partidas', () => {
  it('é determinístico pela seed', () => {
    const x = simulateMatch(STRONG, WEAK, 123);
    const y = simulateMatch(STRONG, WEAK, 123);
    expect(y).toEqual(x);
  });

  it('partidas terminam com o Nexus destruído, eventos em ordem e duração plausível', () => {
    const durations: number[] = [];
    for (let seed = 1; seed <= 300; seed++) {
      const r = simulateMatch(STRONG, WEAK, seed);
      const last = r.events[r.events.length - 1];
      expect(last.type).toBe('nexus');
      expect(last.side).toBe(r.winner);
      for (let i = 1; i < r.events.length; i++) expect(r.events[i].t).toBeGreaterThanOrEqual(r.events[i - 1].t);
      for (const e of r.events) {
        expect(e.at.x).toBeGreaterThanOrEqual(0); expect(e.at.x).toBeLessThanOrEqual(100);
        expect(e.at.y).toBeGreaterThanOrEqual(0); expect(e.at.y).toBeLessThanOrEqual(100);
      }
      expect(r.teams[0].kills + r.teams[1].kills).toBeGreaterThan(0);
      expect(r.mvp.startsWith(String(r.winner))).toBe(true);
      durations.push(r.duration / 60);
    }
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    console.log(`duração média ${avg.toFixed(1)} min (min ${Math.min(...durations).toFixed(1)}, máx ${Math.max(...durations).toFixed(1)})`);
    expect(avg).toBeGreaterThan(22);
    expect(avg).toBeLessThan(40);
  });

  it('time melhor vence mais, mas não sempre (zebra é possível)', () => {
    let wins = 0;
    for (let seed = 1; seed <= 400; seed++) if (simulateMatch(STRONG, WEAK, seed).winner === 0) wins++;
    const rate = wins / 400;
    console.log(`time forte vence ${(rate * 100).toFixed(0)}% contra o fraco; chance prevista ${(preMatchChance(STRONG, WEAK) * 100).toFixed(0)}%`);
    expect(rate).toBeGreaterThan(0.6);
    expect(rate).toBeLessThan(0.93);
  });

  it('time fora de rota é atropelado', () => {
    let wins = 0;
    for (let seed = 1; seed <= 100; seed++) if (simulateMatch(STRONG, OFFROLE, seed).winner === 0) wins++;
    expect(wins).toBeGreaterThan(90);
  });

  it('lado do mapa não dá vantagem', () => {
    let aWins = 0;
    for (let seed = 1; seed <= 400; seed++) {
      if (simulateMatch(STRONG, WEAK, seed).winner === 0) aWins++;
      if (simulateMatch(WEAK, STRONG, seed + 1000).winner === 1) aWins++;
    }
    // O forte vence com frequência parecida dos dois lados (diferença pequena = sem viés de lado).
    const asA = [...Array(400).keys()].filter(s => simulateMatch(STRONG, WEAK, s + 1).winner === 0).length;
    const asB = [...Array(400).keys()].filter(s => simulateMatch(WEAK, STRONG, s + 1001).winner === 1).length;
    expect(Math.abs(asA - asB)).toBeLessThan(60);
    expect(aWins).toBe(asA + asB);
  });

  it('mudar a tática ao vivo não altera o que já aconteceu', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const base = simulateMatch(STRONG, WEAK, seed);
      const t = 15 * 60;
      const changed = simulateMatch(STRONG, WEAK, seed, {
        changes: [{ t, side: 1, strategy: { agressividade: 'agressiva', prioridade: 'abates', estilo: 'pickoff', risco: 'arriscado' } }],
      });
      const before = (r: typeof base) => r.events.filter(e => e.t < t).map(e => e.text);
      if (base.duration > t) {
        expect(before(changed)).toEqual(before(base));
        expect(changed.events.some(e => e.type === 'tactic' && e.side === 1)).toBe(true);
      }
    }
  });

  it('bots adaptam a tática e o resultado continua válido', () => {
    let adapted = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const r = simulateMatch(STRONG, WEAK, seed, { adaptive: [true, true] });
      expect(r.events[r.events.length - 1].type).toBe('nexus');
      if (r.events.some(e => e.type === 'tactic')) adapted++;
    }
    expect(adapted).toBeGreaterThan(20);
  });

  it('estratégia que combina com o time ajuda', () => {
    const tf: Strategy = { ...DEFAULT_STRATEGY, estilo: 'teamfight' };
    const wombo = ['Malphite', 'Amumu', 'Orianna', 'MissFortune', 'Leona'];
    const enemy = team('Rival', ['Darius', 'Vi', 'Ahri', 'Caitlyn', 'Thresh']);
    let fitWins = 0, badWins = 0;
    for (let seed = 1; seed <= 400; seed++) {
      if (simulateMatch(team('TF', wombo, tf), enemy, seed).winner === 0) fitWins++;
      if (simulateMatch(team('Split', wombo, { ...DEFAULT_STRATEGY, estilo: 'splitpush' }), enemy, seed).winner === 0) badWins++;
    }
    console.log(`composição de team fight: ${fitWins}/400 jogando team fight vs ${badWins}/400 jogando split push`);
    expect(fitWins).toBeGreaterThan(badWins);
  });
});
