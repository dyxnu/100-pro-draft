import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient, getCurrentUser, type Profile } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { ProfileView } from '@/components/ProfileView';

type Params = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username } = await params;
  return { title: decodeURIComponent(username) };
}

export default async function JogadorPage({ params }: Params) {
  const { username } = await params;
  if (!isSupabaseConfigured) notFound();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, tag, avatar_url, level, xp, created_at')
    .eq('username', decodeURIComponent(username)) // citext: sem diferenciar maiúsculas
    .maybeSingle<Profile>();
  if (!profile) notFound();
  const me = await getCurrentUser();
  return <ProfileView profile={profile} isOwner={me?.user.id === profile.id} />;
}
