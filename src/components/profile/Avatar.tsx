'use client';

import { createContext, useContext, useMemo, useState, useTransition } from 'react';
import { AVATARS, avatarUrl } from '@/lib/profile/avatars';
import { updateAvatar } from '@/app/auth/actions';
import './avatar.css';

/** Ícone redondo de campeão (com anel na cor do jogador). */
export function Avatar({ id, size = 40, color, className = '' }: { id: string | null | undefined; size?: number; color?: string; className?: string }) {
  return (
    <img
      src={avatarUrl(id)} alt="" width={size} height={size} loading="lazy"
      className={`nx-avatar ${className}`}
      style={{ width: size, height: size, ...(color ? { boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${color}` } : {}) }}
    />
  );
}

/** Ícone de cada jogador do leilão (id do jogador → campeão), para telas fora do saguão. */
export const AvatarMapContext = createContext<Record<string, string>>({});
export const usePlayerAvatar = (playerId: string) => useContext(AvatarMapContext)[playerId] ?? null;

/** Janela para escolher o ícone do perfil entre todos os campeões. */
export function AvatarPicker({ current, onClose, onSaved }: { current: string | null; onClose: () => void; onSaved?: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(current);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const list = useMemo(() => {
    const t = q.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return t ? AVATARS.filter(a => a.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(t)) : AVATARS;
  }, [q]);

  const save = () => {
    if (!sel) return;
    start(async () => {
      const r = await updateAvatar(sel);
      if (r.error) return setError(r.error);
      onSaved?.(sel);
      onClose();
    });
  };

  return (
    <div className="avp-backdrop" role="dialog" aria-modal="true" aria-label="Escolher ícone" onClick={onClose}>
      <div className="avp anim-reveal" onClick={e => e.stopPropagation()}>
        <div className="avp-head">
          <Avatar id={sel} size={64} color="#b48a2f" />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Ícone do perfil</p>
            <h2 className="text-xl font-black text-gold2">{AVATARS.find(a => a.id === sel)?.name ?? 'Escolha um campeão'}</h2>
          </div>
          <button className="avp-x" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        <input className="input" placeholder="Buscar campeão…" value={q} onChange={e => setQ(e.target.value)} autoFocus />
        <div className="avp-grid">
          {list.map(a => (
            <button key={a.id} type="button" title={a.name} onClick={() => setSel(a.id)} className={sel === a.id ? 'on' : ''}>
              <Avatar id={a.id} size={52} />
            </button>
          ))}
          {list.length === 0 && <p className="col-span-full py-6 text-center text-sm text-muted">Nenhum campeão com esse nome.</p>}
        </div>
        {error && <p className="alert-error">{error}</p>}
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary px-6" disabled={!sel || pending || sel === current} onClick={save}>{pending ? 'Salvando…' : 'Usar este ícone'}</button>
        </div>
      </div>
    </div>
  );
}
