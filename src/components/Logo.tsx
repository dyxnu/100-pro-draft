import { useId } from 'react';

/**
 * Emblema do 100 pro Draft: brasão hextec com uma moeda de ouro "100" (o leilão) abraçada por uma
 * lua crescente prateada (a Diana). Com `animated`, a lua pulsa e um brilho passa pela moeda.
 */
export function MoonBladeEmblem({ className = '', title, animated = false }: { className?: string; title?: string; animated?: boolean }) {
  const uid = useId().replace(/:/g, '');
  const id = (k: string) => `nx-${k}-${uid}`;
  return (
    <svg
      viewBox="0 0 64 64" className={`${className} ${animated ? 'nx-emblem-live' : ''}`}
      role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}
    >
      <defs>
        <radialGradient id={id('bg')} cx="45%" cy="30%" r="80%">
          <stop offset="0" stopColor="#3d40a1" />
          <stop offset=".6" stopColor="#1c2058" />
          <stop offset="1" stopColor="#0e1030" />
        </radialGradient>
        <linearGradient id={id('gold')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1c4" />
          <stop offset=".45" stopColor="#e2b85a" />
          <stop offset="1" stopColor="#8a6420" />
        </linearGradient>
        <linearGradient id={id('coin')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe9a8" />
          <stop offset=".5" stopColor="#d9a83c" />
          <stop offset="1" stopColor="#9a6c1c" />
        </linearGradient>
        <linearGradient id={id('moon')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".5" stopColor="#e3e0ff" />
          <stop offset="1" stopColor="#9f97e6" />
        </linearGradient>
        <clipPath id={id('clip')}><circle cx="37" cy="34" r="13" /></clipPath>
      </defs>

      {/* Brasão */}
      <path d="M32 2.5 57.5 13.5v24.8C57.5 51 46.6 58.6 32 62 17.4 58.6 6.5 51 6.5 38.3V13.5Z" fill={`url(#${id('bg')})`} />
      <path d="M32 2.5 57.5 13.5v24.8C57.5 51 46.6 58.6 32 62 17.4 58.6 6.5 51 6.5 38.3V13.5Z" fill="none" stroke={`url(#${id('gold')})`} strokeWidth="2" strokeLinejoin="round" />
      <path d="M32 7.5 53 16.6v21.5c0 10.6-9 17-21 19.9C20 55.1 11 48.7 11 38.1V16.6Z" fill="none" stroke="#c8aa6e" strokeOpacity=".35" strokeWidth=".8" />

      {/* Moeda do leilão */}
      <circle cx="37" cy="34" r="13" fill={`url(#${id('coin')})`} />
      <circle cx="37" cy="34" r="10.4" fill="none" stroke="#7a5512" strokeOpacity=".55" strokeWidth="1" />
      <text x="37" y="38.2" textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="11" fill="#5c3f10" letterSpacing="-.6">100</text>
      {animated && (
        <g clipPath={`url(#${id('clip')})`}>
          <g transform="rotate(25 37 34)"><rect className="nx-shine" x="14" y="10" width="7" height="48" fill="#fff" opacity=".55" /></g>
        </g>
      )}

      {/* Lua crescente abraçando a moeda */}
      <path
        className={animated ? 'nx-moon' : undefined}
        d="M42.75 19.07A19 19 0 1 0 42.75 48.93A16 16 0 1 1 42.75 19.07Z"
        fill={`url(#${id('moon')})`}
      />
      <path d="M42.75 48.93A16 16 0 1 1 42.75 19.07" fill="none" stroke={`url(#${id('gold')})`} strokeWidth="1" strokeOpacity=".8" />

      {/* Estrela */}
      <path className={animated ? 'nx-star' : undefined} d="M50 15.5l1.1 3 3 1.1-3 1.1-1.1 3-1.1-3-3-1.1 3-1.1Z" fill="#fff3c4" />
    </svg>
  );
}

/** Marca do 100 pro Draft: emblema + nome. */
export function Logo({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const lg = size === 'lg';
  return (
    <span className="inline-flex items-center gap-2.5">
      <MoonBladeEmblem animated className={`shrink-0 drop-shadow-[0_2px_6px_rgba(38,42,114,.35)] ${lg ? 'h-14 w-14' : 'h-9 w-9'}`} />
      <span className={`font-black tracking-tight text-gold2 ${lg ? 'text-4xl' : 'text-xl'}`}>
        100 <span className="text-accent2">pro</span> Draft
      </span>
    </span>
  );
}
