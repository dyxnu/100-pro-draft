import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from './env';

const SECRET = process.env.SUPABASE_SECRET_KEY ?? '';

export const isAdminConfigured = SECRET.length > 20;

/**
 * Cliente com a chave SECRETA: ignora o RLS. Só pode ser usado no servidor,
 * para operações já validadas (salas, lances, saldos, times).
 */
export function createAdminClient() {
  if (!isAdminConfigured) throw new Error('SUPABASE_SECRET_KEY não configurada (veja .env.example).');
  return createClient(SUPABASE_URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
}
