import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { TIERS, type Tier } from '@/lib/progress/rank';

import type { RankRow, RankingResult } from './ranking-shared';
export type { RankRow, RankingResult };

const isTier = (t: unknown): t is Tier => typeof t === 'string' && (TIERS as readonly string[]).includes(t);

/** Ranking mundial: jogadores com elo (rank_score ≥ 0), do maior para o menor. Nunca lança. */
export async function getRanking(limit: number): Promise<RankingResult> {
  if (!isSupabaseConfigured) return { rows: [], error: 'O ranking aparece assim que o servidor estiver conectado.' };
  try {
    const sb = await createClient();
    const { data, error } = await sb
      .from('profiles')
      .select('id, username, tag, avatar_url, rank_tier, rank_division, lp, rank_score')
      .gte('rank_score', 0)
      .order('rank_score', { ascending: false })
      .order('lp', { ascending: false })
      .limit(limit);
    if (error) return { rows: [], error: 'O ranking ainda está sendo preparado. Volte daqui a pouco!' };
    const rows = (data ?? []).flatMap(p => (isTier(p.rank_tier) ? [{
      id: p.id as string, username: p.username as string, tag: (p.tag as string) ?? '', avatar_url: (p.avatar_url as string | null) ?? null,
      tier: p.rank_tier, division: (p.rank_division as number | null) ?? null, lp: Number(p.lp) || 0, score: Number(p.rank_score) || 0,
    }] : []));
    return { rows, error: null };
  } catch {
    return { rows: [], error: 'Não foi possível carregar o ranking agora.' };
  }
}

