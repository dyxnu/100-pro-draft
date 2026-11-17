import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase/server';
import { GuestStart } from './GuestStart';

export const metadata: Metadata = { title: 'Jogar como convidado' };

export default async function ConvidadoPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/jogar';
  const session = await getCurrentUser();
  if (session?.user) redirect(target);
  return <GuestStart next={target} />;
}
