'use client';

// Tela do leilão no estilo do 100pracada: cartão central compacto (relógio em anel, foto, preço grande,
// lances), seu time num mini Summoner's Rift à esquerda e os adversários em mini-mapas à direita.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ROLES, type AuctionEvent, type AuctionState, type Role, type RosterSlot,
  bidEligibility, formatBRL as fmt, getPlayer, maxBid, minNextBid, openRoles, validRoles,
} from '@/lib/auction/engine';
import type { ClientAction } from '@/lib/rooms/types';
import { buildCard, CLASS_LABEL } from '@/lib/champions/cards';
import { MINIMAP_URL } from '@/lib/match/map';
import { isMuted, onMutedChange, play, setMuted } from '@/lib/sound';
import { Avatar, usePlayerAvatar } from '@/components/profile/Avatar';
import { ChampImg, ROLE_LABEL, ROLE_SHORT, seatColor } from './ui';
import './stage.css';

const money = (c: number) => fmt(c).replace('R$ ', '');
type LotResult = Extract<AuctionEvent, { type: 'placed' | 'unsold' }>;

/** Onde cada rota fica no mini-mapa (% da imagem). */
const ROLE_SPOT: Record<Role, { x: number; y: number }> = {
  TOP: { x: 17, y: 20 }, JUNGLE: { x: 33, y: 47 }, MID: { x: 50, y: 50 }, ADC: { x: 81, y: 82 }, SUPORTE: { x: 67, y: 85 },
};

export function PlayerAvatar({ pid, name, size = 34 }: { pid: string; name: string; size?: number }) {
  const icon = usePlayerAvatar(pid);
  if (icon) return <Avatar id={icon} size={size} color={seatColor(pid)} />;
  return <span className="pd-ava" style={{ background: seatColor(pid), width: size, height: size }}>{name.slice(0, 1).toUpperCase()}</span>;
}

// ---------------------------------------------------------------------------
export function AuctionStage({ s, me, act, pending, serverTime, code, toast }: {
  s: AuctionState; me: string | null; act: (a: ClientAction) => void; pending: boolean;
  serverTime: () => number; code: string; toast: string | null;
}) {
  const cur = s.current;
  const rp = s.routePick;
  // Último resultado de lote: vendido/colocado OU sem comprador (antes só olhava "placed" e mostrava o campeão errado).
  const lastResult = [...s.events].reverse().find((e): e is LotResult => e.type === 'placed' || e.type === 'unsold');
  const lastPlaced = lastResult?.type === 'placed' ? lastResult : undefined;
  const mine = me ? getPlayer(s, me) : null;
  const others = s.players.filter(p => p.id !== me);
  useAuctionSounds(s, me);

  return (
    <div className="pd">
      <div className="pd-top">
        <nav className="pd-steps" aria-label="Etapas">
          <span className="done">✓ Saguão</span><span className="on">Leilão</span><span>Escalação</span><span>Campeonato</span>
        </nav>
        <div className="pd-top-right">
          <span className="pd-room">Sala <b>{code}</b> · {s.sales.length}/{s.players.length * 5} vagas</span>
          <SoundToggle />
        </div>
      </div>
      <div className="pd-pill">{cur ? `Campeão ${cur.index} de ${s.totalLots}` : rp ? 'Escolhendo a rota…' : 'Próximo campeão…'}</div>

      <div className="pd-grid">
        <aside className="pd-left">
          {mine ? <MyTeam s={s} meId={mine.id} /> : <div className="pd-box muted">Você está assistindo este leilão.</div>}
          <LastSold s={s} />
        </aside>

        <section className="pd-center">
          <LotPanel s={s} me={me} last={lastResult} now={serverTime} pending={pending} act={act} />
        </section>

        <aside className="pd-right">
          {others.map(p => <Rival key={p.id} s={s} pid={p.id} lastPlaced={lastPlaced} />)}
        </aside>
      </div>
      {me && rp && s.phase === 'routePick' && rp.playerId === me && (
        <RouteModal s={s} pending={pending} now={serverTime} onPick={role => act({ type: 'route', role })} />
      )}
      {toast && <div className="pd-toast" role="alert">{toast}</div>}
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
  const me = getPlayer(s, rp.playerId)!;
  return (
    <div className="pd-overlay">
      <div className="pd-route anim-reveal">
        <div className="pd-route-head">
          <ChampImg id={c.id} name={c.name} className="ic" />
          <div>
            <h2>{c.name} é seu!</h2>
            <p>{rp.price ? `Pago: ${fmt(rp.price)}` : 'De graça'} · clique na rota no mapa · <b>{left}</b> s</p>
          </div>
        </div>
        {/* Mapa grande: rotas livres brilham e podem ser clicadas */}
        <div className="pd-rift big">
          <img src={MINIMAP_URL} alt="" className="map" />
          {ROLES.map(r => {
            const slot = me.roster[r];
            const owned = slot ? s.champions[slot.champId] : null;
            const at = ROLE_SPOT[r];
            const can = rp.options.includes(r);
            return can ? (
              <button key={r} className="spot pick" style={{ left: `${at.x}%`, top: `${at.y}%` }} disabled={pending} onClick={() => onPick(r)}>
                <ChampImg id={c.id} name={c.name} className="ic ghost" />
                <span className="lbl">{ROLE_LABEL[r]}</span>
              </button>
            ) : (
              <div key={r} className={`spot ${owned ? 'filled' : ''}`} style={{ left: `${at.x}%`, top: `${at.y}%` }}>
                {owned ? <ChampImg id={owned.id} name={owned.name} className="ic" /> : <span className="role">{ROLE_SHORT[r]}</span>}
              </div>
            );
          })}
        </div>
        <div className="pd-route-opts">
          {rp.options.map(r => <button key={r} className="btn-primary" disabled={pending} onClick={() => onPick(r)}>{ROLE_LABEL[r]}</button>)}
        </div>
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Sons do leilão: novo lote, lances, arremate, contagem final.
function useAuctionSounds(s: AuctionState, me: string | null) {
  const prev = useRef<{ bids: number; sales: number; lot: number | null; leader: string | null; passes: number } | null>(null);
  useEffect(() => {
    const now = { bids: s.bids.length, sales: s.sales.length, lot: s.current?.index ?? null, leader: s.current?.highBid?.playerId ?? null, passes: s.current?.passes.length ?? 0 };
    const p = prev.current;
    prev.current = now;
    if (!p) return;
    if (now.sales > p.sales) {
      const sale = s.sales[s.sales.length - 1];
      play(sale.playerId === me ? 'win' : 'sold');
    } else if (now.lot !== p.lot && now.lot != null) play('lot');
    else if (now.bids > p.bids) {
      if (now.leader === me) play('myBid');
      else if (p.leader === me) play('outbid');
      else play('bid');
    } else if (now.lot === p.lot && now.passes > p.passes) play('pass');
  }, [s, me]);
}

function SoundToggle() {
  const [off, setOff] = useState(false);
  useEffect(() => { setOff(isMuted()); return onMutedChange(setOff); }, []);
  return (
    <button className="pd-sound" onClick={() => { setMuted(!off); if (off) play('click'); }} title={off ? 'Ligar sons' : 'Desligar sons'} aria-label={off ? 'Ligar sons' : 'Desligar sons'}>
      {off ? '🔇' : '🔊'}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Mini Summoner's Rift com os campeões em cada rota.
function RiftBoard({ roster, s, compact = false, accent }: {
  roster: Partial<Record<Role, RosterSlot | null>>; s: AuctionState; compact?: boolean; accent?: string;
}) {
  return (
    <div className={`pd-rift ${compact ? 'compact' : ''}`} style={accent ? { '--acc': accent } as React.CSSProperties : undefined}>
      <img src={MINIMAP_URL} alt="" className="map" />
      {ROLES.map(r => {
        const slot = roster[r];
        const c = slot ? s.champions[slot.champId] : null;
        const at = ROLE_SPOT[r];
        return (
          <div key={r} className={`spot ${c ? 'filled' : ''}`} style={{ left: `${at.x}%`, top: `${at.y}%` }}
            title={`${ROLE_LABEL[r]}${c ? `: ${c.name} · ${slot!.price ? fmt(slot!.price) : 'sobra'}` : ' (vaga aberta)'}`}>
            {c ? <ChampImg key={c.id} id={c.id} name={c.name} className="ic" /> : <span className="role">{ROLE_SHORT[r]}</span>}
            {c && !compact && <span className="price">{slot!.price ? money(slot!.price) : 'sobra'}</span>}
          </div>
        );
      })}
    </div>
  );
}

function MyTeam({ s, meId }: { s: AuctionState; meId: string }) {
  const p = getPlayer(s, meId)!;
  const open = openRoles(p).length;
  const spentPct = Math.round(((s.config.budget - p.budget) / s.config.budget) * 100);
  return (
    <div className="pd-me">
      <div className="pd-me-head">
        <PlayerAvatar pid={meId} name={p.name} />
        <div className="min-w-0 flex-1"><b className="truncate">{p.name}</b><small>VOCÊ</small></div>
        <span key={p.budget} className="pd-money anim-bump"><span className="coin">◐</span>{fmt(p.budget)}</span>
      </div>
      <div className="pd-budget" title={`Gastou ${spentPct}%`}><span style={{ width: `${100 - spentPct}%` }} /></div>
      <p className="pd-sub">
        <span>{fmt(p.budget)} para {open} vaga{open === 1 ? '' : 's'}</span>
        {open > 0 && <span>média de {fmt(Math.floor(p.budget / open / 100) * 100)} por vaga</span>}
      </p>
      <RiftBoard roster={p.roster} s={s} accent={seatColor(meId)} />
      <p className="pd-count">{5 - open}/5 campeões</p>
    </div>
  );
}

function Rival({ s, pid, lastPlaced }: { s: AuctionState; pid: string; lastPlaced?: Extract<AuctionEvent, { type: 'placed' }> }) {
  const p = getPlayer(s, pid)!;
  const cur = s.current;
  const leader = cur?.highBid?.playerId === pid;
  const passed = cur?.passes.includes(pid);
  const el = cur ? bidEligibility(s, pid) : { ok: true as const };
  const justWon = !cur && lastPlaced?.playerId === pid;
  const badge = leader ? { t: `lidera ${fmt(cur!.highBid!.amount)}`, c: 'lead' }
    : justWon ? { t: lastPlaced!.price ? `levou por ${fmt(lastPlaced!.price)}` : 'levou de sobra', c: 'won' }
    : passed ? { t: 'passou', c: 'pass' }
    : cur && !el.ok ? { t: 'fora', c: 'pass' } : null;
  return (
    <div className={`pd-rival ${leader ? 'leader' : ''} ${justWon ? 'won' : ''}`} style={{ '--pc': seatColor(pid) } as React.CSSProperties}>
      <div className="pd-rival-head">
        <PlayerAvatar pid={pid} name={p.name} size={24} />
        <b className="truncate">{p.name}</b>
        <span className="pd-money sm"><span className="coin">◐</span>{money(p.budget)}</span>
      </div>
      <div className="pd-rival-board">
        <RiftBoard roster={p.roster} s={s} compact />
        {badge && <span className={`pd-badge ${badge.c}`}>{badge.t}</span>}
      </div>
    </div>
  );
}

function LastSold({ s }: { s: AuctionState }) {
  const sold = s.sales.slice(-4).reverse();
  return (
    <div className="pd-list">
      <h4>Últimos arremates</h4>
      {sold.length ? sold.map(x => (
        <div key={x.champId} className="row anim-fade-up">
          <ChampImg id={x.champId} name={s.champions[x.champId].name} className="ic" />
          <span className="min-w-0 flex-1 truncate"><b>{getPlayer(s, x.playerId)?.name}</b> levou {s.champions[x.champId].name}</span>
          <b>{x.price ? fmt(x.price) : 'sobra'}</b>
        </div>
      )) : <p className="muted">Os arremates aparecem aqui.</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cartão central
function LotPanel({ s, me, last, now, pending, act }: {
  s: AuctionState; me: string | null; last?: LotResult;
  now: () => number; pending: boolean; act: (a: ClientAction) => void;
}) {
  const cur = s.current, rp = s.routePick;
  const id = cur?.champId ?? rp?.champId ?? last?.champId;
  const champ = id ? s.champions[id] : null;
  const card = useMemo(() => (champ ? buildCard(champ.id, champ.routes) : null), [champ]);
  if (!champ || !card) return <div className="pd-lot empty">Preparando o primeiro campeão…</div>;

  const show = s.config.showOverall !== false;
  const myValid = cur && me ? validRoles(s, me, champ.id) : null;
  const legendary = show && card.bestOvr >= 84;
  const name = (pid: string) => getPlayer(s, pid)?.name ?? '?';
  const bestRole = [...champ.routes].sort((a, b) => card.ovr[b] - card.ovr[a])[0];
  const bids = cur ? s.bids.filter(b => b.champId === cur.champId).slice(-2).reverse() : [];
  const passed = cur ? cur.passes.filter(p => p !== me).map(name) : [];

  let leaderLine: React.ReactNode = null, price = 0, ribbon: React.ReactNode = null;
  if (cur) {
    price = cur.highBid?.amount ?? s.config.minBid;
    leaderLine = cur.highBid
      ? <><b style={{ color: seatColor(cur.highBid.playerId) }}>{cur.highBid.playerId === me ? 'Você' : name(cur.highBid.playerId)}</b> lidera</>
      : <>Sem lances · abre por {fmt(s.config.minBid)}</>;
  } else if (rp) {
    price = rp.price;
    leaderLine = <><b style={{ color: seatColor(rp.playerId) }}>{name(rp.playerId)}</b> escolhe a rota…</>;
    ribbon = <span className="pd-ribbon sold">Vendido · {name(rp.playerId)}</span>;
  } else if (last?.type === 'placed' && last.champId === champ.id) {
    price = last.price;
    leaderLine = last.via === 'sobra' ? <>Sobra para <b>{name(last.playerId)}</b></> : <>Foi para <b style={{ color: seatColor(last.playerId) }}>{name(last.playerId)}</b></>;
    ribbon = <span className="pd-ribbon sold">{last.via === 'sobra' ? 'Sobra' : 'Vendido'} · {name(last.playerId)}</span>;
  } else if (last?.type === 'unsold' && last.champId === champ.id) {
    leaderLine = <>Ninguém deu lance</>;
    ribbon = <span className="pd-ribbon unsold">Sem comprador</span>;
  }

  return (
    <div className={`pd-lot ${legendary ? 'legendary' : ''} ${!cur ? 'closed' : ''}`}>
      <div key={`banner-${champ.id}`} className="pd-banner anim-reveal">
        <img src={`https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${champ.id}_0.jpg`} alt={champ.name} className="splash" />
        <div className="shade" />
        <div className="tags">
          {show && <span className="pd-ovr"><b>{card.ovr[bestRole]}</b><small>{ROLE_SHORT[bestRole]}</small></span>}
          <span className="pd-class">{CLASS_LABEL[card.champClass]}</span>
          {legendary && <span className="pd-legend">✦ Lendário</span>}
        </div>
        <div className="corner">
          {cur ? <ClockRing endsAt={cur.endsAt} total={s.config.bidTimeMs} now={now} />
            : rp ? <ClockRing endsAt={rp.deadline} total={s.config.routePickMs} now={now} label="rota" /> : null}
        </div>
        <div className="caption">
          <h2>{card.name}</h2>
          <p>{card.title}</p>
          <div className="pd-chips">
            {champ.routes.map(r => (
              <span key={r} className={`chip ${myValid ? (myValid.includes(r) ? 'ok' : 'no') : ''}`} title={myValid && !myValid.includes(r) ? 'Você já tem essa rota' : undefined}>
                {ROLE_LABEL[r]}{show && <b> {card.ovr[r]}</b>}
              </span>
            ))}
          </div>
        </div>
        {ribbon}
      </div>

      {show && (
        <div className="pd-attrs">
          {(Object.entries(card.attrs) as [string, number][]).map(([k, v]) => <span key={k}><b>{v}</b>{k}</span>)}
        </div>
      )}

      <div className="pd-price-box">
        <p className="pd-leader">{leaderLine}</p>
        <div key={price} className="pd-price anim-bump">{fmt(price)}</div>
        {(bids.length > 0 || passed.length > 0) && (
          <p className="pd-trail">
            {bids.slice(1).map(b => <span key={b.seq}>{name(b.playerId)} {fmt(b.amount)}</span>)}
            {passed.length > 0 && <span className="passed">✋ {passed.join(', ')} {passed.length === 1 ? 'passou' : 'passaram'}</span>}
          </p>
        )}
      </div>

      {me && cur && <BidControls key={`ctl-${cur.champId}`} s={s} me={me} pending={pending} act={act} />}
    </div>
  );
}

function ClockRing({ endsAt, total, now, label }: { endsAt: number; total: number; now: () => number; label?: string }) {
  const [left, setLeft] = useState(() => Math.max(0, endsAt - now()));
  const lastSec = useRef<number | null>(null);
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, endsAt - now())), 100);
    return () => clearInterval(id);
  }, [endsAt, now]);
  const secs = Math.ceil(left / 1000);
  // tique nos 3 segundos finais
  useEffect(() => {
    if (label || secs === lastSec.current) return;
    lastSec.current = secs;
    if (secs > 0 && secs <= 3) play(secs === 1 ? 'tickLast' : 'tick');
  }, [secs, label]);
  const frac = Math.max(0, Math.min(1, left / Math.max(total, 1)));
  const low = left < 3000;
  const R = 34, C = 2 * Math.PI * R;
  const call = label ?? (low ? ['Dou-lhe três!', 'Dou-lhe uma…', 'Dou-lhe duas…', 'Dou-lhe três!'][Math.min(3, Math.max(0, 4 - secs))] : 'em disputa');
  return (
    <div className={`pd-clock ${low ? 'low' : ''}`}>
      <svg viewBox="0 0 80 80" aria-hidden>
        <circle cx="40" cy="40" r={R} className="track" />
        <circle cx="40" cy="40" r={R} className="bar" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
      </svg>
      <b>{String(secs).padStart(2, '0')}</b>
      <small>{call}</small>
    </div>
  );
}

function BidControls({ s, me, pending, act }: { s: AuctionState; me: string; pending: boolean; act: (a: ClientAction) => void }) {
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
  const [custom, setCustom] = useState('');

  const bid = (amount: number) => { act({ type: 'bid', amount }); };
  const doPass = () => { act({ type: 'pass' }); };
  const customCents = Math.round(Number(custom.replace(',', '.')) * 100);
  const customOk = can && Number.isFinite(customCents) && customCents >= min && customCents <= max;

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
    <div className="pd-controls">
      <div className="row4">
        {quick.map(q => (
          <button key={q.key} className="q" disabled={!can || q.amount > max} onClick={() => bid(q.amount)}>
            {q.label}<kbd>{q.key}</kbd>
          </button>
        ))}
        <button className={`all ${confirmMax ? 'armed' : ''}`} disabled={!can || max < min}
          onClick={() => { if (confirmMax) { bid(max); setConfirmMax(false); } else setConfirmMax(true); }}>
          {confirmMax ? 'Confirmar?' : 'Tudo'} <small>{fmt(max)}</small><kbd>T</kbd>
        </button>
      </div>
      <form className="row2" onSubmit={e => { e.preventDefault(); if (customOk) { bid(customCents); setCustom(''); } }}>
        <input inputMode="decimal" placeholder="Outro valor" value={custom} onChange={e => setCustom(e.target.value.replace(/[^\d,.]/g, ''))} disabled={!can} aria-label="Outro valor em reais" />
        <button type="submit" className="give" disabled={!customOk}>Dar lance</button>
        <button type="button" className="pass" disabled={passed || leading || pending} onClick={doPass}>{passed ? 'Passou' : 'Passar'}<kbd>P</kbd></button>
      </form>
      <p className={`hint ${leading ? 'lead' : !el.ok ? 'bad' : ''}`}>
        {leading ? 'O maior lance é seu. Se ninguém cobrir, o campeão é seu.'
          : !el.ok ? el.reason
          : `Você pode ir até ${fmt(max)}. Lance no fim devolve ${Math.round(s.config.bidExtendMs / 1000)} segundos.`}
      </p>
    </div>
  );
}
