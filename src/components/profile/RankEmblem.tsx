// Emblema de elo ORIGINAL (SVG): escudo lunar nas cores de TIER_COLOR, com asas a partir de Mestre.
// Não usa imagens da Riot.
import { TIER_COLOR, TIER_LABEL, isApex, type Tier } from '@/lib/progress/rank';

const ROMAN = ['', 'I', 'II', 'III', 'IV'];

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt))));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function RankEmblem({ tier, division, size = 96 }: { tier: Tier | null; division?: number | null; size?: number }) {
  const base = tier ? TIER_COLOR[tier] : '#9a9cc0';
  const light = shade(base, 0.45), dark = shade(base, -0.45);
  const gid = `pfrk-${tier ?? 'none'}`;
  const apex = isApex(tier);
  const label = tier ? `${TIER_LABEL[tier]}${!apex && division ? ` ${ROMAN[division]}` : ''}` : 'Sem elo';
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={label} className="pf-emblem">
      <defs>
        <linearGradient id={`${gid}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset=".55" stopColor={base} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <radialGradient id={`${gid}-c`} cx=".5" cy=".42" r=".5">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".9" />
          <stop offset="1" stopColor={light} stopOpacity=".15" />
        </radialGradient>
      </defs>
      {apex && (
        <g fill={`url(#${gid}-g)`} stroke={dark} strokeWidth="1.5" opacity=".95">
          <path d="M30 52 C14 46 6 32 4 18 C16 26 24 30 34 32 C26 24 22 16 22 8 C32 18 38 26 42 38 Z" />
          <path d="M90 52 C106 46 114 32 116 18 C104 26 96 30 86 32 C94 24 98 16 98 8 C88 18 82 26 78 38 Z" />
        </g>
      )}
      {!tier ? (
        <path d="M60 10 L98 28 L94 74 L60 108 L26 74 L22 28 Z" fill="none" stroke={base} strokeWidth="4" strokeDasharray="7 6" />
      ) : (
        <>
          <path d="M60 8 L100 27 L96 75 L60 110 L24 75 L20 27 Z" fill={`url(#${gid}-g)`} stroke={dark} strokeWidth="2.5" />
          <path d="M60 18 L90 32 L87 71 L60 98 L33 71 L30 32 Z" fill="none" stroke={light} strokeOpacity=".7" strokeWidth="1.5" />
          {/* lua crescente */}
          <circle cx="60" cy="56" r="22" fill={`url(#${gid}-c)`} />
          <path d="M66 36 A20 20 0 1 0 66 76 A15 15 0 1 1 66 36 Z" fill="#fff" fillOpacity=".92" />
          {apex && <path d="M60 4 L64 14 L60 12 L56 14 Z" fill={light} />}
        </>
      )}
    </svg>
  );
}
