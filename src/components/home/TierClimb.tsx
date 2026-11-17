'use client';

import { useEffect, useState } from 'react';
import { TIERS, TIER_COLOR, TIER_LABEL, type Tier } from '@/lib/progress/rank';
import { tierEmblemUrl } from './TierEmblem';

const BLURB: Record<Tier, string> = {
  FERRO: 'Todo mundo começa aqui.',
  BRONZE: 'Os primeiros lances certeiros.',
  PRATA: 'Já sabe quando segurar o dinheiro.',
  OURO: 'Times montados com cabeça.',
  PLATINA: 'Lê a sala antes de dar lance.',
  ESMERALDA: 'Poucos chegam tão longe.',
  DIAMANTE: 'O leilão é seu território.',
  MESTRE: 'Sem divisões: só PDL.',
  GRAO_MESTRE: 'A elite do leilão.',
  DESAFIANTE: 'O topo do ranking mundial.',
};

/** Escalada de elos: o emblema oficial grande passa de Ferro a Desafiante; tocar num elo fixa nele. */
export function TierClimb() {
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  useEffect(() => {
    if (hold || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setI(x => (x + 1) % TIERS.length), 1800);
    return () => clearInterval(id);
  }, [hold]);
  const t = TIERS[i];
  return (
    <div className="hm-climb" style={{ '--tc': TIER_COLOR[t] } as React.CSSProperties}>
      <div className="hm-climb-stage">
        <div className="hm-climb-glow" />
        <img key={t} src={tierEmblemUrl(t)} alt={TIER_LABEL[t]} className="hm-climb-emblem" draggable={false} />
        <p key={`${t}-n`} className="hm-climb-name">{TIER_LABEL[t]}</p>
        <p key={`${t}-b`} className="hm-climb-blurb">{BLURB[t]}</p>
      </div>
      <ol className="hm-climb-row" onPointerLeave={() => setHold(false)}>
        {TIERS.map((x, k) => (
          <li key={x}>
            <button
              type="button" className={k === i ? 'on' : k < i ? 'past' : ''} aria-label={TIER_LABEL[x]}
              onClick={() => { setI(k); setHold(true); }} onPointerEnter={() => { setI(k); setHold(true); }}
            >
              <img src={tierEmblemUrl(x)} alt="" draggable={false} loading="lazy" />
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
