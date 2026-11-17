'use client';

import { createContext, useContext, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { getBrowserClient } from '@/lib/supabase/client';
import { giveKudosAction } from '@/app/social/actions';
import { Avatar } from '@/components/profile/Avatar';
import { RoomChatDock } from './Docks';
import { KUDOS_INFO, KUDOS_KINDS, MISSING_SOCIAL, type KudosKind, isMissingSchema } from './shared';
import './chat.css';

export interface RoomHuman { userId: string; name: string; avatar: string | null; guest: boolean }
interface RoomSocial { roomId: string; meId: string; meGuest: boolean; isMember: boolean; humans: RoomHuman[] }

const RoomSocialContext = createContext<RoomSocial | null>(null);

/** Envolve o leilão/campeonato: dá contexto ao painel de elogios e põe o chat da sala ao lado. */
export function RoomShell({ children, ...social }: RoomSocial & { children: React.ReactNode }) {
  return (
    <RoomSocialContext.Provider value={social}>
      {children}
      <RoomChatDock roomId={social.roomId} meId={social.meId} canSend={social.isMember} />
    </RoomSocialContext.Provider>
  );
}

/** Elogios de fim de campeonato: cada humano dá 1 elogio a outro humano da sala. */
export function KudosPanel() {
  const ctx = useContext(RoomSocialContext);
  const [given, setGiven] = useState<{ to: string; kind: KudosKind } | null>(null);
  const [received, setReceived] = useState<KudosKind[]>([]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'missing'>('loading');
  const [target, setTarget] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const roomId = ctx?.roomId;
  const meId = ctx?.meId;
  useEffect(() => {
    if (!roomId || !meId) return;
    let cancelled = false;
    void (async () => {
      const { data, error: e } = await getBrowserClient().from('kudos').select('from_user, to_user, kind').eq('room_id', roomId);
      if (cancelled) return;
      if (e) { setStatus(isMissingSchema(e) ? 'missing' : 'ok'); return; }
      const rows = (data ?? []) as { from_user: string; to_user: string; kind: KudosKind }[];
      const mine = rows.find(r => r.from_user === meId);
      if (mine) setGiven({ to: mine.to_user, kind: mine.kind });
      setReceived(rows.filter(r => r.to_user === meId).map(r => r.kind));
      setStatus('ok');
    })();
    return () => { cancelled = true; };
  }, [roomId, meId]);

  if (!ctx) return null;
  const others = ctx.humans.filter(h => h.userId !== ctx.meId);
  if (!others.length) return null; // só bots na sala: nada para elogiar

  const give = (kind: KudosKind) => {
    if (!target) return;
    start(async () => {
      setError(undefined);
      const r = await giveKudosAction(ctx.roomId, target, kind);
      if (!r.ok) { setError(r.error); return; }
      setGiven({ to: target, kind });
    });
  };
  const nameOf = (id: string) => ctx.humans.find(h => h.userId === id)?.name ?? 'alguém';

  return (
    <section className="ch-kudos">
      <p className="ch-kudos-eyebrow">Honra</p>
      <h3>Elogie um jogador</h3>
      {status === 'missing' ? (
        <p className="ch-muted">{MISSING_SOCIAL}</p>
      ) : !ctx.isMember ? (
        <p className="ch-muted">Só quem jogou nesta sala pode dar elogios.</p>
      ) : ctx.meGuest ? (
        <p className="ch-muted">Convidados não dão elogios. <Link href="/cadastro">Crie uma conta</Link> para elogiar e ganhar honra.</p>
      ) : given ? (
        <p className="ch-kudos-done">{KUDOS_INFO[given.kind].icon} Você elogiou <b>{nameOf(given.to)}</b> como <b>{KUDOS_INFO[given.kind].label}</b>. Valeu!</p>
      ) : (
        <>
          <p className="ch-muted">Escolha quem e o tipo de elogio (1 por campeonato).</p>
          <div className="ch-kudos-people">
            {others.map(h => (
              <button key={h.userId} className={target === h.userId ? 'on' : ''} onClick={() => setTarget(h.userId)} disabled={pending || status === 'loading'}>
                <Avatar id={h.avatar} size={48} />
                <span>{h.name}</span>
              </button>
            ))}
          </div>
          <div className="ch-kudos-kinds">
            {KUDOS_KINDS.map(k => (
              <button key={k} disabled={!target || pending} onClick={() => give(k)} title={KUDOS_INFO[k].hint}>
                <span aria-hidden>{KUDOS_INFO[k].icon}</span>{KUDOS_INFO[k].label}
              </button>
            ))}
          </div>
          {!target && <p className="ch-muted small">Toque em um jogador primeiro.</p>}
        </>
      )}
      {received.length > 0 && (
        <p className="ch-kudos-got">Você recebeu {received.length} elogio{received.length > 1 ? 's' : ''}: {received.map(k => `${KUDOS_INFO[k].icon} ${KUDOS_INFO[k].label}`).join(', ')}</p>
      )}
      {error && <p className="ch-error" role="alert">{error}</p>}
    </section>
  );
}
