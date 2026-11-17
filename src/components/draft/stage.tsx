'use client';

// Tela do leilão no estilo do 100pracada: cartão central compacto (carta vertical da tela de carregamento
// do LoL, relógio em anel, preço grande, lances), seu time num mini Summoner's Rift à esquerda e os
// adversários em mini-mapas à direita.
//
// Desempenho: o estado chega como objeto novo a cada lance (structuredClone / realtime), então os blocos
// pesados (mini-mapas, carta, lista) são memoizados comparando só o que importa (assinatura do time etc.).
// O relógio anda por requestAnimationFrame escrevendo direto no SVG; o React só renderiza quando o
// segundo muda.
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  ROLES, type AuctionEvent, type AuctionState, type Champion, type Role, type RosterSlot, type Sale,
  bidEligibility, formatBRL as fmt, getPlayer, maxBid, minNextBid, validRoles,
} from '@/lib/auction/engine';
import type { ClientAction } from '@/lib/rooms/types';
import { buildCard, type ChampionCard } from '@/lib/champions/cards';
import { MINIMAP_URL } from '@/lib/match/map';
import { SKINS } from '@/lib/store/catalog';
import { isMuted, onMutedChange, play, setMuted } from '@/lib/sound';
import { Avatar, usePlayerAvatar } from '@/components/profile/Avatar';
import { ChampImg, ROLE_LABEL, ROLE_SHORT, seatColor } from './ui';
import './stage.css';

const money = (c: number) => fmt(c).replace('R$ ', '');
type LotResult = Extract<AuctionEvent, { type: 'placed' | 'unsold' }>;
type Placed = Extract<AuctionEvent, { type: 'placed' }>;
type Champs = Record<string, Champion>;

/** Overall a partir do qual o lote é "lendário". */
const LEGEND_OVR = 84;

/** Onde cada rota fica no mini-mapa (% da imagem). */
const ROLE_SPOT: Record<Role, { x: number; y: number }> = {
  TOP: { x: 17, y: 20 }, JUNGLE: { x: 33, y: 47 }, MID: { x: 50, y: 50 }, ADC: { x: 81, y: 82 }, SUPORTE: { x: 67, y: 85 },
};

// Cartas calculadas uma vez por campeão (buildCard faz contas com o JSON do Data Dragon).
const cardCache = new Map<string, ChampionCard>();
function cardOf(c: Champion): ChampionCard {
  let card = cardCache.get(c.id);
  if (!card) { card = buildCard(c.id, c.routes); cardCache.set(c.id, card); }
  return card;
}

/** Perfil resumido: só "Dano físico", "Dano mágico" ou "Tanque". */
function profileOf(card: ChampionCard): { label: string; cls: 'tank' | 'phys' | 'magic'; icon: string } {
  const { ATQ, MAG, DEF } = card.attrs;
  if (card.champClass === 'tanque' || (DEF >= 78 && DEF > Math.max(ATQ, MAG))) return { label: 'Tanque', cls: 'tank', icon: '⛨' };
  return ATQ >= MAG ? { label: 'Dano físico', cls: 'phys', icon: '⚔' } : { label: 'Dano mágico', cls: 'magic', icon: '✦' };
}

export const skinName = (champId: string, num?: number) =>
  num ? SKINS[champId]?.find(x => x.num === num)?.name ?? 'Skin rara' : null;

const loadingArt = (id: string, skin = 0) => `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${id}_${skin}.jpg`;

const rosterSig = (r: Partial<Record<Role, RosterSlot | null>>) =>
  ROLES.map(k => { const x = r[k]; return x ? `${x.champId}:${x.price}:${x.skin ?? 0}` : '-'; }).join('|');

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

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
  // Último resultado de lote (vendido/colocado OU sem comprador) e o instante do martelo.
  const { lastResult, flyDelay } = useMemo(() => {
    let res: LotResult | undefined, soldAt: number | undefined;
    for (let i = s.events.length - 1; i >= 0; i--) {
      const e = s.events[i];
      if (!res && (e.type === 'placed' || e.type === 'unsold')) res = e;
      if (res && e.type === 'sold' && e.champId === res.champId) { soldAt = e.at; break; }
      if (res && e.type === 'lot_start') break;
    }
    // Rota única: martelo e colocação no mesmo instante → a carta voa depois do carimbo.
    // Rota escolhida depois: o carimbo já apareceu, voa logo.
    const delay = res?.type === 'placed' && soldAt != null && soldAt !== res.at ? 120 : 620;
    return { lastResult: res, flyDelay: delay };
  }, [s.events]);
  // Só na pausa logo após a colocação (durante a escolha de rota o último "placed" é do lote anterior).
  const lastPlaced = !cur && !rp && lastResult?.type === 'placed' ? lastResult : undefined;
  const mine = me ? getPlayer(s, me) : null;
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
          {mine
            ? <MyTeam pid={mine.id} name={mine.name} budget={mine.budget} total={s.config.budget} roster={mine.roster} champs={s.champions}
                fresh={lastPlaced?.playerId === mine.id ? lastPlaced.role : null} arriveMs={flyDelay + 480} />
            : <div className="pd-box muted">Você está assistindo este leilão.</div>}
          <LastSold sales={s.sales} champs={s.champions} names={s.players} />
        </aside>

        <section className="pd-center">
          <LotPanel s={s} me={me} last={lastResult} flyDelay={flyDelay} now={serverTime} pending={pending} act={act} />
        </section>

        <aside className="pd-right">
          {s.players.filter(p => p.id !== me).map(p => {
            const leader = cur?.highBid?.playerId === p.id;
            const justWon = !cur && (lastPlaced?.playerId === p.id || rp?.playerId === p.id);
            const badge = leader ? { t: `lidera ${fmt(cur!.highBid!.amount)}`, c: 'lead' }
              : rp?.playerId === p.id ? { t: 'escolhendo a rota', c: 'won' }
              : justWon ? { t: lastPlaced!.price ? `levou por ${fmt(lastPlaced!.price)}` : 'levou de sobra', c: 'won' }
              : cur?.passes.includes(p.id) ? { t: 'passou', c: 'pass' }
              : cur && !bidEligibility(s, p.id).ok ? { t: 'fora', c: 'pass' } : null;
            return (
              <Rival key={p.id} pid={p.id} name={p.name} budget={p.budget} roster={p.roster} champs={s.champions}
                leader={leader} justWon={justWon} badgeT={badge?.t ?? null} badgeC={badge?.c ?? null}
                fresh={lastPlaced?.playerId === p.id ? lastPlaced.role : null} arriveMs={flyDelay + 480} />
            );
          })}
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
    const id = setInterval(() => setLeft(Math.ceil(Math.max(0, rp.deadline - now()) / 1000)), 250);
    return () => clearInterval(id);
  }, [rp.deadline, now]);
  const me = getPlayer(s, rp.playerId)!;
  return (
    <div className="pd-overlay">
      <div className="pd-route anim-reveal">
        <div className="pd-route-head">
          <ChampImg id={c.id} name={c.name} className={`ic ${rp.skin ? 'pd-skinglow' : ''}`} />
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
              <div key={r} className={`spot ${owned ? 'filled' : ''} ${slot?.skin ? 'skin' : ''}`} style={{ left: `${at.x}%`, top: `${at.y}%` }}>
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
// Sons do leilão: novo lote, lances, arremate (no martelo, não na escolha de rota), passes.
function useAuctionSounds(s: AuctionState, me: string | null) {
  const prev = useRef<{ seq: number; lot: number | null; result: string | null; leader: string | null; passes: number } | null>(null);
  useEffect(() => {
    let res: Extract<AuctionEvent, { type: 'sold' | 'unsold' }> | undefined;
    for (let i = s.events.length - 1; i >= 0 && !res; i--) {
      const e = s.events[i];
      if (e.type === 'sold' || e.type === 'unsold') res = e;
    }
    const now = {
      seq: s.seq, lot: s.current?.index ?? null, result: res ? `${res.type}:${res.champId}` : null,
      leader: s.current?.highBid?.playerId ?? null, passes: s.current?.passes.length ?? 0,
    };
    const p = prev.current;
    prev.current = now;
    if (!p) return;
    if (res && now.result !== p.result) {
      play(res.type === 'unsold' ? 'unsold' : res.playerId === me ? 'win' : 'sold');
    } else if (now.lot !== p.lot && now.lot != null) {
      const c = s.champions[s.current!.champId];
      play(s.config.showOverall !== false && cardOf(c).bestOvr >= LEGEND_OVR ? 'legend' : 'lot');
    } else if (now.seq > p.seq && now.lot === p.lot) {
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
interface BoardProps {
  roster: Partial<Record<Role, RosterSlot | null>>; champs: Champs; compact?: boolean; accent?: string;
  fresh?: Role | null; arriveMs?: number;
}
const RiftBoard = memo(function RiftBoard({ roster, champs, compact = false, accent, fresh, arriveMs = 1100 }: BoardProps) {
  return (
    <div className={`pd-rift ${compact ? 'compact' : ''}`} style={accent ? { '--acc': accent } as React.CSSProperties : undefined}>
      <img src={MINIMAP_URL} alt="" className="map" />
      {ROLES.map(r => {
        const slot = roster[r];
        const c = slot ? champs[slot.champId] : null;
        const at = ROLE_SPOT[r];
        const arrive = c && fresh === r;
        const sk = slot?.skin ? skinName(slot.champId, slot.skin) : null;
        return (
          <div key={r} className={`spot ${c ? 'filled' : ''} ${slot?.skin ? 'skin' : ''} ${arrive ? 'arrive' : ''}`}
            style={{ left: `${at.x}%`, top: `${at.y}%`, ...(arrive ? { '--arrive': `${arriveMs}ms` } : {}) } as React.CSSProperties}
            title={`${ROLE_LABEL[r]}${c ? `: ${c.name}${sk ? ` (${sk})` : ''} · ${slot!.price ? fmt(slot!.price) : 'sobra'}` : ' (vaga aberta)'}`}>
            {c ? <ChampImg key={c.id} id={c.id} name={c.name} className="ic" /> : <span className="role">{ROLE_SHORT[r]}</span>}
            {c && !compact && <span className="price">{slot!.price ? money(slot!.price) : 'sobra'}</span>}
          </div>
        );
      })}
    </div>
  );
}, (a, b) => a.compact === b.compact && a.accent === b.accent && a.fresh === b.fresh && a.arriveMs === b.arriveMs && rosterSig(a.roster) === rosterSig(b.roster));

interface MyTeamProps {
  pid: string; name: string; budget: number; total: number; roster: Record<Role, RosterSlot | null>; champs: Champs;
  fresh: Role | null; arriveMs: number;
}
const MyTeam = memo(function MyTeam({ pid, name, budget, total, roster, champs, fresh, arriveMs }: MyTeamProps) {
  const open = ROLES.filter(r => !roster[r]).length;
  const spentPct = Math.round(((total - budget) / total) * 100);
  return (
    <div className="pd-me">
      <div className="pd-me-head">
        <PlayerAvatar pid={pid} name={name} />
        <div className="min-w-0 flex-1"><b className="truncate">{name}</b><small>VOCÊ</small></div>
        <span key={budget} className="pd-money anim-bump"><span className="coin">◐</span>{fmt(budget)}</span>
      </div>
      <div className="pd-budget" title={`Gastou ${spentPct}%`}><span style={{ width: `${100 - spentPct}%` }} /></div>
      <p className="pd-sub">
        <span>{fmt(budget)} para {open} vaga{open === 1 ? '' : 's'}</span>
        {open > 0 && <span>média de {fmt(Math.floor(budget / open / 100) * 100)} por vaga</span>}
      </p>
      <div className="pd-board-hit" data-pd-board={pid}>
        <RiftBoard roster={roster} champs={champs} accent={seatColor(pid)} fresh={fresh} arriveMs={arriveMs} />
      </div>
      <p className="pd-count">{5 - open}/5 campeões</p>
    </div>
  );
}, (a, b) => a.pid === b.pid && a.name === b.name && a.budget === b.budget && a.total === b.total && a.fresh === b.fresh
  && a.arriveMs === b.arriveMs && rosterSig(a.roster) === rosterSig(b.roster));

interface RivalProps {
  pid: string; name: string; budget: number; roster: Record<Role, RosterSlot | null>; champs: Champs;
  leader: boolean; justWon: boolean; badgeT: string | null; badgeC: string | null; fresh: Role | null; arriveMs: number;
}
const Rival = memo(function Rival({ pid, name, budget, roster, champs, leader, justWon, badgeT, badgeC, fresh, arriveMs }: RivalProps) {
  return (
    <div className={`pd-rival ${leader ? 'leader' : ''} ${justWon ? 'won' : ''}`} style={{ '--pc': seatColor(pid) } as React.CSSProperties}>
      <div className="pd-rival-head">
        <PlayerAvatar pid={pid} name={name} size={24} />
        <b className="truncate">{name}</b>
        <span className="pd-money sm"><span className="coin">◐</span>{money(budget)}</span>
      </div>
      <div className="pd-rival-board" data-pd-board={pid}>
        <RiftBoard roster={roster} champs={champs} compact fresh={fresh} arriveMs={arriveMs} />
        {badgeT && <span key={badgeT} className={`pd-badge ${badgeC}`}>{badgeT}</span>}
      </div>
    </div>
  );
}, (a, b) => a.pid === b.pid && a.name === b.name && a.budget === b.budget && a.leader === b.leader && a.justWon === b.justWon
  && a.badgeT === b.badgeT && a.badgeC === b.badgeC && a.fresh === b.fresh && a.arriveMs === b.arriveMs
  && rosterSig(a.roster) === rosterSig(b.roster));

const LastSold = memo(function LastSold({ sales, champs, names }: { sales: Sale[]; champs: Champs; names: { id: string; name: string }[] }) {
  const sold = sales.slice(-4).reverse();
  return (
    <div className="pd-list">
      <h4>Últimos arremates</h4>
      {sold.length ? sold.map(x => (
        <div key={x.champId} className="row anim-fade-up">
          <ChampImg id={x.champId} name={champs[x.champId].name} className={`ic ${x.skin ? 'pd-skinglow' : ''}`} />
          <span className="min-w-0 flex-1 truncate">
            <b>{names.find(p => p.id === x.playerId)?.name}</b> levou {champs[x.champId].name}{x.skin ? <em className="pd-skin-mini"> ✦ skin</em> : null}
          </span>
          <b>{x.price ? fmt(x.price) : 'sobra'}</b>
        </div>
      )) : <p className="muted">Os arremates aparecem aqui.</p>}
    </div>
  );
}, (a, b) => a.sales.length === b.sales.length);

// ---------------------------------------------------------------------------
// Carta vertical (tela de carregamento do LoL)
const LoLCard = memo(function LoLCard({ id, name, title, skin, ovr, ovrRole, legendary }: {
  id: string; name: string; title: string; skin?: number; ovr: number | null; ovrRole: Role; legendary: boolean;
}) {
  // 0 = arte da skin (ou padrão), 1 = arte padrão (skin não carregou), 2 = iniciais
  const [lvl, setLvl] = useState(0);
  const sk = skinName(id, skin);
  return (
    <div className={`pd-carta ${legendary ? 'legend' : ''} ${skin ? 'has-skin' : ''}`}>
      <div className="frame">
        {lvl === 2
          ? <div className="art img-fallback">{name.slice(0, 2).toUpperCase()}</div>
          : <img className="art" src={loadingArt(id, lvl === 0 ? skin : 0)} alt={name} draggable={false}
              onError={() => setLvl(l => (skin && l === 0 ? 1 : 2))} />}
        {skin ? <span className="holo" aria-hidden /> : null}
        <span className="sheen" aria-hidden />
        {ovr != null && <span className="ovr"><b>{ovr}</b><small>{ROLE_SHORT[ovrRole]}</small></span>}
        {legendary && <span className="legend-tag">✦ Lendário</span>}
        <div className="plate">
          <h2>{name}</h2>
          <p>{sk ?? title}</p>
        </div>
        <span className="gem" aria-hidden />
      </div>
    </div>
  );
});

// Partículas do arremate (fixas: nada de aleatório durante a renderização)
const SPARKS = Array.from({ length: 28 }, (_, i) => ({
  a: Math.round(i * (360 / 28) + ((i * 53) % 17) - 8),
  d: 80 + ((i * 37) % 90),
  s: ((i * 7) % 5) * 25,
  z: 4 + (i % 4) * 2,
}));

type Status = 'live' | 'sold' | 'placed' | 'unsold' | 'idle';

// Cartão central
function LotPanel({ s, me, last, flyDelay, now, pending, act }: {
  s: AuctionState; me: string | null; last?: LotResult; flyDelay: number;
  now: () => number; pending: boolean; act: (a: ClientAction) => void;
}) {
  const cur = s.current, rp = s.routePick;
  const id = cur?.champId ?? rp?.champId ?? last?.champId;
  const champ = id ? s.champions[id] : null;
  const card = champ ? cardOf(champ) : null;
  const lotRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<{ id: string; st: Status } | null>(null);

  const placed: Placed | undefined = !cur && !rp && last?.type === 'placed' && last.champId === id ? last : undefined;
  const status: Status = cur ? 'live' : rp ? 'sold' : placed ? 'placed' : last?.type === 'unsold' && last.champId === id ? 'unsold' : 'idle';
  const buyer = rp?.playerId ?? placed?.playerId ?? null;
  const skin = cur?.skin ?? rp?.skin ?? (placed ? getPlayer(s, placed.playerId)?.roster[placed.role]?.skin : undefined);

  // A carta voa para o mini-mapa de quem comprou.
  useEffect(() => {
    const prevSt = statusRef.current && statusRef.current.id === id ? statusRef.current.st : null;
    statusRef.current = id ? { id, st: status } : null;
    if (status !== 'placed' || prevSt === 'placed' || !buyer || reducedMotion()) return;
    const el = cardRef.current;
    const target = document.querySelector<HTMLElement>(`[data-pd-board="${buyer}"]`);
    if (!el || !target || typeof el.animate !== 'function') return;
    const a = el.getBoundingClientRect(), b = target.getBoundingClientRect();
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const sc = Math.max(0.12, Math.min(0.45, (b.width / a.width) * 0.45));
    el.animate([
      { transform: 'none', opacity: 1, offset: 0 },
      { transform: `translate(${dx * 0.08}px, ${dy * 0.08 - 26}px) scale(.86) rotate(-3deg)`, opacity: 1, offset: 0.28 },
      { transform: `translate(${dx}px, ${dy}px) scale(${sc}) rotate(-12deg)`, opacity: 0.15, offset: 1 },
    ], { duration: 520, delay: flyDelay, easing: 'cubic-bezier(.5,0,.75,.35)', fill: 'forwards' });
    target.animate([
      { transform: 'scale(1)', filter: 'brightness(1)' },
      { transform: 'scale(1.05)', filter: 'brightness(1.35) drop-shadow(0 0 14px rgba(240, 200, 90, .9))' },
      { transform: 'scale(1)', filter: 'brightness(1)' },
    ], { duration: 520, delay: flyDelay + 440, easing: 'ease-out' });
  }, [id, status, buyer, flyDelay]);

  if (!champ || !card) return <div className="pd-lot empty">Preparando o primeiro campeão…</div>;

  const show = s.config.showOverall !== false;
  const myValid = cur && me ? validRoles(s, me, champ.id) : null;
  const legendary = show && card.bestOvr >= LEGEND_OVR;
  const name = (pid: string) => getPlayer(s, pid)?.name ?? '?';
  const bestRole = [...champ.routes].sort((a, b) => card.ovr[b] - card.ovr[a])[0];
  const prof = profileOf(card);
  const sk = skinName(champ.id, skin);
  const isMine = buyer != null && buyer === me;

  const bids: typeof s.bids = [];
  if (cur) for (let i = s.bids.length - 1; i >= 0 && bids.length < 3; i--) if (s.bids[i].champId === cur.champId) bids.push(s.bids[i]);
  const top = bids[0];
  const plus = top ? top.amount - (bids[1]?.amount ?? 0) : 0;
  const passed = cur ? cur.passes.filter(p => p !== me).map(name) : [];

  let leaderLine: React.ReactNode = null, price = 0;
  if (cur) {
    price = cur.highBid?.amount ?? s.config.minBid;
    leaderLine = cur.highBid
      ? <><b style={{ color: seatColor(cur.highBid.playerId) }}>{cur.highBid.playerId === me ? 'Você' : name(cur.highBid.playerId)}</b> lidera</>
      : <>Sem lances · abre por {fmt(s.config.minBid)}</>;
  } else if (rp) {
    price = rp.price;
    leaderLine = <><b style={{ color: seatColor(rp.playerId) }}>{rp.playerId === me ? 'Você' : name(rp.playerId)}</b> escolhe a rota…</>;
  } else if (placed) {
    price = placed.price;
    leaderLine = <>Foi para <b style={{ color: seatColor(placed.playerId) }}>{placed.playerId === me ? 'você' : name(placed.playerId)}</b></>;
  } else if (status === 'unsold') {
    leaderLine = <>Ninguém deu lance</>;
  }
  const closedSold = status === 'sold' || status === 'placed';

  return (
    <div ref={lotRef} className={`pd-lot ${legendary ? 'legendary' : ''} ${cur ? '' : 'closed'} pd-st-${status} ${isMine ? 'mine' : ''}`}>
      <div className="pd-lot-body">
        <div key={`carta-${champ.id}`} className={`pd-carta-wrap ${legendary ? 'aura' : ''} ${status === 'unsold' ? 'dim' : ''}`}>
          <div ref={cardRef} className="pd-carta-fly">
            <LoLCard id={champ.id} name={card.name} title={card.title} skin={skin} ovr={show ? card.ovr[bestRole] : null} ovrRole={bestRole} legendary={legendary} />
            {/* o carimbo fica na carta e voa junto com ela */}
            {closedSold && buyer && (
              <div className={`pd-stamp ${isMine ? 'me' : ''}`}>
                <b>{isMine ? 'É seu!' : 'Vendido'}</b>
                <small>{isMine ? 'Você' : name(buyer)} · {fmt(price)}</small>
              </div>
            )}
          </div>
          {closedSold && buyer && (
            <div className={`pd-burst ${isMine ? 'big' : ''}`} aria-hidden>
              <span className="ring" />
              {SPARKS.slice(0, isMine ? 28 : 16).map((p, i) => (
                <i key={i} style={{ '--a': `${p.a}deg`, '--d': `${isMine ? p.d * 1.5 : p.d}px`, '--w': `${p.s}ms`, '--z': `${p.z}px` } as React.CSSProperties} />
              ))}
            </div>
          )}
          {status === 'unsold' && <div className="pd-stamp none"><b>Sem comprador</b></div>}
        </div>

        <div className="pd-info">
          <div className="pd-info-top">
            {cur ? <ClockRing endsAt={cur.endsAt} total={s.config.bidTimeMs} now={now} pulse={lotRef} />
              : rp ? <ClockRing endsAt={rp.deadline} total={s.config.routePickMs} now={now} label="rota" /> : null}
            <div className="pd-tags">
              <span className={`pd-prof ${prof.cls}`}><i aria-hidden>{prof.icon}</i>{prof.label}</span>
              {sk && <span className="pd-skin">✦ SKIN: {sk}</span>}
            </div>
          </div>

          <div className="pd-chips">
            {champ.routes.map(r => (
              <span key={r} className={`chip ${myValid ? (myValid.includes(r) ? 'ok' : 'no') : ''}`} title={myValid && !myValid.includes(r) ? 'Você já tem essa rota' : undefined}>
                {ROLE_LABEL[r]}{show && <b> {card.ovr[r]}</b>}
              </span>
            ))}
          </div>

          <div className="pd-price-box">
            <p className="pd-leader">{leaderLine}</p>
            <div className="pd-price-wrap">
              <div key={price} className="pd-price anim-bump">{fmt(price)}</div>
              {cur && top && (
                <span key={top.seq} className="pd-plus" style={{ color: seatColor(top.playerId) }}>+{fmt(plus)}</span>
              )}
            </div>
            {(bids.length > 1 || passed.length > 0) && (
              <p className="pd-trail">
                {bids.slice(1).map(b => <span key={b.seq}>{name(b.playerId)} {fmt(b.amount)}</span>)}
                {passed.length > 0 && <span className="passed">✋ {passed.join(', ')} {passed.length === 1 ? 'passou' : 'passaram'}</span>}
              </p>
            )}
          </div>

          {me && cur && <BidControls key={`ctl-${cur.champId}`} s={s} me={me} pending={pending} act={act} />}
        </div>
      </div>
      {isMine && closedSold && <div key={`flash-${champ.id}`} className="pd-flash" aria-hidden />}
    </div>
  );
}

/** Relógio em anel: anda por requestAnimationFrame (sem renderizar a tela); o React só vê o segundo mudar. */
const ClockRing = memo(function ClockRing({ endsAt, total, now, label, pulse }: {
  endsAt: number; total: number; now: () => number; label?: string; pulse?: React.RefObject<HTMLDivElement | null>;
}) {
  const R = 34, C = 2 * Math.PI * R;
  const barRef = useRef<SVGCircleElement>(null);
  const [secs, setSecs] = useState(() => Math.ceil(Math.max(0, endsAt - now()) / 1000));
  const lastSec = useRef<number | null>(null);
  useEffect(() => {
    let raf = 0, last = -1;
    const loop = () => {
      const left = Math.max(0, endsAt - now());
      const frac = Math.max(0, Math.min(1, left / Math.max(total, 1)));
      if (barRef.current) barRef.current.style.strokeDashoffset = String(C * (1 - frac));
      const sec = Math.ceil(left / 1000);
      if (sec !== last) { last = sec; setSecs(sec); }
      if (left > 0) raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [endsAt, total, now, C]);
  const low = !label && secs > 0 && secs <= 3;
  // tique nos 3 segundos finais + pulso no cartão
  useEffect(() => {
    pulse?.current?.classList.toggle('pd-final', low);
    if (label || secs === lastSec.current) return;
    lastSec.current = secs;
    if (secs > 0 && secs <= 3) play(secs === 1 ? 'tickLast' : 'tick');
  }, [secs, label, low, pulse]);
  useEffect(() => () => { pulse?.current?.classList.remove('pd-final'); }, [pulse]);
  const call = label ?? (low ? ['Dou-lhe três!', 'Dou-lhe uma…', 'Dou-lhe duas…', 'Dou-lhe três!'][Math.min(3, Math.max(0, 4 - secs))] : 'em disputa');
  return (
    <div className={`pd-clock ${low ? 'low' : ''}`}>
      <svg viewBox="0 0 80 80" aria-hidden>
        <circle cx="40" cy="40" r={R} className="track" />
        <circle ref={barRef} cx="40" cy="40" r={R} className="bar" strokeDasharray={C} />
      </svg>
      <b key={low ? secs : 'n'}>{String(secs).padStart(2, '0')}</b>
      <small>{call}</small>
    </div>
  );
});

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
  useEffect(() => { latest.current = { can, max, min, quick, passed, leading }; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
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
