'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { CATALOG, isFreeItem, profileIconUrl, skinLoadingUrl, skinSplashUrl, type ItemKind, type StoreItem } from '@/lib/store/catalog';
import { RARITY_COLOR, RARITY_LABEL, RARITY_ORDER, isForSale, normalize } from '@/lib/store/rules';
import { NAME_CHANGE_PRICE } from '@/lib/progress/rewards';
import { EssenceAmount, EssenceIcon } from '@/components/header/EssenceIcon';
import { buyItemAction } from './actions';
import { BetaBanner } from './BetaBanner';
import { VictoryEffect } from '@/components/match/VictoryEffect';
import { isVictoryFx } from '@/components/match/victory-fx';
import '@/components/match/match.css';
import '@/components/profile/cosmetics.css';

export interface StoreProps {
  loggedIn: boolean;
  isGuest: boolean;
  ready: boolean;
  vip: boolean;
  balance: number;
  owned: string[];
  betaClaimable: boolean;
  nameTokens: number;
  champNames: Record<string, string>;
  avatar: string;
}

type Tab = Exclude<ItemKind, 'banner'>;
const TABS: { id: Tab; label: string }[] = [
  { id: 'skin', label: 'Skins' },
  { id: 'icon', label: 'Ícones' },
  { id: 'border', label: 'Bordas' },
  { id: 'theme', label: 'Temas' },
  { id: 'victory', label: 'Efeitos de vitória' },
  { id: 'title', label: 'Títulos' },
  { id: 'service', label: 'Serviços' },
];
const PAGE = 48;
const byKind = (k: ItemKind) => CATALOG.filter(i => i.kind === k);
const iconNum = (id: string) => Number(id.slice(5));

/** Nomes dos ícones (5 mil): baixados só quando a aba de ícones abre. */
type IconNames = Map<number, { name: string; year: number }>;
let iconNamesCache: Promise<IconNames> | null = null;
const loadIconNames = () => (iconNamesCache ??= import('@/lib/store/icons.json').then(m =>
  new Map((m.default as [number, string, number][]).map(([id, name, year]) => [id, { name, year }]))));

export function StoreView(p: StoreProps) {
  const [tab, setTab] = useState<Tab>('skin');
  const [balance, setBalance] = useState(p.balance);
  const [owned, setOwned] = useState(() => new Set(p.owned));
  const [beta] = useState(p.betaClaimable);
  const [preview, setPreview] = useState<StoreItem | null>(null);
  const [q, setQ] = useState('');
  const [rarity, setRarity] = useState<StoreItem['rarity'] | ''>('');
  const [champ, setChamp] = useState('');
  const [hideOwned, setHideOwned] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [iconNames, setIconNames] = useState<IconNames | null>(null);
  useEffect(() => {
    if (tab === 'icon' && !iconNames) loadIconNames().then(setIconNames).catch(() => {});
  }, [tab, iconNames]);

  useEffect(() => { setBalance(p.balance); setOwned(new Set(p.owned)); }, [p.balance, p.owned]);
  useEffect(() => { setLimit(PAGE); }, [tab, q, rarity, champ, hideOwned]);

  const closePreview = useCallback(() => setPreview(null), []);
  const has = (id: string) => owned.has(id) || isFreeItem(id);
  const champs = useMemo(
    () => Object.entries(p.champNames).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')),
    [p.champNames],
  );

  const items = useMemo(() => {
    let list = byKind(tab);
    if (tab === 'skin') {
      const t = normalize(q.trim());
      list = list.filter(i =>
        (!champ || i.champId === champ) &&
        (!t || normalize(i.name).includes(t) || normalize(p.champNames[i.champId ?? ''] ?? '').includes(t)));
    }
    if (tab === 'icon') {
      if (iconNames) {
        list = list.map(i => ({ ...i, name: iconNames.get(iconNum(i.id))?.name ?? i.name }))
          .sort((a, b) => (iconNames.get(iconNum(b.id))?.year ?? 0) - (iconNames.get(iconNum(a.id))?.year ?? 0) || iconNum(b.id) - iconNum(a.id));
      }
      const t = normalize(q.trim());
      if (t) list = list.filter(i => normalize(i.name).includes(t) || i.id.slice(5) === t);
    }
    if (rarity) list = list.filter(i => i.rarity === rarity);
    if (hideOwned) list = list.filter(i => !owned.has(i.id) && !isFreeItem(i.id));
    return list;
  }, [tab, q, champ, rarity, hideOwned, owned, p.champNames, iconNames]);

  const onBought = (item: StoreItem, newBalance: number) => {
    setBalance(newBalance);
    setOwned(prev => new Set(prev).add(item.id));
  };

  return (
    <div className="st-root">
      <section className="st-hero">
        <div className="st-hero-art" aria-hidden />
        <div className="relative min-w-0">
          <p className="st-hero-eyebrow">Loja do Invocador</p>
          <h1 className="text-3xl font-black text-white sm:text-4xl">Loja</h1>
          <p className="mt-1 max-w-xl text-sm text-[#d9d5ff]">
            Tudo aqui é comprado com <b>Essência Azul</b>, ganha jogando campeonatos. Só visual: nada muda o leilão nem as partidas.
          </p>
        </div>
        <div className="st-balance">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#9fc6ff]">Seu saldo</span>
          {p.loggedIn && p.ready ? <EssenceAmount value={balance} size={24} className="text-2xl text-white" /> : <span className="font-bold text-white/80">—</span>}
        </div>
      </section>

      {!p.loggedIn && (
        <p className="st-note">Você está só olhando. <Link href="/cadastro" className="font-black underline">Crie uma conta</Link> ou <Link href="/entrar" className="font-black underline">entre</Link> para ganhar essência e comprar.</p>
      )}
      {p.loggedIn && p.isGuest && (
        <p className="st-note">Convidados podem jogar, mas não guardam essência nem itens. <Link href="/cadastro" className="font-black underline">Crie sua conta grátis</Link> para começar a colecionar.</p>
      )}
      {p.loggedIn && !p.ready && !p.isGuest && (
        <p className="st-note">A loja está sendo preparada. Seu saldo e seus itens aparecem aqui em breve.</p>
      )}

      {beta && <BetaBanner onClaimed={b => setBalance(b)} />}

      <div className="st-tabs" role="tablist">
        {TABS.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => { setTab(t.id); setQ(''); setRarity(''); }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab !== 'service' && (
        <div className="st-filters">
          {tab === 'icon' && (
            <input className="input st-search" placeholder="Buscar ícone (ex.: Diana, Mundial, K/DA)…" value={q} onChange={e => setQ(e.target.value)} />
          )}
          {tab === 'skin' && (
            <>
              <input className="input st-search" placeholder="Buscar skin ou campeão…" value={q} onChange={e => setQ(e.target.value)} />
              <select className="input st-select" value={champ} onChange={e => setChamp(e.target.value)} aria-label="Campeão">
                <option value="">Todos os campeões</option>
                {champs.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </>
          )}
          <div className="st-chips">
            <button className={rarity === '' ? 'on' : ''} onClick={() => setRarity('')}>Todas</button>
            {RARITY_ORDER.filter(r => byKind(tab).some(i => i.rarity === r)).map(r => (
              <button key={r} className={rarity === r ? 'on' : ''} style={{ '--rc': RARITY_COLOR[r] } as CSSProperties} onClick={() => setRarity(r)}>
                <i />{RARITY_LABEL[r]}
              </button>
            ))}
          </div>
          {p.loggedIn && (
            <label className="st-toggle"><input type="checkbox" checked={hideOwned} onChange={e => setHideOwned(e.target.checked)} /> Ocultar os que possuo</label>
          )}
        </div>
      )}

      {tab === 'service' ? (
        <Services tokens={p.nameTokens} loggedIn={p.loggedIn} />
      ) : (
        <>
          <p className="mb-3 text-xs font-bold text-muted">{items.length.toLocaleString('pt-BR')} {items.length === 1 ? 'item' : 'itens'}</p>
          <div className={`st-grid st-grid-${tab}`}>
            {items.slice(0, limit).map(item => (
              <ItemCard key={item.id} item={item} owned={has(item.id)} champName={p.champNames[item.champId ?? '']} avatar={p.avatar} onOpen={() => setPreview(item)} />
            ))}
          </div>
          {items.length === 0 && <p className="py-12 text-center text-sm text-muted">Nada encontrado com esses filtros.</p>}
          {items.length > limit && (
            <div className="mt-6 text-center"><button className="btn-secondary" onClick={() => setLimit(l => l + PAGE)}>Mostrar mais</button></div>
          )}
        </>
      )}

      {preview && (
        <Preview
          item={preview} owned={has(preview.id)} balance={balance} props={p}
          champName={p.champNames[preview.champId ?? '']}
          onClose={closePreview} onBought={b => onBought(preview, b)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function tilt(e: MouseEvent<HTMLElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top) / r.height - 0.5;
  el.style.setProperty('--rx', `${(-y * 12).toFixed(2)}deg`);
  el.style.setProperty('--ry', `${(x * 14).toFixed(2)}deg`);
  el.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(1)}%`);
  el.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(1)}%`);
}
function untilt(e: MouseEvent<HTMLElement>) {
  const s = e.currentTarget.style;
  s.setProperty('--rx', '0deg'); s.setProperty('--ry', '0deg');
}

function PriceTag({ item, owned }: { item: StoreItem; owned: boolean }) {
  if (owned) return <span className="st-owned">✓ Possui</span>;
  if (item.vipOnly) return <span className="st-viptag">VIP</span>;
  if (!isForSale(item)) return <span className="st-achv">Conquista</span>;
  return <EssenceAmount value={item.price} size={14} className="text-[13px] text-[#174a9c]" />;
}

function ItemCard({ item, owned, champName, avatar, onOpen }: { item: StoreItem; owned: boolean; champName?: string; avatar: string; onOpen: () => void }) {
  return (
    <button
      type="button" onClick={onOpen} onMouseMove={tilt} onMouseLeave={untilt}
      className={`st-card ${owned ? 'is-owned' : ''}`} style={{ '--rc': RARITY_COLOR[item.rarity] } as CSSProperties}
      title={item.name}
    >
      <div className="st-card-in">
        <div className="st-art"><Art item={item} avatar={avatar} /></div>
        <div className="st-shine" aria-hidden />
        <div className="st-info">
          <span className="st-rarity">{RARITY_LABEL[item.rarity]}</span>
          <span className="st-name">{item.name}</span>
          {item.kind === 'skin' && champName && <span className="st-sub">{champName}</span>}
          <span className="st-price"><PriceTag item={item} owned={owned} /></span>
        </div>
      </div>
    </button>
  );
}

/** Arte do item (carta e prévia). */
function Art({ item, avatar, big = false }: { item: StoreItem; avatar: string; big?: boolean }) {
  const key = item.id.split(':')[1];
  switch (item.kind) {
    case 'skin':
      return <img src={big ? skinSplashUrl(item.champId!, item.skinNum) : skinLoadingUrl(item.champId!, item.skinNum)} alt="" loading="lazy" className="st-img" />;
    case 'icon':
      return <img src={profileIconUrl(iconNum(item.id))} alt="" loading="lazy" className="st-icon" />;
    case 'border':
      return (
        <span className={`st-bd cos-border-${key}`}>
          <img src={avatar} alt="" className="st-bd-av" />
        </span>
      );
    case 'theme':
      return <span className={`st-th cos-theme-${key}`}><i /><i /><i /></span>;
    case 'victory':
      if (big && isVictoryFx(item.id)) {
        return (
          <span className="st-fx st-fx-live">
            <VictoryEffect kind={item.id} color="#6d63db" />
            <b>Vitória!</b>
          </span>
        );
      }
      return (
        <span className={`st-fx st-fx-${key}`}>
          {Array.from({ length: 14 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}
          <b>Vitória!</b>
        </span>
      );
    case 'title':
      return <span className="st-tt"><span className={`st-title cos-title cos-title-${key}`}>{item.name}</span></span>;
    default:
      return null;
  }
}

function Preview({ item, owned, balance, props, champName, onClose, onBought }: {
  item: StoreItem; owned: boolean; balance: number; props: StoreProps; champName?: string;
  onClose: () => void; onBought: (balance: number) => void;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const forSale = isForSale(item);
  const short = item.price - balance;
  const buy = () => start(async () => {
    setMsg(undefined);
    const r = await buyItemAction(item.id);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: r.message ?? 'Comprado!' });
    onBought(r.balance);
  });

  let action: ReactNode;
  if (owned) action = <span className="st-owned st-owned-lg">✓ Você possui este item</span>;
  else if (item.vipOnly) action = <Link href="/vip" className="st-btn-gold">Liberado com VIP</Link>;
  else if (!forSale) action = <span className="st-achv st-achv-lg">{item.description ?? 'Conquista especial'}</span>;
  else if (!props.loggedIn) action = <Link href="/entrar?next=/loja" className="btn-primary">Entre para comprar</Link>;
  else if (props.isGuest) action = <Link href="/cadastro" className="btn-primary">Crie uma conta para comprar</Link>;
  else if (!props.ready) action = <span className="st-achv st-achv-lg">Loja em preparação</span>;
  else action = (
    <button className="st-btn-buy" disabled={pending || short > 0} onClick={buy}>
      <EssenceIcon size={18} />
      {pending ? 'Comprando…' : short > 0 ? `Faltam ${short.toLocaleString('pt-BR')}` : `Comprar por ${item.price.toLocaleString('pt-BR')}`}
    </button>
  );

  return (
    <div className="st-modal" role="dialog" aria-modal="true" aria-label={item.name} onClick={onClose}>
      <div className={`st-pv st-pv-${item.kind} anim-reveal`} style={{ '--rc': RARITY_COLOR[item.rarity] } as CSSProperties} onClick={e => e.stopPropagation()}>
        <button ref={closeRef} className="st-x" onClick={onClose} aria-label="Fechar">✕</button>
        <div className="st-pv-art"><Art item={item} avatar={props.avatar} big /></div>
        <div className="st-pv-body">
          <span className="st-rarity st-rarity-lg">{RARITY_LABEL[item.rarity]}</span>
          <h2 className="text-2xl font-black text-gold2">{item.name}</h2>
          {champName && <p className="text-sm font-bold text-muted">{champName}</p>}
          {item.description && forSale && <p className="text-sm text-muted">{item.description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-3">{action}</div>
          {msg && <p className={msg.ok ? 'st-ok' : 'alert-error mt-3'}>{msg.text}</p>}
          {msg?.ok && <p className="mt-1 text-xs text-muted">Equipe no seu <Link href="/perfil" className="font-bold underline">perfil</Link>.</p>}
        </div>
      </div>
    </div>
  );
}

function Services({ tokens, loggedIn }: { tokens: number; loggedIn: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="st-service">
        <span className="st-service-ic" aria-hidden>✎</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-black text-gold2">Troca de nome</h3>
          <p className="text-sm text-muted">Muda seu nome de invocador. A troca é feita no seu perfil.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <EssenceAmount value={NAME_CHANGE_PRICE} size={18} className="text-lg text-[#174a9c]" />
            {loggedIn && tokens > 0 && <span className="st-owned">{tokens} troca{tokens > 1 ? 's' : ''} grátis</span>}
          </div>
          <Link href="/perfil" className="btn-secondary mt-4">Ir para o perfil</Link>
        </div>
      </div>
      <div className="st-service st-service-soon">
        <span className="st-service-ic" aria-hidden>★</span>
        <div>
          <h3 className="text-lg font-black text-gold2">Mais essência com VIP</h3>
          <p className="text-sm text-muted">Convide amigos e ganhe dias de VIP: +25% de essência por campeonato e itens exclusivos.</p>
          <Link href="/vip" className="btn-secondary mt-4">Ver o VIP</Link>
        </div>
      </div>
    </div>
  );
}
