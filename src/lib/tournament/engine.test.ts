import { describe, expect, it } from 'vitest';
import { createGame } from '@/lib/auction/engine';
import { createBrains } from '@/lib/auction/bots';
import { advance } from '@/lib/auction/runner';
import { STARTER_CHAMPIONS } from '@/lib/auction/champions';
import {
  changeStrategy, createTournament, playingMatchOf, roundMatches, setReady, swapLineup,
  tickTournament, tournamentDeadline,
} from './engine';

function draftedAuction(n: number, seed: number, bots = true) {
  const profiles = ['agressivo', 'economico', 'equilibrado', 'estrategico', 'equilibrado', 'agressivo'] as const;
  const s = createGame({
    players: profiles.slice(0, n).map((p, i) => ({ id: `seat${i}`, name: `Time ${i}`, isBot: bots || i > 0, botProfile: p })),
    champions: STARTER_CHAMPIONS, seed, now: 0,
  });
  advance(s, createBrains(s), 3_600_000);
  return s;
}

function runToEnd(t: ReturnType<typeof createTournament>, champs: ReturnType<typeof draftedAuction>['champions'], start: number) {
  let now = start;
  for (let i = 0; i < 200 && t.stage !== 'done'; i++) {
    tickTournament(t, now, champs);
    const d = tournamentDeadline(t);
    now = Math.max(now + 1, d ?? now + 1000);
  }
  return now;
}

describe('campeonato mata-mata', () => {
  it('6 times: 2 melhores cabeças de chave folgam, 3 rodadas, 1 campeão', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const a = draftedAuction(6, seed);
      const t = createTournament(a, 0);
      expect(t.totalRounds).toBe(3);
      const r1 = roundMatches(t, 1);
      expect(r1).toHaveLength(4);
      const byes = r1.filter(m => !m.a || !m.b).map(m => m.a ?? m.b);
      expect(byes.map(id => t.teams[id!].seed).sort()).toEqual([1, 2]);
      runToEnd(t, a.champions, 3_600_000);
      expect(t.stage).toBe('done');
      expect(t.champion).toBeTruthy();
      expect(Object.values(t.teams).filter(x => !x.eliminated)).toHaveLength(1);
      expect(t.matches.filter(m => m.a && m.b)).toHaveLength(5); // 2 + 2 + 1
    }
  });

  it('2, 3 e 4 times também fecham a chave', () => {
    for (const n of [2, 3, 4]) {
      const a = draftedAuction(n, 7);
      const t = createTournament(a, 0);
      runToEnd(t, a.champions, 3_600_000);
      expect(t.champion).toBeTruthy();
      expect(t.matches.filter(m => m.a && m.b)).toHaveLength(n - 1);
    }
  });

  it('a rodada espera o humano ficar pronto (ou o tempo acabar)', () => {
    const a = draftedAuction(6, 3, false);
    const t = createTournament(a, 0);
    const me = 'seat0';
    const myMatch = playingMatchOf(t, me);
    tickTournament(t, 1000, a.champions);
    expect(t.stage).toBe(myMatch?.a && myMatch?.b ? 'lineup' : 'playing');
    if (t.stage === 'lineup') {
      expect(swapLineup(t, me, 'TOP', 'MID').ok).toBe(true);
      expect(t.teams[me].ready).toBe(false);
      setReady(t, me, true);
      tickTournament(t, 2000, a.champions);
      expect(t.stage).toBe('playing');
    }
  });

  it('tática ao vivo durante a partida muda o rumo, mas não o passado', () => {
    const a = draftedAuction(2, 11, false);
    const t = createTournament(a, 0);
    setReady(t, 'seat0', true);
    tickTournament(t, 0, a.champions);
    const m = roundMatches(t)[0];
    const before = m.endsAt;
    const r = changeStrategy(t, 'seat0', { agressividade: 'agressiva', prioridade: 'abates', estilo: 'pickoff', risco: 'arriscado' }, m.startedAt! + 20_000, a.champions);
    expect(r.ok).toBe(true);
    expect(m.changes).toHaveLength(1);
    expect(m.changes[0].t).toBeGreaterThan(20 * t.config.speed);
    expect(m.endsAt).not.toBeNull();
    expect(typeof before).toBe('number');
  });
});
