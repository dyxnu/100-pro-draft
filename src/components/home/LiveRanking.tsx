'use client';

import { useEffect, useState } from 'react';
import { RankingTable } from './RankingTable';
import type { RankingResult } from './ranking-shared';

const EVERY_MS = 15_000;

/** Ranking que se atualiza sozinho a cada 15 s enquanto a aba estiver visível. */
export function LiveRanking({ initial, limit }: { initial: RankingResult; limit: number }) {
  const [data, setData] = useState(initial);
  const [changed, setChanged] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch(`/api/ranking?limit=${limit}`, { cache: 'no-store' });
        if (!r.ok) return;
        const next = (await r.json()) as RankingResult;
        if (!alive || next.error) return;
        setData(prev => {
          const before = new Map(prev.rows.map((p, i) => [p.id, `${i}|${p.lp}|${p.tier}`]));
          const diff = new Set(next.rows.filter((p, i) => before.get(p.id) !== `${i}|${p.lp}|${p.tier}`).map(p => p.id));
          if (diff.size) setChanged(diff);
          return next;
        });
      } catch { /* sem rede: tenta de novo depois */ }
    };
    const id = setInterval(tick, EVERY_MS);
    const vis = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', vis);
    return () => { alive = false; clearInterval(id); document.removeEventListener('visibilitychange', vis); };
  }, [limit]);

  useEffect(() => {
    if (!changed.size) return;
    const t = setTimeout(() => setChanged(new Set()), 2500);
    return () => clearTimeout(t);
  }, [changed]);

  return (
    <div>
      <span className="hm-live" title="Atualiza sozinho a cada 15 segundos"><i />Ao vivo</span>
      <RankingTable data={data} flash={changed} />
    </div>
  );
}
