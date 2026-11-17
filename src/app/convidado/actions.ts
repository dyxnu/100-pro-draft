'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';

const safeNext = (next: string) => (next.startsWith('/') && !next.startsWith('//') ? next : '/jogar');

/** Login anônimo do Supabase (o gatilho do banco cria o perfil "convidado_xxxx" com is_guest). */
export async function guestSignInAction(next: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: 'O Supabase não está configurado neste servidor.' };
  const supabase = await createClient();
  const { data: current } = await supabase.auth.getClaims();
  if (current?.claims?.sub) redirect(safeNext(next)); // já entrou

  const { error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.error('[convidado] signInAnonymously', error.message);
    if (/anonymous/i.test(error.message) && /disabled|not enabled/i.test(error.message)) {
      return {
        error: 'O modo convidado ainda não foi ativado. O dono do site precisa ligar “Anonymous sign-ins” no Supabase '
          + '(Authentication → Sign In / Providers → Anonymous).',
      };
    }
    if (error.status === 429) return { error: 'Muitas tentativas seguidas. Espere um pouco e tente de novo.' };
    return { error: `Não foi possível entrar como convidado agora (${error.message}).` };
  }
  redirect(safeNext(next));
}
