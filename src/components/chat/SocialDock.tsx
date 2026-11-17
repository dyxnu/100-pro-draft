import { getCurrentUser } from '@/lib/supabase/server';
import { GuestBanner } from './Docks';

/**
 * Componente de servidor para o layout: aviso de convidado. (Não há chat global: só o chat da sala.)
 */
export async function SocialDock() {
  const session = await getCurrentUser().catch(() => null);
  const profile = session?.profile;
  if (!profile) return null;
  return profile.is_guest ? <GuestBanner /> : null;
}
