import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { type Profile, createClient, getCurrentUser } from '@/lib/supabase/server';
import { normalizeCode } from '@/lib/rooms/service';
import { type AuctionRow, type LobbyRank, type MemberRow, type RoomRow, seatPlayerId } from '@/lib/rooms/types';
import { type Tier, TIER_COLOR, rankLabel } from '@/lib/progress/rank';
import { type RoomHuman, RoomShell } from '@/components/chat/RoomSocial';
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
  // Uma ida ao banco: sala, vagas e leilão juntos (o RLS continua valendo).
  const { data: full } = await supabase.from('rooms')
    .select('*, room_members(room_id, seat, user_id, bot_profile, display_name, ready), auctions(id, room_id, state, tournament, version, next_tick_at)')
    .eq('code', code).maybeSingle();
  if (!full) notFound();
  const { room_members: members, auctions: auctionRel, ...roomOnly } = full as RoomRow & {
    room_members: MemberRow[]; auctions: Omit<AuctionRow, 'bot_brains'> | Omit<AuctionRow, 'bot_brains'>[] | null;
  };
  const room = roomOnly as RoomRow;
  const list = [...(members ?? [])].sort((a, b) => a.seat - b.seat);
  const me = list.find(m => m.user_id === session.user.id) ?? null;

  // Ícone de cada vaga: o do perfil para pessoas, um fixo para bots. Elo e "convidado" também vêm daqui
  // (select('*') para não quebrar se a migração 0006 ainda não criou as colunas).
  const userIds = list.flatMap(m => (m.user_id ? [m.user_id] : []));
  const { data: profs } = userIds.length
    ? await supabase.from('profiles').select('*').in('id', userIds)
    : { data: [] as Partial<Profile>[] };
  const profOf = new Map(((profs ?? []) as Partial<Profile>[]).map(p => [p.id, p]));
  const avatars: Record<string, string> = {};
  const victoryFx: Record<string, string> = {}; // efeito de vitória escolhido no perfil (por vaga)
  const ranks: Record<string, LobbyRank> = {};
  for (const m of list) {
    const p = m.user_id ? profOf.get(m.user_id) : null;
    const a = m.user_id ? p?.avatar_url : botAvatar(m.seat);
    if (a) avatars[seatPlayerId(m.seat)] = a;
    if (p?.victory_fx) victoryFx[seatPlayerId(m.seat)] = p.victory_fx;
    if (m.user_id && p && 'lp' in p) {
      const tier = (p.rank_tier ?? null) as Tier | null;
      ranks[m.user_id] = {
        label: rankLabel({ tier, division: p.rank_division ?? null, lp: p.lp ?? 0 }),
        color: tier ? TIER_COLOR[tier] ?? null : null,
        guest: !!p.is_guest,
      };
    }
  }
  const meGuest = !!session.profile?.is_guest;
  const humans: RoomHuman[] = list.flatMap(m => (m.user_id ? [{
    userId: m.user_id, name: m.display_name, avatar: avatars[seatPlayerId(m.seat)] ?? null, guest: !!ranks[m.user_id]?.guest,
  }] : []));

  if (room.status === 'abandoned') {
    return <Message title="Sala encerrada" text="Todos saíram desta sala antes do draft começar." />;
  }

  if (room.status === 'lobby') {
    return (
      <LobbyView room={room} members={list} meId={session.user.id} isMember={!!me} avatars={avatars}
        myAvatar={session.profile?.avatar_url ?? null} ranks={ranks} meGuest={meGuest} />
    );
  }

  const auction = Array.isArray(auctionRel) ? auctionRel[0] ?? null : auctionRel;
  if (!auction) {
    return <Message title="Draft em andamento" text="Esse draft já começou e você não está nesta sala." />;
  }
  return (
    <RoomShell roomId={room.id} meId={session.user.id} meGuest={meGuest} isMember={!!me} humans={humans}>
      <AuctionView
        code={room.code}
        roomId={room.id}
        initialState={auction.state}
        initialTournament={auction.tournament ?? null}
        initialNextTickAt={auction.next_tick_at ? Date.parse(auction.next_tick_at) : null}
        serverNow={Date.now()}
        mySeat={me?.seat ?? null}
        avatars={avatars}
        victoryFx={victoryFx}
      />
    </RoomShell>
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
