// Catálogo da loja e dos cosméticos. IDs são estáveis e gravados em inventory.item_id e nas colunas
// do perfil (title_id, banner_id, border_id, theme_id, victory_fx, avatar_url).
// Tudo é comprado só com Essência Azul (ganha jogando). Nada aqui muda atributos de partida.
import skinsData from '@/lib/champions/skins.json';
import { NAME_CHANGE_PRICE } from '@/lib/progress/rewards';

export type ItemKind = 'skin' | 'icon' | 'banner' | 'border' | 'theme' | 'victory' | 'title' | 'service';

export interface StoreItem {
  id: string;            // 'skin:Diana_2', 'icon:5000', 'banner:Diana_2', 'border:lua', 'theme:eclipse', 'victory:moonfall', 'title:beta'
  kind: ItemKind;
  name: string;
  price: number;         // essência azul; 0 = não está à venda (conquista/VIP/beta)
  rarity: 'comum' | 'rara' | 'epica' | 'lendaria' | 'mitica';
  champId?: string;      // skins e banners
  skinNum?: number;
  vipOnly?: boolean;
  description?: string;
}

const DD_VERSION = '16.22.1';
export const skinLoadingUrl = (champId: string, num = 0) => `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${champId}_${num}.jpg`;
export const skinSplashUrl = (champId: string, num = 0) => `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champId}_${num}.jpg`;
export const skinCenteredUrl = (champId: string, num = 0) => `https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${champId}_${num}.jpg`;
export const profileIconUrl = (iconId: number) => `https://ddragon.leagueoflegends.com/cdn/${DD_VERSION}/img/profileicon/${iconId}.png`;

/** Skins de cada campeão (num > 0) — Data Dragon, sincronizado por scripts/sync-skins.mjs. */
export const SKINS = skinsData as Record<string, { num: number; name: string }[]>;

function skinPrice(name: string): { price: number; rarity: StoreItem['rarity'] } {
  if (/Prest[ií]gio|Prestige/i.test(name)) return { price: 9_000, rarity: 'mitica' };
  if (/Eterno|Elderwood|Ascens|Imortal|Ultimate|Supremo|Divino|Aspecto/i.test(name)) return { price: 6_300, rarity: 'lendaria' };
  if (/Cosmos|Guardi|Fliperama|Arcade|Projeto|PROJECT|Rainha|Celestia|Draconian|Dragões|Coven|Sab[aá]/i.test(name)) return { price: 4_800, rarity: 'epica' };
  return { price: 3_150, rarity: 'rara' };
}

const SKIN_ITEMS: StoreItem[] = Object.entries(SKINS).flatMap(([champId, list]) => list.map(s => ({
  id: `skin:${champId}_${s.num}`, kind: 'skin' as const, name: s.name, champId, skinNum: s.num, ...skinPrice(s.name),
})));

// Ícones de perfil do LoL (Data Dragon). 0–28: grátis para todos. Os demais, à venda.
export const FREE_ICONS = Array.from({ length: 29 }, (_, i) => i);
const SHOP_ICON_IDS = [
  588, 590, 744, 785, 1105, 1211, 1301, 1385, 1442, 1588, 1628, 3150, 3379, 3502, 3797, 4022, 4219, 4568, 4644, 4834,
  4900, 5021, 5142, 5340, 5384, 5455, 5562, 5698, 5790, 5888, 6017, 6270, 6345, 6521, 6631, 6743,
];
const ICON_ITEMS: StoreItem[] = SHOP_ICON_IDS.map((id, i) => ({
  id: `icon:${id}`, kind: 'icon' as const, name: `Ícone #${id}`, price: i % 3 === 0 ? 1_200 : 750, rarity: i % 3 === 0 ? 'rara' : 'comum',
}));

// Bordas, temas, efeitos de vitória e títulos são ORIGINAIS (não são da Riot).
const BORDERS: StoreItem[] = [
  { id: 'border:prata', kind: 'border', name: 'Prata Lunar', price: 900, rarity: 'comum' },
  { id: 'border:ouro', kind: 'border', name: 'Crescente Dourado', price: 2_400, rarity: 'rara' },
  { id: 'border:eclipse', kind: 'border', name: 'Eclipse', price: 4_200, rarity: 'epica' },
  { id: 'border:aurora', kind: 'border', name: 'Aurora', price: 4_200, rarity: 'epica' },
  { id: 'border:supernova', kind: 'border', name: 'Supernova', price: 7_500, rarity: 'lendaria' },
  { id: 'border:vip', kind: 'border', name: 'Borda VIP', price: 0, rarity: 'lendaria', vipOnly: true },
];
const THEMES: StoreItem[] = [
  { id: 'theme:noite', kind: 'theme', name: 'Noite Lunar', price: 0, rarity: 'comum', description: 'Tema padrão' },
  { id: 'theme:eclipse', kind: 'theme', name: 'Eclipse Carmesim', price: 3_000, rarity: 'rara' },
  { id: 'theme:aurora', kind: 'theme', name: 'Aurora Boreal', price: 3_000, rarity: 'rara' },
  { id: 'theme:hextec', kind: 'theme', name: 'Hextec', price: 4_500, rarity: 'epica' },
  { id: 'theme:sombras', kind: 'theme', name: 'Ilhas das Sombras', price: 4_500, rarity: 'epica' },
];
const VICTORY: StoreItem[] = [
  { id: 'victory:confete', kind: 'victory', name: 'Chuva de Confete', price: 1_500, rarity: 'comum' },
  { id: 'victory:estrelas', kind: 'victory', name: 'Estrelas Cadentes', price: 3_200, rarity: 'rara' },
  { id: 'victory:moonfall', kind: 'victory', name: 'Queda Lunar', price: 5_500, rarity: 'epica' },
  { id: 'victory:fogos', kind: 'victory', name: 'Fogos Hextec', price: 5_500, rarity: 'epica' },
];
export const TITLES: StoreItem[] = [
  { id: 'title:alpha', kind: 'title', name: 'Alpha Tester', price: 0, rarity: 'mitica', description: 'Jogou durante o beta' },
  { id: 'title:vip', kind: 'title', name: 'Apoiador VIP', price: 0, rarity: 'lendaria', vipOnly: true },
  { id: 'title:campeao', kind: 'title', name: 'Campeão', price: 0, rarity: 'rara', description: 'Venceu um campeonato' },
  { id: 'title:pentacampeao', kind: 'title', name: 'Pentacampeão', price: 0, rarity: 'epica', description: 'Venceu 5 campeonatos' },
  { id: 'title:honrado', kind: 'title', name: 'Honrado', price: 0, rarity: 'rara', description: 'Chegou à honra 5' },
  { id: 'title:leiloeiro', kind: 'title', name: 'Leiloeiro', price: 2_000, rarity: 'comum' },
  { id: 'title:lunari', kind: 'title', name: 'Lunari', price: 3_500, rarity: 'rara' },
  { id: 'title:desafiante', kind: 'title', name: 'Desafiante', price: 0, rarity: 'mitica', description: 'Chegou ao Desafiante' },
];
const SERVICES: StoreItem[] = [
  { id: 'service:rename', kind: 'service', name: 'Troca de nome', price: NAME_CHANGE_PRICE, rarity: 'comum', description: 'Muda seu nome de invocador' },
];

/** Banners de perfil: a splash de qualquer skin (padrão grátis; skins exigem possuir a skin). */
export const bannerIdFor = (champId: string, num = 0) => `banner:${champId}_${num}`;

export const CATALOG: StoreItem[] = [...SKIN_ITEMS, ...ICON_ITEMS, ...BORDERS, ...THEMES, ...VICTORY, ...TITLES, ...SERVICES];
const BY_ID = new Map(CATALOG.map(i => [i.id, i]));
export const itemById = (id: string) => BY_ID.get(id) ?? null;

/** O que vem com o bônus de beta. */
export const BETA_GRANTS = ['title:alpha', 'border:prata', 'victory:confete'];
/** O que o VIP libera enquanto estiver ativo. */
export const VIP_GRANTS = ['title:vip', 'border:vip'];

/** Itens que todo mundo tem sem comprar. */
export function isFreeItem(id: string): boolean {
  if (id === 'theme:noite') return true;
  if (id.startsWith('icon:')) return FREE_ICONS.includes(Number(id.slice(5)));
  if (id.startsWith('banner:')) return id.endsWith('_0');
  return false;
}
