// Ícones de perfil: qualquer campeão do Data Dragon. Guardamos só o id (ex.: "Diana") em profiles.avatar_url.
import ddragon from '@/lib/champions/ddragon.json';

type DD = { version: string; champions: Record<string, { name: string }> };
const DATA = ddragon as unknown as DD;

export const DD_VERSION = DATA.version;
export const DEFAULT_AVATAR = 'Diana';

/** Todos os campeões que podem virar ícone, em ordem alfabética pelo nome. */
export const AVATARS: { id: string; name: string }[] = Object.entries(DATA.champions)
  .map(([id, c]) => ({ id, name: c.name }))
  .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

export const isAvatar = (id: unknown): id is string => typeof id === 'string' && id in DATA.champions;

export const avatarUrl = (id: string | null | undefined) =>
  `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION}/img/champion/${isAvatar(id) ? id : DEFAULT_AVATAR}.png`;

/** Ícones fixos para os bots (um por vaga). */
const BOT_AVATARS = ['Nautilus', 'Rammus', 'KogMaw', 'Shyvana', 'Skarner', 'Malphite', 'Bard', 'Ivern'];
export const botAvatar = (seat: number) => BOT_AVATARS[seat % BOT_AVATARS.length];
