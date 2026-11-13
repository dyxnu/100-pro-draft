import { describe, expect, it } from 'vitest';
import { STARTER_CHAMPIONS } from '@/lib/auction/champions';
import { buildCard } from './cards';

describe('cartas dos campeões', () => {
  const cards = STARTER_CHAMPIONS.map(c => buildCard(c.id, c.routes));

  it('gera todas as cartas do catálogo com atributos no intervalo', () => {
    expect(cards).toHaveLength(STARTER_CHAMPIONS.length);
    for (const card of cards) {
      for (const v of Object.values(card.attrs)) {
        expect(v).toBeGreaterThanOrEqual(40);
        expect(v).toBeLessThanOrEqual(99);
      }
    }
  });

  it('melhor overall é numa rota do campeão; fora das rotas vale metade', () => {
    for (const c of STARTER_CHAMPIONS) {
      const card = buildCard(c.id, c.routes);
      const inRole = Math.max(...c.routes.map(r => card.ovr[r]));
      expect(inRole).toBe(card.bestOvr);
      for (const [role, v] of Object.entries(card.ovr)) {
        if (!c.routes.includes(role as never)) expect(v).toBe(Math.round(inRole / 2));
      }
    }
  });

  it('faixa de overall parecida com cartas de futebol', () => {
    const best = cards.map(c => c.bestOvr);
    console.table(cards.map(c => ({ id: c.id, classe: c.champClass, ovr: c.bestOvr, ...c.attrs })).sort((a, b) => b.ovr - a.ovr));
    expect(Math.min(...best)).toBeGreaterThanOrEqual(65);
    expect(Math.max(...best)).toBeLessThanOrEqual(95);
    expect(Math.max(...best) - Math.min(...best)).toBeGreaterThanOrEqual(8); // há diferença entre campeões
  });
});
