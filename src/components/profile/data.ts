import 'server-only';
// Leitura dos dados do perfil (inventário, maestria, histórico). Tolerante: se a migração 0006
// ainda não rodou, as tabelas não existem e tudo volta vazio em vez de quebrar a página.
import { createClient, isVip, type Profile } from '@/lib/supabase/server';
import type { OwnerCtx } from './ownership';

type Client = Awaited<ReturnType<typeof createClient>>;

export interface MasteryRow { champion_id: string; points: number; games: number; wins: number }
export interface HistoryTeamSlot { role: string; champId: string; skin?: number; price?: number }
export interface HistoryRow {
  id: number;
  mode: 'casual' | 'ranked';
  placement: number;
  players: number;
  matches_won: number;
  matches_played: number;
  lp_delta: number;
  be_gain: number;
  xp_gain: number;
  team: HistoryTeamSlot[];
  played_at: string;
}

/**
 * Inventário inteiro, de 1000 em 1000 (o banco devolve no máximo 1000 linhas por consulta).
 * Devolve null se a consulta falhar.
 */
export async function fetchInventoryRows(client: Pick<Client, 'from'>, userId: string): Promise<{ item_id: string; source: string }[] | null> {
  const out: { item_id: string; source: string }[] = [];
  for (let from = 0; from < 50_000; from += 1000) {
    const { data, error } = await client.from('inventory').select('item_id, source').eq('user_id', userId)
      .order('item_id').range(from, from + 999);
    if (error) return null;
    out.push(...((data ?? []) as { item_id: string; source: string }[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function loadInventory(client: Pick<Client, 'from'>, userId: string): Promise<Set<string>> {
  try {
    const rows = await fetchInventoryRows(client, userId);
    return new Set((rows ?? []).map(r => String(r.item_id)));
  } catch {
    return new Set();
  }
}

export function ownerCtx(p: Profile, inventory: ReadonlySet<string>): OwnerCtx {
  return {
    inventory, vip: isVip(p), is_beta: !!p.is_beta, titles_won: p.titles_won ?? 0,
    honor_level: p.honor_level ?? 0, peak_tier: p.peak_tier ?? null,
    tournaments: p.tournaments ?? 0, kudos_count: p.kudos_count ?? 0,
  };
}

export async function loadProfileData(userId: string) {
  const client = await createClient();
  const [inventory, mastery, history] = await Promise.all([
    loadInventory(client, userId),
    client.from('mastery').select('champion_id, points, games, wins').eq('user_id', userId)
      .order('points', { ascending: false }).limit(6)
      .then(r => (r.error ? [] : (r.data ?? []) as MasteryRow[]), () => [] as MasteryRow[]),
    client.from('match_history')
      .select('id, mode, placement, players, matches_won, matches_played, lp_delta, be_gain, xp_gain, team, played_at')
      .eq('user_id', userId).order('played_at', { ascending: false }).limit(20)
      .then(r => (r.error ? [] : (r.data ?? []) as HistoryRow[]), () => [] as HistoryRow[]),
  ]);
  return { inventory, mastery, history };
}
