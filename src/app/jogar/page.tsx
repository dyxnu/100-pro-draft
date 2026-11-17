import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase/server';
import { ArenaView } from './ArenaView';

export const metadata: Metadata = { title: 'Arena' };

export default async function JogarPage() {
  const session = await getCurrentUser();
  if (!session) redirect('/entrar?next=/jogar');
  return <ArenaView p={session.profile} />;
}
