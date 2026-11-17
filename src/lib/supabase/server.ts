import { cache } from 'react';
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

/** Perfil completo (migração 0006). Escrita só pelo servidor (service role). */
export interface Profile {
  id: string;
  username: string;
  tag: string;
  /** Ícone: id de campeão ("Diana") ou ícone de perfil do LoL ("icon:4568"). */
  avatar_url: string | null;
  level: number;
  xp: number;
  created_at: string;
  is_guest: boolean;
  blue_essence: number;
  honor_level: number;
  honor_progress: number;
  kudos_count: number;
  games: number;
  wins: number;
  titles_won: number;
  tournaments: number;
  rank_tier: string | null;
  rank_division: number | null;
  lp: number;
  rank_score: number;
  peak_tier: string | null;
  title_id: string | null;
  banner_id: string | null;
  border_id: string | null;
  theme_id: string | null;
  victory_fx: string | null;
  vip_until: string | null;
  is_beta: boolean;
  beta_claimed: boolean;
  name_change_tokens: number;
  referral_code: string | null;
  referred_by: string | null;
  /** Migração 0007: até quando as notificações já foram vistas. */
  notif_seen_at?: string | null;
}

export const isVip = (p: Pick<Profile, 'vip_until'> | null | undefined) => !!p?.vip_until && new Date(p.vip_until).getTime() > Date.now();

/**
 * Usuário logado + perfil, ou null. Nunca lança se o Supabase não estiver configurado.
 * getClaims valida o token (localmente, quando o projeto usa chaves assimétricas) e o cache()
 * evita repetir a consulta no mesmo carregamento (cabeçalho + página).
 */
export const getCurrentUser = cache(async () => {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) return null;
  const user = { id: sub };
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>();
  return { user, profile };
});
