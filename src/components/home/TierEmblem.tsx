import { TIER_LABEL, type Tier } from '@/lib/progress/rank';

/** Arquivo do emblema oficial de cada elo (public/ranked, tirado do cliente do LoL). */
export const TIER_FILE: Record<Tier, string> = {
  FERRO: 'iron', BRONZE: 'bronze', PRATA: 'silver', OURO: 'gold', PLATINA: 'platinum', ESMERALDA: 'emerald',
  DIAMANTE: 'diamond', MESTRE: 'master', GRAO_MESTRE: 'grandmaster', DESAFIANTE: 'challenger',
};
export const tierEmblemUrl = (tier: Tier) => `/ranked/${TIER_FILE[tier]}.webp`;

/** Emblema oficial do elo, igual ao do LoL. */
export function TierEmblem({ tier, size = 64, className = '' }: { tier: Tier; size?: number; className?: string }) {
  return (
    <img
      src={tierEmblemUrl(tier)} alt={TIER_LABEL[tier]} width={size} height={size}
      className={`tier-emblem select-none object-contain ${className}`} draggable={false} loading="lazy" decoding="async"
    />
  );
}
