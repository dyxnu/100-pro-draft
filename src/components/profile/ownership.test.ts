import { describe, expect, it } from 'vitest';
import {
  bannerOf, canEquip, ownedIconIds, ownedOf, ownedTitles, parseBanner, parseIcon, placementLabel, relativeTime,
  renamePayment, usernameError, winRate, withDefaults, type OwnerCtx,
} from './ownership';
import { SKINS } from '@/lib/store/catalog';

const ctx = (over: Partial<OwnerCtx> = {}): OwnerCtx => ({
  inventory: new Set(), vip: false, is_beta: false, titles_won: 0, honor_level: 2, peak_tier: null, ...over,
});

describe('ids', () => {
  it('lê ícone e banner', () => {
    expect(parseIcon('icon:4568')).toBe(4568);
    expect(parseIcon('Diana')).toBeNull();
    expect(parseIcon('icon:abc')).toBeNull();
    expect(parseBanner('banner:Diana_2')).toEqual({ champId: 'Diana', num: 2 });
    expect(parseBanner('banner:../x_1')).toBeNull();
    expect(bannerOf({ banner_id: null, avatar_url: 'Ahri' })).toEqual({ champId: 'Ahri', num: 0 });
    expect(bannerOf({ banner_id: null, avatar_url: 'icon:3' })).toEqual({ champId: 'Diana', num: 0 });
  });
});

describe('posse de cosméticos', () => {
  it('ícone: campeão, grátis ou comprado', () => {
    expect(canEquip('icon', 'Diana', ctx())).toBe(true);
    expect(canEquip('icon', 'icon:5', ctx())).toBe(true);
    expect(canEquip('icon', 'icon:4568', ctx())).toBe(false);
    expect(canEquip('icon', 'icon:4568', ctx({ inventory: new Set(['icon:4568']) }))).toBe(true);
    expect(canEquip('icon', 'NaoExiste', ctx())).toBe(false);
    expect(canEquip('icon', null, ctx())).toBe(false);
  });

  it('banner: padrão grátis, skin só com a skin', () => {
    const champ = Object.keys(SKINS).find(c => SKINS[c].length)!;
    const num = SKINS[champ][0].num;
    expect(canEquip('banner', `banner:${champ}_0`, ctx())).toBe(true);
    expect(canEquip('banner', `banner:${champ}_${num}`, ctx())).toBe(false);
    expect(canEquip('banner', `banner:${champ}_${num}`, ctx({ inventory: new Set([`skin:${champ}_${num}`]) }))).toBe(true);
    expect(canEquip('banner', `banner:${champ}_999`, ctx({ inventory: new Set([`skin:${champ}_999`]) }))).toBe(false);
    expect(canEquip('banner', null, ctx())).toBe(true);
  });

  it('borda, tema e efeito', () => {
    expect(canEquip('border', 'border:ouro', ctx())).toBe(false);
    expect(canEquip('border', 'border:ouro', ctx({ inventory: new Set(['border:ouro']) }))).toBe(true);
    expect(canEquip('border', 'border:vip', ctx({ inventory: new Set(['border:vip']) }))).toBe(false);
    expect(canEquip('border', 'border:vip', ctx({ vip: true }))).toBe(true);
    expect(canEquip('border', 'theme:eclipse', ctx({ inventory: new Set(['theme:eclipse']) }))).toBe(false);
    expect(canEquip('theme', 'theme:noite', ctx())).toBe(true);
    expect(canEquip('theme', 'theme:hextec', ctx())).toBe(false);
    expect(canEquip('victory', 'victory:fogos', ctx({ inventory: new Set(['victory:fogos']) }))).toBe(true);
    expect(canEquip('victory', 'victory:fogos', ctx())).toBe(false);
    expect(ownedOf('border', ctx({ vip: true, inventory: new Set(['border:prata']) }))).toEqual(['border:prata', 'border:vip']);
  });

  it('títulos: inventário + conquistas', () => {
    expect(ownedTitles(ctx())).toEqual([]);
    expect(ownedTitles(ctx({ is_beta: true }))).toEqual(['title:alpha']);
    const t = ownedTitles(ctx({ titles_won: 5, honor_level: 5, peak_tier: 'DESAFIANTE', inventory: new Set(['title:lunari', 'title:vip']) }));
    expect(t).toEqual(['title:vip', 'title:primeira_taca', 'title:mestre', 'title:grao_mestre', 'title:desafiante', 'title:honrado', 'title:lunari']);
    expect(canEquip('title', 'title:lunari', ctx())).toBe(false);
    expect(canEquip('title', 'title:inventado', ctx({ inventory: new Set(['title:inventado']) }))).toBe(false);
  });

  it('ícones possuídos', () => {
    const ids = ownedIconIds(new Set(['icon:4568', 'icon:3', 'skin:Ahri_1']));
    expect(ids).toContain(0);
    expect(ids).toContain(4568);
    expect(ids.filter(i => i === 3)).toHaveLength(1);
  });
});

describe('troca de nome', () => {
  it('valida formato e palavras ofensivas', () => {
    expect(usernameError('Lua_Cheia')).toBeNull();
    expect(usernameError('ab')).toMatch(/3 a 16/);
    expect(usernameError('nome com espaço')).toMatch(/3 a 16/);
    expect(usernameError('p0rr4_master')).toMatch(/não é permitido/);
  });
  it('escolhe o pagamento', () => {
    expect(renamePayment({ name_change_tokens: 1, blue_essence: 0 })).toBe('token');
    expect(renamePayment({ name_change_tokens: 0, blue_essence: 14_900 })).toBe('essence');
    expect(renamePayment({ name_change_tokens: 0, blue_essence: 14_899 })).toBeNull();
  });
});

describe('perfil e textos', () => {
  it('preenche colunas que faltam', () => {
    const p = withDefaults({ id: 'x', username: 'Lua', level: 7 });
    expect(p.level).toBe(7);
    expect(p.games).toBe(0);
    expect(p.blue_essence).toBe(0);
    expect(p.honor_level).toBe(2);
    expect(p.title_id).toBeNull();
  });
  it('formata', () => {
    expect(placementLabel(1)).toBe('Campeão');
    expect(placementLabel(3)).toBe('3º lugar');
    expect(winRate(3, 4)).toBe(75);
    expect(winRate(0, 0)).toBeNull();
    const now = Date.parse('2026-11-17T12:00:00Z');
    expect(relativeTime('2026-11-17T11:59:40Z', now)).toBe('agora mesmo');
    expect(relativeTime('2026-11-17T11:30:00Z', now)).toBe('há 30 min');
    expect(relativeTime('2026-11-16T10:00:00Z', now)).toBe('ontem');
    expect(relativeTime('2026-11-10T12:00:00Z', now)).toBe('há 7 dias');
  });
});
