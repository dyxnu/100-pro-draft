'use server';

// Chat (global e da sala) e elogios de fim de campeonato. Tudo é validado aqui e gravado com o
// cliente admin; o navegador só lê (RLS) e recebe as mensagens novas pelo Realtime.
import { getCurrentUser, isVip } from '@/lib/supabase/server';
import { createAdminClient, isAdminConfigured } from '@/lib/supabase/admin';
import { censor } from '@/lib/moderation/profanity';
import { HONOR_PER_KUDOS, addHonor } from '@/lib/progress/rewards';
import {
  CHAT_COOLDOWN_MS, MISSING_SOCIAL, type ChatMessage, cleanBody, isKudosKind, isMissingSchema, parseChannel,
} from '@/components/chat/shared';

export type ChatSendResult = { ok: true; message: ChatMessage } | { ok: false; error: string };
export type KudosResult = { ok: true } | { ok: false; error: string };

const NO_ADMIN = 'O servidor ainda não tem a chave secreta do Supabase (SUPABASE_SECRET_KEY).';

export async function sendChatAction(channel: string, raw: string): Promise<ChatSendResult> {
  const session = await getCurrentUser();
  const profile = session?.profile;
  if (!profile) return { ok: false, error: 'Entre na sua conta para conversar.' };
  if (!isAdminConfigured) return { ok: false, error: NO_ADMIN };
  const target = parseChannel(String(channel));
  if (!target) return { ok: false, error: 'Canal de chat inválido.' };
  const body = cleanBody(String(raw ?? ''));
  if (!body) return { ok: false, error: 'Escreva alguma coisa.' };
  if (target.roomId === null) return { ok: false, error: 'O chat é só dentro das salas.' };

  const admin = createAdminClient();
  if (target.roomId) {
    const { data: seat } = await admin.from('room_members').select('seat')
      .eq('room_id', target.roomId).eq('user_id', profile.id).maybeSingle();
    if (!seat) return { ok: false, error: 'Entre na sala para falar no chat dela.' };
  }

  // 1 mensagem por segundo por pessoa (em qualquer canal).
  const { data: last, error: lastErr } = await admin.from('chat_messages').select('created_at')
    .eq('user_id', profile.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (isMissingSchema(lastErr)) return { ok: false, error: MISSING_SOCIAL };
  if (last && Date.now() - Date.parse(last.created_at) < CHAT_COOLDOWN_MS) {
    return { ok: false, error: 'Calma! Uma mensagem por segundo.' };
  }

  const { data, error } = await admin.from('chat_messages').insert({
    channel: String(channel),
    user_id: profile.id,
    username: profile.username,
    title_id: profile.title_id ?? null,
    is_vip: isVip(profile),
    body: censor(body),
  }).select('id, channel, user_id, username, title_id, is_vip, body, created_at').single<ChatMessage>();
  if (error || !data) return { ok: false, error: isMissingSchema(error) ? MISSING_SOCIAL : 'Não foi possível enviar a mensagem.' };
  return { ok: true, message: data };
}

/** Elogio de fim de campeonato: 1 por pessoa por sala, para outro humano da mesma sala. */
export async function giveKudosAction(roomId: string, toUser: string, kind: string): Promise<KudosResult> {
  const session = await getCurrentUser();
  const profile = session?.profile;
  if (!profile) return { ok: false, error: 'Entre na sua conta para elogiar.' };
  if (profile.is_guest) return { ok: false, error: 'Convidados não podem elogiar. Crie uma conta!' };
  if (!isAdminConfigured) return { ok: false, error: NO_ADMIN };
  if (!isKudosKind(kind)) return { ok: false, error: 'Tipo de elogio inválido.' };
  if (!roomId || !toUser || parseChannel(`sala:${roomId}`) === undefined) return { ok: false, error: 'Sala inválida.' };
  if (toUser === profile.id) return { ok: false, error: 'Não dá para elogiar a si mesmo. 😉' };

  const admin = createAdminClient();
  const { data: room } = await admin.from('rooms').select('id, status').eq('id', roomId).maybeSingle();
  if (!room) return { ok: false, error: 'Sala não encontrada.' };
  if (room.status !== 'finished') return { ok: false, error: 'Os elogios abrem quando o campeonato termina.' };
  const { data: members } = await admin.from('room_members').select('user_id').eq('room_id', roomId).not('user_id', 'is', null);
  const ids = new Set((members ?? []).map(m => m.user_id as string));
  if (!ids.has(profile.id)) return { ok: false, error: 'Só quem jogou nesta sala pode elogiar.' };
  if (!ids.has(toUser)) return { ok: false, error: 'Essa pessoa não jogou nesta sala.' };

  const { error } = await admin.from('kudos').insert({ from_user: profile.id, to_user: toUser, room_id: roomId, kind });
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Você já deu seu elogio nesta sala.' };
    return { ok: false, error: isMissingSchema(error) ? MISSING_SOCIAL : 'Não foi possível registrar o elogio.' };
  }

  // Contador e honra do elogiado.
  const { data: target } = await admin.from('profiles').select('kudos_count, honor_level, honor_progress').eq('id', toUser).maybeSingle();
  if (target) {
    const honor = addHonor(target.honor_level ?? 2, target.honor_progress ?? 0, HONOR_PER_KUDOS);
    await admin.from('profiles').update({
      kudos_count: (target.kudos_count ?? 0) + 1, honor_level: honor.level, honor_progress: honor.progress,
    }).eq('id', toUser);
  }
  return { ok: true };
}
