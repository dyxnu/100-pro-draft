// Ícone do perfil com borda (estilos CSS originais) e o nível embaixo, como no LoL.
import { Avatar } from './Avatar';

export function FramedIcon({ id, border, level, size = 112 }: { id: string | null; border: string | null; level: number; size?: number }) {
  return (
    <span className={`pf-frame ${border ? `pf-border-${border}` : 'pf-border-none'}`} style={{ ['--pf-size' as string]: `${size}px` }}>
      <span className="pf-frame-ring" aria-hidden />
      <Avatar id={id} size={size} className="pf-frame-img" />
      <span className="pf-level" title={`Nível ${level}`}>{level}</span>
    </span>
  );
}
