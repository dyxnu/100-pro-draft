// Regras puras do perfil: posse de cosméticos, validação de nome, valores padrão (migração 0006
// ainda não aplicada) e textos do histórico. Sem acesso a banco: testável e usada pelas ações do servidor.
import type { Profile } from '@/lib/supabase/server';
import { FREE_ICONS, SKINS, TITLES, itemById } from '@/lib/store/catalog';
import { isAvatar } from '@/lib/profile/avatars';
import { isOffensive } from '@/lib/moderation/profanity';
import { NAME_CHANGE_PRICE } from '@/lib/progress/rewards';
import { TIERS, type Tier } from '@/lib/progress/rank';

export type EquipKind = 'icon' | 'banner' | 'border' | 'title' | 'theme' | 'victory';
export const EQUIP_KINDS: readonly EquipKind[] = ['icon', 'banner', 'border', 'title', 'theme', 'victory'];

/** Coluna do perfil que cada tipo de cosmético ocupa. */
export const EQUIP_COLUMN: Record<EquipKind, keyof Profile> = {
  icon: 'avatar_url', banner: 'banner_id', border: 'border_id', title: 'title_id', theme: 'theme_id', victory: 'victory_fx',
};

/** O que é preciso saber do jogador para decidir posse. */
export interface OwnerCtx {
  inventory: ReadonlySet<string>;
  vip: boolean;
  is_beta: boolean;
  titles_won: number;
  honor_level: number;
  peak_tier: string | null;
}

// ---------------------------------------------------------------------------
// Valores padrão (tolerância: sem a migração 0006 as colunas novas vêm undefined)

const DEFAULTS: Omit<Profile, 'id' | 'username' | 'tag' | 'created_at'> = {
  avatar_url: null, level: 1, xp: 0, is_guest: false, blue_essence: 0, honor_level: 2, honor_progress: 0,
  kudos_count: 0, games: 0, wins: 0, titles_won: 0, tournaments: 0, rank_tier: null, rank_division: null, lp: 0,
  rank_score: -1, peak_tier: null, title_id: null, banner_id: null, border_id: null, theme_id: null, victory_fx: null,
  vip_until: null, is_beta: false, beta_claimed: false, name_change_tokens: 0, referral_code: null, referred_by: null,
};

export function withDefaults(p: Partial<Profile> & Pick<Profile, 'id' | 'username'>): Profile {
  const out = { ...DEFAULTS, tag: '', created_at: new Date(0).toISOString(), ...p } as Profile;
  for (const k of Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]) {
    if (out[k] === undefined) (out as unknown as Record<string, unknown>)[k] = DEFAULTS[k];
  }
  return out;
}

export const asTier = (t: string | null | undefined): Tier | null => (t && (TIERS as readonly string[]).includes(t) ? (t as Tier) : null);

// ---------------------------------------------------------------------------
// Ids

/** "icon:4568" → 4568; outra coisa → null. */
export function parseIcon(id: string | null | undefined): number | null {
  if (!id?.startsWith('icon:')) return null;
  const n = Number(id.slice(5));
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** "banner:Diana_2" → { champId: 'Diana', num: 2 }. */
export function parseBanner(id: string | null | undefined): { champId: string; num: number } | null {
  const m = /^banner:([A-Za-z0-9]+)_(\d{1,3})$/.exec(id ?? '');
  return m ? { champId: m[1], num: Number(m[2]) } : null;
}

/** Banner a mostrar: o escolhido, ou a splash padrão do campeão do ícone (ou Diana). */
export function bannerOf(p: Pick<Profile, 'banner_id' | 'avatar_url'>): { champId: string; num: number } {
  return parseBanner(p.banner_id) ?? { champId: isAvatar(p.avatar_url) ? p.avatar_url : 'Diana', num: 0 };
}

// ---------------------------------------------------------------------------
// Posse

/** Títulos que o jogador tem: comprados/ganhos no inventário + conquistas calculadas do perfil. */
export function ownedTitles(ctx: OwnerCtx): string[] {
  const earned = new Set<string>();
  if (ctx.is_beta) earned.add('title:alpha');
  if (ctx.vip) earned.add('title:vip');
  if (ctx.titles_won >= 1) earned.add('title:campeao');
  if (ctx.titles_won >= 5) earned.add('title:pentacampeao');
  if (ctx.honor_level >= 5) earned.add('title:honrado');
  if (ctx.peak_tier === 'DESAFIANTE') earned.add('title:desafiante');
  return TITLES.filter(t => {
    if (t.vipOnly && !ctx.vip) return false; // título VIP some quando o VIP acaba
    return earned.has(t.id) || ctx.inventory.has(t.id);
  }).map(t => t.id);
}

/** Ícone válido e do jogador: campeão (legado, todos), ícone grátis, ou ícone no inventário. */
export function ownsIcon(value: string, ctx: OwnerCtx): boolean {
  if (isAvatar(value)) return true;
  const n = parseIcon(value);
  if (n == null) return false;
  return FREE_ICONS.includes(n) || ctx.inventory.has(`icon:${n}`);
}

export function ownsBanner(value: string, ctx: OwnerCtx): boolean {
  const b = parseBanner(value);
  if (!b || !isAvatar(b.champId)) return false;
  if (b.num === 0) return true;
  if (!SKINS[b.champId]?.some(s => s.num === b.num)) return false;
  return ctx.inventory.has(`skin:${b.champId}_${b.num}`) || ctx.inventory.has(value);
}

/**
 * Pode equipar `value` no espaço `kind`? `null` = tirar (sempre pode, exceto o ícone).
 * Toda gravação passa por aqui no servidor: nada vindo do navegador é confiável.
 */
export function canEquip(kind: EquipKind, value: string | null, ctx: OwnerCtx): boolean {
  if (value == null) return kind !== 'icon';
  if (typeof value !== 'string' || value.length > 64) return false;
  switch (kind) {
    case 'icon': return ownsIcon(value, ctx);
    case 'banner': return ownsBanner(value, ctx);
    case 'title': return ownedTitles(ctx).includes(value);
    case 'border': {
      const item = itemById(value);
      if (item?.kind !== 'border') return false;
      if (item.vipOnly) return ctx.vip;
      return ctx.inventory.has(value);
    }
    case 'theme': {
      const item = itemById(value);
      if (item?.kind !== 'theme') return false;
      return value === 'theme:noite' || ctx.inventory.has(value);
    }
    case 'victory': {
      const item = itemById(value);
      return item?.kind === 'victory' && ctx.inventory.has(value);
    }
  }
}

/** Lista do que o jogador pode equipar em cada espaço (para os seletores). */
export function ownedOf(kind: 'border' | 'theme' | 'victory', ctx: OwnerCtx): string[] {
  const all = { border: ['border:prata', 'border:ouro', 'border:eclipse', 'border:aurora', 'border:supernova', 'border:vip'],
    theme: ['theme:noite', 'theme:eclipse', 'theme:aurora', 'theme:hextec', 'theme:sombras'],
    victory: ['victory:confete', 'victory:estrelas', 'victory:moonfall', 'victory:fogos'] }[kind];
  return all.filter(id => canEquip(kind, id, ctx));
}

/** Ícones de perfil (números) que o jogador tem: grátis + inventário. */
export function ownedIconIds(inventory: ReadonlySet<string>): number[] {
  const bought = [...inventory].map(parseIcon).filter((n): n is number => n != null && !FREE_ICONS.includes(n));
  return [...FREE_ICONS, ...bought.sort((a, b) => a - b)];
}

/** Skins (números) de um campeão que o jogador pode usar como banner (inclui a padrão 0). */
export function bannerSkinsFor(champId: string, inventory: ReadonlySet<string>): { num: number; name: string }[] {
  const list = (SKINS[champId] ?? []).filter(s => inventory.has(`skin:${champId}_${s.num}`) || inventory.has(`banner:${champId}_${s.num}`));
  return [{ num: 0, name: 'Padrão' }, ...list];
}

// ---------------------------------------------------------------------------
// Troca de nome

export const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;

/** Erro de validação do nome (formato ou ofensivo), ou null se o nome é aceitável. */
export function usernameError(name: string): string | null {
  if (!USERNAME_RE.test(name)) return 'Nome de usuário: 3 a 16 caracteres, só letras, números e _.';
  if (isOffensive(name)) return 'Esse nome não é permitido. Escolha um nome sem palavras ofensivas.';
  return null;
}

/** Como a troca de nome vai ser paga: com um token (bônus), com essência, ou não dá. */
export function renamePayment(p: Pick<Profile, 'name_change_tokens' | 'blue_essence'>): 'token' | 'essence' | null {
  if ((p.name_change_tokens ?? 0) > 0) return 'token';
  if ((p.blue_essence ?? 0) >= NAME_CHANGE_PRICE) return 'essence';
  return null;
}

// ---------------------------------------------------------------------------
// Textos

export const placementLabel = (n: number) => (n === 1 ? 'Campeão' : `${n}º lugar`);

export function winRate(wins: number, games: number): number | null {
  return games > 0 ? Math.round((wins / games) * 100) : null;
}

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ontem';
  if (d < 30) return `há ${d} dias`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return mo === 1 ? 'há 1 mês' : `há ${mo} meses`;
  const y = Math.floor(d / 365);
  return y <= 1 ? 'há 1 ano' : `há ${y} anos`;
}
