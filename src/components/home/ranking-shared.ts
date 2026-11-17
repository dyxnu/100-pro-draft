import type { Tier } from '@/lib/progress/rank';
import { DD_VERSION, isAvatar } from '@/lib/profile/avatars';

export interface RankRow {
  id: string;
  username: string;
  tag: string;
  avatar_url: string | null;
  tier: Tier;
  division: number | null;
  lp: number;
  score: number;
}

export interface RankingResult { rows: RankRow[]; error: string | null }

/** Imagem do ícone do jogador: id de campeão ("Diana") ou ícone de perfil do LoL ("icon:4568"). */
export function playerIconUrl(avatar: string | null | undefined) {
  if (avatar?.startsWith('icon:')) {
    const n = Number(avatar.slice(5));
    if (Number.isInteger(n) && n >= 0) return `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION}/img/profileicon/${n}.png`;
  }
  return `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION}/img/champion/${isAvatar(avatar) ? avatar : 'Diana'}.png`;
}
