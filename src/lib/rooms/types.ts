import type { AuctionState, BotProfile, Role } from '@/lib/auction/engine';
import type { BotBrains } from '@/lib/auction/bots';
import type { Strategy } from '@/lib/match/model';
import type { TournamentState } from '@/lib/tournament/engine';

export type RoomStatus = 'lobby' | 'drafting' | 'finished' | 'abandoned';
export type RoomSpeed = 'normal' | 'rapido';
export type RoomMode = 'casual' | 'ranked';

/** Elo de cada jogador humano, para o saguão (lido de profiles; vazio sem a migração 0006). */
export interface LobbyRank { label: string; color: string | null; guest: boolean }

export interface RoomRow {
  id: string;
  code: string;
  host_id: string;
  mode: RoomMode;
  status: RoomStatus;
  bots_enabled: boolean;
  speed: RoomSpeed;
  max_players: number;
  show_overall: boolean;
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
  ready: boolean;
}

export interface AuctionRow {
  id: string;
  room_id: string;
  state: AuctionState;
  bot_brains: BotBrains;
  tournament: TournamentState | null;
  version: number;
  next_tick_at: string | null;
}

/** O que o navegador pode pedir. Tudo é validado no servidor. */
export type ClientAction =
  | { type: 'bid'; amount: number }
  | { type: 'pass' }
  | { type: 'route'; role: Role }
  | { type: 'lineup_swap'; a: Role; b: Role }
  | { type: 'strategy'; strategy: Strategy }
  | { type: 'ready'; ready: boolean }
  | { type: 'tick' };

export interface ActionResponse {
  ok: boolean;
  reason?: string;
  serverNow: number;
  state?: AuctionState;
  tournament?: TournamentState | null;
  nextTickAt?: number | null;
}

export const seatPlayerId = (seat: number) => `seat${seat}`;
export const playerSeat = (playerId: string) => Number(playerId.replace('seat', ''));
export const ROOM_SIZE = 6;
