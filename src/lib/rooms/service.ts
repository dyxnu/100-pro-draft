import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  ROLES, type BotProfile, type Champion, type Role,
  chooseRoute, createGame, placeBid,
} from '@/lib/auction/engine';
import { createBrains } from '@/lib/auction/bots';
import { advance, nextWake } from '@/lib/auction/runner';
import {
  type ActionResponse, type AuctionRow, type ClientAction, type MemberRow, type RoomRow, type RoomSpeed,
  ROOM_SIZE, playerSeat, seatPlayerId,
} from './types';

type Admin = ReturnType<typeof createAdminClient>;
type Result<T = object> = ({ ok: true } & T) | { ok: false; reason: string };

const BOT_NAMES = ['Bot Barão', 'Bot Arauto', 'Bot Poro', 'Bot Arongueijo', 'Bot Dragão', 'Bot Cuidador'];
const BOT_PROFILES: BotProfile[] = ['agressivo', 'economico', 'equilibrado', 'estrategico', 'equilibrado', 'agressivo'];
const SPEED_CONFIG: Record<RoomSpeed, { bidTimeMs: number; routePickMs: number; intermissionMs: number }> = {
  normal: { bidTimeMs: 10_000, routePickMs: 10_000, intermissionMs: 1_500 },
  rapido: { bidTimeMs: 5_000, routePickMs: 7_000, intermissionMs: 900 },
};
const CODE_RE = /^[A-Z0-9]{6}$/;

export const normalizeCode = (code: string) => code.trim().toUpperCase();

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------
export async function loadCatalog(admin: Admin): Promise<Champion[]> {
  const { data: champs, error } = await admin.from('champions').select('id, name, tier').eq('active', true);
  if (error) throw error;
  const { data: routes, error: e2 } = await admin.from('champion_routes').select('champion_id, lane, is_primary');
  if (e2) throw e2;
  return champs.map(c => {
    const rs = routes.filter(r => r.champion_id === c.id)
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || ROLES.indexOf(a.lane) - ROLES.indexOf(b.lane));
    return { id: c.id, name: c.name, tier: c.tier as 1 | 2 | 3, routes: rs.map(r => r.lane as Role) };
  });
}

async function getRoom(admin: Admin, code: string): Promise<RoomRow | null> {
  const c = normalizeCode(code);
  if (!CODE_RE.test(c)) return null;
  const { data } = await admin.from('rooms').select('*').eq('code', c).maybeSingle<RoomRow>();
  return data;
}

async function getMembers(admin: Admin, roomId: string): Promise<MemberRow[]> {
  const { data, error } = await admin.from('room_members')
    .select('room_id, seat, user_id, bot_profile, display_name').eq('room_id', roomId).order('seat');
  if (error) throw error;
  return data as MemberRow[];
}

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------
export async function createRoom(
  userId: string, displayName: string, opts: { botsEnabled: boolean; speed: RoomSpeed },
): Promise<Result<{ code: string }>> {
  const admin = createAdminClient();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: room, error } = await admin.from('rooms')
      .insert({ host_id: userId, bots_enabled: opts.botsEnabled, speed: opts.speed, mode: 'casual' })
      .select('*').single<RoomRow>();
    if (error) {
      if (error.code === '23505') continue; // código repetido: tenta outro
      return { ok: false, reason: 'Não foi possível criar a sala.' };
    }
    const { error: e2 } = await admin.from('room_members')
      .insert({ room_id: room.id, seat: 0, user_id: userId, display_name: displayName });
    if (e2) {
      await admin.from('rooms').delete().eq('id', room.id);
      return { ok: false, reason: 'Não foi possível criar a sala.' };
    }
    return { ok: true, code: room.code };
  }
  return { ok: false, reason: 'Não foi possível gerar um código de sala.' };
}

export async function joinRoom(code: string, userId: string, displayName: string): Promise<Result> {
  const admin = createAdminClient();
  const room = await getRoom(admin, code);
  if (!room) return { ok: false, reason: 'Sala não encontrada.' };
  for (let attempt = 0; attempt < 4; attempt++) {
    const members = await getMembers(admin, room.id);
    if (members.some(m => m.user_id === userId)) return { ok: true };
    if (room.status !== 'lobby') return { ok: false, reason: 'Esse draft já começou.' };
    const taken = new Set(members.map(m => m.seat));
    const seat = [...Array(ROOM_SIZE).keys()].find(i => !taken.has(i));
    if (seat == null) return { ok: false, reason: 'A sala está cheia.' };
    const { error } = await admin.from('room_members')
      .insert({ room_id: room.id, seat, user_id: userId, display_name: displayName });
    if (!error) return { ok: true };
    if (error.code !== '23505') return { ok: false, reason: 'Não foi possível entrar na sala.' };
  }
  return { ok: false, reason: 'Muita gente entrando ao mesmo tempo. Tente de novo.' };
}

export async function leaveRoom(code: string, userId: string): Promise<Result> {
  const admin = createAdminClient();
  const room = await getRoom(admin, code);
  if (!room) return { ok: false, reason: 'Sala não encontrada.' };
  if (room.status !== 'lobby') return { ok: false, reason: 'Não dá para sair de um draft em andamento. Seu time fica salvo e você pode voltar quando quiser.' };
  await admin.from('room_members').delete().eq('room_id', room.id).eq('user_id', userId);

  if (room.host_id === userId) {
    const rest = (await getMembers(admin, room.id)).filter(m => m.user_id);
    if (rest.length) await admin.from('rooms').update({ host_id: rest[0].user_id }).eq('id', room.id);
    else await admin.from('rooms').update({ status: 'abandoned' }).eq('id', room.id);
  }
  return { ok: true };
}

export async function updateRoomSettings(
  code: string, userId: string, settings: { botsEnabled?: boolean; speed?: RoomSpeed },
): Promise<Result> {
  const admin = createAdminClient();
  const room = await getRoom(admin, code);
  if (!room) return { ok: false, reason: 'Sala não encontrada.' };
  if (room.host_id !== userId) return { ok: false, reason: 'Só o dono da sala pode mudar as configurações.' };
  if (room.status !== 'lobby') return { ok: false, reason: 'O draft já começou.' };
  const patch: Record<string, unknown> = {};
  if (settings.botsEnabled != null) patch.bots_enabled = settings.botsEnabled;
  if (settings.speed) patch.speed = settings.speed;
  await admin.from('rooms').update(patch).eq('id', room.id);
  return { ok: true };
}

export async function startDraft(code: string, userId: string, now = Date.now()): Promise<Result> {
  const admin = createAdminClient();
  const room = await getRoom(admin, code);
  if (!room) return { ok: false, reason: 'Sala não encontrada.' };
  if (room.host_id !== userId) return { ok: false, reason: 'Só o dono da sala pode iniciar.' };
  if (room.status !== 'lobby') return { ok: false, reason: 'O draft já começou.' };

  let members = await getMembers(admin, room.id);
  const free = [...Array(ROOM_SIZE).keys()].filter(i => !members.some(m => m.seat === i));
  if (free.length && !room.bots_enabled) {
    return { ok: false, reason: `Faltam ${free.length} jogador(es). Convide mais gente ou ative os bots.` };
  }
  if (free.length) {
    const used = new Set(members.map(m => m.display_name));
    const names = BOT_NAMES.filter(n => !used.has(n));
    const bots = free.map((seat, i) => ({
      room_id: room.id, seat, user_id: null,
      bot_profile: BOT_PROFILES[(seat + i) % BOT_PROFILES.length],
      display_name: names[i] ?? `Bot ${seat + 1}`,
    }));
    const { error } = await admin.from('room_members').insert(bots);
    if (error) return { ok: false, reason: 'Alguém entrou agora mesmo. Tente iniciar de novo.' };
    members = await getMembers(admin, room.id);
  }

  // Marca a sala como "em draft" primeiro: impede dois inícios simultâneos.
  const { data: claimed } = await admin.from('rooms')
    .update({ status: 'drafting', started_at: new Date(now).toISOString() })
    .eq('id', room.id).eq('status', 'lobby').select('id');
  if (!claimed?.length) return { ok: false, reason: 'O draft já começou.' };

  const champions = await loadCatalog(admin);
  const seed = Math.floor(Math.random() * 2 ** 31);
  const state = createGame({
    players: members.map(m => ({
      id: seatPlayerId(m.seat), name: m.display_name, isBot: !m.user_id, botProfile: m.bot_profile,
    })),
    champions,
    seed,
    now,
    config: SPEED_CONFIG[room.speed],
  });
  const brains = createBrains(state);
  advance(state, brains, now);

  const { error } = await admin.from('auctions').insert({
    room_id: room.id, seed, config: state.config, state, bot_brains: brains, version: 0,
    next_tick_at: toIso(nextWake(state, brains)),
  });
  if (error) {
    await admin.from('rooms').update({ status: 'lobby', started_at: null }).eq('id', room.id);
    return { ok: false, reason: 'Não foi possível iniciar o draft.' };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Leilão: toda ação passa por aqui (lance, rota, "cutucada" do relógio)
// ---------------------------------------------------------------------------
export async function performAction(
  code: string, userId: string, action: ClientAction, now = Date.now(),
): Promise<ActionResponse> {
  const admin = createAdminClient();
  const c = normalizeCode(code);
  if (!CODE_RE.test(c)) return { ok: false, reason: 'Sala não encontrada.', serverNow: now };

  // Uma única consulta traz sala + minha vaga + leilão (cada ida ao banco custa latência).
  const { data: joined } = await admin.from('rooms')
    .select('*, room_members(seat, user_id), auctions(*)')
    .eq('code', c).maybeSingle<RoomRow & { room_members: { seat: number; user_id: string | null }[]; auctions: AuctionRow | AuctionRow[] | null }>();
  if (!joined || (joined.status !== 'drafting' && joined.status !== 'finished'))
    return { ok: false, reason: 'Nenhum draft em andamento nesta sala.', serverNow: now };
  const room: RoomRow = joined;
  const me = joined.room_members.find(m => m.user_id === userId);
  if (!me) return { ok: false, reason: 'Você não está nesta sala.', serverNow: now };
  const playerId = seatPlayerId(me.seat);
  let preloaded = Array.isArray(joined.auctions) ? joined.auctions[0] ?? null : joined.auctions;

  for (let attempt = 0; attempt < 5; attempt++) {
    const row = preloaded
      ?? (await admin.from('auctions').select('*').eq('room_id', room.id).single<AuctionRow>()).data;
    preloaded = null; // nas novas tentativas, relê do banco
    if (!row) return { ok: false, reason: 'Leilão não encontrado.', serverNow: now };
    const s = row.state;
    const brains = row.bot_brains;
    const before = JSON.stringify([s, brains]);

    advance(s, brains, now);
    let result: { ok: boolean; reason?: string } = { ok: true };
    if (action.type === 'bid') result = placeBid(s, playerId, action.amount, now);
    else if (action.type === 'route') result = chooseRoute(s, playerId, action.role, now);
    advance(s, brains, now);

    const wake = nextWake(s, brains);
    if (JSON.stringify([s, brains]) === before) {
      return { ...result, serverNow: now, state: s, nextTickAt: wake };
    }

    // Trava otimista: só grava se ninguém gravou desde a leitura.
    const { data: saved } = await admin.from('auctions')
      .update({ state: s, bot_brains: brains, version: row.version + 1, next_tick_at: toIso(wake), updated_at: new Date().toISOString() })
      .eq('id', row.id).eq('version', row.version).select('id');
    if (!saved?.length) continue; // outro pedido ganhou a corrida: relê e refaz

    if (s.phase === 'finished' && room.status !== 'finished') await persistFinal(admin, room, row.id, s);
    return { ...result, serverNow: now, state: s, nextTickAt: wake };
  }
  return { ok: false, reason: 'Servidor ocupado, tente de novo.', serverNow: now };
}

async function persistFinal(admin: Admin, room: RoomRow, auctionId: string, s: AuctionRow['state']) {
  const rosters = s.players.flatMap(p => ROLES.map(lane => {
    const slot = p.roster[lane]!;
    return {
      auction_id: auctionId, seat: playerSeat(p.id), lane, champion_id: slot.champId,
      price_cents: slot.price, acquired_how: slot.how,
    };
  }));
  const bids = s.bids.map(b => ({
    auction_id: auctionId, seq: b.seq, seat: playerSeat(b.playerId), champion_id: b.champId,
    amount_cents: b.amount, created_at: new Date(b.at).toISOString(),
  }));
  await admin.from('rosters').upsert(rosters, { onConflict: 'auction_id,seat,lane', ignoreDuplicates: true });
  if (bids.length) await admin.from('bids').upsert(bids, { onConflict: 'auction_id,seq', ignoreDuplicates: true });
  await admin.from('rooms').update({ status: 'finished', finished_at: new Date().toISOString() }).eq('id', room.id);
}

const toIso = (ms: number | null) => (ms == null ? null : new Date(ms).toISOString());
