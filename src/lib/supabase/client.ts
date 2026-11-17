'use client';
import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env';

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Cliente do navegador (só leitura nas tabelas do jogo, por causa do RLS) + Realtime. */
export function getBrowserClient() {
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

/**
 * Garante que o Realtime use o token do usuário logado antes de assinar um canal.
 * Sem isso, o canal pode conectar como visitante (anon) e o RLS "to authenticated"
 * bloqueia os eventos: quem já estava na sala não via quem entrou depois.
 */
export async function authRealtime() {
  const sb = getBrowserClient();
  const { data } = await sb.auth.getSession();
  if (data.session?.access_token) await sb.realtime.setAuth(data.session.access_token);
  return sb;
}
