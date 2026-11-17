'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ROLES, type AuctionState, formatBRL as fmt, getPlayer } from '@/lib/auction/engine';
import type { ActionResponse, ClientAction } from '@/lib/rooms/types';
import { seatPlayerId } from '@/lib/rooms/types';
import { authRealtime, getBrowserClient } from '@/lib/supabase/client';
import { AvatarMapContext } from '@/components/profile/Avatar';
import type { TournamentState } from '@/lib/tournament/engine';
import { TournamentView } from '@/components/tournament/TournamentView';
import { ChampImg, HOW_LABEL, ROLE_LABEL, seatColor } from './ui';
import { AuctionStage } from './stage';
import './auction.css';

export { AuctionStage };

interface Snapshot { state: AuctionState; tournament: TournamentState | null; nextTickAt: number | null }
// Ordem das versões: leilão primeiro, depois campeonato (para descartar mensagens antigas).
const versionOf = (st: AuctionState, t: TournamentState | null) => st.version * 1_000_000 + (t?.version ?? -1);

export function AuctionView({ code, roomId, initialState, initialTournament, initialNextTickAt, serverNow, mySeat, avatars = {} }: {
  code: string;
  roomId: string;
  initialState: AuctionState;
  initialTournament: TournamentState | null;
  initialNextTickAt: number | null;
  serverNow: number;
  mySeat: number | null;
  avatars?: Record<string, string>;
}) {
  const me = mySeat == null ? null : seatPlayerId(mySeat);
  const [snap, setSnap] = useState<Snapshot>({ state: initialState, tournament: initialTournament, nextTickAt: initialNextTickAt });
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const offset = useRef(0); // relógio do servidor = Date.now() + offset
  useEffect(() => { offset.current = serverNow - Date.now(); }, [serverNow]);
  const serverTime = useCallback(() => Date.now() + offset.current, []);
  const s = snap.state;

  // Só aceita estados mais novos (realtime e respostas podem chegar fora de ordem).
  const apply = useCallback((state: AuctionState, tournament: TournamentState | null, nextTickAt: number | null) => {
    setSnap(prev => (versionOf(state, tournament) >= versionOf(prev.state, prev.tournament) ? { state, tournament, nextTickAt } : prev));
  }, []);

  const send = useCallback(async (action: ClientAction): Promise<ActionResponse> => {
    const t0 = Date.now();
    let data: ActionResponse;
    try {
      const res = await fetch(`/api/salas/${code}/acao`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(action),
      });
      data = await res.json();
    } catch {
      return { ok: false, reason: 'Sem conexão com o servidor.', serverNow: serverTime() };
    }
    const t1 = Date.now();
    if (t1 - t0 < 1500) offset.current = data.serverNow - (t0 + t1) / 2;
    if (data.state) apply(data.state, data.tournament ?? null, data.nextTickAt ?? null);
    return data;
  }, [code, apply, serverTime]);

  // Tempo real: cada gravação do servidor chega para todos da sala.
  useEffect(() => {
    const sb = getBrowserClient();
    let cancelled = false;
    let ch: ReturnType<typeof sb.channel> | null = null;
    void authRealtime().then(() => {
      if (cancelled) return;
      ch = sb.channel(`leilao:${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'auctions', filter: `room_id=eq.${roomId}` }, (p: { new: unknown }) => {
        // Colunas grandes que não mudaram podem vir vazias na mensagem: aproveita o que já temos.
        const row = p.new as { state?: AuctionState | null; tournament?: TournamentState | null; next_tick_at?: string | null };
        const nextTickAt = row.next_tick_at ? Date.parse(row.next_tick_at) : null;
        setSnap(prev => {
          const state = row.state ?? prev.state;
          const tournament = row.tournament ?? prev.tournament;
          return versionOf(state, tournament) >= versionOf(prev.state, prev.tournament) ? { state, tournament, nextTickAt } : prev;
        });
      })
      .subscribe();
    });
    return () => { cancelled = true; if (ch) sb.removeChannel(ch); };
  }, [roomId]);

  // "Cutucada" no relógio do servidor quando um prazo vence (fim de lote, vez dos bots...).
  const done = snap.tournament?.stage === 'done';
  useEffect(() => {
    if (!me || done || snap.nextTickAt == null) return;
    const delay = Math.max(0, snap.nextTickAt - serverTime()) + 100 + Math.random() * 400;
    const id = setTimeout(() => { void send({ type: 'tick' }); }, delay);
    return () => clearTimeout(id);
  }, [snap, me, done, send, serverTime]);

  // Rede de segurança caso alguma mensagem em tempo real se perca.
  useEffect(() => {
    if (done) return;
    const id = setInterval(() => { if (me) void send({ type: 'tick' }); }, 5000);
    return () => clearInterval(id);
  }, [done, me, send]);

  const act = async (action: ClientAction) => {
    setPending(true);
    const r = await send(action);
    setPending(false);
    if (!r.ok && r.reason) {
      setToast(r.reason);
      setTimeout(() => setToast(null), 2500);
    }
  };

  if (s.phase === 'finished') {
    return (
      <AvatarMapContext.Provider value={avatars}>
        {snap.tournament
          ? <TournamentView s={s} t={snap.tournament} me={me} act={act} pending={pending} serverTime={serverTime} auctionSummary={<Results s={s} me={me} />} />
          : <Results s={s} me={me} />}
        {toast && <div className="lx-toast" role="alert">{toast}</div>}
      </AvatarMapContext.Provider>
    );
  }

  return (
    <AvatarMapContext.Provider value={avatars}>
      <AuctionStage s={s} me={me} act={act} pending={pending} serverTime={serverTime} code={code} toast={toast} />
    </AvatarMapContext.Provider>
  );
}

function Results({ s, me }: { s: AuctionState; me: string | null }) {
  const [copied, setCopied] = useState(false);
  const highlights = useMemo(() => {
    const paid = s.sales.filter(x => x.price > 0).sort((a, b) => b.price - a.price);
    const totals = s.players.map(p => ({ p, spent: s.config.budget - p.budget }));
    const spender = [...totals].sort((a, b) => b.spent - a.spent)[0];
    const thrifty = [...totals].sort((a, b) => a.spent - b.spent)[0];
    return [
      paid[0] && { k: 'Mais caro', v: `${s.champions[paid[0].champId].name} · ${fmt(paid[0].price)}`, d: getPlayer(s, paid[0].playerId)?.name },
      { k: 'Mais gastou', v: fmt(spender.spent), d: spender.p.name },
      { k: 'Mais econômico', v: fmt(thrifty.spent), d: thrifty.p.name },
      { k: 'Lances no total', v: String(s.bids.length), d: `${s.sales.filter(x => x.price === 0).length} campeão(ões) saíram de graça` },
    ].filter(Boolean) as { k: string; v: string; d?: string }[];
  }, [s]);

  const copy = async () => {
    const lines = ['100 PRO DRAFT: resultado', ''];
    s.players.forEach(p => {
      lines.push(`${p.name} (gastou ${fmt(s.config.budget - p.budget)})`);
      ROLES.forEach(r => { const x = p.roster[r]!; lines.push(`  ${ROLE_LABEL[r]}: ${s.champions[x.champId].name} · ${fmt(x.price)}`); });
      lines.push('');
    });
    try { await navigator.clipboard.writeText(lines.join('\n')); setCopied(true); } catch { /* ignora */ }
  };

  return (
    <div className="lx-results">
      <div className="hls">
        {highlights.map(h => (
          <div key={h.k} className="hl"><small>{h.k}</small><b>{h.v}</b><span>{h.d}</span></div>
        ))}
      </div>
      <div className="teams">
        {s.players.map(p => (
          <div key={p.id} className={`team ${p.id === me ? 'me' : ''}`} style={{ '--pc': seatColor(p.id) } as React.CSSProperties}>
            <div className="team-head"><b>{p.name}</b><span>gastou {fmt(s.config.budget - p.budget)} · sobrou {fmt(p.budget)}</span></div>
            {ROLES.map(r => {
              const x = p.roster[r]!;
              const c = s.champions[x.champId];
              return (
                <div key={r} className="trow">
                  <span className="role">{ROLE_LABEL[r]}</span>
                  <ChampImg id={c.id} name={c.name} className="ic" />
                  <span>{c.name}<span className="how">{HOW_LABEL[x.how]}{x.offRole ? ' · fora da rota' : ''}</span></span>
                  <span className="pr">{fmt(x.price)}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="actions">
        <button className="btn-secondary" onClick={copy}>{copied ? 'Copiado!' : 'Copiar resultado'}</button>
        <Link href="/jogar" className="btn-primary px-6">Jogar de novo</Link>
      </div>
    </div>
  );
}
