import { describe, expect, it } from 'vitest';
import { BETA_GRANTS, CATALOG, VIP_GRANTS } from './catalog';
import { canClaimBeta, checkPurchase, daysLeft, effectiveOwned, isForSale, isValidReferralCode, missingBetaGrants, missingVipGrants } from './rules';

const forSale = CATALOG.find(i => i.kind === 'border' && i.price > 0)!;
const ctx = { loggedIn: true, isGuest: false, balance: 100_000, owned: new Set<string>() };

describe('checkPurchase', () => {
  it('aceita item à venda com saldo', () => {
    const r = checkPurchase(forSale.id, ctx);
    expect(r.ok).toBe(true);
  });
  it('exige login e recusa convidado', () => {
    expect(checkPurchase(forSale.id, { ...ctx, loggedIn: false })).toMatchObject({ ok: false, code: 'login' });
    expect(checkPurchase(forSale.id, { ...ctx, isGuest: true })).toMatchObject({ ok: false, code: 'guest' });
  });
  it('recusa item inexistente, VIP, conquista e serviço', () => {
    expect(checkPurchase('skin:Nada_99', ctx)).toMatchObject({ code: 'unknown' });
    expect(checkPurchase('border:vip', ctx)).toMatchObject({ code: 'not_for_sale' });
    expect(checkPurchase('title:alpha', ctx)).toMatchObject({ code: 'not_for_sale' });
    expect(checkPurchase('service:rename', ctx)).toMatchObject({ code: 'not_for_sale' });
  });
  it('recusa item já possuído ou grátis', () => {
    expect(checkPurchase(forSale.id, { ...ctx, owned: new Set([forSale.id]) })).toMatchObject({ code: 'owned' });
    expect(checkPurchase('theme:noite', ctx)).toMatchObject({ ok: false });
  });
  it('recusa saldo insuficiente (inclusive saldo exato menos 1)', () => {
    expect(checkPurchase(forSale.id, { ...ctx, balance: forSale.price - 1 })).toMatchObject({ code: 'balance' });
    expect(checkPurchase(forSale.id, { ...ctx, balance: forSale.price }).ok).toBe(true);
  });
});

describe('catálogo', () => {
  it('tem ids únicos e nenhum item VIP à venda', () => {
    expect(new Set(CATALOG.map(i => i.id)).size).toBe(CATALOG.length);
    expect(CATALOG.filter(i => i.vipOnly).every(i => !isForSale(i))).toBe(true);
  });
  it('bônus de beta e VIP apontam para itens existentes', () => {
    for (const id of [...BETA_GRANTS, ...VIP_GRANTS]) expect(CATALOG.some(i => i.id === id)).toBe(true);
  });
});

describe('VIP e beta', () => {
  it('itens do VIP só valem com VIP ativo', () => {
    const rows = [{ item_id: 'title:vip', source: 'vip' }, { item_id: 'border:ouro', source: 'loja' }];
    expect(effectiveOwned(rows, true).has('title:vip')).toBe(true);
    expect(effectiveOwned(rows, false).has('title:vip')).toBe(false);
    expect(effectiveOwned(rows, false).has('border:ouro')).toBe(true);
    expect(missingVipGrants(rows, true)).toEqual(['border:vip']);
    expect(missingVipGrants(rows, false)).toEqual([]);
  });
  it('resgate do beta só uma vez e nunca para convidado', () => {
    expect(canClaimBeta({ is_beta: true, beta_claimed: false })).toBe(true);
    expect(canClaimBeta({ is_beta: true, beta_claimed: true })).toBe(false);
    expect(canClaimBeta({ is_beta: true, beta_claimed: false, is_guest: true })).toBe(false);
    expect(canClaimBeta(null)).toBe(false);
    expect(canClaimBeta({})).toBe(false); // migração ainda não rodou
    expect(missingBetaGrants(new Set(['title:alpha']))).not.toContain('title:alpha');
  });
  it('dias restantes e código de convite', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    expect(daysLeft('2026-01-03T12:00:00Z', now)).toBe(3);
    expect(daysLeft('2025-12-31T00:00:00Z', now)).toBe(0);
    expect(daysLeft(null, now)).toBe(0);
    expect(isValidReferralCode('a1b2c3d4')).toBe(true);
    expect(isValidReferralCode('x')).toBe(false);
    expect(isValidReferralCode('../../etc')).toBe(false);
  });
});
