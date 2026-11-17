import { describe, expect, it } from 'vitest';
import { ROLES, type Role } from '@/lib/auction/engine';
import { STARTER_CHAMPIONS } from '@/lib/auction/champions';
import { buildCard, type ChampionCard } from '@/lib/champions/cards';
import { DEFAULT_STRATEGY } from '@/lib/match/model';
import { type MatchTeam, simulateMatch } from '@/lib/match/sim';
import { ALL_KEYS, CHAMP_SPEED, buildDeaths, buildPaths, isDeadAt, positionAt } from './positions';

const routes = Object.fromEntries(STARTER_CHAMPIONS.map(c => [c.id, c.routes]));
const team = (name: string, ids: string[]): MatchTeam => ({
  name, strategy: DEFAULT_STRATEGY,
  cards: Object.fromEntries(ROLES.map((r, i) => [r, buildCard(ids[i], routes[ids[i]])])) as Record<Role, ChampionCard>,
});
const A = team('A', ['Camille', 'Ekko', 'Ahri', 'Jinx', 'Lulu']);
const B = team('B', ['Darius', 'LeeSin', 'Syndra', 'Kaisa', 'Nautilus']);

describe('movimento no mini-mapa', () => {
  it('quem participa de um lance está no local na hora, e ninguém se teletransporta', () => {
    let late = 0, total = 0;
    const byType: Record<string, number> = {};
    for (let seed = 1; seed <= 40; seed++) {
      const r = simulateMatch(A, B, seed);
      const deaths = buildDeaths(r.events);
      const paths = buildPaths(r.events, deaths, [false, false], r.duration);
      for (const e of r.events) {
        // Torres contam para o time todo no simulador; aqui só lutas, abates, ganks e objetivos.
        if (['tactic', 'nexus', 'tower', 'inhibitor', 'nexus_tower'].includes(e.type)) continue;
        for (const k of [...e.actors, ...e.victims]) {
          total++;
          // Chegou ao local até 6 s depois do lance (correndo para a luta)?
          const near = [0, 1, 2, 3, 4, 5, 6].some(dt => { const p = positionAt(paths, k, e.t + dt); return Math.hypot(p.x - e.at.x, p.y - e.at.y) <= 4; });
          if (!near) { late++; byType[e.type + (e.victims.includes(k) ? ':vit' : ':act') + (isDeadAt(deaths, k, e.t - 0.5) ? ':dead' : '')] = (byType[e.type + (e.victims.includes(k) ? ':vit' : ':act') + (isDeadAt(deaths, k, e.t - 0.5) ? ':dead' : '')] ?? 0) + 1; }
        }
      }
      // Velocidade máxima entre quadros de 1 s (fora de mortes/renascimentos).
      for (const k of ALL_KEYS) {
        for (let t = 1; t < r.duration; t += 1) {
          if (isDeadAt(deaths, k, t) || isDeadAt(deaths, k, t - 1)) continue;
          const a = positionAt(paths, k, t - 1), b = positionAt(paths, k, t);
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(CHAMP_SPEED * 1.7);
        }
      }
    }
    console.log(`fora do local na hora do lance: ${late}/${total}`);
    // Sobram casos de quem acabou de renascer ou lutou longe: chega correndo, sem teletransporte.
    expect(late / total).toBeLessThan(0.07);
  });
});
