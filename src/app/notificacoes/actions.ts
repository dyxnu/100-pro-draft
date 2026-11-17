'use server';

import { getCurrentUser } from '@/lib/supabase/server';
import { createAdminClient, isAdminConfigured } from '@/lib/supabase/admin';

export interface NotifItem { id: number; kind: string; title: string; body: string | null; link: string | null; created_at: string; unread: boolean }

/** Notificações do jogador (pessoais + avisos gerais), da mais nova para a mais antiga. */
export async function listNotificationsAction(): Promise<{ items: NotifItem[]; unread: number }> {
  const session = await getCurrentUser();
  const profile = session?.profile;
  if (!profile || !isAdminConfigured) return { items: [], unread: 0 };
  const { data, error } = await createAdminClient().from('notifications')
    .select('id, kind, title, body, link, created_at')
    .or(`user_id.eq.${profile.id},user_id.is.null`)
    .order('created_at', { ascending: false }).limit(30);
  if (error || !data) return { items: [], unread: 0 };
  const seen = profile.notif_seen_at ? new Date(profile.notif_seen_at).getTime() : 0;
  const since = new Date(profile.created_at).getTime() - 7 * 86_400_000; // avisos gerais muito antigos não aparecem para contas novas
  const items = data
    .filter(n => new Date(n.created_at as string).getTime() >= since)
    .map(n => ({ ...(n as Omit<NotifItem, 'unread'>), unread: new Date(n.created_at as string).getTime() > seen }));
  return { items, unread: items.filter(i => i.unread).length };
}

/** Marca tudo como visto (abrir o sininho). */
export async function markNotificationsSeenAction(): Promise<void> {
  const session = await getCurrentUser();
  if (!session?.profile || !isAdminConfigured) return;
  await createAdminClient().from('profiles').update({ notif_seen_at: new Date().toISOString() }).eq('id', session.profile.id);
}
