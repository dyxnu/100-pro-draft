import { getCurrentUser } from '@/lib/supabase/server';
import { GlobalChatDock, GuestBanner } from './Docks';

/**
 * Componente de servidor para o layout: aviso de convidado + botão do chat global.
 * Quem não entrou não vê nada (o chat só é lido por usuários autenticados).
 */
export async function SocialDock() {
  const session = await getCurrentUser().catch(() => null);
  const profile = session?.profile;
  if (!profile) return null;
  const guest = !!profile.is_guest;
  return (
    <>
      {guest && <GuestBanner />}
      <GlobalChatDock meId={profile.id} canSend={!guest} />
    </>
  );
}
