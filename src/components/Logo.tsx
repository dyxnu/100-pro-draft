import { useId } from 'react';

/** Emblema do 100 pro Draft: a lâmina crescente da Diana em prata e ouro sobre a noite índigo. */
export function MoonBladeEmblem({ className = '', title }: { className?: string; title?: string }) {
  const uid = useId().replace(/:/g, '');
  const bg = `mb-bg-${uid}`, blade = `mb-blade-${uid}`, gold = `mb-gold-${uid}`;
  return (
    <svg viewBox="0 0 64 64" className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <defs>
        <radialGradient id={bg} cx="40%" cy="35%" r="75%">
          <stop offset="0" stopColor="#4c4fb5" />
          <stop offset=".55" stopColor="#262a72" />
          <stop offset="1" stopColor="#14173f" />
        </radialGradient>
        <linearGradient id={blade} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".45" stopColor="#e8e5ff" />
          <stop offset="1" stopColor="#9f97e6" />
        </linearGradient>
        <linearGradient id={gold} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3d68a" />
          <stop offset="1" stopColor="#b48a2f" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="31" fill={`url(#${bg})`} />
      <circle cx="32" cy="32" r="29.6" fill="none" stroke={`url(#${gold})`} strokeWidth="1.8" />
      <g transform="rotate(-24 32 32) translate(33 32) scale(.88) translate(-32 -32)">
        <path d="M41 8.5A24.6 24.6 0 1 0 41 55.5A23.5 23.5 0 0 1 41 8.5Z" fill={`url(#${blade})`} />
        <path d="M41 55.5A23.5 23.5 0 0 1 41 8.5" fill="none" stroke={`url(#${gold})`} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M14.5 24A21 21 0 0 0 14.5 40" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity=".9" />
      </g>
      <path d="M48 26l1.3 3.7 3.7 1.3-3.7 1.3L48 36l-1.3-3.7L43 31l3.7-1.3Z" fill={`url(#${gold})`} />
      <circle cx="44.5" cy="42.5" r="1.3" fill="#e8e5ff" />
    </svg>
  );
}

/** Marca do 100 pro Draft: emblema da lâmina crescente + nome. */
export function Logo({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const lg = size === 'lg';
  return (
    <span className="inline-flex items-center gap-2.5">
      <MoonBladeEmblem className={`shrink-0 drop-shadow-[0_2px_6px_rgba(38,42,114,.35)] ${lg ? 'h-14 w-14' : 'h-9 w-9'}`} />
      <span className={`font-black tracking-tight text-gold2 ${lg ? 'text-4xl' : 'text-xl'}`}>
        100 <span className="text-accent2">pro</span> Draft
      </span>
    </span>
  );
}
