'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { SITE_URL, isSupabaseConfigured } from '@/lib/supabase/env';
import { isAvatar } from '@/lib/profile/avatars';

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
  if (password.length < 8) return { error: 'A senha precisa ter pelo menos 8 caracteres.' };

  const supabase = await createClient();
  const { data: taken } = await supabase.from('profiles').select('id').eq('username', username) /* citext: sem diferenciar maiúsculas */.maybeSingle();
  if (taken) return { error: 'Esse nome de usuário já está em uso.' };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
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

export async function updateUsername(_: FormState, form: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const username = String(form.get('username') ?? '').trim();
  if (!USERNAME_RE.test(username)) return { error: 'Nome de usuário: 3 a 16 caracteres, só letras, números e _.' };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Sessão expirada. Entre novamente.' };
  const { error } = await supabase.from('profiles').update({ username }).eq('id', user.id);
  if (error) return { error: error.code === '23505' ? 'Esse nome de usuário já está em uso.' : 'Não foi possível salvar.' };
  revalidatePath('/', 'layout');
  return { message: 'Nome de usuário atualizado.' };
}

/** Troca o ícone do perfil (id de um campeão do Data Dragon). */
export async function updateAvatar(champId: string): Promise<FormState> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  if (!isAvatar(champId)) return { error: 'Ícone inválido.' };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Sessão expirada. Entre novamente.' };
  const { error } = await supabase.from('profiles').update({ avatar_url: champId }).eq('id', user.id);
  if (error) return { error: 'Não foi possível salvar o ícone.' };
  revalidatePath('/', 'layout');
  return { message: 'Ícone atualizado.' };
}
