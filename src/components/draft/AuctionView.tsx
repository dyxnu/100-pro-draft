'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ROLES, type AuctionEvent, type AuctionState, type Role,
  bidEligibility, formatBRL as fmt, getPlayer, maxBid, minNextBid, openRoles, validRoles,
} from '@/lib/auction/engine';
import { BOT_PROFILES } from '@/lib/auction/bots';
import type { ActionResponse, ClientAction } from '@/lib/rooms/types';
import { seatPlayerId } from '@/lib/rooms/types';
import { authRealtime, getBrowserClient } from '@/lib/supabase/client';
import { Avatar, AvatarMapContext, usePlayerAvatar } from '@/components/profile/Avatar';
import type { TournamentState } from '@/lib/tournament/engine';
import { buildCard, CLASS_LABEL } from '@/lib/champions/cards';
import { TournamentView } from '@/components/tournament/TournamentView';
import { ChampImg, HOW_LABEL, ROLE_LABEL, ROLE_SHORT, seatColor } from './ui';
import './auction.css';

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
        {toast && <div className="ad-toast" role="alert">{toast}</div>}
      </AvatarMapContext.Provider>
    );
  }

  return (
    <AvatarMapContext.Provider value={avatars}>
      <AuctionStage s={s} me={me} act={act} pending={pending} serverTime={serverTime} code={code} toast={toast} />
    </AvatarMapContext.Provider>
  );
}

/** Ícone do jogador: o campeão escolhido no perfil, ou a inicial na cor da vaga. */
function PlayerAvatar({ pid, name, small = false }: { pid: string; name: string; small?: boolean }) {
  const icon = usePlayerAvatar(pid);
  if (icon) return <Avatar id={icon} size={small ? 26 : 34} color={seatColor(pid)} />;
  return <span className={`ad-avatar ${small ? 'sm' : ''}`} style={{ background: seatColor(pid) }}>{name.slice(0, 1).toUpperCase()}</span>;
}

/** A tela do leilão (sem rede): recebe o estado e envia intenções por act(). */
export function AuctionStage({ s, me, act, pending, serverTime, code, toast }: {
  s: AuctionState; me: string | null; act: (a: ClientAction) => void; pending: boolean;
  serverTime: () => number; code: string; toast: string | null;
}) {
  const cur = s.current;
  const rp = s.routePick;
  const lastPlaced = [...s.events].reverse().find((e): e is Extract<AuctionEvent, { type: 'placed' }> => e.type === 'placed');
  const mine = me ? getPlayer(s, me) : null;
  const others = s.players.filter(p => p.id !== me);

  return (
    <div className="ad">
      <div className="ad-top">
        <span className="ad-pill">{cur ? `Campeão ${cur.index} de ${s.totalLots}` : rp ? 'Escolhendo a rota…' : 'Próximo campeão…'}</span>
        <span className="ad-room">Sala <b>{code}</b> · {s.sales.length}/{s.players.length * 5} vagas preenchidas</span>
      </div>

      <div className="ad-grid">
        <aside className="ad-left">
          {mine ? <MyPanel s={s} meId={mine.id} /> : <div className="ad-box muted">Você está assistindo este leilão.</div>}
          <RecentBids s={s} />
        </aside>

        <section className="ad-center">
          <LotCard s={s} me={me} lastPlaced={lastPlaced} now={serverTime} />
          {me && cur && <BidBar key={cur.champId} s={s} me={me} pending={pending} act={act} />}
        </section>

        <aside className="ad-right">
          <div className="ad-head"><h3>Outros jogadores</h3><small>{s.players.length} na sala</small></div>
          {others.map(p => <PlayerRow key={p.id} s={s} pid={p.id} />)}
          <LastSold s={s} />
        </aside>
      </div>

      {me && rp && s.phase === 'routePick' && rp.playerId === me && (
        <RouteModal s={s} pending={pending} now={serverTime} onPick={role => act({ type: 'route', role })} />
      )}
      {toast && <div className="ad-toast" role="alert">{toast}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coluna da esquerda: meu time
// ---------------------------------------------------------------------------
function MyPanel({ s, meId }: { s: AuctionState; meId: string }) {
  const p = getPlayer(s, meId)!;
  const filled = ROLES.length - openRoles(p).length;
  const open = openRoles(p).length;
  return (
    <>
      <div className="ad-me">
        <PlayerAvatar pid={meId} name={p.name} />
        <div><b>{p.name}</b><small>Você</small></div>
        <span className="ad-count">{filled}/5</span>
      </div>
      <div className="ad-budget">
        <small>Seu orçamento</small>
        <div key={p.budget} className="anim-bump"><span className="coin">◐</span>{fmt(p.budget)}</div>
        {open > 0 && <small>{fmt(Math.floor(p.budget / open / 100) * 100)} em média por vaga</small>}
      </div>
      <div className="ad-slots">
        {ROLES.map(r => {
          const slot = p.roster[r];
          const c = slot ? s.champions[slot.champId] : null;
          return (
            <div key={r} className={`ad-slot ${slot ? 'filled anim-reveal' : ''}`}>
              {c ? (
                <>
                  <ChampImg id={c.id} name={c.name} className="ic" />
                  <b>{c.name}</b>
                  <small>{ROLE_LABEL[r]} · {slot!.price ? fmt(slot!.price) : 'sobra'}</small>
                </>
              ) : (
                <><span className="ring">◌</span><small>{ROLE_LABEL[r]}</small><small className="muted">vaga aberta</small></>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function RecentBids({ s }: { s: AuctionState }) {
  const cur = s.current;
  const bids = (cur ? s.bids.filter(b => b.champId === cur.champId) : s.bids).slice(-5).reverse();
  return (
    <div className="ad-list">
      <h4>Últimos lances</h4>
      {bids.length ? bids.map(b => (
        <div key={b.seq} className="row anim-fade-up">
          <span><i className="dot" style={{ background: seatColor(b.playerId) }} />{getPlayer(s, b.playerId)?.name}</span>
          <b>{fmt(b.amount)}</b>
        </div>
      )) : <p className="muted">Ninguém deu lance ainda.</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Centro: a carta do lote
// ---------------------------------------------------------------------------
function LotCard({ s, me, lastPlaced, now }: {
  s: AuctionState; me: string | null; lastPlaced?: Extract<AuctionEvent, { type: 'placed' }>; now: () => number;
}) {
  const cur = s.current, rp = s.routePick;
  const id = cur?.champId ?? rp?.champId ?? lastPlaced?.champId;
  const champ = id ? s.champions[id] : null;
  const card = useMemo(() => (champ ? buildCard(champ.id, champ.routes) : null), [champ]);
  if (!champ || !card) return <div className="lot lot-empty">Preparando o primeiro campeão…</div>;

  const show = s.config.showOverall !== false;
  const myValid = cur && me ? validRoles(s, me, champ.id) : null;
  const legendary = show && card.bestOvr >= 84;
  const name = (pid: string) => getPlayer(s, pid)?.name ?? '?';

  let status: React.ReactNode, price = 0;
  if (cur) {
    price = cur.highBid?.amount ?? s.config.minBid;
    status = cur.highBid
      ? <><b style={{ color: seatColor(cur.highBid.playerId) }}>{name(cur.highBid.playerId)}</b> está vencendo</>
      : <>Sem lances · abre por {fmt(s.config.minBid)}</>;
  } else if (rp) {
    price = rp.price;
    status = <><b style={{ color: seatColor(rp.playerId) }}>{name(rp.playerId)}</b> arrematou e escolhe a rota…</>;
  } else if (lastPlaced) {
    price = lastPlaced.price;
    status = lastPlaced.via === 'sobra'
      ? <>Sobra para <b>{name(lastPlaced.playerId)}</b></>
      : <>Vendido para <b style={{ color: seatColor(lastPlaced.playerId) }}>{name(lastPlaced.playerId)}</b></>;
  }

  return (
    <div key={champ.id} className={`lot anim-reveal ${legendary ? 'legendary anim-glow' : ''} ${!cur ? 'sold' : ''}`}>
      <div className="lot-head">
        <span className="lot-no">{cur ? `Nº ${cur.index}` : rp ? 'Arrematado' : 'Encerrado'}</span>
        {legendary && <span className="lot-tag">✦ Lendário</span>}
        {cur ? <Clock endsAt={cur.endsAt} now={now} /> : rp ? <Clock endsAt={rp.deadline} now={now} /> : null}
      </div>
      <div className="lot-art">
        <div className="moon" />
        <ChampImg key={champ.id} id={champ.id} name={champ.name} big className="splash" />
        <div className="lot-name">
          <h2>{card.name}</h2>
          <p>{card.title}</p>
          <div className="chips">
            {champ.routes.map(r => (
              <span key={r} className={`chip ${myValid ? (myValid.includes(r) ? 'ok' : 'no') : ''}`}>
                {ROLE_LABEL[r]}{show && <b> {card.ovr[r]}</b>}
              </span>
            ))}
            <span className="chip cls">{CLASS_LABEL[card.champClass]}</span>
          </div>
        </div>
      </div>
      <div className="lot-info">
        {show ? (
          <div className="attrs">
            {(Object.entries(card.attrs) as [string, number][]).map(([k, v]) => (
              <span key={k}><b>{v}</b>{k}</span>
            ))}
          </div>
        ) : <p className="muted">Overall escondido: leilão no olho.</p>}
        {card.roles.length > 0 && <p className="roles">{card.roles.join(' · ')}</p>}
        {card.abilities.find(a => a.key === 'R') && (
          <p className="ult"><b>R · {card.abilities.find(a => a.key === 'R')!.name}</b></p>
        )}
      </div>
      <div className="lot-foot">
        <div>
          <p className="st">{status}</p>
          <small>{cur ? `${cur.bidCount} lance${cur.bidCount === 1 ? '' : 's'}${cur.passes.length ? ` · ${cur.passes.length} passaram` : ''}` : ' '}</small>
        </div>
        <div key={price} className="price anim-bump"><span className="coin">◐</span>{fmt(price).replace('R$ ', '')}</div>
      </div>
    </div>
  );
}

function Clock({ endsAt, now }: { endsAt: number; now: () => number }) {
  const [left, setLeft] = useState(() => Math.max(0, endsAt - now()));
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, endsAt - now())), 100);
    return () => clearInterval(id);
  }, [endsAt, now]);
  const secs = Math.ceil(left / 1000);
  return (
    <span className={`clock ${left < 3000 ? 'low anim-pulse' : ''}`}>
      <span className="ic">⏱</span><b>{String(secs).padStart(2, '0')}</b><small>seg</small>
    </span>
  );
}

function BidBar({ s, me, pending, act }: { s: AuctionState; me: string; pending: boolean; act: (a: ClientAction) => void }) {
  const cur = s.current!;
  const el = bidEligibility(s, me);
  const leading = cur.highBid?.playerId === me;
  const min = minNextBid(s);
  const max = maxBid(s, me);
  const base = cur.highBid?.amount ?? 0;
  const can = el.ok && !leading && !pending;
  const passed = cur.passes.includes(me);
  const unit = s.config.minIncrement;
  const quick = [1, 5, 10].map((n, i) => ({ key: String(i + 1), label: `+${n}`, amount: Math.max(min, base + n * unit) }));
  const [confirmMax, setConfirmMax] = useState(false);

  // Atalhos: 1/2/3 = +1/+5/+10, T = tudo, P = passar
  const latest = useRef({ can, max, min, quick, passed, leading });
  latest.current = { can, max, min, quick, passed, leading };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || e.ctrlKey || e.metaKey || e.altKey) return;
      const st = latest.current;
      const q = st.quick.find(x => x.key === e.key);
      if (q && st.can && q.amount <= st.max) act({ type: 'bid', amount: q.amount });
      else if (e.key.toLowerCase() === 't' && st.can && st.max >= st.min) act({ type: 'bid', amount: st.max });
      else if (e.key.toLowerCase() === 'p' && !st.passed && !st.leading) act({ type: 'pass' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [act]);

  return (
    <div className="bidbar">
      <div className="bids">
        {quick.map(q => (
          <button key={q.key} className="bid" disabled={!can || q.amount > max} onClick={() => act({ type: 'bid', amount: q.amount })}>
            {q.label}<small>{fmt(q.amount).replace('R$ ', '')} moedas</small>
          </button>
        ))}
      </div>
      <div className="bids2">
        <button
          className={`max ${confirmMax ? 'armed' : ''}`} disabled={!can || max < min}
          onClick={() => { if (confirmMax) { act({ type: 'bid', amount: max }); setConfirmMax(false); } else setConfirmMax(true); }}
        >
          {confirmMax ? `Confirmar ${fmt(max)}` : `Máximo · ${fmt(max).replace('R$ ', '')}`} <span>🔒</span>
        </button>
        <button className="pass" disabled={passed || leading || pending} onClick={() => act({ type: 'pass' })}>
          {passed ? 'Passou' : 'Passar'}
        </button>
      </div>
      <p className={`hint ${leading ? 'lead' : !el.ok ? 'bad' : ''}`}>
        {leading ? 'O maior lance é seu. Se ninguém cobrir, ele é seu.'
          : !el.ok ? el.reason
          : `Uma moeda por vaga restante fica reservada. Atalhos: 1, 2, 3, T e P.`}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coluna da direita: outros jogadores
// ---------------------------------------------------------------------------
function PlayerRow({ s, pid }: { s: AuctionState; pid: string }) {
  const p = getPlayer(s, pid)!;
  const cur = s.current;
  const leader = cur?.highBid?.playerId === pid;
  const passed = cur?.passes.includes(pid);
  const el = cur ? bidEligibility(s, pid) : { ok: true as const };
  const filled = ROLES.length - openRoles(p).length;
  const tag = p.isBot ? BOT_PROFILES[p.botProfile ?? 'equilibrado'].label : 'Jogador';
  return (
    <div className={`ad-player ${leader ? 'leader' : ''} ${cur && !el.ok && !leader ? 'out' : ''}`} style={{ '--pc': seatColor(pid) } as React.CSSProperties}>
      <div className="ph">
        <PlayerAvatar pid={pid} name={p.name} small />
        <b>{p.name}</b>
        <span className="money"><span className="coin">◐</span>{fmt(p.budget).replace('R$ ', '')}</span>
      </div>
      <div className="mslots">
        {ROLES.map(r => {
          const slot = p.roster[r];
          const c = slot ? s.champions[slot.champId] : null;
          return (
            <span key={r} className="ms" title={`${ROLE_LABEL[r]}${c ? `: ${c.name} · ${fmt(slot!.price)}` : ''}`}>
              {c ? <ChampImg id={c.id} name={c.name} /> : ROLE_SHORT[r]}
            </span>
          );
        })}
      </div>
      <small className="ps">
        {filled}/5 · {tag}
        {leader ? ' · lidera' : passed ? ' · passou' : cur && !el.ok ? ' · fora da disputa' : ''}
      </small>
    </div>
  );
}

function LastSold({ s }: { s: AuctionState }) {
  const sold = s.sales.slice(-4).reverse();
  return (
    <div className="ad-list">
      <h4>Últimos arremates</h4>
      {sold.length ? sold.map(x => (
        <div key={x.champId} className="row sold anim-fade-up">
          <ChampImg id={x.champId} name={s.champions[x.champId].name} className="ic" />
          <span><b>{getPlayer(s, x.playerId)?.name}</b> levou {s.champions[x.champId].name}</span>
          <b>{x.price ? fmt(x.price) : 'sobra'}</b>
        </div>
      )) : <p className="muted">Os arremates aparecem aqui.</p>}
    </div>
  );
}

function RouteModal({ s, pending, now, onPick }: {
  s: AuctionState; pending: boolean; now: () => number; onPick: (r: Role) => void;
}) {
  const rp = s.routePick!;
  const c = s.champions[rp.champId];
  const [left, setLeft] = useState(() => Math.ceil(Math.max(0, rp.deadline - now()) / 1000));
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.ceil(Math.max(0, rp.deadline - now()) / 1000)), 200);
    return () => clearInterval(id);
  }, [rp.deadline, now]);
  return (
    <div className="ad-overlay">
      <div className="ad-modal anim-reveal">
        <ChampImg id={c.id} name={c.name} className="ic" />
        <h2>{c.name} é seu!</h2>
        <p>{rp.price ? `Pago: ${fmt(rp.price)}` : 'De graça'} · escolha a rota em <b>{left}</b> s</p>
        <div className="opts">
          {rp.options.map(r => (
            <button key={r} className="btn-primary" disabled={pending} onClick={() => onPick(r)}>{ROLE_LABEL[r]}</button>
          ))}
        </div>
      </div>
    </div>
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
    <div className="ad-results">
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
