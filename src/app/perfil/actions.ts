'use server';
// Ações do perfil: equipar cosméticos e trocar de nome. Tudo é validado aqui (posse, formato,
// custo) e gravado com o cliente admin — o navegador não tem permissão de UPDATE em profiles.
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createAdminClient, isAdminConfigured } from '@/lib/supabase/admin';
import { NAME_CHANGE_PRICE } from '@/lib/progress/rewards';
import { loadInventory, ownerCtx } from '@/components/profile/data';
import { EQUIP_COLUMN, EQUIP_KINDS, canEquip, renamePayment, usernameError, withDefaults, type EquipKind } from '@/components/profile/ownership';
import type { FormState } from '@/app/auth/actions';

const NOT_READY: FormState = { error: 'O servidor ainda não está configurado para salvar o perfil.' };

async function sessionUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Equipa (ou tira, com `null`) um cosmético do próprio perfil. */
export async function equipCosmetic(kind: EquipKind, value: string | null): Promise<FormState> {
  if (!isSupabaseConfigured || !isAdminConfigured) return NOT_READY;
  if (!EQUIP_KINDS.includes(kind)) return { error: 'Item inválido.' };
  const userId = await sessionUserId();
  if (!userId) return { error: 'Sessão expirada. Entre novamente.' };

  const admin = createAdminClient();
  const { data: raw } = await admin.from('profiles').select('*').eq('id', userId).single();
  if (!raw) return { error: 'Perfil não encontrado.' };
  const profile = withDefaults(raw);
  const inventory = await loadInventory(admin, userId);
  if (!canEquip(kind, value, ownerCtx(profile, inventory))) return { error: 'Você não tem esse item.' };

  const { error } = await admin.from('profiles').update({ [EQUIP_COLUMN[kind]]: value }).eq('id', userId);
  if (error) {
    return { error: error.code === '42703' ? 'O banco ainda não foi atualizado (migração 0006).' : 'Não foi possível salvar.' };
  }
  revalidatePath('/', 'layout');
  return { message: 'Salvo.' };
}

/**
 * Troca o nome de usuário. Custa 1 token de troca (bônus do beta) ou 14.900 de essência azul.
 * A cobrança e o nome novo vão numa única atualização condicionada ao saldo lido (sem corrida).
 */
export async function renameAction(_: FormState, form: FormData): Promise<FormState> {
  if (!isSupabaseConfigured || !isAdminConfigured) return NOT_READY;
  const username = String(form.get('username') ?? '').trim();
  const invalid = usernameError(username);
  if (invalid) return { error: invalid };
  const userId = await sessionUserId();
  if (!userId) return { error: 'Sessão expirada. Entre novamente.' };

  const admin = createAdminClient();
  const { data: raw } = await admin.from('profiles').select('*').eq('id', userId).single();
  if (!raw) return { error: 'Perfil não encontrado.' };
  const p = withDefaults(raw);
  if (p.is_guest) return { error: 'Convidados não podem trocar de nome. Crie uma conta.' };
  if (p.username === username) return { error: 'Esse já é o seu nome.' };

  const { data: taken } = await admin.from('profiles').select('id').eq('username', username).neq('id', userId).maybeSingle();
  if (taken) return { error: 'Esse nome de usuário já está em uso.' };

  const pay = renamePayment(p);
  if (!pay) return { error: `Você precisa de ${NAME_CHANGE_PRICE.toLocaleString('pt-BR')} de essência azul ou de um token de troca de nome.` };

  const patch = pay === 'token'
    ? { username, name_change_tokens: p.name_change_tokens - 1 }
    : { username, blue_essence: p.blue_essence - NAME_CHANGE_PRICE };
  let q = admin.from('profiles').update(patch).eq('id', userId);
  q = pay === 'token' ? q.eq('name_change_tokens', p.name_change_tokens) : q.eq('blue_essence', p.blue_essence);
  const { data: done, error } = await q.select('id');
  if (error) {
    if (error.code === '23505') return { error: 'Esse nome de usuário já está em uso.' };
    if (error.code === '42703') return { error: 'O banco ainda não foi atualizado (migração 0006).' };
    return { error: 'Não foi possível trocar o nome.' };
  }
  if (!done?.length) return { error: 'Seu saldo mudou enquanto isso. Tente de novo.' };

  revalidatePath('/', 'layout');
  return {
    message: pay === 'token'
      ? `Nome trocado para ${username} (usou 1 token de troca).`
      : `Nome trocado para ${username} (−${NAME_CHANGE_PRICE.toLocaleString('pt-BR')} de essência azul).`,
  };
}
