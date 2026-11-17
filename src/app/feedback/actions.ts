'use server';

import { headers } from 'next/headers';
import { getCurrentUser } from '@/lib/supabase/server';
import { createAdminClient, isAdminConfigured } from '@/lib/supabase/admin';
import { notify } from '@/lib/notify/service';

export interface FeedbackState { ok?: boolean; error?: string }
const KINDS = new Set(['sugestao', 'bug', 'elogio', 'outro']);

export async function sendFeedbackAction(_: FeedbackState, form: FormData): Promise<FeedbackState> {
  const session = await getCurrentUser();
  if (!session?.profile) return { error: 'Entre na sua conta (ou como convidado) para mandar feedback.' };
  if (!isAdminConfigured) return { error: 'O servidor ainda não está pronto para receber feedback.' };
  const kind = String(form.get('kind') ?? 'sugestao');
  const body = String(form.get('body') ?? '').trim().slice(0, 2000);
  if (!KINDS.has(kind)) return { error: 'Escolha um tipo.' };
  if (body.length < 3) return { error: 'Escreva um pouco mais.' };

  const admin = createAdminClient();
  // No máximo 1 feedback a cada 30 s por pessoa.
  const { data: last } = await admin.from('feedback').select('created_at').eq('user_id', session.profile.id)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (last && Date.now() - new Date(last.created_at as string).getTime() < 30_000) {
    return { error: 'Calma! Espere alguns segundos para mandar outro.' };
  }

  const page = (await headers()).get('referer')?.slice(0, 200) ?? null;
  const { error } = await admin.from('feedback').insert({ user_id: session.profile.id, kind, body, page });
  if (error) return { error: 'Não deu para enviar agora. Tente de novo daqui a pouco.' };
  await notify(session.profile.id, {
    kind: 'info', title: 'Recebemos seu feedback. Valeu!',
    body: 'Cada sugestão é lida. Se for um erro, a correção aparece nas notas de atualização.',
  });
  return { ok: true };
}
