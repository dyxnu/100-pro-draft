import { TIERS, TIER_COLOR, TIER_LABEL, type Tier } from '@/lib/progress/rank';

/**
 * Emblema de elo próprio (SVG), desenhado a partir da cor do elo. Quanto mais alto o elo,
 * mais asas; Mestre+ ganha coroa e o Desafiante, raios dourados. Não usa arte oficial.
 */
export function TierEmblem({ tier, size = 64, className = '' }: { tier: Tier; size?: number; className?: string }) {
  const t = TIERS.indexOf(tier);
  const color = TIER_COLOR[tier];
  const g = `hm-te-${tier}`;
  const wings = Math.min(3, Math.floor((t + 1) / 3)); // Ferro/Bronze 0 · Prata–Platina 1 · Esmeralda–Mestre 2 · GM/Desafiante 3
  const apex = t >= 7;

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} role="img" aria-label={TIER_LABEL[tier]}>
      <defs>
        <linearGradient id={`${g}-m`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".3" stopColor={color} />
          <stop offset="1" stopColor="#14173f" />
        </linearGradient>
        <radialGradient id={`${g}-gem`} cx="40%" cy="30%" r="80%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".35" stopColor={color} />
          <stop offset="1" stopColor="#0e1030" />
        </radialGradient>
        <linearGradient id={`${g}-au`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6dc94" />
          <stop offset="1" stopColor="#b48a2f" />
        </linearGradient>
      </defs>

      {tier === 'DESAFIANTE' && (
        <g opacity=".85">
          {Array.from({ length: 10 }, (_, i) => (
            <polygon key={i} points="50,50 47,6 53,6" fill={`url(#${g}-au)`} transform={`rotate(${i * 36} 50 52)`} />
          ))}
        </g>
      )}

      {Array.from({ length: wings }, (_, k) => {
        const d = `M33 ${40 + k * 9} L${12 - k * 4} ${26 + k * 13} L${20 - k * 2} ${42 + k * 12} L30 ${56 + k * 7} Z`;
        return (
          <g key={k} fill={`url(#${g}-m)`} stroke="#0e1030" strokeWidth="1.5" strokeLinejoin="round">
            <path d={d} />
            <path d={d} transform="matrix(-1 0 0 1 100 0)" />
          </g>
        );
      })}

      {apex && (
        <polygon
          points="34,26 38,10 44,20 50,4 56,20 62,10 66,26"
          fill={`url(#${g}-au)`} stroke="#0e1030" strokeWidth="1.5" strokeLinejoin="round"
        />
      )}

      <path d="M50 16 L74 27 L72 62 Q66 78 50 90 Q34 78 28 62 L26 27 Z" fill={`url(#${g}-m)`} stroke="#0e1030" strokeWidth="2" strokeLinejoin="round" />
      <path d="M50 24 L67 32 L65.5 60 Q61 72 50 81 Q39 72 34.5 60 L33 32 Z" fill="#1c2058" />
      <path d="M50 24 L67 32 L65.5 60 Q61 72 50 81 Q39 72 34.5 60 L33 32 Z" fill={color} opacity=".22" />
      <path d="M50 33 L61 51 L50 70 L39 51 Z" fill={`url(#${g}-gem)`} stroke="#ffffff" strokeOpacity=".7" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M50 33 L55 46 L50 51 L45 46 Z" fill="#ffffff" opacity=".35" />
      {t >= 3 && <circle cx="50" cy="19.5" r="2.4" fill={`url(#${g}-au)`} />}
    </svg>
  );
}
