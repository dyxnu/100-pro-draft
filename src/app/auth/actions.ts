'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { SITE_URL, isSupabaseConfigured } from '@/lib/supabase/env';
import { createAdminClient, isAdminConfigured } from '@/lib/supabase/admin';
import { isOffensive } from '@/lib/moderation/profanity';
import { canEquip, ownedIconIds, withDefaults } from '@/components/profile/ownership';
import { loadInventory, ownerCtx } from '@/components/profile/data';

export interface FormState {
  error?: string;
  message?: string;
}

const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;
const NOT_CONFIGURED: FormState = { error: 'O Supabase ainda não foi configurado neste ambiente.' };

function safeNext(value: FormDataEntryValue | null): string {
  const v = typeof value === 'string' ? value : '';
  return v.startsWith('/') && !v.startsWith('//') ? v : '/jogar';
}

function translate(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada).';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Este e-mail já tem uma conta.';
  if (m.includes('password should be')) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (m.includes('rate limit')) return 'Muitas tentativas. Espere um pouco e tente de novo.';
  if (m.includes('same password')) return 'A nova senha precisa ser diferente da anterior.';
  return 'Algo deu errado. Tente novamente.';
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const username = String(form.get('username') ?? '').trim();
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const next = safeNext(form.get('next'));

  if (!USERNAME_RE.test(username)) return { error: 'Nome de usuário: 3 a 16 caracteres, só letras, números e _.' };
  if (isOffensive(username)) return { error: 'Esse nome não é permitido. Que tal escolher outro, sem palavras ofensivas?' };
  if (password.length < 8) return { error: 'A senha precisa ter pelo menos 8 caracteres.' };

  // Código de convite (a rota de convite grava o cookie). O gatilho do banco registra quem convidou.
  const rawRef = (await cookies()).get('nx_ref')?.value ?? '';
  const ref = /^[A-Za-z0-9_-]{4,32}$/.test(rawRef) ? rawRef : null;

  const supabase = await createClient();
  const { data: taken } = await supabase.from('profiles').select('id').eq('username', username) /* citext: sem diferenciar maiúsculas */.maybeSingle();
  if (taken) return { error: 'Esse nome de usuário já está em uso.' };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: ref ? { username, ref } : { username },
      emailRedirectTo: `${SITE_URL}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { error: translate(error.message) };
  if (data.session) redirect(next); // confirmação de e-mail desligada: entra direto (Arena ou a sala do convite)
  return { message: 'Conta criada! Enviamos um link de confirmação para o seu e-mail.' };
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(form.get('email') ?? '').trim(),
    password: String(form.get('password') ?? ''),
  });
  if (error) return { error: translate(error.message) };
  revalidatePath('/', 'layout');
  redirect(safeNext(form.get('next')));
}

export async function signOut() {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(String(form.get('email') ?? '').trim(), {
    redirectTo: `${SITE_URL}/auth/confirm?next=/redefinir-senha`,
  });
  if (error && error.message.toLowerCase().includes('rate limit')) return { error: translate(error.message) };
  // Mesma resposta exista ou não a conta (não revela quais e-mails estão cadastrados).
  return { message: 'Se existir uma conta com esse e-mail, enviamos um link para redefinir a senha.' };
}

export async function updatePassword(_: FormState, form: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const password = String(form.get('password') ?? '');
  if (password.length < 8) return { error: 'A senha precisa ter pelo menos 8 caracteres.' };
  if (password !== String(form.get('confirm') ?? '')) return { error: 'As senhas não conferem.' };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: translate(error.message) };
  redirect('/perfil');
}

/**
 * Troca o ícone do perfil: id de campeão (legado) ou `icon:<id>` (ícone de perfil grátis ou comprado).
 * Valida a posse e grava com o cliente admin (o navegador não pode mais dar UPDATE em profiles).
 */
export async function updateAvatar(iconId: string): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  if (!isAdminConfigured) return { error: 'O servidor ainda não está configurado para salvar o perfil.' };
  if (typeof iconId !== 'string' || iconId.length > 40) return { error: 'Ícone inválido.' };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Sessão expirada. Entre novamente.' };
  const admin = createAdminClient();
  const { data: raw } = await admin.from('profiles').select('*').eq('id', user.id).single();
  if (!raw) return { error: 'Perfil não encontrado.' };
  const inventory = await loadInventory(admin, user.id);
  if (!canEquip('icon', iconId, ownerCtx(withDefaults(raw), inventory))) return { error: 'Você não tem esse ícone.' };
  const { error } = await admin.from('profiles').update({ avatar_url: iconId }).eq('id', user.id);
  if (error) return { error: 'Não foi possível salvar o ícone.' };
  revalidatePath('/', 'layout');
  return { message: 'Ícone atualizado.' };
}

/** Ícones de perfil (números) que o usuário logado pode usar: grátis + comprados. */
export async function listMyIcons(): Promise<number[]> {
  if (!isSupabaseConfigured) return ownedIconIds(new Set());
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return ownedIconIds(new Set());
  return ownedIconIds(await loadInventory(supabase, user.id));
}
