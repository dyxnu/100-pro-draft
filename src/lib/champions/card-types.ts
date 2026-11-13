// Tipos e utilitários das cartas que podem ir para o navegador (sem o JSON do Data Dragon).
import type { Role } from '@/lib/auction/engine';

export type ChampClass = 'tanque' | 'lutador' | 'assassino' | 'mago' | 'atirador' | 'encantador';

export const CLASS_LABEL: Record<ChampClass, string> = {
  tanque: 'Tanque', lutador: 'Lutador', assassino: 'Assassino', mago: 'Mago', atirador: 'Atirador', encantador: 'Suporte',
};

export interface ChampionCard {
  id: string;
  name: string;
  title: string;
  champClass: ChampClass;
  tags: string[];
  attrs: { ATQ: number; MAG: number; DEF: number; MOB: number; CTR: number; UTL: number };
  curve: { early: number; mid: number; late: number };
  engage: number;
  aoe: number;
  ranged: boolean;
  difficulty: number;
  ovr: Record<Role, number>;
  bestOvr: number;
  patch: string;
}

export function cardTier(ovr: number): 'icone' | 'ouro' | 'prata' | 'bronze' {
  if (ovr >= 88) return 'icone';
  if (ovr >= 80) return 'ouro';
  if (ovr >= 72) return 'prata';
  return 'bronze';
}
