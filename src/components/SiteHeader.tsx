import Link from 'next/link';
import { getCurrentUser } from '@/lib/supabase/server';
import { signOut } from '@/app/auth/actions';
import { avatarUrl } from '@/lib/profile/avatars';
import { profileIconUrl } from '@/lib/store/catalog';
import { canClaimBeta } from '@/lib/store/rules';
import { EssenceAmount } from './header/EssenceIcon';
import { Logo } from './Logo';
import { MobileMenu } from './header/MobileMenu';
import { NotificationBell } from './header/NotificationBell';
import './header/header.css';

const LINKS = [
  { href: '/jogar', label: 'Arena' },
  { href: '/loja', label: 'Loja' },
  { href: '/ranking', label: 'Ranking' },
  { href: '/vip', label: 'VIP' },
];

const iconSrc = (id: string | null | undefined) =>
  id?.startsWith('icon:') && Number.isFinite(Number(id.slice(5))) ? profileIconUrl(Number(id.slice(5))) : avatarUrl(id);

export async function SiteHeader() {
  let session: Awaited<ReturnType<typeof getCurrentUser>> = null;
  try { session = await getCurrentUser(); } catch { session = null; }
  const profile = session?.profile;
  const essence = typeof profile?.blue_essence === 'number' ? profile.blue_essence : null; // null = migração pendente
  const beta = canClaimBeta(profile);
  const nav = 'rounded-lg px-2.5 py-1.5 font-semibold text-muted transition hover:bg-moon hover:text-gold2';

  return (
    <header className="sticky top-0 z-20 px-3 pt-3 sm:px-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 rounded-2xl border border-line bg-panel/90 px-3 py-2 shadow-[0_8px_30px_-18px_rgba(38,42,114,.5)] backdrop-blur sm:px-4 sm:py-2.5">
        <Link href="/" aria-label="Início" className="st-logo shrink-0"><Logo /></Link>

        <nav className="hidden items-center gap-0.5 text-sm md:flex" aria-label="Principal">
          {LINKS.map(l => (
            <Link key={l.href} href={l.href} className={`${nav} ${l.href === '/vip' ? 'st-navvip' : ''}`}>{l.label}</Link>
          ))}
        </nav>

        <div className="flex min-w-0 items-center gap-1.5 text-sm">
          {profile ? (
            <>
              {beta && (
                <Link href="/loja#beta" className="st-betabadge" title="Você é Alpha Tester! Resgate seu bônus">
                  <span aria-hidden>✦</span><span className="hidden lg:inline">Resgatar bônus</span>
                </Link>
              )}
              {essence !== null && (
                <Link href="/loja" className="st-wallet" title="Essência Azul">
                  <EssenceAmount value={essence} size={15} />
                </Link>
              )}
              {!profile.is_guest && <NotificationBell />}
              <Link href="/perfil" className="flex min-w-0 items-center gap-2 rounded-xl border border-line px-1.5 py-1 hover:border-accent sm:pr-2.5">
                <span className="relative shrink-0">
                  <img src={iconSrc(profile.avatar_url)} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover ring-2 ring-gold/60" />
                  <span className="st-lvl">{profile.level ?? 1}</span>
                </span>
                <span className="hidden max-w-[9rem] truncate font-bold sm:inline">{profile.username}</span>
              </Link>
              <form action={signOut} className="hidden md:block"><button className={nav}>Sair</button></form>
            </>
          ) : (
            <Link href="/entrar" className="btn-secondary !px-3 !py-1.5">Entrar</Link>
          )}

          <MobileMenu>
            {LINKS.map(l => <Link key={l.href} href={l.href}>{l.label}</Link>)}
            <Link href="/campeoes">Campeões</Link>
            {profile && <Link href="/perfil">Meu perfil</Link>}
            <Link href="/feedback">Feedback</Link>
            {profile && <form action={signOut}><button>Sair</button></form>}
          </MobileMenu>
        </div>
      </div>
    </header>
  );
}
