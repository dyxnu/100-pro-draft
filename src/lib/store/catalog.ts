// Catálogo da loja e dos cosméticos. IDs são estáveis e gravados em inventory.item_id e nas colunas
// do perfil (title_id, banner_id, border_id, theme_id, victory_fx, avatar_url).
// Tudo é comprado só com Essência Azul (ganha jogando). Nada aqui muda atributos de partida.
import skinsData from '@/lib/champions/skins.json';
import iconIds from './icon-ids.json';
import { NAME_CHANGE_PRICE } from '@/lib/progress/rewards';

export type ItemKind = 'skin' | 'icon' | 'banner' | 'border' | 'theme' | 'victory' | 'title' | 'service';

export interface StoreItem {
  id: string;            // 'skin:Diana_2', 'icon:5000', 'banner:Diana_2', 'border:lua', 'theme:eclipse', 'victory:moonfall', 'title:beta'
  kind: ItemKind;
  name: string;
  price: number;         // essência azul; 0 = não está à venda (conquista/VIP/beta)
  rarity: 'comum' | 'rara' | 'epica' | 'lendaria' | 'mitica' | 'suprema';
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
export const SKINS = skinsData as Record<string, { num: number; name: string; r?: string; l?: 1 }[]>;

/**
 * Preço como no LoL (mesmos números do RP, pagos em Essência Azul), pela raridade oficial da skin.
 * Skins sem raridade variam no LoL (520 a 1350): as de legado e as primeiras saem mais baratas.
 */
export function skinPrice(s: { num: number; r?: string; l?: 1 }): { price: number; rarity: StoreItem['rarity'] } {
  switch (s.r) {
    case 'kRare': return { price: 975, rarity: 'rara' };
    case 'kEpic': return { price: 1_350, rarity: 'epica' };
    case 'kLegendary': return { price: 1_820, rarity: 'lendaria' };
    case 'kMythic': return { price: 2_775, rarity: 'mitica' };
    case 'kUltimate': case 'kTranscendent': case 'kExalted': return { price: 3_250, rarity: 'suprema' };
    default: return { price: s.l ? 520 : s.num <= 3 ? 750 : 975, rarity: 'comum' };
  }
}

const SKIN_ITEMS: StoreItem[] = Object.entries(SKINS).flatMap(([champId, list]) => list.map(s => ({
  id: `skin:${champId}_${s.num}`, kind: 'skin' as const, name: s.name, champId, skinNum: s.num, ...skinPrice(s),
})));

// Ícones de perfil do LoL: 0–28 grátis para todos; os demais (todos os que o Data Dragon serve,
// sincronizados por scripts/sync-skins.mjs) à venda. Os nomes ficam em icons.json, carregado só na loja.
export const FREE_ICONS = Array.from({ length: 29 }, (_, i) => i);
export const SHOP_ICON_IDS = iconIds as number[];
/** Ícones mais novos custam um pouco mais (como os ícones de evento no LoL). */
export const iconPrice = (id: number): { price: number; rarity: StoreItem['rarity'] } =>
  id >= 6000 ? { price: 750, rarity: 'rara' } : { price: 450, rarity: 'comum' };
const ICON_ITEMS: StoreItem[] = SHOP_ICON_IDS.map(id => ({ id: `icon:${id}`, kind: 'icon' as const, name: `Ícone #${id}`, ...iconPrice(id) }));

// Bordas, temas, efeitos de vitória e títulos são ORIGINAIS (não são da Riot).
const BORDERS: StoreItem[] = [
  { id: 'border:prata', kind: 'border', name: 'Prata Lunar', price: 900, rarity: 'comum' },
  { id: 'border:ouro', kind: 'border', name: 'Crescente Dourado', price: 2_400, rarity: 'rara' },
  { id: 'border:eclipse', kind: 'border', name: 'Eclipse', price: 4_200, rarity: 'epica' },
  { id: 'border:aurora', kind: 'border', name: 'Aurora', price: 4_200, rarity: 'epica' },
  { id: 'border:supernova', kind: 'border', name: 'Supernova', price: 7_500, rarity: 'lendaria' },
  { id: 'border:hextec', kind: 'border', name: 'Engrenagem Hextec', price: 3_600, rarity: 'rara' },
  { id: 'border:gelo', kind: 'border', name: 'Gelo Eterno', price: 3_600, rarity: 'rara' },
  { id: 'border:sombras', kind: 'border', name: 'Névoa Negra', price: 4_200, rarity: 'epica' },
  { id: 'border:dragao', kind: 'border', name: 'Chama do Dragão', price: 5_200, rarity: 'epica' },
  { id: 'border:pulsar', kind: 'border', name: 'Pulsar', price: 6_000, rarity: 'lendaria' },
  { id: 'border:eclipse_total', kind: 'border', name: 'Eclipse Total', price: 9_500, rarity: 'mitica' },
  { id: 'border:vip', kind: 'border', name: 'Borda VIP', price: 0, rarity: 'lendaria', vipOnly: true },
];
const THEMES: StoreItem[] = [
  { id: 'theme:noite', kind: 'theme', name: 'Noite Lunar', price: 0, rarity: 'comum', description: 'Tema padrão' },
  { id: 'theme:eclipse', kind: 'theme', name: 'Eclipse Carmesim', price: 3_000, rarity: 'rara' },
  { id: 'theme:aurora', kind: 'theme', name: 'Aurora Boreal', price: 3_000, rarity: 'rara' },
  { id: 'theme:hextec', kind: 'theme', name: 'Hextec', price: 4_500, rarity: 'epica' },
  { id: 'theme:sombras', kind: 'theme', name: 'Ilhas das Sombras', price: 4_500, rarity: 'epica' },
  { id: 'theme:abismo', kind: 'theme', name: 'Abismo Marinho', price: 3_000, rarity: 'rara' },
  { id: 'theme:solari', kind: 'theme', name: 'Templo Solari', price: 3_000, rarity: 'rara' },
  { id: 'theme:freljord', kind: 'theme', name: 'Freljord', price: 3_000, rarity: 'rara' },
  { id: 'theme:vazio', kind: 'theme', name: 'Vazio', price: 4_500, rarity: 'epica' },
  { id: 'theme:sakura', kind: 'theme', name: 'Flor Espiritual', price: 4_500, rarity: 'epica' },
  { id: 'theme:imperial', kind: 'theme', name: 'Ouro Imperial', price: 6_000, rarity: 'lendaria' },
];
const VICTORY: StoreItem[] = [
  { id: 'victory:confete', kind: 'victory', name: 'Canhões de Confete', price: 1_500, rarity: 'comum' },
  { id: 'victory:estrelas', kind: 'victory', name: 'Estrelas Cadentes', price: 3_200, rarity: 'rara' },
  { id: 'victory:moonfall', kind: 'victory', name: 'Queda Lunar', price: 5_500, rarity: 'epica' },
  { id: 'victory:fogos', kind: 'victory', name: 'Fogos Hextec', price: 5_500, rarity: 'epica' },
  { id: 'victory:aurora', kind: 'victory', name: 'Aurora Boreal', price: 4_800, rarity: 'epica' },
  { id: 'victory:brasas', kind: 'victory', name: 'Brasas do Dragão', price: 6_500, rarity: 'lendaria' },
];
export const TITLES: StoreItem[] = [
  { id: 'title:alpha', kind: 'title', name: 'Alpha Tester', price: 0, rarity: 'mitica', description: 'Jogou durante o beta' },
  { id: 'title:vip', kind: 'title', name: 'Apoiador', price: 0, rarity: 'lendaria', description: 'Apoiou o projeto' },
  // Campeonatos
  { id: 'title:primeira_taca', kind: 'title', name: 'Primeira Taça', price: 0, rarity: 'comum', description: 'Venceu o primeiro campeonato' },
  { id: 'title:dinastia', kind: 'title', name: 'Dinastia', price: 0, rarity: 'epica', description: 'Venceu 25 campeonatos' },
  { id: 'title:imperador', kind: 'title', name: 'Imperador do Rift', price: 0, rarity: 'mitica', description: 'Venceu 100 campeonatos' },
  { id: 'title:veterano', kind: 'title', name: 'Veterano', price: 0, rarity: 'rara', description: 'Disputou 100 campeonatos' },
  // Elo (o maior que já alcançou)
  { id: 'title:mestre', kind: 'title', name: 'Mestre', price: 0, rarity: 'epica', description: 'Chegou ao Mestre' },
  { id: 'title:grao_mestre', kind: 'title', name: 'Grão-Mestre', price: 0, rarity: 'lendaria', description: 'Chegou ao Grão-Mestre' },
  { id: 'title:desafiante', kind: 'title', name: 'Desafiante', price: 0, rarity: 'mitica', description: 'Chegou ao Desafiante' },
  // Comunidade
  { id: 'title:honrado', kind: 'title', name: 'Honrado', price: 0, rarity: 'rara', description: 'Chegou à honra 5' },
  { id: 'title:querido', kind: 'title', name: 'Querido da Comunidade', price: 0, rarity: 'epica', description: 'Recebeu 100 elogios' },
  { id: 'title:recrutador', kind: 'title', name: 'Recrutador', price: 0, rarity: 'rara', description: 'Trouxe 5 amigos que jogaram' },
  // Loja
  { id: 'title:leiloeiro', kind: 'title', name: 'Leiloeiro', price: 2_000, rarity: 'comum' },
  { id: 'title:mao_de_vaca', kind: 'title', name: 'Mão de Vaca', price: 2_000, rarity: 'comum' },
  { id: 'title:lunari', kind: 'title', name: 'Lunari', price: 3_500, rarity: 'rara' },
  { id: 'title:all_in', kind: 'title', name: 'All-in', price: 3_500, rarity: 'rara' },
  { id: 'title:noite_eterna', kind: 'title', name: 'Noite Eterna', price: 6_000, rarity: 'epica' },
];
const SERVICES: StoreItem[] = [
  { id: 'service:rename', kind: 'service', name: 'Troca de nome', price: NAME_CHANGE_PRICE, rarity: 'comum', description: 'Muda seu nome de invocador' },
];

/** Banners de perfil: a splash de qualquer skin (padrão grátis; skins exigem possuir a skin). */
export const bannerIdFor = (champId: string, num = 0) => `banner:${champId}_${num}`;

export const CATALOG: StoreItem[] = [...SKIN_ITEMS, ...ICON_ITEMS, ...BORDERS, ...THEMES, ...VICTORY, ...TITLES, ...SERVICES];
const BY_ID = new Map(CATALOG.map(i => [i.id, i]));
export const itemById = (id: string) => BY_ID.get(id) ?? null;

/** Metas do programa de convites: amigos que jogaram → prêmio extra (além dos dias de VIP). */
export const REFERRAL_MILESTONES: { friends: number; label: string; item?: string }[] = [
  { friends: 1, label: '+3 dias' },
  { friends: 3, label: '+9 dias' },
  { friends: 5, label: 'Título Recrutador', item: 'title:recrutador' },
  { friends: 10, label: 'Borda Pulsar', item: 'border:pulsar' },
];

/** O que vem com o bônus de beta. */
export const BETA_GRANTS = ['title:alpha', 'border:prata', 'victory:confete'];
/** O que o VIP libera enquanto estiver ativo. */
export const VIP_GRANTS = ['border:vip'];

/** Itens que todo mundo tem sem comprar. */
export function isFreeItem(id: string): boolean {
  if (id === 'theme:noite') return true;
  if (id.startsWith('icon:')) return FREE_ICONS.includes(Number(id.slice(5)));
  if (id.startsWith('banner:')) return id.endsWith('_0');
  return false;
}
