import Link from 'next/link';
import { getCurrentUser } from '@/lib/supabase/server';
import { signOut } from '@/app/auth/actions';
import { Logo } from './Logo';

export async function SiteHeader() {
  const session = await getCurrentUser();
  const profile = session?.profile;

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-bg/75 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="Início"><Logo /></Link>
        <nav className="flex items-center gap-2 text-sm sm:gap-4">
          {profile ? (
            <>
              <Link href="/perfil" className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-panel2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-panel2 text-xs font-bold text-gold">
                  {profile.username.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden font-semibold sm:inline">{profile.username}</span>
              </Link>
              <form action={signOut}>
                <button className="text-muted hover:text-text">Sair</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/entrar" className="text-muted hover:text-text">Entrar</Link>
              <Link href="/cadastro" className="btn-secondary !py-1.5">Criar conta</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
