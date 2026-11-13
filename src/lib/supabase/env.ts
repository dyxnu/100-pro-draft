export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/** Permite rodar o site sem Supabase configurado (mostra um aviso em vez de quebrar). */
export const isSupabaseConfigured =
  SUPABASE_URL.startsWith('https://') && !SUPABASE_URL.includes('SEU-PROJETO') && SUPABASE_ANON_KEY.length > 20;
