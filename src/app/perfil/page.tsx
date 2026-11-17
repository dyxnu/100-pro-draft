import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase/server';
import { ProfileView } from '@/components/ProfileView';
import { loadProfileData, ownerCtx } from '@/components/profile/data';
import { withDefaults } from '@/components/profile/ownership';

export const metadata: Metadata = { title: 'Meu perfil' };

export default async function PerfilPage() {
  const session = await getCurrentUser();
  if (!session) redirect('/entrar?next=/perfil');
  if (!session.profile) {
    return <p className="mt-10 text-muted">Seu perfil ainda está sendo criado. Recarregue a página em instantes.</p>;
  }
  const profile = withDefaults(session.profile);
  const { inventory, mastery, history } = await loadProfileData(profile.id);
  return <ProfileView profile={profile} isOwner ctx={ownerCtx(profile, inventory)} mastery={mastery} history={history} />;
}
