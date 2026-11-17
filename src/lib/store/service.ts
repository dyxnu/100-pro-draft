import 'server-only';
// Loja no servidor: lê inventário, entrega itens do VIP/beta e faz compras com segurança.
// Escrita de moeda/inventário SÓ aqui, com o cliente admin (service role).
import { createClient, getCurrentUser, isVip, type Profile } from '@/lib/supabase/server';
import { createAdminClient, isAdminConfigured } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { BETA_BONUS_BE } from '@/lib/progress/rewards';
import { BETA_GRANTS } from './catalog';
import { notify } from '@/lib/notify/service';
import { fetchInventoryRows } from '@/components/profile/data';
import { BETA_BONUS_BE as BETA_BE } from '@/lib/progress/rewards';
import { type InventoryRow, canClaimBeta, checkPurchase, effectiveOwned, missingBetaGrants, missingVipGrants } from './rules';

export interface StoreSession {
  userId: string | null;
  profile: Profile | null;
  /** Migração 0006 aplicada (colunas novas no perfil + tabela inventory). */
  ready: boolean;
  vip: boolean;
  owned: Set<string>;
}

const EMPTY: StoreSession = { userId: null, profile: null, ready: false, vip: false, owned: new Set() };

/** Perfil + inventário do usuário logado. Nunca lança: sem banco/migração volta com ready=false. */
export async function loadStoreSession(): Promise<StoreSession> {
  if (!isSupabaseConfigured) return EMPTY;
  let session: Awaited<ReturnType<typeof getCurrentUser>> = null;
  try { session = await getCurrentUser(); } catch { return EMPTY; }
  if (!session) return EMPTY;
  const profile = session.profile ?? null;
  const userId = session.user.id;
  const vip = isVip(profile);
  if (!profile || typeof profile.blue_essence !== 'number') return { userId, profile, ready: false, vip, owned: new Set() };

  let rows: InventoryRow[] = [];
  try {
    const supabase = await createClient();
    const data = await fetchInventoryRows(supabase, userId);
    if (!data) return { userId, profile, ready: false, vip, owned: new Set() };
    rows = data as InventoryRow[];
  } catch {
    return { userId, profile, ready: false, vip, owned: new Set() };
  }

  // Entregas automáticas: itens do VIP enquanto ativo; itens do beta que faltaram num resgate.
  const toGrant: InventoryRow[] = [
    ...missingVipGrants(rows, vip).map(item_id => ({ item_id, source: 'vip' })),
    ...(profile.beta_claimed ? missingBetaGrants(new Set(rows.map(r => r.item_id))).map(item_id => ({ item_id, source: 'beta' })) : []),
  ];
  if (toGrant.length && isAdminConfigured && !profile.is_guest) {
    try {
      await createAdminClient().from('inventory')
        .upsert(toGrant.map(r => ({ user_id: userId, ...r })), { onConflict: 'user_id,item_id', ignoreDuplicates: true });
      rows = [...rows, ...toGrant];
    } catch (e) {
      console.error('[loja] falha ao entregar itens', e);
    }
  }
  return { userId, profile, ready: true, vip, owned: effectiveOwned(rows, vip) };
}

export type ActionResult = { ok: true; balance: number; message?: string } | { ok: false; error: string };

const NOT_READY = 'A loja está sendo preparada. Tente de novo em alguns minutos.';

async function preflight(): Promise<{ s: StoreSession } | { error: string }> {
  if (!isSupabaseConfigured) return { error: 'O Supabase ainda não foi configurado neste ambiente.' };
  const s = await loadStoreSession();
  if (!s.userId) return { error: 'Entre na sua conta para continuar.' };
  if (!s.ready) return { error: NOT_READY };
  if (!isAdminConfigured) return { error: 'O servidor ainda não está pronto para a loja (chave secreta ausente).' };
  return { s };
}

/** Compra um item: reserva no inventário (chave única) e só então debita com comparação do saldo. */
export async function buyItem(itemId: string): Promise<ActionResult> {
  const pre = await preflight();
  if ('error' in pre) return { ok: false, error: pre.error };
  const { s } = pre;
  const userId = s.userId!;
  const check = checkPurchase(itemId, {
    loggedIn: true, isGuest: !!s.profile?.is_guest, balance: s.profile?.blue_essence ?? 0, owned: s.owned,
  });
  if (!check.ok) return { ok: false, error: check.error };
  const { item } = check;
  const admin = createAdminClient();

  // 1) Reserva: a chave (user_id, item_id) impede comprar o mesmo item duas vezes (clique duplo).
  const { error: insErr } = await admin.from('inventory').insert({ user_id: userId, item_id: item.id, source: 'loja' });
  if (insErr) {
    if (insErr.code === '23505') return { ok: false, error: 'Você já possui este item.' };
    console.error('[loja] reserva falhou', insErr);
    return { ok: false, error: NOT_READY };
  }
  const rollback = () => admin.from('inventory').delete().eq('user_id', userId).eq('item_id', item.id).eq('source', 'loja');

  // 2) Débito com comparação: só grava se o saldo não mudou desde a leitura (compras simultâneas).
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: p } = await admin.from('profiles').select('blue_essence, is_guest').eq('id', userId).single();
    if (!p || p.is_guest || p.blue_essence < item.price) {
      await rollback();
      return { ok: false, error: p?.is_guest ? 'Convidados não compram na loja.' : 'Essência Azul insuficiente.' };
    }
    const { data: upd } = await admin.from('profiles')
      .update({ blue_essence: p.blue_essence - item.price })
      .eq('id', userId).eq('blue_essence', p.blue_essence)
      .select('blue_essence');
    if (upd?.length) {
      await notify(userId, { kind: 'loja', title: `Você comprou ${item.name}`, body: `-${item.price.toLocaleString('pt-BR')} de Essência Azul. Equipe no seu perfil.`, link: '/perfil' });
      return { ok: true, balance: upd[0].blue_essence as number, message: `${item.name} agora é seu!` };
    }
  }
  await rollback();
  return { ok: false, error: 'Não deu para concluir agora. Tente de novo.' };
}

/** Resgate único do bônus de Alpha Tester: essência, itens do beta e 1 troca de nome. */
export async function claimBeta(): Promise<ActionResult> {
  const pre = await preflight();
  if ('error' in pre) return { ok: false, error: pre.error };
  const userId = pre.s.userId!;
  if (!canClaimBeta(pre.s.profile)) return { ok: false, error: 'Não há bônus de beta para resgatar nesta conta.' };
  const admin = createAdminClient();

  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: p } = await admin.from('profiles')
      .select('blue_essence, name_change_tokens, is_beta, beta_claimed, is_guest').eq('id', userId).single();
    if (!p || !canClaimBeta(p)) return { ok: false, error: 'O bônus de beta já foi resgatado.' };
    // A condição beta_claimed = false garante um único resgate, mesmo com cliques simultâneos.
    const { data: upd } = await admin.from('profiles')
      .update({ beta_claimed: true, blue_essence: p.blue_essence + BETA_BONUS_BE, name_change_tokens: (p.name_change_tokens ?? 0) + 1 })
      .eq('id', userId).eq('beta_claimed', false).eq('blue_essence', p.blue_essence)
      .select('blue_essence');
    if (!upd?.length) continue;
    const { error } = await admin.from('inventory')
      .upsert(BETA_GRANTS.map(item_id => ({ user_id: userId, item_id, source: 'beta' })), { onConflict: 'user_id,item_id', ignoreDuplicates: true });
    if (error) console.error('[loja] itens do beta ficaram para a próxima visita', error); // loadStoreSession entrega depois
    await notify(userId, {
      kind: 'recompensa', title: 'Bônus de Alpha Tester resgatado!',
      body: `+${BETA_BE.toLocaleString('pt-BR')} de Essência Azul, título Alpha Tester, borda Prata Lunar, Chuva de Confete e 1 troca de nome.`,
      link: '/perfil',
    });
    return { ok: true, balance: upd[0].blue_essence as number, message: 'Bônus de Alpha Tester resgatado!' };
  }
  return { ok: false, error: 'Não deu para resgatar agora. Tente de novo.' };
}

export interface ReferralStats { played: number; signedUp: number }

/** Amigos convidados: quantos criaram conta pelo link e quantos já terminaram um campeonato. */
export async function loadReferralStats(userId: string): Promise<ReferralStats> {
  try {
    const supabase = await createClient();
    const [played, signed] = await Promise.all([
      supabase.from('referrals').select('referred', { count: 'exact', head: true }).eq('referrer', userId).eq('rewarded', true),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('referred_by', userId),
    ]);
    return { played: played.error ? 0 : played.count ?? 0, signedUp: signed.error ? 0 : signed.count ?? 0 };
  } catch {
    return { played: 0, signedUp: 0 };
  }
}
