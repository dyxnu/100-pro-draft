import 'server-only';
// Grava o resultado de um campeonato para cada jogador humano: histórico, partidas/vitórias,
// PDL (ranqueada), essência azul, XP/nível, maestria e honra. Roda uma única vez por sala.
import { createAdminClient } from '@/lib/supabase/admin';
import { ROLES, type AuctionState } from '@/lib/auction/engine';
import type { TournamentState } from '@/lib/tournament/engine';
import { type Rank, type Tier, applyLp, higherTier, rankScore } from './rank';
import { BE_PER_LEVEL, HONOR_PER_GAME, VIP_DAYS_PER_REFERRAL, addHonor, addXp, rewardsFor } from './rewards';

type Admin = ReturnType<typeof createAdminClient>;

/** Colocação final de cada time: campeão 1, vice 2, semifinal 3, quartas 5... */
export function placements(t: TournamentState): Record<string, number> {
  const out: Record<string, number> = {};
  const lostIn: Record<string, number> = {};
  for (const m of t.matches) {
    if (!m.winner || !m.a || !m.b) continue;
    const loser = m.winner === m.a ? m.b : m.a;
    lostIn[loser] = m.round;
  }
  for (const id of Object.keys(t.teams)) {
    if (t.champion === id) out[id] = 1;
    else if (lostIn[id] != null) out[id] = 2 ** (t.totalRounds - lostIn[id]) + 1;
    else out[id] = 2 ** t.totalRounds; // não chegou a jogar (caso raro)
  }
  return out;
}

export function matchCounts(t: TournamentState, playerId: string) {
  let played = 0, won = 0;
  for (const m of t.matches) {
    if (!m.a || !m.b || !m.winner) continue;
    if (m.a !== playerId && m.b !== playerId) continue;
    played++;
    if (m.winner === playerId) won++;
  }
  return { played, won };
}

export async function recordResults(roomId: string, s: AuctionState, t: TournamentState): Promise<void> {
  if (t.stage !== 'done') return;
  const admin = createAdminClient();
  // Trava: só um pedido grava (o primeiro que virar a flag).
  const { data: claimed } = await admin.from('rooms').update({ results_recorded: true })
    .eq('id', roomId).eq('results_recorded', false).select('id, mode');
  if (!claimed?.length) return;
  const ranked = claimed[0].mode === 'ranked';

  const { data: members } = await admin.from('room_members').select('seat, user_id').eq('room_id', roomId);
  const humans = (members ?? []).filter(m => m.user_id) as { seat: number; user_id: string }[];
  if (!humans.length) return;
  const place = placements(t);
  const totalPlayers = Object.keys(t.teams).length;

  for (const h of humans) {
    try {
      await recordOne(admin, roomId, h.user_id, `seat${h.seat}`, s, t, place, totalPlayers, ranked);
    } catch (e) {
      console.error('[progress] falha ao gravar', h.user_id, e);
    }
  }
}

async function recordOne(
  admin: Admin, roomId: string, userId: string, playerId: string, s: AuctionState, t: TournamentState,
  place: Record<string, number>, totalPlayers: number, rankedRoom: boolean,
) {
  const { data: p } = await admin.from('profiles').select('*').eq('id', userId).single();
  if (!p) return;
  const team = t.teams[playerId];
  if (!team) return;
  const counts = matchCounts(t, playerId);
  const vip = !!p.vip_until && new Date(p.vip_until).getTime() > Date.now();
  const ranked = rankedRoom && !p.is_guest;
  const placement = place[playerId];
  const r = rewardsFor({ placement, players: totalPlayers, matchesWon: counts.won, matchesPlayed: counts.played, ranked, vip });
  const guest = !!p.is_guest;
  const be = guest ? 0 : r.be; // convidado joga, mas não acumula essência

  // Elo
  let rank: Rank = { tier: p.rank_tier as Tier | null, division: p.rank_division, lp: p.lp };
  if (ranked) rank = applyLp(rank, r.lp);
  // Nível
  const lv = addXp(p.level, p.xp, r.xp);
  const honor = addHonor(p.honor_level, p.honor_progress, HONOR_PER_GAME);

  await admin.from('profiles').update({
    games: p.games + counts.played,
    wins: p.wins + counts.won,
    tournaments: p.tournaments + 1,
    titles_won: p.titles_won + (placement === 1 ? 1 : 0),
    blue_essence: p.blue_essence + be + (guest ? 0 : lv.levelsUp * BE_PER_LEVEL),
    level: lv.level, xp: lv.xp,
    honor_level: honor.level, honor_progress: honor.progress,
    ...(ranked ? {
      rank_tier: rank.tier, rank_division: rank.division, lp: rank.lp, rank_score: rankScore(rank),
      peak_tier: higherTier(p.peak_tier as Tier | null, rank.tier),
    } : {}),
  }).eq('id', userId);

  // Histórico
  const roster = s.players.find(x => x.id === playerId)?.roster;
  const teamJson = ROLES.map(role => {
    const champId = team.lineup[role];
    const slot = roster ? Object.values(roster).find(x => x?.champId === champId) : null;
    return { role, champId, skin: slot?.skin ?? 0, price: slot?.price ?? 0 };
  });
  await admin.from('match_history').upsert({
    user_id: userId, room_id: roomId, mode: ranked ? 'ranked' : 'casual', placement, players: totalPlayers,
    matches_won: counts.won, matches_played: counts.played, lp_delta: ranked ? r.lp : 0, be_gain: be, xp_gain: r.xp,
    team: teamJson,
  }, { onConflict: 'user_id,room_id' });

  // Maestria: pontos para cada campeão do time (cresce com as vitórias)
  if (!guest) {
    const champIds = ROLES.map(role => team.lineup[role]);
    const { data: current } = await admin.from('mastery').select('*').eq('user_id', userId).in('champion_id', champIds);
    const byId = new Map((current ?? []).map(m => [m.champion_id, m]));
    await admin.from('mastery').upsert(champIds.map(id => {
      const m = byId.get(id);
      return {
        user_id: userId, champion_id: id,
        points: (m?.points ?? 0) + r.masteryPerChamp,
        games: (m?.games ?? 0) + counts.played,
        wins: (m?.wins ?? 0) + counts.won,
        updated_at: new Date().toISOString(),
      };
    }), { onConflict: 'user_id,champion_id' });
  }

  // Convite: o primeiro campeonato do convidado dá dias de VIP para quem convidou
  if (!guest && p.referred_by && p.tournaments === 0) {
    const { data: ref } = await admin.from('referrals').upsert({ referrer: p.referred_by, referred: userId, rewarded: true }, { onConflict: 'referred', ignoreDuplicates: true }).select('referred');
    if (ref?.length) {
      const { data: inviter } = await admin.from('profiles').select('vip_until').eq('id', p.referred_by).single();
      const base = inviter?.vip_until && new Date(inviter.vip_until).getTime() > Date.now() ? new Date(inviter.vip_until).getTime() : Date.now();
      await admin.from('profiles').update({ vip_until: new Date(base + VIP_DAYS_PER_REFERRAL * 86_400_000).toISOString() }).eq('id', p.referred_by);
    }
  }
}
