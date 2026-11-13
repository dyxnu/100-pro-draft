import { isSupabaseConfigured } from '@/lib/supabase/env';

export function SetupNotice() {
  if (isSupabaseConfigured) return null;
  return (
    <div className="border-b border-gold/40 bg-gold/10 px-4 py-2 text-center text-sm text-gold2">
      Supabase ainda não configurado: cadastro e login ficam desativados. Copie <code>.env.example</code> para{' '}
      <code>.env.local</code> e preencha a URL e a anon key do seu projeto.
    </div>
  );
}
