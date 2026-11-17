import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient, getCurrentUser, type Profile } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { ProfileView } from '@/components/ProfileView';
import { loadProfileData, ownerCtx } from '@/components/profile/data';
import { withDefaults } from '@/components/profile/ownership';

type Params = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username } = await params;
  return { title: decodeURIComponent(username) };
}

/** Perfil público (só leitura). */
export default async function JogadorPage({ params }: Params) {
  const { username } = await params;
  if (!isSupabaseConfigured) notFound();
  const supabase = await createClient();
  const { data: raw } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', decodeURIComponent(username)) // citext: sem diferenciar maiúsculas
    .maybeSingle<Profile>();
  if (!raw) notFound();
  const profile = withDefaults(raw);
  const [{ inventory, mastery, history }, me] = await Promise.all([loadProfileData(profile.id), getCurrentUser()]);
  return (
    <ProfileView
      profile={profile} isOwner={false} isMe={me?.user.id === profile.id}
      ctx={ownerCtx(profile, inventory)} mastery={mastery} history={history}
    />
  );
}
