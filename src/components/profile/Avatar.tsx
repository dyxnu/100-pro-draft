'use client';

import { createContext, useContext, useEffect, useMemo, useState, useTransition } from 'react';
import { AVATARS, avatarUrl } from '@/lib/profile/avatars';
import { listMyIcons, updateAvatar } from '@/app/auth/actions';
import './avatar.css';

// Mesma versão de src/lib/store/catalog.ts (profileIconUrl). Repetida aqui para não levar o
// catálogo inteiro de skins para o navegador em toda tela que mostra um ícone.
const ICON_DD_VERSION = '16.22.1';
const FREE_ICON_IDS = Array.from({ length: 29 }, (_, i) => i);

/** URL do ícone: `icon:<n>` → ícone de perfil do LoL; senão, campeão (legado). */
export function iconSrc(id: string | null | undefined): string {
  if (id?.startsWith('icon:')) {
    const n = Number(id.slice(5));
    if (Number.isInteger(n) && n >= 0) return `https://ddragon.leagueoflegends.com/cdn/${ICON_DD_VERSION}/img/profileicon/${n}.png`;
  }
  return avatarUrl(id);
}

/** Ícone redondo (campeão ou ícone de perfil), com anel na cor do jogador. */
export function Avatar({ id, size = 40, color, className = '' }: { id: string | null | undefined; size?: number; color?: string; className?: string }) {
  return (
    <img
      src={iconSrc(id)} alt="" width={size} height={size} loading="lazy"
      className={`nx-avatar ${className}`}
      style={{ width: size, height: size, ...(color ? { boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${color}` } : {}) }}
    />
  );
}

/** Ícone de cada jogador do leilão (id do jogador → campeão), para telas fora do saguão. */
export const AvatarMapContext = createContext<Record<string, string>>({});
export const usePlayerAvatar = (playerId: string) => useContext(AvatarMapContext)[playerId] ?? null;

const strip = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Janela para escolher o ícone do perfil: ícones de perfil (grátis + comprados) ou um campeão.
 * `ownedIcons` vem do servidor quando já se sabe; senão, a janela pergunta ao servidor.
 */
export function AvatarPicker({ current, onClose, onSaved, ownedIcons }: {
  current: string | null; onClose: () => void; onSaved?: (id: string) => void; ownedIcons?: number[];
}) {
  const [tab, setTab] = useState<'icons' | 'champs'>(current?.startsWith('icon:') ? 'icons' : 'champs');
  const [icons, setIcons] = useState<number[]>(ownedIcons ?? FREE_ICON_IDS);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(current);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  useEffect(() => {
    if (ownedIcons) return;
    let alive = true;
    listMyIcons().then(list => { if (alive && list.length) setIcons(list); }, () => {});
    return () => { alive = false; };
  }, [ownedIcons]);

  const champs = useMemo(() => {
    const t = strip(q.trim());
    return t ? AVATARS.filter(a => strip(a.name).includes(t)) : AVATARS;
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

  const selName = sel?.startsWith('icon:') ? `Ícone #${sel.slice(5)}` : AVATARS.find(a => a.id === sel)?.name;

  return (
    <div className="avp-backdrop" role="dialog" aria-modal="true" aria-label="Escolher ícone" onClick={onClose}>
      <div className="avp anim-reveal" onClick={e => e.stopPropagation()}>
        <div className="avp-head">
          <Avatar id={sel} size={64} color="#b48a2f" />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Ícone do perfil</p>
            <h2 className="text-xl font-black text-gold2">{selName ?? 'Escolha um ícone'}</h2>
          </div>
          <button className="avp-x" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        <div className="avp-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'icons'} className={tab === 'icons' ? 'on' : ''} onClick={() => setTab('icons')}>
            Ícones <span>{icons.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={tab === 'champs'} className={tab === 'champs' ? 'on' : ''} onClick={() => setTab('champs')}>
            Campeões <span>{AVATARS.length}</span>
          </button>
        </div>
        {tab === 'champs' && <input className="input" placeholder="Buscar campeão…" value={q} onChange={e => setQ(e.target.value)} autoFocus />}
        <div className="avp-grid">
          {tab === 'icons' && icons.map(n => {
            const id = `icon:${n}`;
            return (
              <button key={id} type="button" title={`Ícone #${n}`} onClick={() => setSel(id)} className={sel === id ? 'on' : ''}>
                <Avatar id={id} size={52} />
              </button>
            );
          })}
          {tab === 'champs' && champs.map(a => (
            <button key={a.id} type="button" title={a.name} onClick={() => setSel(a.id)} className={sel === a.id ? 'on' : ''}>
              <Avatar id={a.id} size={52} />
            </button>
          ))}
          {tab === 'champs' && champs.length === 0 && <p className="col-span-full py-6 text-center text-sm text-muted">Nenhum campeão com esse nome.</p>}
        </div>
        {tab === 'icons' && <p className="text-xs text-muted">Mais ícones na loja, com essência azul.</p>}
        {error && <p className="alert-error">{error}</p>}
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary px-6" disabled={!sel || pending || sel === current} onClick={save}>{pending ? 'Salvando…' : 'Usar este ícone'}</button>
        </div>
      </div>
    </div>
  );
}
