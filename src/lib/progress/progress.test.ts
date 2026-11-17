import { describe, expect, it } from 'vitest';
import { START_RANK, applyLp, rankLabel, rankScore } from './rank';
import { addHonor, addXp, beFor, lpFor, masteryLevel } from './rewards';
import { isOffensive, censor } from '@/lib/moderation/profanity';

describe('elo e PDL', () => {
  it('sobe de divisão e de elo', () => {
    expect(applyLp(START_RANK, 120)).toEqual({ tier: 'FERRO', division: 3, lp: 20 });
    expect(applyLp({ tier: 'FERRO', division: 1, lp: 90 }, 20)).toEqual({ tier: 'BRONZE', division: 4, lp: 10 });
    expect(applyLp({ tier: 'DIAMANTE', division: 1, lp: 95 }, 10)).toEqual({ tier: 'MESTRE', division: null, lp: 5 });
  });
  it('Mestre vira Grão-Mestre e Desafiante pelo PDL', () => {
    expect(applyLp({ tier: 'MESTRE', division: null, lp: 190 }, 20).tier).toBe('GRAO_MESTRE');
    expect(applyLp({ tier: 'GRAO_MESTRE', division: null, lp: 490 }, 20).tier).toBe('DESAFIANTE');
  });
  it('cai de divisão, mas não abaixo de Ferro IV 0', () => {
    expect(applyLp({ tier: 'PRATA', division: 4, lp: 5 }, -20)).toEqual({ tier: 'BRONZE', division: 1, lp: 85 });
    expect(applyLp(START_RANK, -50)).toEqual(START_RANK);
  });
  it('sem elo começa em Ferro IV', () => {
    expect(applyLp({ tier: null, division: null, lp: 0 }, 12)).toEqual({ tier: 'FERRO', division: 4, lp: 12 });
  });
  it('ordem do ranking e rótulos', () => {
    expect(rankScore({ tier: 'OURO', division: 1, lp: 50 })).toBeGreaterThan(rankScore({ tier: 'OURO', division: 2, lp: 99 }));
    expect(rankScore({ tier: 'DESAFIANTE', division: null, lp: 600 })).toBeGreaterThan(rankScore({ tier: 'DIAMANTE', division: 1, lp: 99 }));
    expect(rankLabel({ tier: 'PLATINA', division: 2, lp: 40 })).toBe('Platina II · 40 PDL');
  });
});

describe('recompensas', () => {
  const base = { players: 6, matchesPlayed: 3, ranked: true, vip: false };
  it('campeão ganha mais PDL e essência que o eliminado', () => {
    const champ = { ...base, placement: 1, matchesWon: 3 };
    const out = { ...base, placement: 5, matchesWon: 0, matchesPlayed: 1 };
    expect(lpFor(champ)).toBeGreaterThan(0);
    expect(lpFor(out)).toBeLessThan(0);
    expect(beFor(champ)).toBeGreaterThan(beFor(out));
    expect(lpFor({ ...champ, ranked: false })).toBe(0);
  });
  it('nível, honra e maestria', () => {
    expect(addXp(1, 350, 100)).toEqual({ level: 2, xp: 50, levelsUp: 1 });
    expect(addHonor(2, 95, 10)).toEqual({ level: 3, progress: 5 });
    expect(addHonor(5, 90, 50).level).toBe(5);
    expect(masteryLevel(0)).toBe(1);
    expect(masteryLevel(6000)).toBe(3);
  });
});

describe('filtro de palavras', () => {
  it('pega ofensas com variações', () => {
    for (const w of ['nigger', 'N1GG3R', 'porra', 'p0rr4', 'viado', 'FDP', 'caralhooo']) expect(isOffensive(w)).toBe(true);
  });
  it('não bloqueia palavras normais', () => {
    for (const w of ['dyxnu', 'picanha', 'Fagner', 'rolamento', 'Diana_main', 'xaolin', 'computador']) expect(isOffensive(w)).toBe(false);
  });
  it('censura no chat', () => {
    expect(censor('que porra de lance')).toBe('que ***** de lance');
  });
});
