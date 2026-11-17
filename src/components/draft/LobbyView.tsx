'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { authRealtime, getBrowserClient } from '@/lib/supabase/client';
import type { MemberRow, RoomRow, RoomSpeed } from '@/lib/rooms/types';
import { ROOM_SIZE, seatPlayerId } from '@/lib/rooms/types';
import {
  addBotAction, fillBotsAction, joinRoomAction, leaveRoomAction, removeBotAction, lobbyReadyAction, startDraftAction, updateSettingsAction, type RoomFormState,
} from '@/app/sala/actions';
import { Avatar, AvatarPicker } from '@/components/profile/Avatar';
import { SEAT_COLORS } from './ui';
import './lobby.css';

type Channel = ReturnType<ReturnType<typeof getBrowserClient>['channel']>;

export function LobbyView({ room, members, meId, isMember, avatars, myAvatar }: {
  room: RoomRow; members: MemberRow[]; meId: string; isMember: boolean;
  avatars: Record<string, string>; myAvatar: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);
  const [picker, setPicker] = useState(false);
  const channel = useRef<Channel | null>(null);

  const isHost = room.host_id === meId;
  const me = members.find(m => m.user_id === meId);
  const humans = members.filter(m => m.user_id);
  const free = room.max_players - members.length;
  const waiting = humans.filter(m => !m.ready);
  const canStart = waiting.length === 0 && members.length >= 2;
  const readyCount = humans.length - waiting.length;

  // Tempo real: mudanças na sala/membros recarregam os dados do servidor; um "ping" por broadcast
  // avisa os outros quando alguém troca de ícone. A cada 5 s há uma recarga de segurança.
  useEffect(() => {
    const sb = getBrowserClient();
    let cancelled = false;
    let ch: Channel | null = null;
    void authRealtime().then(() => {
      if (cancelled) return;
      ch = sb.channel(`sala:${room.id}`, { config: { presence: { key: meId }, broadcast: { self: false } } })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${room.id}` }, () => router.refresh())
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, (p: { new: { status?: string } }) => {
          if (p.new?.status && p.new.status !== 'lobby') window.location.reload();
          else router.refresh();
        })
        .on('broadcast', { event: 'refresh' }, () => router.refresh())
        .on('presence', { event: 'sync' }, () => setOnline(new Set(Object.keys(ch!.presenceState()))))
        .subscribe((status: string) => { if (status === 'SUBSCRIBED') void ch!.track({ at: Date.now() }); });
      channel.current = ch;
    });
    const poll = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, 5000);
    return () => { cancelled = true; clearInterval(poll); channel.current = null; if (ch) sb.removeChannel(ch); };
  }, [room.id, meId, router]);

  const ping = useCallback(() => { void channel.current?.send({ type: 'broadcast', event: 'refresh', payload: {} }); }, []);

  const run = (fn: () => Promise<RoomFormState>) => startTransition(async () => {
    setError(undefined);
    const r = await fn();
    if (r?.error) setError(r.error);
    else ping(); // a ação já devolve a tela atualizada (revalidatePath); só avisa os outros
  });

  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  const inviteUrl = `${origin}/sala/${room.code}`;
  const copy = async (what: 'link' | 'code') => {
    try {
      await navigator.clipboard.writeText(what === 'link' ? inviteUrl : room.code);
      setCopied(what); setTimeout(() => setCopied(null), 1800);
    } catch { /* ignora */ }
  };

  return (
    <div className="lobby">
      {/* Cabeçalho */}
      <section className="lb-hero anim-fade-up">
        <div className="lb-moon" aria-hidden />
        <div className="min-w-0">
          <p className="lb-eyebrow">Saguão · casual · mata-mata</p>
          <h1>Sala <button className="lb-code" onClick={() => copy('code')} title="Copiar código">{room.code}</button></h1>
          <div className="lb-chips">
            <span>👥 {members.length}/{room.max_players} participantes</span>
            <span>⏱ {room.speed === 'rapido' ? '6 s' : '10 s'} por campeão</span>
            <span>{room.show_overall ? '👁 overall à mostra' : '🙈 overall escondido'}</span>
            <span>🤖 {members.length - humans.length} bot{members.length - humans.length === 1 ? '' : 's'}</span>
          </div>
        </div>
        <div className="lb-invite">
          <button className="btn-primary" onClick={() => copy('link')}>{copied === 'link' ? '✓ Link copiado!' : '🔗 Copiar convite'}</button>
          <span className="truncate">{copied === 'code' ? 'Código copiado!' : inviteUrl}</span>
        </div>
      </section>

      <div className="lb-main">
        {/* Jogadores */}
        <section className="lb-panel">
          <div className="lb-panel-head">
            <h2>Jogadores</h2>
            {isHost && free > 0 && (
              <button className="lb-fill" disabled={pending} onClick={() => run(() => fillBotsAction(room.code))}>
                🤖 Preencher {free === 1 ? 'a vaga' : `as ${free} vagas`} com bots
              </button>
            )}
            <div className="lb-progress" title="Jogadores prontos">
              <span style={{ width: `${humans.length ? (readyCount / humans.length) * 100 : 0}%` }} />
              <b>{readyCount}/{humans.length} prontos</b>
            </div>
          </div>
          <div className="lb-seats">
            {[...Array(room.max_players).keys()].map(seat => {
              const m = members.find(x => x.seat === seat);
              const color = SEAT_COLORS[seat];
              if (!m) {
                return (
                  <div key={seat} className="lb-seat empty">
                    <span className="lb-plus">+</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">Vaga {seat + 1}</p>
                      <p className="text-xs text-muted">convide um amigo{isHost ? ' ou' : ''}</p>
                      {isHost && (
                        <button className="lb-addbot" disabled={pending} onClick={() => run(() => addBotAction(room.code))}>🤖 Adicionar bot</button>
                      )}
                    </div>
                  </div>
                );
              }
              const isBot = !m.user_id;
              const isMe = m.user_id === meId;
              const hostSeat = m.user_id === room.host_id;
              const isOnline = isBot || online.has(m.user_id!);
              const ready = isBot || m.ready;
              const status = isBot ? 'Bot' : m.ready ? 'Pronto' : 'Aguardando';
              return (
                <div key={seat} className={`lb-seat ${ready ? 'ready' : ''} ${isMe ? 'me' : ''}`} style={{ '--seat': color } as React.CSSProperties}>
                  <div className="lb-ava">
                    <Avatar id={avatars[seatPlayerId(seat)] ?? null} size={60} color={color} />
                    {hostSeat && <span className="lb-crown" title="Dono da sala">👑</span>}
                    <span className={`lb-dot ${isOnline ? 'on' : ''}`} title={isOnline ? 'Conectado' : 'Desconectado'} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-extrabold">{m.display_name}{isMe && <span className="ml-1.5 text-xs font-semibold text-muted">(você)</span>}</p>
                    <span className={`lb-status ${isBot ? 'bot' : ready ? 'ok' : 'wait'}`}>{ready && !isBot ? '✓ ' : ''}{status}</span>
                    {hostSeat && <span className="lb-status host">Dono</span>}
                    {isBot && isHost && <button className="lb-change danger" disabled={pending} onClick={() => run(() => removeBotAction(room.code, seat))}>Remover bot</button>}
                    {isMe && <button className="lb-change" onClick={() => setPicker(true)}>Trocar ícone</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Lateral: ações e configurações */}
        <aside className="lb-side">
          <section className="lb-panel lb-action">
            {!isMember ? (
              <>
                <h2>Você foi convidado</h2>
                <p className="text-sm text-muted">Entre na sala para participar do leilão.</p>
                <button className="btn-primary lb-big" disabled={pending || free <= 0} onClick={() => run(() => joinRoomAction(room.code))}>
                  {free <= 0 ? 'Sala cheia' : 'Entrar na sala'}
                </button>
              </>
            ) : isHost ? (
              <>
                <h2>Começar o leilão</h2>
                <button className={`lb-big ${me?.ready ? 'btn-secondary' : 'btn-primary'}`} disabled={pending}
                  onClick={() => run(() => lobbyReadyAction(room.code, !me?.ready))}>
                  {me?.ready ? 'Desfazer pronto' : '✓ Estou pronto'}
                </button>
                <p className="text-sm text-muted">
                  {canStart ? 'Todos prontos! Pode começar.'
                    : members.length < 2 ? 'Precisa de pelo menos 2 participantes: convide alguém ou adicione bots.'
                    : `Aguardando ${waiting.map(w => (w.user_id === meId ? 'você' : w.display_name)).join(', ')} ficar pronto.`}
                </p>
                <button className={`btn-primary lb-big ${canStart ? 'go' : ''}`} disabled={pending || !canStart} onClick={() => startTransition(async () => {
                  setError(undefined);
                  const r = await startDraftAction(room.code);
                  if (r?.error) return setError(r.error);
                  ping();
                  window.location.reload(); // abre o leilão do zero, sem trocar a tela por dentro
                })}>
                  {pending ? 'Aguarde…' : canStart ? '▶ Começar leilão' : `Prontos ${readyCount}/${humans.length}`}
                </button>
              </>
            ) : (
              <>
                <h2>{me?.ready ? 'Você está pronto!' : 'Está pronto?'}</h2>
                <p className="text-sm text-muted">
                  {me?.ready ? 'Aguardando o dono da sala começar o leilão…' : 'Quando todos estiverem prontos, o dono da sala começa o leilão.'}
                </p>
                <button className={`lb-big ${me?.ready ? 'btn-secondary' : 'btn-primary go'}`} disabled={pending}
                  onClick={() => run(() => lobbyReadyAction(room.code, !me?.ready))}>
                  {me?.ready ? 'Desfazer pronto' : '✓ Estou pronto'}
                </button>
              </>
            )}
            {isMember && <button className="lb-leave" disabled={pending} onClick={() => run(() => leaveRoomAction(room.code))}>Sair da sala</button>}
            {error && <p role="alert" className="alert-error">{error}</p>}
          </section>

          <section className="lb-panel">
            <h2>Configurações {!isHost && <small>(o dono escolhe)</small>}</h2>
            <div className="lb-settings">
              <Toggle label="Overall à mostra no leilão" on={room.show_overall} disabled={!isHost || pending}
                onChange={v => run(() => updateSettingsAction(room.code, { showOverall: v }))} />
              <div className="lb-row">
                <span>Participantes</span>
                <div className="lb-seg">
                  {[...Array(ROOM_SIZE - 1).keys()].map(i => i + 2).map(n => (
                    <button key={n} className={room.max_players === n ? 'on' : ''} disabled={!isHost || pending || n < members.length}
                      onClick={() => run(() => updateSettingsAction(room.code, { maxPlayers: n }))}>{n}</button>
                  ))}
                </div>
              </div>
              <div className="lb-row">
                <span>Ritmo</span>
                <div className="lb-seg">
                  {([['normal', '10 s'], ['rapido', '6 s']] as [RoomSpeed, string][]).map(([v, l]) => (
                    <button key={v} className={room.speed === v ? 'on' : ''} disabled={!isHost || pending}
                      onClick={() => run(() => updateSettingsAction(room.code, { speed: v }))}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {picker && <AvatarPicker current={myAvatar} onClose={() => setPicker(false)} onSaved={() => { router.refresh(); ping(); }} />}
    </div>
  );
}

function Toggle({ label, on, disabled, onChange }: { label: string; on: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`lb-row lb-toggle ${disabled ? 'off' : ''}`}>
      <span>{label}</span>
      <button type="button" role="switch" aria-checked={on} className={on ? 'on' : ''} disabled={disabled} onClick={() => onChange(!on)}>
        <i />
      </button>
    </label>
  );
}
