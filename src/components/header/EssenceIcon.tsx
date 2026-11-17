import { useId } from 'react';

/** Cristal de Essência Azul (SVG próprio). */
export function EssenceIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} style={{ flex: 'none' }}>
      <defs>
        <linearGradient id={`be-a${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#bfe9ff" />
          <stop offset=".5" stopColor="#3aa6f0" />
          <stop offset="1" stopColor="#1d4fb8" />
        </linearGradient>
      </defs>
      <path d="M12 1.5 19.5 9 12 22.5 4.5 9Z" fill={`url(#be-a${id})`} stroke="#123a8a" strokeWidth="1" strokeLinejoin="round" />
      <path d="M12 1.5 15 9 12 22.5 9 9Z" fill="#ffffff" opacity=".28" />
      <path d="M4.5 9h15" stroke="#e6f6ff" strokeWidth=".9" opacity=".8" />
      <path d="M8.2 4.6 9.6 3.4" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity=".9" />
    </svg>
  );
}

/** Valor em essência com o cristal ao lado. */
export function EssenceAmount({ value, size = 16, className = '' }: { value: number; size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 font-black tabular-nums ${className}`}>
      <EssenceIcon size={size} />
      {value.toLocaleString('pt-BR')}
    </span>
  );
}
