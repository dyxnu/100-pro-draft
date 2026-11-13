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
import { getBrowserClient } from '@/lib/supabase/client';
import { ChampImg, HOW_LABEL, ROLE_LABEL, ROLE_SHORT, seatColor } from './ui';
import './draft.css';

interface Snapshot { state: AuctionState; nextTickAt: number | null }

export function AuctionView({ code, roomId, initialState, initialNextTickAt, serverNow, mySeat }: {
  code: string;
  roomId: string;
  initialState: AuctionState;
  initialNextTickAt: number | null;
  serverNow: number;
  mySeat: number | null;
}) {
  const me = mySeat == null ? null : seatPlayerId(mySeat);
  const [snap, setSnap] = useState<Snapshot>({ state: initialState, nextTickAt: initialNextTickAt });
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const offset = useRef(0); // relógio do servidor = Date.now() + offset
  useEffect(() => { offset.current = serverNow - Date.now(); }, [serverNow]);
  const serverTime = useCallback(() => Date.now() + offset.current, []);
  const s = snap.state;

  // Só aceita estados mais novos (realtime e respostas podem chegar fora de ordem).
  const apply = useCallback((state: AuctionState, nextTickAt: number | null) => {
    setSnap(prev => (state.version >= prev.state.version ? { state, nextTickAt } : prev));
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
    if (data.state) apply(data.state, data.nextTickAt ?? null);
    return data;
  }, [code, apply, serverTime]);

  // Tempo real: cada gravação do servidor chega para todos da sala.
  useEffect(() => {
    const sb = getBrowserClient();
    const ch = sb.channel(`leilao:${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'auctions', filter: `room_id=eq.${roomId}` }, (p: { new: unknown }) => {
        const row = p.new as { state?: AuctionState; next_tick_at?: string | null };
        if (row.state) apply(row.state, row.next_tick_at ? Date.parse(row.next_tick_at) : null);
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [roomId, apply]);

  // "Cutucada" no relógio do servidor quando um prazo vence (fim de lote, vez dos bots...).
  useEffect(() => {
    if (!me || s.phase === 'finished' || snap.nextTickAt == null) return;
    const delay = Math.max(0, snap.nextTickAt - serverTime()) + 100 + Math.random() * 400;
    const id = setTimeout(() => { void send({ type: 'tick' }); }, delay);
    return () => clearTimeout(id);
  }, [snap, me, s.phase, send, serverTime]);

  // Rede de segurança caso alguma mensagem em tempo real se perca.
  useEffect(() => {
    if (s.phase === 'finished') return;
    const id = setInterval(() => { if (me) void send({ type: 'tick' }); }, 5000);
    return () => clearInterval(id);
  }, [s.phase, me, send]);

  const act = async (action: ClientAction) => {
    setPending(true);
    const r = await send(action);
    setPending(false);
    if (!r.ok && r.reason) {
      setToast(r.reason);
      setTimeout(() => setToast(null), 2500);
    }
  };

  if (s.phase === 'finished') return <Results s={s} me={me} />;

  const cur = s.current;
  const rp = s.routePick;
  const lastPlaced = [...s.events].reverse().find((e): e is Extract<AuctionEvent, { type: 'placed' }> => e.type === 'placed');
  const stageId = cur?.champId ?? rp?.champId ?? lastPlaced?.champId ?? null;
  const champ = stageId ? s.champions[stageId] : null;
  const mine = me ? getPlayer(s, me) : null;

  return (
    <div className="nx-draft">
      <div className="topline">
        <span>Sala <b className="font-mono">{code}</b> · {s.sales.length} de {Object.keys(s.champions).length} campeões definidos</span>
        {mine ? <span>Seu saldo <b className="money-lg">{fmt(mine.budget)}</b></span> : <span>Assistindo</span>}
      </div>

      <div className="layout">
        <section className="stage panel-d">
          <div className={`stage-art ${cur?.highBid ? 'has-bid' : ''}`} key={`${stageId}-${cur?.highBid?.seq ?? 0}`}>
            {champ && <ChampImg key={champ.id} id={champ.id} name={champ.name} big />}
          </div>
          <div className="stage-info">
            <StageHeader s={s} me={me} lastPlaced={lastPlaced} />
            {cur ? (
              <Timer endsAt={cur.endsAt} total={s.config.bidTimeMs} now={serverTime} />
            ) : rp ? (
              <Timer endsAt={rp.deadline} total={s.config.routePickMs} now={serverTime} label="Escolha de rota" />
            ) : (
              <div className="timer"><span>Próximo campeão…</span></div>
            )}
            {me && s.current && <BidControls key={s.current.champId} s={s} me={me} pending={pending} act={act} custom={custom} setCustom={setCustom} />}
          </div>
        </section>

        {mine && <MyTeam s={s} meId={mine.id} />}
        <Players s={s} me={me} />
        <Pool s={s} />
        <Log s={s} />
      </div>

      {me && rp && s.phase === 'routePick' && rp.playerId === me && (
        <RouteModal s={s} pending={pending} now={serverTime} onPick={role => act({ type: 'route', role })} />
      )}
      {toast && <div className="toast" role="alert">{toast}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
function StageHeader({ s, me, lastPlaced }: {
  s: AuctionState; me: string | null; lastPlaced?: Extract<AuctionEvent, { type: 'placed' }>;
}) {
  const cur = s.current, rp = s.routePick;
  const id = cur?.champId ?? rp?.champId ?? lastPlaced?.champId;
  if (!id) return <h2 className="champ-name">Preparando…</h2>;
  const champ = s.champions[id];
  const myValid = cur && me ? validRoles(s, me, id) : null;
  const name = (pid: string) => getPlayer(s, pid)?.name ?? '?';

  let tag: React.ReactNode = '', amount = '—', leader: React.ReactNode = '';
  if (cur) {
    tag = <>Campeão {cur.index} de {s.totalLots}{cur.passes.length > 0 && <span className="warn"> · {cur.passes.length} passaram</span>}</>;
    if (cur.highBid) {
      amount = fmt(cur.highBid.amount);
      leader = <>liderando: <b style={{ color: seatColor(cur.highBid.playerId) }}>{name(cur.highBid.playerId)}</b> · {cur.bidCount} lance{cur.bidCount > 1 ? 's' : ''}</>;
    } else {
      amount = fmt(s.config.minBid);
      leader = 'Nenhum lance ainda. Esse é o lance inicial.';
    }
  } else if (rp) {
    tag = 'Arrematado';
    amount = fmt(rp.price);
    leader = <><b style={{ color: seatColor(rp.playerId) }}>{name(rp.playerId)}</b> está escolhendo a rota…</>;
  } else if (lastPlaced) {
    tag = lastPlaced.via === 'sobra' ? 'Sobra (grátis)' : 'Vendido';
    amount = fmt(lastPlaced.price);
    leader = <><b style={{ color: seatColor(lastPlaced.playerId) }}>{name(lastPlaced.playerId)}</b> · {ROLE_LABEL[lastPlaced.role]}</>;
  }

  return (
    <>
      <div className="lot-tag">{tag}</div>
      <h2 className="champ-name">{champ.name}</h2>
      <div className="routes">
        {champ.routes.map(r => (
          <span key={r} className={`chip ${myValid ? (myValid.includes(r) ? 'ok' : 'no') : ''}`}>{ROLE_LABEL[r]}</span>
        ))}
      </div>
      <div className="bid-box">
        <div className="bid-label">Maior lance</div>
        <div className="bid-amount">{amount}</div>
        <div className="bid-leader">{leader}</div>
      </div>
    </>
  );
}

function Timer({ endsAt, total, now, label }: { endsAt: number; total: number; now: () => number; label?: string }) {
  const [left, setLeft] = useState(() => Math.max(0, endsAt - now()));
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, endsAt - now())), 100);
    return () => clearInterval(id);
  }, [endsAt, now]);
  const pct = Math.min(100, (left / total) * 100);
  return (
    <div className="timer">
      <div className={`timer-bar ${!label && left < 3000 ? 'low' : ''}`} style={{ width: `${pct}%` }} />
      <span>{label ? `${label} · ${Math.ceil(left / 1000)} s` : `${(left / 1000).toFixed(1)} s`}</span>
    </div>
  );
}

function BidControls({ s, me, pending, act, custom, setCustom }: {
  s: AuctionState; me: string; pending: boolean; act: (a: ClientAction) => void;
  custom: string; setCustom: (v: string) => void;
}) {
  const cur = s.current!; // só é renderizado com um lote em disputa
  const el = bidEligibility(s, me);
  const leading = cur.highBid?.playerId === me;
  const min = minNextBid(s);
  const max = maxBid(s, me);
  const base = cur.highBid?.amount ?? 0;
  const can = el.ok && !leading && !pending;
  const passed = cur.passes.includes(me);
  const reserve = (openRoles(getPlayer(s, me)!).length - 1) * s.config.minBid;
  const unit = s.config.minIncrement;
  const quick = [1, 5, 10].map((n, i) => ({ key: String(i + 1), label: `+${n}`, amount: Math.max(min, base + n * unit) }));

  const submitCustom = () => {
    const v = Math.round(parseFloat(custom.replace(/[^\d,.]/g, '').replace(',', '.'))) * 100;
    if (Number.isFinite(v)) { act({ type: 'bid', amount: v }); setCustom(''); }
  };

  // Atalhos de teclado: 1/2/3 = +1/+5/+10, T = tudo, P = passar
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
    <>
      <div className="quick">
        {quick.map(q => (
          <button key={q.key} className="btn-bid" disabled={!can || q.amount > max} onClick={() => act({ type: 'bid', amount: q.amount })}>
            {q.label}<small>{fmt(q.amount)} · tecla {q.key}</small>
          </button>
        ))}
        <button className="btn-bid allin" disabled={!can || max < min} onClick={() => act({ type: 'bid', amount: max })}>
          Tudo<small>{fmt(max)} · tecla T</small>
        </button>
      </div>
      <div className="custom">
        <span className="prefix">R$</span>
        <input
          value={custom} onChange={e => setCustom(e.target.value)} inputMode="numeric" placeholder="valor"
          disabled={!can} onKeyDown={e => { if (e.key === 'Enter') submitCustom(); }}
        />
        <button className="btn-secondary" disabled={!can} onClick={submitCustom}>Dar lance</button>
        <button className="btn-pass" disabled={passed || leading || pending || !el.ok && !passed && el.reason.startsWith('Nenhum')} onClick={() => act({ type: 'pass' })}>
          {passed ? 'Passou' : 'Passar (P)'}
        </button>
      </div>
      <div className={`hint ${leading ? 'lead' : !el.ok ? 'bad' : ''}`}>
        {leading ? 'O maior lance é seu. Se ninguém cobrir, ele é seu.'
          : !el.ok ? el.reason
          : `Você pode ir até ${fmt(max)} (guardando ${fmt(reserve)} para as outras vagas). Lance no fim garante ${s.config.bidExtendMs / 1000} s no relógio.`}
      </div>
    </>
  );
}

function MyTeam({ s, meId }: { s: AuctionState; meId: string }) {
  const p = getPlayer(s, meId)!;
  const filled = ROLES.length - openRoles(p).length;
  return (
    <section className="myteam panel-d">
      <h3>Seu time <small>{filled}/5 · gasto {fmt(s.config.budget - p.budget)}</small></h3>
      <div className="slots">
        {ROLES.map(r => {
          const slot = p.roster[r];
          const c = slot ? s.champions[slot.champId] : null;
          return (
            <div key={r} className={`slot ${slot ? 'filled' : ''}`}>
              <div className="role">{ROLE_LABEL[r]}</div>
              {c ? <ChampImg id={c.id} name={c.name} className="ic" /> : <div className="ic empty" />}
              <div className="nm">{c ? c.name : 'vazio'}</div>
              <div className="pr">{slot ? `${fmt(slot.price)}${HOW_LABEL[slot.how] ? ' · ' + HOW_LABEL[slot.how] : ''}` : ' '}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Players({ s, me }: { s: AuctionState; me: string | null }) {
  const cur = s.current;
  return (
    <section className="players panel-d">
      <h3>Participantes</h3>
      <div className="plist">
        {s.players.map(p => {
          const leader = cur?.highBid?.playerId === p.id;
          const el = cur ? bidEligibility(s, p.id) : { ok: true as const };
          const open = openRoles(p).length;
          const status = leader ? `Liderando com ${fmt(cur!.highBid!.amount)}`
            : !open ? 'Time completo'
            : cur && !el.ok ? el.reason.replace('Você não tem', 'Sem').replace('Seu time', 'Time')
            : `Lance máx. ${fmt(maxBid(s, p.id))}`;
          const tag = p.isBot ? `Bot · ${BOT_PROFILES[p.botProfile ?? 'equilibrado'].label}` : p.id === me ? 'Você' : 'Jogador';
          return (
            <div key={p.id} className={`pcard ${leader ? 'leader' : ''} ${cur && !el.ok && !leader ? 'out' : ''}`} style={{ '--pc': seatColor(p.id) } as React.CSSProperties}>
              <div className="pc-head"><b>{p.name}</b><span className="tag">{tag}</span><span className="money">{fmt(p.budget)}</span></div>
              <div className="pc-slots">
                {ROLES.map(r => {
                  const slot = p.roster[r];
                  const c = slot ? s.champions[slot.champId] : null;
                  return (
                    <div key={r} className="mini" title={`${ROLE_LABEL[r]}${c ? `: ${c.name} · ${fmt(slot!.price)}` : ''}`}>
                      {c ? <ChampImg id={c.id} name={c.name} /> : ROLE_SHORT[r]}
                    </div>
                  );
                })}
              </div>
              <div className={`pc-status ${leader ? 'lead' : ''}`}>{status}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Pool({ s }: { s: AuctionState }) {
  const owner = new Map(s.sales.map(x => [x.champId, x]));
  const curId = s.current?.champId ?? s.routePick?.champId;
  const all = Object.values(s.champions).sort((a, b) =>
    ROLES.indexOf(a.routes[0]) - ROLES.indexOf(b.routes[0]) || a.name.localeCompare(b.name));
  return (
    <section className="pool panel-d">
      <h3>Campeões <small>{s.queue.length + (s.current ? 1 : 0)} na fila</small></h3>
      {s.queue.length > 0 && (
        <div className="next">
          Próximos:
          {s.queue.slice(0, 3).map(id => (
            <div key={id} className="mini" title={s.champions[id].name}><ChampImg id={id} name={s.champions[id].name} /></div>
          ))}
        </div>
      )}
      <div className="pool-grid">
        {all.map(c => {
          const sale = owner.get(c.id);
          const cls = sale ? 'sold' : c.id === curId ? 'current' : '';
          const title = `${c.name} (${c.routes.map(r => ROLE_SHORT[r]).join('/')})${sale ? ` · ${getPlayer(s, sale.playerId)?.name} · ${fmt(sale.price)}` : ''}`;
          return (
            <div key={c.id} className={`pchamp ${cls}`} title={title} style={{ '--pc': sale ? seatColor(sale.playerId) : 'transparent' } as React.CSSProperties}>
              <ChampImg id={c.id} name={c.name} />
              {sale && <div className="price">{fmt(sale.price).replace('R$ ', '')}</div>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Log({ s }: { s: AuctionState }) {
  const who = (id: string) => <span className="who" style={{ color: seatColor(id) }}>{getPlayer(s, id)?.name}</span>;
  const cn = (id: string) => <b>{s.champions[id]?.name}</b>;
  const text = (e: AuctionEvent): React.ReactNode => {
    switch (e.type) {
      case 'lot_start': return <>Campeão {e.index}: {cn(e.champId)}</>;
      case 'bid': return <>{who(e.playerId)} deu {fmt(e.amount)} em {cn(e.champId)}</>;
      case 'pass': return <>{who(e.playerId)} passou</>;
      case 'sold': return <>{cn(e.champId)} arrematado por {who(e.playerId)} por <b>{fmt(e.amount)}</b></>;
      case 'unsold': return <>{cn(e.champId)} ficou sem lances: passou, passou</>;
      case 'route_pick': return <>{who(e.playerId)} está escolhendo a rota de {cn(e.champId)}</>;
      case 'placed': return e.via === 'sobra'
        ? <>{who(e.playerId)} completa o {ROLE_LABEL[e.role]} de graça com {cn(e.champId)}{e.offRole ? ' (fora da rota: vale metade)' : ''}</>
        : <>{who(e.playerId)} colocou {cn(e.champId)} no <b>{ROLE_LABEL[e.role]}</b>{e.via === 'auto' ? ' (automático)' : ''}</>;
      case 'finished': return <b>Draft encerrado!</b>;
    }
  };
  const evs = s.events.slice(-60).reverse();
  return (
    <section className="log panel-d">
      <h3>Histórico</h3>
      <ol>
        {evs.map((e, i) => (
          <li key={s.events.length - i} className={['sold', 'finished'].includes(e.type) ? 'big' : ''}>{text(e)}</li>
        ))}
      </ol>
    </section>
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
    <div className="overlay">
      <div className="route-card">
        <ChampImg id={c.id} name={c.name} />
        <h2>{c.name} é seu!</h2>
        <p>{rp.price ? `Pago: ${fmt(rp.price)}` : 'De graça'} · escolha a rota em <b>{left}</b> s</p>
        <div className="route-btns">
          {rp.options.map(r => (
            <button key={r} className="btn-secondary" disabled={pending} onClick={() => onPick(r)}>{ROLE_LABEL[r]}</button>
          ))}
        </div>
        <p className="small">Só aparecem as rotas que não travam o draft de ninguém.</p>
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
    const lines = ['NEXUS DRAFT: resultado', ''];
    s.players.forEach(p => {
      lines.push(`${p.name} (gastou ${fmt(s.config.budget - p.budget)})`);
      ROLES.forEach(r => { const x = p.roster[r]!; lines.push(`  ${ROLE_LABEL[r]}: ${s.champions[x.champId].name} · ${fmt(x.price)}`); });
      lines.push('');
    });
    try { await navigator.clipboard.writeText(lines.join('\n')); setCopied(true); } catch { /* ignora */ }
  };

  return (
    <div className="nx-draft">
      <div className="topline"><span>Draft encerrado</span></div>
      <div className="highlights">
        {highlights.map(h => (
          <div key={h.k} className="hl"><div className="k">{h.k}</div><div className="v">{h.v}</div><div className="s">{h.d}</div></div>
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
                  <ChampImg id={c.id} name={c.name} />
                  <span>{c.name}<span className="how">{HOW_LABEL[x.how]}</span></span>
                  <span className="pr">{fmt(x.price)}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="results-actions">
        <button className="btn-secondary" onClick={copy}>{copied ? 'Copiado!' : 'Copiar resultado'}</button>
        <Link href="/jogar" className="btn-primary px-6">Jogar de novo</Link>
      </div>
    </div>
  );
}
