// Regras puras da loja (sem banco): o que pode ser comprado, o que o jogador possui de fato,
// bônus de beta e itens do VIP. Testadas em rules.test.ts; quem grava é store/service.ts.
import { BETA_GRANTS, VIP_GRANTS, isFreeItem, itemById, type StoreItem } from './catalog';

export const RARITY_LABEL: Record<StoreItem['rarity'], string> = {
  comum: 'Comum', rara: 'Rara', epica: 'Épica', lendaria: 'Lendária', mitica: 'Mítica', suprema: 'Suprema',
};
export const RARITY_COLOR: Record<StoreItem['rarity'], string> = {
  comum: '#8b8fae', rara: '#2f8fd8', epica: '#8a5cf0', lendaria: '#e0763a', mitica: '#cf3fb8', suprema: '#e8b923',
};
export const RARITY_ORDER: StoreItem['rarity'][] = ['comum', 'rara', 'epica', 'lendaria', 'mitica', 'suprema'];

/** Item que pode ser comprado com essência (os de preço 0 são conquista, VIP ou beta). */
export const isForSale = (item: StoreItem) => item.price > 0 && !item.vipOnly && item.kind !== 'service';

export interface BuyContext {
  loggedIn: boolean;
  isGuest: boolean;
  balance: number;
  owned: ReadonlySet<string>;
}

export type BuyCheck =
  | { ok: true; item: StoreItem }
  | { ok: false; code: 'login' | 'guest' | 'unknown' | 'not_for_sale' | 'owned' | 'balance'; error: string };

/** Valida uma compra. Só a regra: o servidor ainda confere saldo e posse de forma atômica ao gravar. */
export function checkPurchase(itemId: string, ctx: BuyContext): BuyCheck {
  if (!ctx.loggedIn) return { ok: false, code: 'login', error: 'Entre na sua conta para comprar.' };
  if (ctx.isGuest) return { ok: false, code: 'guest', error: 'Convidados não compram na loja. Crie uma conta grátis para guardar sua essência e seus itens.' };
  const item = itemById(itemId);
  if (!item) return { ok: false, code: 'unknown', error: 'Item não encontrado.' };
  if (!isForSale(item)) {
    return { ok: false, code: 'not_for_sale', error: item.vipOnly ? 'Este item é exclusivo do VIP.' : 'Este item não está à venda.' };
  }
  if (ctx.owned.has(item.id) || isFreeItem(item.id)) return { ok: false, code: 'owned', error: 'Você já possui este item.' };
  if (ctx.balance < item.price) {
    return { ok: false, code: 'balance', error: `Faltam ${(item.price - ctx.balance).toLocaleString('pt-BR')} de Essência Azul.` };
  }
  return { ok: true, item };
}

export interface InventoryRow { item_id: string; source: string }

/**
 * O que o jogador possui de fato agora. Itens do VIP entregues pelo VIP (fonte 'vip')
 * só valem enquanto o VIP estiver ativo.
 */
export function effectiveOwned(rows: readonly InventoryRow[], vip: boolean): Set<string> {
  const out = new Set<string>();
  for (const r of rows) {
    if (!vip && r.source === 'vip' && VIP_GRANTS.includes(r.item_id)) continue;
    out.add(r.item_id);
  }
  return out;
}

/** Itens do VIP que ainda precisam ser entregues (só para quem está com VIP ativo). */
export function missingVipGrants(rows: readonly InventoryRow[], vip: boolean): string[] {
  if (!vip) return [];
  const have = new Set(rows.map(r => r.item_id));
  return VIP_GRANTS.filter(id => !have.has(id));
}

/** Bônus de beta disponível para resgate. */
export const canClaimBeta = (p: { is_beta?: boolean | null; beta_claimed?: boolean | null; is_guest?: boolean | null } | null | undefined) =>
  !!p?.is_beta && !p.beta_claimed && !p.is_guest;

/** Itens do beta que faltam (para não duplicar no inventário). */
export const missingBetaGrants = (owned: ReadonlySet<string>) => BETA_GRANTS.filter(id => !owned.has(id));

/** Dias inteiros (arredondados para cima) até uma data; 0 se já passou ou não existe. */
export function daysLeft(until: string | null | undefined, now = Date.now()): number {
  if (!until) return 0;
  const ms = new Date(until).getTime() - now;
  return ms > 0 ? Math.ceil(ms / 86_400_000) : 0;
}

/** Código de convite aceito na URL /convite/<code>. */
export const isValidReferralCode = (code: unknown): code is string => typeof code === 'string' && /^[A-Za-z0-9_-]{4,32}$/.test(code);

/** Texto normalizado para busca (sem acento, minúsculo). */
export const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
