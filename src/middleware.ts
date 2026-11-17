import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from '@/lib/supabase/env';

const PROTECTED = ['/perfil', '/jogar', '/sala'];

// Renova a sessão do Supabase em toda navegação e protege rotas que exigem login.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  // As rotas de API conferem o login sozinhas: pular aqui tira uma ida ao Supabase de cada lance.
  if (!isSupabaseConfigured || request.nextUrl.pathname.startsWith('/api/')) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: toSet => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getClaims renova a sessão quando preciso e valida o token sem consulta extra quando possível.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ?? null;

  if (!user && PROTECTED.some(p => request.nextUrl.pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = '/entrar';
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
};
