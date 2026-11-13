import type { AuctionState, BotProfile, Role } from '@/lib/auction/engine';
import type { BotBrains } from '@/lib/auction/bots';

export type RoomStatus = 'lobby' | 'drafting' | 'finished' | 'abandoned';
export type RoomSpeed = 'normal' | 'rapido';

export interface RoomRow {
  id: string;
  code: string;
  host_id: string;
  mode: 'casual' | 'ranked';
  status: RoomStatus;
  bots_enabled: boolean;
  speed: RoomSpeed;
  max_players: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface MemberRow {
  room_id: string;
  seat: number;
  user_id: string | null;
  bot_profile: BotProfile | null;
  display_name: string;
}

export interface AuctionRow {
  id: string;
  room_id: string;
  state: AuctionState;
  bot_brains: BotBrains;
  version: number;
  next_tick_at: string | null;
}

/** O que o navegador pode pedir. Tudo é validado no servidor. */
export type ClientAction =
  | { type: 'bid'; amount: number }
  | { type: 'route'; role: Role }
  | { type: 'tick' };

export interface ActionResponse {
  ok: boolean;
  reason?: string;
  serverNow: number;
  state?: AuctionState;
  nextTickAt?: number | null;
}

export const seatPlayerId = (seat: number) => `seat${seat}`;
export const playerSeat = (playerId: string) => Number(playerId.replace('seat', ''));
export const ROOM_SIZE = 6;
