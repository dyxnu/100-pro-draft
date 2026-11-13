'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { type AuctionState, type Champion, createGame } from '@/lib/auction/engine';
import { createBrains } from '@/lib/auction/bots';
import { advance } from '@/lib/auction/runner';
import type { ClientAction } from '@/lib/rooms/types';
import {
  type TournamentState, changeStrategy, createTournament, setReady, swapLineup, tickTournament,
} from '@/lib/tournament/engine';
import { TournamentView } from '@/components/tournament/TournamentView';

const ME = 'seat0';

export function TournamentDemo({ champions }: { champions: Champion[] }) {
  const [game, setGame] = useState<{ s: AuctionState; t: TournamentState } | null>(null);
  const ref = useRef(game);
  ref.current = game;

  useEffect(() => {
    const now = Date.now();
    const profiles = ['equilibrado', 'agressivo', 'economico', 'estrategico', 'equilibrado', 'agressivo'] as const;
    const s = createGame({
      players: profiles.map((p, i) => ({ id: `seat${i}`, name: i === 0 ? 'Você' : `Bot ${i}`, isBot: true, botProfile: p })),
      champions, seed: now % 100000, now: 0,
    });
    advance(s, createBrains(s), 3_600_000); // leilão resolvido na hora pelos bots
    const t = createTournament(s, now, { lineupMs: 60_000 });
    t.teams[ME].isBot = false;
    t.teams[ME].ready = false;
    setGame({ s, t });
  }, [champions]);

  // Relógio local (no jogo de verdade quem faz isso é o servidor).
  useEffect(() => {
    const id = setInterval(() => {
      const g = ref.current;
      if (!g) return;
      const v = g.t.version;
      tickTournament(g.t, Date.now(), g.s.champions);
      if (g.t.version !== v) setGame({ s: g.s, t: structuredClone(g.t) });
    }, 250);
    return () => clearInterval(id);
  }, []);

  const act = useCallback((a: ClientAction) => {
    const g = ref.current;
    if (!g) return;
    const t = structuredClone(g.t);
    if (a.type === 'lineup_swap') swapLineup(t, ME, a.a, a.b);
    else if (a.type === 'ready') setReady(t, ME, a.ready);
    else if (a.type === 'strategy') changeStrategy(t, ME, a.strategy, Date.now(), g.s.champions);
    setGame({ s: g.s, t });
  }, []);

  const now = useCallback(() => Date.now(), []);
  if (!game) return <p className="mt-10 text-muted">Montando o campeonato…</p>;
  return <TournamentView s={game.s} t={game.t} me={ME} act={act} pending={false} serverTime={now} auctionSummary={<p className="text-muted">Leilão resolvido pelos bots nesta demonstração.</p>} />;
}
