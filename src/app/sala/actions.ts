'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/supabase/server';
import { isAdminConfigured } from '@/lib/supabase/admin';
import {
  type RoomSettings, addBot, createRoom, joinRoom, leaveRoom, normalizeCode, removeBot, setLobbyReady, startDraft, updateRoomSettings,
} from '@/lib/rooms/service';
import type { RoomSpeed } from '@/lib/rooms/types';

export interface RoomFormState { error?: string }

async function requireUser(next: string) {
  const session = await getCurrentUser();
  if (!session?.profile) redirect(`/entrar?next=${encodeURIComponent(next)}`);
  return session;
}

const NOT_READY: RoomFormState = {
  error: 'O servidor ainda não tem a chave secreta do Supabase (SUPABASE_SECRET_KEY no .env.local).',
};
const speedOf = (v: FormDataEntryValue | null): RoomSpeed => (v === 'rapido' ? 'rapido' : 'normal');

export async function createRoomAction(_: RoomFormState, form: FormData): Promise<RoomFormState> {
  const { user, profile } = await requireUser('/jogar');
  if (!isAdminConfigured) return NOT_READY;
  const r = await createRoom(user.id, profile!.username, {
    botsEnabled: form.get('bots') === 'on',
    speed: speedOf(form.get('speed')),
  });
  if (!r.ok) return { error: r.reason };
  redirect(`/sala/${r.code}`);
}

/** "Treinar contra bots": cria uma sala só com bots e já começa o leilão. */
export async function trainAction(): Promise<RoomFormState> {
  const { user, profile } = await requireUser('/jogar');
  if (!isAdminConfigured) return NOT_READY;
  const r = await createRoom(user.id, profile!.username, { botsEnabled: true, speed: 'normal' });
  if (!r.ok) return { error: r.reason };
  const started = await startDraft(r.code, user.id, Date.now(), { fillBots: true });
  if (!started.ok) return { error: started.reason };
  redirect(`/sala/${r.code}`);
}

export async function goToRoomAction(_: RoomFormState, form: FormData): Promise<RoomFormState> {
  const code = normalizeCode(String(form.get('code') ?? ''));
  if (!/^[A-Z0-9]{6}$/.test(code)) return { error: 'O código tem 6 letras/números, ex.: A1B2C3.' };
  redirect(`/sala/${code}`);
}

export async function joinRoomAction(code: string): Promise<RoomFormState> {
  const { user, profile } = await requireUser(`/sala/${code}`);
  if (!isAdminConfigured) return NOT_READY;
  const r = await joinRoom(code, user.id, profile!.username);
  revalidatePath(`/sala/${code}`);
  return r.ok ? {} : { error: r.reason };
}

export async function leaveRoomAction(code: string): Promise<RoomFormState> {
  const { user } = await requireUser(`/sala/${code}`);
  if (!isAdminConfigured) return NOT_READY;
  const r = await leaveRoom(code, user.id);
  if (!r.ok) return { error: r.reason };
  redirect('/jogar');
}

export async function lobbyReadyAction(code: string, ready: boolean): Promise<RoomFormState> {
  const { user } = await requireUser(`/sala/${code}`);
  if (!isAdminConfigured) return NOT_READY;
  const r = await setLobbyReady(code, user.id, ready);
  revalidatePath(`/sala/${code}`);
  return r.ok ? {} : { error: r.reason };
}

export async function updateSettingsAction(code: string, settings: RoomSettings): Promise<RoomFormState> {
  const { user } = await requireUser(`/sala/${code}`);
  if (!isAdminConfigured) return NOT_READY;
  const r = await updateRoomSettings(code, user.id, settings);
  revalidatePath(`/sala/${code}`);
  return r.ok ? {} : { error: r.reason };
}

export async function addBotAction(code: string): Promise<RoomFormState> {
  const { user } = await requireUser(`/sala/${code}`);
  if (!isAdminConfigured) return NOT_READY;
  const r = await addBot(code, user.id);
  revalidatePath(`/sala/${code}`);
  return r.ok ? {} : { error: r.reason };
}

export async function removeBotAction(code: string, seat: number): Promise<RoomFormState> {
  const { user } = await requireUser(`/sala/${code}`);
  if (!isAdminConfigured) return NOT_READY;
  const r = await removeBot(code, user.id, Math.floor(Number(seat)));
  revalidatePath(`/sala/${code}`);
  return r.ok ? {} : { error: r.reason };
}

export async function startDraftAction(code: string): Promise<RoomFormState> {
  const { user } = await requireUser(`/sala/${code}`);
  if (!isAdminConfigured) return NOT_READY;
  const r = await startDraft(code, user.id);
  revalidatePath(`/sala/${code}`);
  return r.ok ? {} : { error: r.reason };
}
