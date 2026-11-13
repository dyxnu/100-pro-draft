import 'server-only';
import { ROLES, type Champion, type Role } from '@/lib/auction/engine';
import { STARTER_CHAMPIONS } from '@/lib/auction/champions';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { buildCard, type ChampionCard } from './cards';
import { SPECIFIC_COUNTERS, SYNERGIES, matchupEdge } from '@/lib/match/model';

/** Catálogo ativo (banco; se não houver Supabase, o catálogo inicial). */
export async function getCatalog(): Promise<Champion[]> {
  if (!isSupabaseConfigured) return STARTER_CHAMPIONS;
  const sb = await createClient();
  const [{ data: champs }, { data: routes }] = await Promise.all([
    sb.from('champions').select('id, name, tier').eq('active', true),
    sb.from('champion_routes').select('champion_id, lane, is_primary'),
  ]);
  if (!champs?.length || !routes) return STARTER_CHAMPIONS;
  return champs.map(c => ({
    id: c.id, name: c.name, tier: c.tier as 1 | 2 | 3,
    routes: routes.filter(r => r.champion_id === c.id)
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || ROLES.indexOf(a.lane) - ROLES.indexOf(b.lane))
      .map(r => r.lane as Role),
  }));
}

export interface CardWithInsights {
  card: ChampionCard;
  routes: Role[];
  strongVs: string[];
  weakVs: string[];
  synergies: { with: string; label: string }[];
}

export async function getCatalogCards(): Promise<CardWithInsights[]> {
  const catalog = await getCatalog();
  const cards = catalog.map(c => ({ card: buildCard(c.id, c.routes), routes: c.routes }));
  const byId = new Map(cards.map(c => [c.card.id, c.card]));
  return cards.map(({ card, routes }) => {
    const edges = cards.filter(o => o.card.id !== card.id).map(o => ({ id: o.card.id, e: matchupEdge(card, o.card) }));
    const named = (ids: string[]) => ids.map(id => byId.get(id)?.name ?? id);
    return {
      card, routes,
      strongVs: named(edges.filter(x => x.e >= 2 || SPECIFIC_COUNTERS[card.id]?.includes(x.id)).sort((a, b) => b.e - a.e).slice(0, 6).map(x => x.id)),
      weakVs: named(edges.filter(x => x.e <= -2).sort((a, b) => a.e - b.e).slice(0, 6).map(x => x.id)),
      synergies: SYNERGIES.filter(s => s.pair.includes(card.id)).map(s => ({
        with: byId.get(s.pair[0] === card.id ? s.pair[1] : s.pair[0])?.name ?? '', label: s.label,
      })),
    };
  });
}
