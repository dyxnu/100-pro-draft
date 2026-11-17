'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { type AuctionState, type Champion, chooseRoute, createGame, passLot, placeBid } from '@/lib/auction/engine';
import { type BotBrains, createBrains } from '@/lib/auction/bots';
import { advance } from '@/lib/auction/runner';
import { SKINS } from '@/lib/store/catalog';
import type { ClientAction } from '@/lib/rooms/types';
import { AuctionStage } from '@/components/draft/AuctionView';

const ME = 'seat0';

export function AuctionDemo({ champions }: { champions: Champion[] }) {
  const [s, setS] = useState<AuctionState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const game = useRef<{ s: AuctionState; brains: BotBrains } | null>(null);

  useEffect(() => {
    const now = Date.now();
    const profiles = ['equilibrado', 'agressivo', 'economico', 'estrategico', 'equilibrado', 'agressivo'] as const;
    const st = createGame({
      players: profiles.map((p, i) => ({ id: `seat${i}`, name: i === 0 ? 'Você' : ['Bot Barão', 'Bot Arauto', 'Bot Poro', 'Bot Dragão', 'Bot Arongueijo'][i - 1], isBot: i > 0, botProfile: p })),
      champions, seed: now % 100000, now,
    });
    game.current = { s: st, brains: createBrains(st) };
    setS(structuredClone(st));
  }, [champions]);

  // Relógio local (no jogo de verdade quem faz isso é o servidor).
  // ?skins=1 na URL: todo lote vem com skin (só nesta demonstração, para ver o efeito).
  useEffect(() => {
    const forceSkins = new URLSearchParams(window.location.search).has('skins');
    const id = setInterval(() => {
      const g = game.current;
      if (!g) return;
      const v = g.s.version;
      advance(g.s, g.brains, Date.now());
      const cur = g.s.current;
      if (forceSkins && cur && cur.skin == null && cur.bidCount === 0) {
        const list = SKINS[cur.champId];
        if (list?.length) { cur.skin = list[cur.index % list.length].num; g.s.version++; }
      }
      if (g.s.version !== v) setS(structuredClone(g.s));
    }, 100);
    return () => clearInterval(id);
  }, []);

  const act = useCallback((a: ClientAction) => {
    const g = game.current;
    if (!g) return;
    const now = Date.now();
    const r = a.type === 'bid' ? placeBid(g.s, ME, a.amount, now)
      : a.type === 'pass' ? passLot(g.s, ME, now)
      : a.type === 'route' ? chooseRoute(g.s, ME, a.role, now)
      : { ok: true as const };
    if (!r.ok) { setToast(r.reason); setTimeout(() => setToast(null), 2200); }
    advance(g.s, g.brains, now);
    setS(structuredClone(g.s));
  }, []);

  const now = useCallback(() => Date.now(), []);
  if (!s) return <p className="mt-10 text-muted">Montando o leilão…</p>;
  if (s.phase === 'finished') return <p className="panel mt-10 p-6 text-center font-bold text-gold2">Leilão encerrado! No jogo de verdade, agora vem a escalação e o campeonato.</p>;
  return <AuctionStage s={s} me={ME} act={act} pending={false} serverTime={now} code="DEMO" toast={toast} />;
}
