'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { listNotificationsAction, markNotificationsSeenAction, type NotifItem } from '@/app/notificacoes/actions';

const ICON: Record<string, string> = {
  recompensa: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z',
  loja: 'M5 8h14l-1 12H6z M9 8a3 3 0 016 0',
  vip: 'M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z',
  elo: 'M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z',
  campeonato: 'M7 4h10v4a5 5 0 01-10 0z M7 6H4a3 3 0 003 4 M17 6h3a3 3 0 01-3 4 M10 13h4v3h-4z M8 20h8',
  atualizacao: 'M4 12a8 8 0 0114-5.3 M20 12a8 8 0 01-14 5.3 M18 3v4h-4 M6 21v-4h4',
  info: 'M12 8h.01 M11 12h1v5h1 M12 3a9 9 0 100 18 9 9 0 000-18z',
};

function ago(iso: string) {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  return `${Math.round(h / 24)} d`;
}

/** Sininho no cabeçalho: conta as não lidas, abre a lista e marca tudo como visto. */
export function NotificationBell() {
  const [items, setItems] = useState<NotifItem[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const path = usePathname();

  const load = useCallback(async () => {
    try {
      const r = await listNotificationsAction();
      setItems(r.items);
      setUnread(r.unread);
    } catch { /* sem rede */ }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => { if (!document.hidden) void load(); }, 60_000);
    // Outras partes do site avisam quando criam uma notificação (compra, bônus…).
    const ping = () => void load();
    window.addEventListener('nx:notify', ping);
    return () => { clearInterval(id); window.removeEventListener('nx:notify', ping); };
  }, [load]);

  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); window.removeEventListener('keydown', esc); };
  }, [open]);

  const toggle = () => {
    const v = !open;
    setOpen(v);
    if (v && unread > 0) {
      setUnread(0);
      void markNotificationsSeenAction();
      // as não lidas continuam destacadas enquanto a lista estiver aberta
    }
    if (!v) setItems(list => list?.map(i => ({ ...i, unread: false })) ?? list);
  };

  return (
    <div ref={box} className="nt-wrap">
      <button type="button" className={`nt-bell ${unread ? 'has' : ''}`} onClick={toggle} aria-label={unread ? `${unread} notificações novas` : 'Notificações'} aria-expanded={open}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 003.4 0" />
        </svg>
        {unread > 0 && <i>{unread > 9 ? '9+' : unread}</i>}
      </button>
      {open && (
        <div className="nt-pop" role="dialog" aria-label="Notificações">
          <header>
            <b>Notificações</b>
            <Link href="/feedback" className="nt-fb">Mandar feedback</Link>
          </header>
          {items === null ? (
            <p className="nt-empty">Carregando…</p>
          ) : items.length === 0 ? (
            <p className="nt-empty">Nada por aqui ainda. Suas recompensas, compras e novidades do site aparecem aqui.</p>
          ) : (
            <ul>
              {items.map(n => {
                const inner = (
                  <>
                    <span className={`nt-ic nt-${n.kind}`}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d={ICON[n.kind] ?? ICON.info} />
                      </svg>
                    </span>
                    <span className="min-w-0 flex-1">
                      <b>{n.title}</b>
                      {n.body && <small>{n.body}</small>}
                    </span>
                    <time>{ago(n.created_at)}</time>
                  </>
                );
                return (
                  <li key={n.id} className={n.unread ? 'new' : ''}>
                    {n.link ? <Link href={n.link}>{inner}</Link> : <div>{inner}</div>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Avisa o sininho para recarregar (chamar depois de uma ação que cria notificação). */
export const pingNotifications = () => { try { window.dispatchEvent(new Event('nx:notify')); } catch { /* servidor */ } };
