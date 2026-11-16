import Link from 'next/link';
import { getCurrentUser } from '@/lib/supabase/server';
import { signOut } from '@/app/auth/actions';
import { Logo } from './Logo';

export async function SiteHeader() {
  const session = await getCurrentUser();
  const profile = session?.profile;
  const nav = 'rounded-lg px-2.5 py-1.5 font-semibold text-muted transition hover:bg-moon hover:text-gold2';

  return (
    <header className="sticky top-0 z-20 px-3 pt-3 sm:px-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-2xl border border-line bg-panel/90 px-4 py-2.5 shadow-[0_8px_30px_-18px_rgba(38,42,114,.5)] backdrop-blur">
        <Link href="/" aria-label="Início"><Logo /></Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/jogar" className={nav}>Arena</Link>
          <Link href="/campeoes" className={`${nav} hidden sm:inline`}>Campeões</Link>
          <Link href="/#como-jogar" className={`${nav} hidden md:inline`}>Como jogar</Link>
          {profile ? (
            <>
              <Link href="/perfil" className="ml-1 flex items-center gap-2 rounded-xl border border-line px-2 py-1 hover:border-accent">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-moon text-xs font-black text-accent">
                  {profile.username.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden font-bold sm:inline">{profile.username}</span>
              </Link>
              <form action={signOut}><button className={nav}>Sair</button></form>
            </>
          ) : (
            <Link href="/entrar" className="btn-secondary ml-1 !py-1.5">Fazer login</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
