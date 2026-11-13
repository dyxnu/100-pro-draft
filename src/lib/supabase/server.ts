import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './env';

/** Cliente Supabase para Server Components, Server Actions e Route Handlers. */
export async function createClient() {
  if (!isSupabaseConfigured) throw new Error('Supabase não configurado (veja .env.example).');
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: toSet => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chamado de um Server Component: o middleware já renova a sessão.
        }
      },
    },
  });
}

export interface Profile {
  id: string;
  username: string;
  tag: string;
  avatar_url: string | null;
  level: number;
  xp: number;
  created_at: string;
}

/** Usuário logado + perfil, ou null. Nunca lança se o Supabase não estiver configurado. */
export async function getCurrentUser() {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, tag, avatar_url, level, xp, created_at')
    .eq('id', user.id)
    .single<Profile>();
  return { user, profile };
}
