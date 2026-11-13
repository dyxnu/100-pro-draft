'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase/client';
import type { MemberRow, RoomRow, RoomSpeed } from '@/lib/rooms/types';
import { ROOM_SIZE } from '@/lib/rooms/types';
import {
  joinRoomAction, leaveRoomAction, lobbyReadyAction, startDraftAction, updateSettingsAction, type RoomFormState,
} from '@/app/sala/actions';
import { SEAT_COLORS } from './ui';

export function LobbyView({ room, members, meId, isMember }: {
  room: RoomRow; members: MemberRow[]; meId: string; isMember: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const isHost = room.host_id === meId;
  const me = members.find(m => m.user_id === meId);
  const humans = members.filter(m => m.user_id);
  const free = room.max_players - members.length;
  const waiting = humans.filter(m => m.user_id !== room.host_id && !m.ready);
  const total = room.bots_enabled ? room.max_players : members.length;
  const canStart = waiting.length === 0 && total >= 2;

  // Tempo real: qualquer mudança na sala ou nos membros recarrega a página (do servidor).
  useEffect(() => {
    const sb = getBrowserClient();
    const channel = sb.channel(`sala:${room.id}`, { config: { presence: { key: meId } } })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${room.id}` }, () => router.refresh())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, () => router.refresh())
      .on('presence', { event: 'sync' }, () => setOnline(new Set(Object.keys(channel.presenceState()))))
      .subscribe((status: string) => { if (status === 'SUBSCRIBED') channel.track({ at: Date.now() }); });
    return () => { sb.removeChannel(channel); };
  }, [room.id, meId, router]);

  const run = (fn: () => Promise<RoomFormState>) => startTransition(async () => {
    setError(undefined);
    const r = await fn();
    if (r?.error) setError(r.error);
    else router.refresh();
  });

  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  const inviteUrl = `${origin}/sala/${room.code}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignora */ }
  };

  return (
    <div className="mt-8 space-y-5">
      <section className="panel flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Saguão · casual</p>
          <h1 className="mt-1 text-3xl font-bold text-gold2">
            Sala <span className="font-mono tracking-[0.2em]">{room.code}</span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            {members.length}/{room.max_players} participantes · {room.speed === 'rapido' ? '6 s' : '10 s'} por campeão ·
            overall {room.show_overall ? 'à mostra' : 'escondido'} · mata-mata
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <button onClick={copy} className="btn-secondary">{copied ? 'Link copiado!' : 'Copiar convite'}</button>
          <span className="max-w-full truncate text-xs text-muted">{inviteUrl}</span>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(room.max_players).keys()].map(seat => {
          const m = members.find(x => x.seat === seat);
          const color = SEAT_COLORS[seat];
          if (!m) {
            return (
              <div key={seat} className="rounded-xl border border-dashed border-line bg-bg2 p-4 text-sm text-muted">
                Vaga {seat + 1} · {room.bots_enabled ? 'um bot entra aqui se ninguém vier' : 'aguardando jogador'}
              </div>
            );
          }
          const isOnline = m.user_id ? online.has(m.user_id) : true;
          const status = !m.user_id ? 'Bot de treino · pronto'
            : m.user_id === room.host_id ? 'Dono da sala'
            : m.ready ? 'Pronto' : 'Aguardando';
          return (
            <div key={seat} className="panel flex items-center gap-3 border-l-4 p-4" style={{ borderLeftColor: color }}>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-panel2 font-bold" style={{ color }}>
                {m.display_name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {m.display_name}{m.user_id === meId && <span className="ml-2 text-xs text-muted">(você)</span>}
                </p>
                <p className={`text-xs ${m.ready || !m.user_id ? 'text-teal' : 'text-muted'}`}>
                  {status}{m.user_id && !isOnline ? ' · desconectado' : ''}
                </p>
              </div>
              <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-teal' : 'bg-line'}`} />
            </div>
          );
        })}
      </section>

      <section className="panel space-y-4 p-6">
        {!isMember ? (
          <>
            <p className="text-muted">Você foi convidado para esta sala.</p>
            <button className="btn-primary" disabled={pending || free <= 0} onClick={() => run(() => joinRoomAction(room.code))}>
              {free <= 0 ? 'Sala cheia' : 'Entrar na sala'}
            </button>
          </>
        ) : (
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            {isHost ? (
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={room.bots_enabled} disabled={pending} className="h-4 w-4 accent-[#c8aa6e]"
                    onChange={e => run(() => updateSettingsAction(room.code, { botsEnabled: e.target.checked }))} />
                  Completar vagas com bots
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={room.show_overall} disabled={pending} className="h-4 w-4 accent-[#c8aa6e]"
                    onChange={e => run(() => updateSettingsAction(room.code, { showOverall: e.target.checked }))} />
                  Overall à mostra no leilão
                </label>
                <label className="flex items-center gap-2">
                  Participantes
                  <select className="input !w-auto !py-1.5" value={room.max_players} disabled={pending}
                    onChange={e => run(() => updateSettingsAction(room.code, { maxPlayers: Number(e.target.value) }))}>
                    {[...Array(ROOM_SIZE - 1).keys()].map(i => <option key={i} value={i + 2}>{i + 2}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  Ritmo
                  <select className="input !w-auto !py-1.5" value={room.speed} disabled={pending}
                    onChange={e => run(() => updateSettingsAction(room.code, { speed: e.target.value as RoomSpeed }))}>
                    <option value="normal">10 s por campeão</option>
                    <option value="rapido">6 s por campeão</option>
                  </select>
                </label>
              </div>
            ) : (
              <p className="text-sm text-muted">
                {me?.ready ? 'Você está pronto. Aguardando o dono da sala começar o leilão…' : 'Confirme que está pronto para o dono começar.'}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" disabled={pending} onClick={() => run(() => leaveRoomAction(room.code))}>Sair</button>
              {isHost ? (
                <button className="btn-primary px-6" disabled={pending || !canStart} onClick={() => run(() => startDraftAction(room.code))}>
                  {pending ? 'Aguarde…' : canStart ? 'Começar leilão' : waiting.length ? `Falta confirmar: ${waiting.length}` : 'Mínimo 2 participantes'}
                </button>
              ) : (
                <button className={me?.ready ? 'btn-secondary' : 'btn-primary px-6'} disabled={pending}
                  onClick={() => run(() => lobbyReadyAction(room.code, !me?.ready))}>
                  {me?.ready ? 'Desfazer pronto' : 'Estou pronto'}
                </button>
              )}
            </div>
          </div>
        )}
        {error && <p role="alert" className="rounded-lg border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-[#ffd5db]">{error}</p>}
      </section>
    </div>
  );
}
