'use client';
// Partes editáveis do próprio perfil: título, personalização (banner, borda, tema, efeito de
// vitória) e troca de nome. Toda gravação passa pelas ações do servidor, que validam a posse.
import { useActionState, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AVATARS, avatarUrl } from '@/lib/profile/avatars';
import { equipCosmetic, renameAction } from '@/app/perfil/actions';
import type { FormState } from '@/app/auth/actions';
import type { EquipKind } from './ownership';
import { TitleBadge } from './TitleBadge';

export interface NamedItem { id: string; name: string; rarity: string }
export interface EditorOptions {
  titles: NamedItem[];
  borders: NamedItem[];
  themes: NamedItem[];
  victories: NamedItem[];
  skinBanners: { id: string; name: string; img: string }[];
  current: { title: string | null; border: string | null; theme: string; victory: string | null; banner: string | null };
  rename: { tokens: number; essence: number; price: number; guest: boolean };
  username: string;
}

const fmt = (n: number) => n.toLocaleString('pt-BR');
const strip = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function useEquip() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<FormState>({});
  const equip = (kind: EquipKind, value: string | null, after?: () => void) => start(async () => {
    const r = await equipCosmetic(kind, value);
    setMsg(r);
    if (!r.error) { router.refresh(); after?.(); }
  });
  return { equip, pending, msg };
}

export function ProfileEditor({ options, part }: { options: EditorOptions; part: 'title' | 'actions' }) {
  return part === 'title' ? <TitleSelect options={options} /> : <Actions options={options} />;
}

function Dialog({ label, onClose, children, wide }: { label: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="pf-modal-bg" role="dialog" aria-modal="true" aria-label={label} onClick={onClose}>
      <div className={`pf-modal anim-reveal ${wide ? 'pf-modal--wide' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-gold2">{label}</h2>
          <button className="pf-x" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function TitleSelect({ options }: { options: EditorOptions }) {
  const [open, setOpen] = useState(false);
  const { equip, pending, msg } = useEquip();
  const cur = options.titles.find(t => t.id === options.current.title) ?? null;
  return (
    <>
      <button type="button" className="pf-title-btn" onClick={() => setOpen(true)} title="Escolher título">
        <TitleBadge id={cur?.id ?? null} name={cur?.name ?? null} empty="Escolher título" />
        <span className="pf-title-caret" aria-hidden>▾</span>
      </button>
      {open && (
        <Dialog label="Escolher título" onClose={() => setOpen(false)}>
          {options.titles.length === 0 ? (
            <p className="text-sm text-muted">Você ainda não tem títulos. Vença campeonatos, suba a honra ou visite a loja.</p>
          ) : (
            <ul className="pf-pick-list">
              <li>
                <button type="button" disabled={pending} className={!options.current.title ? 'on' : ''} onClick={() => equip('title', null, () => setOpen(false))}>
                  <span className="text-muted">Sem título</span>
                </button>
              </li>
              {options.titles.map(t => (
                <li key={t.id}>
                  <button type="button" disabled={pending} className={options.current.title === t.id ? 'on' : ''} onClick={() => equip('title', t.id, () => setOpen(false))}>
                    <TitleBadge id={t.id} name={t.name} />
                    <span className={`pf-rarity pf-rarity-${t.rarity}`}>{t.rarity}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {msg.error && <p className="alert-error">{msg.error}</p>}
        </Dialog>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
function Actions({ options }: { options: EditorOptions }) {
  const [open, setOpen] = useState<'custom' | 'rename' | null>(null);
  const close = () => setOpen(null);
  return (
    <>
      <button type="button" className="pf-main-btn" onClick={() => setOpen('custom')}>Personalizar</button>
      {!options.rename.guest && <button type="button" className="pf-ghost-btn" onClick={() => setOpen('rename')}>Trocar nome</button>}
      {open === 'custom' && <Customize options={options} onClose={close} />}
      {open === 'rename' && <Rename options={options} onClose={close} />}
    </>
  );
}

type Tab = 'banner' | 'border' | 'theme' | 'victory';
const TABS: { id: Tab; label: string }[] = [
  { id: 'banner', label: 'Banner' }, { id: 'border', label: 'Borda' }, { id: 'theme', label: 'Tema' }, { id: 'victory', label: 'Efeito de vitória' },
];

function Customize({ options, onClose }: { options: EditorOptions; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('banner');
  const [q, setQ] = useState('');
  const { equip, pending, msg } = useEquip();
  const cur = options.current;
  const champs = useMemo(() => {
    const t = strip(q.trim());
    return t ? AVATARS.filter(a => strip(a.name).includes(t)) : AVATARS;
  }, [q]);

  const itemList = (kind: 'border' | 'theme' | 'victory', items: NamedItem[], current: string | null, allowNone: boolean) => (
    <>
      {items.length === 0 && <p className="text-sm text-muted">Nenhum item ainda.</p>}
      <div className="pf-item-grid">
        {allowNone && (
          <button type="button" disabled={pending} className={`pf-item ${!current ? 'on' : ''}`} onClick={() => equip(kind, null)}>
            <span className="pf-item-swatch pf-swatch-none" />
            <span className="pf-item-name">Nenhum</span>
          </button>
        )}
        {items.map(it => (
          <button key={it.id} type="button" disabled={pending} className={`pf-item ${current === it.id ? 'on' : ''}`} onClick={() => equip(kind, it.id)}>
            <span className={`pf-item-swatch pf-swatch-${it.id.replace(':', '-')}`} />
            <span className="pf-item-name">{it.name}</span>
            <span className={`pf-rarity pf-rarity-${it.rarity}`}>{it.rarity}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">Mais opções na <Link href="/loja" className="text-gold hover:underline">loja</Link>, com essência azul.</p>
    </>
  );

  return (
    <Dialog label="Personalizar perfil" onClose={onClose} wide>
      <div className="pf-tabs" role="tablist">
        {TABS.map(t => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      <div className="pf-modal-scroll">
        {tab === 'banner' && (
          <div className="space-y-4">
            {options.skinBanners.length > 0 && (
              <div>
                <p className="label">Suas skins</p>
                <div className="pf-banner-grid">
                  {options.skinBanners.map(b => (
                    <button key={b.id} type="button" disabled={pending} title={b.name}
                      className={`pf-banner-opt ${cur.banner === b.id ? 'on' : ''}`} onClick={() => equip('banner', b.id)}>
                      <img src={b.img} alt="" loading="lazy" />
                      <span>{b.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="label !mb-0">Splash padrão de um campeão</p>
                <button type="button" className="text-xs font-bold text-gold hover:underline" disabled={pending} onClick={() => equip('banner', null)}>
                  Usar o campeão do ícone
                </button>
              </div>
              <input className="input" placeholder="Buscar campeão…" value={q} onChange={e => setQ(e.target.value)} />
              <div className="pf-champ-grid mt-3">
                {champs.map(a => {
                  const id = `banner:${a.id}_0`;
                  return (
                    <button key={a.id} type="button" disabled={pending} title={a.name} className={cur.banner === id ? 'on' : ''} onClick={() => equip('banner', id)}>
                      <img src={avatarUrl(a.id)} alt="" width={52} height={52} loading="lazy" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {tab === 'border' && itemList('border', options.borders, cur.border, true)}
        {tab === 'theme' && itemList('theme', options.themes, cur.theme, false)}
        {tab === 'victory' && itemList('victory', options.victories, cur.victory, true)}
      </div>
      <p className="min-h-5 text-sm" aria-live="polite">
        {pending ? <span className="text-muted">Salvando…</span> : msg.error ? <span className="text-danger">{msg.error}</span> : msg.message ? <span className="text-teal">{msg.message}</span> : null}
      </p>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
function Rename({ options, onClose }: { options: EditorOptions; onClose: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(renameAction, {});
  const [name, setName] = useState('');
  const [confirming, setConfirming] = useState(false);
  const { tokens, essence, price } = options.rename;
  const useToken = tokens > 0;
  const canPay = useToken || essence >= price;

  useEffect(() => {
    if (state.message) router.refresh();
    if (state.error) setConfirming(false);
  }, [state, router]);

  return (
    <Dialog label="Trocar nome de usuário" onClose={onClose}>
      {state.message ? (
        <>
          <p className="text-sm text-teal">{state.message}</p>
          <div className="flex justify-end"><button className="btn-primary px-6" onClick={onClose}>Fechar</button></div>
        </>
      ) : (
        <form action={action} className="space-y-4" onSubmit={e => { if (!confirming) { e.preventDefault(); if (name.trim()) setConfirming(true); } }}>
          <div className="pf-cost">
            {useToken ? (
              <p><b>Grátis</b> — usa 1 token de troca de nome (você tem {tokens}).</p>
            ) : (
              <p>Custa <b>{fmt(price)} de essência azul</b>. Você tem {fmt(essence)}.</p>
            )}
          </div>
          <label className="block">
            <span className="label">Novo nome</span>
            <input className="input" name="username" value={name} maxLength={16} autoComplete="off" readOnly={confirming}
              onChange={e => { setName(e.target.value); setConfirming(false); }} placeholder={options.username} required />
            <span className="mt-1 block text-xs text-muted">3 a 16 caracteres: letras, números e _</span>
          </label>
          {confirming && (
            <p className="pf-confirm">
              Trocar <b>{options.username}</b> por <b>{name.trim()}</b>{useToken ? ' usando 1 token de troca' : ` por ${fmt(price)} de essência azul`}? Isso não pode ser desfeito.
            </p>
          )}
          {state.error && <p className="alert-error">{state.error}</p>}
          {!canPay && <p className="text-sm text-muted">Você ainda não tem essência suficiente. Jogue campeonatos para juntar mais.</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={confirming ? () => setConfirming(false) : onClose}>{confirming ? 'Voltar' : 'Cancelar'}</button>
            <button type="submit" className="btn-primary px-6" disabled={!canPay || pending || !name.trim()}>
              {pending ? 'Trocando…' : confirming ? 'Confirmar troca' : 'Continuar'}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
