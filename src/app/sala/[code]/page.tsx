import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { normalizeCode } from '@/lib/rooms/service';
import { type AuctionRow, type MemberRow, type RoomRow, seatPlayerId } from '@/lib/rooms/types';
import { botAvatar } from '@/lib/profile/avatars';
import { LobbyView } from '@/components/draft/LobbyView';
import { AuctionView } from '@/components/draft/AuctionView';

type Params = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { code } = await params;
  return { title: `Sala ${normalizeCode(code)}` };
}

export default async function SalaPage({ params }: Params) {
  const code = normalizeCode((await params).code);
  const session = await getCurrentUser();
  if (!session) redirect(`/entrar?next=/sala/${code}`);
  if (!/^[A-Z0-9]{6}$/.test(code)) notFound();

  // Leitura com o usuário logado: o RLS decide o que ele pode ver.
  const supabase = await createClient();
  const { data: room } = await supabase.from('rooms').select('*').eq('code', code).maybeSingle<RoomRow>();
  if (!room) notFound();
  const { data: members } = await supabase.from('room_members')
    .select('room_id, seat, user_id, bot_profile, display_name, ready').eq('room_id', room.id).order('seat');
  const list = (members ?? []) as MemberRow[];
  const me = list.find(m => m.user_id === session.user.id) ?? null;

  // Ícone de cada vaga: o do perfil para pessoas, um fixo para bots.
  const userIds = list.flatMap(m => (m.user_id ? [m.user_id] : []));
  const { data: profs } = userIds.length
    ? await supabase.from('profiles').select('id, avatar_url').in('id', userIds)
    : { data: [] as { id: string; avatar_url: string | null }[] };
  const avatarOf = new Map((profs ?? []).map(p => [p.id, p.avatar_url]));
  const avatars: Record<string, string> = {};
  for (const m of list) {
    const a = m.user_id ? avatarOf.get(m.user_id) : botAvatar(m.seat);
    if (a) avatars[seatPlayerId(m.seat)] = a;
  }

  if (room.status === 'abandoned') {
    return <Message title="Sala encerrada" text="Todos saíram desta sala antes do draft começar." />;
  }

  if (room.status === 'lobby') {
    return <LobbyView room={room} members={list} meId={session.user.id} isMember={!!me} avatars={avatars} myAvatar={session.profile?.avatar_url ?? null} />;
  }

  const { data: auction } = await supabase.from('auctions')
    .select('id, room_id, state, tournament, version, next_tick_at').eq('room_id', room.id).maybeSingle<Omit<AuctionRow, 'bot_brains'>>();
  const hdr = await headers();
  console.log('[sala]', hdr.get('rsc') ? 'RSC' : 'DOC', hdr.get('next-action') ? 'ACTION' : '', hdr.get('referer')?.slice(-30) ?? '', code, room.status, 'auction?', !!auction, 'phase', auction?.state?.phase, 'seat', me?.seat ?? null);
  if (!auction) {
    return <Message title="Draft em andamento" text="Esse draft já começou e você não está nesta sala." />;
  }
  return (
    <AuctionView
      code={room.code}
      roomId={room.id}
      initialState={auction.state}
      initialTournament={auction.tournament ?? null}
      initialNextTickAt={auction.next_tick_at ? Date.parse(auction.next_tick_at) : null}
      serverNow={Date.now()}
      mySeat={me?.seat ?? null}
      avatars={avatars}
    />
  );
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div className="panel mx-auto mt-16 max-w-md p-8 text-center">
      <h1 className="text-2xl font-bold text-gold2">{title}</h1>
      <p className="mt-2 text-muted">{text}</p>
      <Link href="/jogar" className="btn-primary mt-6">Criar ou entrar em outra sala</Link>
    </div>
  );
}
