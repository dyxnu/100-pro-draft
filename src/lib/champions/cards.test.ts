import { describe, expect, it } from 'vitest';
import { STARTER_CHAMPIONS } from '@/lib/auction/champions';
import { buildCard } from './cards';

describe('cartas dos campeões', () => {
  const cards = STARTER_CHAMPIONS.map(c => buildCard(c.id, c.routes));

  it('gera todas as 30 cartas com atributos no intervalo', () => {
    expect(cards).toHaveLength(30);
    for (const card of cards) {
      for (const v of Object.values(card.attrs)) {
        expect(v).toBeGreaterThanOrEqual(40);
        expect(v).toBeLessThanOrEqual(99);
      }
    }
  });

  it('rota principal tem o melhor overall', () => {
    for (const c of STARTER_CHAMPIONS) {
      const card = buildCard(c.id, c.routes);
      expect(card.ovr[c.routes[0]]).toBe(card.bestOvr);
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
