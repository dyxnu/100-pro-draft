import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export interface RecentWin {
  id: number;
  username: string;
  avatar: string | null;
  mode: 'casual' | 'ranked';
  players: number;
  playedAt: string;
  team: { role: string; champId: string; skin?: number | null; price?: number }[];
}

/** Últimos campeonatos vencidos por pessoas (o campeão de cada sala). Nunca lança. */
export async function getRecentWins(limit: number): Promise<RecentWin[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const sb = await createClient();
    const { data, error } = await sb
      .from('match_history')
      .select('id, mode, players, played_at, team, profiles(username, avatar_url, is_guest)')
      .eq('placement', 1)
      .order('played_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.flatMap(r => {
      const p = (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) as { username: string; avatar_url: string | null } | null;
      if (!p) return [];
      return [{
        id: r.id as number, username: p.username, avatar: p.avatar_url, mode: r.mode === 'ranked' ? 'ranked' : 'casual',
        players: Number(r.players) || 0, playedAt: r.played_at as string, team: Array.isArray(r.team) ? r.team as RecentWin['team'] : [],
      }];
    });
  } catch {
    return [];
  }
}
