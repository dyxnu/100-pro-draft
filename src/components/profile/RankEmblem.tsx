// Emblema oficial do elo (o mesmo do LoL). Sem elo: contorno tracejado.
import { TIER_LABEL, isApex, type Tier } from '@/lib/progress/rank';
import { tierEmblemUrl } from '@/components/home/TierEmblem';

const ROMAN = ['', 'I', 'II', 'III', 'IV'];

export function RankEmblem({ tier, division, size = 96 }: { tier: Tier | null; division?: number | null; size?: number }) {
  const apex = isApex(tier);
  const label = tier ? `${TIER_LABEL[tier]}${!apex && division ? ` ${ROMAN[division]}` : ''}` : 'Sem elo';
  if (!tier) {
    return (
      <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={label} className="pf-emblem">
        <path d="M60 10 L98 28 L94 74 L60 108 L26 74 L22 28 Z" fill="none" stroke="#9a9cc0" strokeWidth="4" strokeDasharray="7 6" />
      </svg>
    );
  }
  return (
    <img
      src={tierEmblemUrl(tier)} alt={label} width={size} height={size}
      className="pf-emblem select-none object-contain" draggable={false} decoding="async"
    />
  );
}
