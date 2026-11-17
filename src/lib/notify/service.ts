import 'server-only';
import { createAdminClient, isAdminConfigured } from '@/lib/supabase/admin';

export type NotifKind = 'info' | 'recompensa' | 'loja' | 'vip' | 'elo' | 'campeonato' | 'atualizacao';
export interface NotifInput { kind: NotifKind; title: string; body?: string; link?: string }

/** Grava uma notificação para o jogador (ou para todos, com userId null). Nunca lança: sem a migração 0007, só não grava. */
export async function notify(userId: string | null, n: NotifInput | NotifInput[]): Promise<void> {
  if (!isAdminConfigured) return;
  const list = Array.isArray(n) ? n : [n];
  if (!list.length) return;
  try {
    await createAdminClient().from('notifications').insert(list.map(x => ({
      user_id: userId, kind: x.kind, title: x.title.slice(0, 140), body: x.body?.slice(0, 500) ?? null, link: x.link ?? null,
    })));
  } catch { /* tabela ainda não existe */ }
}
