'use client';

import type { Role } from '@/lib/auction/engine';
import { CLASS_LABEL, type ChampionCard as Card, cardTier } from '@/lib/champions/card-types';
import { ChampImg, ROLE_SHORT } from '@/components/draft/ui';
import './cards.css';

const ATTR_LABEL = { ATQ: 'ATQ', MAG: 'MAG', DEF: 'DEF', MOB: 'MOB', CTR: 'CTR', UTL: 'UTL' } as const;

/** Carta estilo FIFA. `role` define o overall mostrado (padrão: melhor rota). */
export function ChampionCard({ card, role, size = 'md', onClick, selected }: {
  card: Card; role?: Role; size?: 'sm' | 'md'; onClick?: () => void; selected?: boolean;
}) {
  const shownRole = role ?? (Object.entries(card.ovr).sort((a, b) => b[1] - a[1])[0][0] as Role);
  const ovr = card.ovr[shownRole];
  const tier = cardTier(ovr);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`nx-card tier-${tier} size-${size} ${selected ? 'selected' : ''}`}
      aria-label={`${card.name}, overall ${ovr} no ${ROLE_SHORT[shownRole]}`}
    >
      <div className="nx-card-top">
        <div className="nx-ovr">{ovr}</div>
        <div className="nx-role">{ROLE_SHORT[shownRole]}</div>
        <div className="nx-class">{CLASS_LABEL[card.champClass]}</div>
      </div>
      <div className="nx-art"><ChampImg key={card.id} id={card.id} name={card.name} big /></div>
      <div className="nx-name">{card.name}</div>
      <div className="nx-attrs">
        {(Object.keys(ATTR_LABEL) as (keyof typeof ATTR_LABEL)[]).map(k => (
          <div key={k}><b>{card.attrs[k]}</b> {ATTR_LABEL[k]}</div>
        ))}
      </div>
      {size === 'md' && (
        <div className="nx-curve" title="Força no início, meio e fim de jogo">
          {(['early', 'mid', 'late'] as const).map(p => (
            <div key={p} className="bar"><span style={{ height: `${card.curve[p] * 10}%` }} /><small>{{ early: 'Início', mid: 'Meio', late: 'Fim' }[p]}</small></div>
          ))}
        </div>
      )}
    </button>
  );
}
