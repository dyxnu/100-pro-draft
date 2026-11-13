'use client';

import { useState } from 'react';
import type { AcquiredHow, Role } from '@/lib/auction/engine';

export const SEAT_COLORS = ['#c8aa6e', '#0ac8b9', '#e84057', '#9b7dff', '#5ccf6a', '#ff9f43'];
export const ROLE_LABEL: Record<Role, string> = { TOP: 'Top', JUNGLE: 'Jungle', MID: 'Mid', ADC: 'ADC', SUPORTE: 'Suporte' };
export const ROLE_SHORT: Record<Role, string> = { TOP: 'TOP', JUNGLE: 'JG', MID: 'MID', ADC: 'ADC', SUPORTE: 'SUP' };
export const HOW_LABEL: Record<AcquiredHow, string> = { leilao: '', sorteio: 'sorteado', unico: 'sobra' };

const DDRAGON = '14.23.1';
const initials = (n: string) =>
  n.replace(/[^A-Za-zÀ-ú ]/g, '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

export const seatColor = (playerId: string) => SEAT_COLORS[Number(playerId.replace('seat', '')) % SEAT_COLORS.length];

/** Imagem do campeão (Data Dragon) com iniciais caso a imagem não carregue. */
export function ChampImg({ id, name, big = false, className = '' }: { id: string; name: string; big?: boolean; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className={`${className} img-fallback`}>{initials(name)}</div>;
  const src = big
    ? `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${id}_0.jpg`
    : `https://ddragon.leagueoflegends.com/cdn/${DDRAGON}/img/champion/${id}.png`;
  return <img key={src} src={src} alt={name} className={className} loading="lazy" onError={() => setFailed(true)} />;
}
