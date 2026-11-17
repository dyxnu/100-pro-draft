// Baixa as skins de cada campeão do catálogo (nomes em pt_BR do Data Dragon + raridade do
// CommunityDragon) e todos os ícones de perfil que existem no Data Dragon.
// Uso: node scripts/sync-skins.mjs  →  src/lib/champions/skins.json e src/lib/store/icons.json
import { readFileSync, writeFileSync } from 'node:fs';

const dd = JSON.parse(readFileSync('src/lib/champions/ddragon.json', 'utf8'));
const src = readFileSync('src/lib/auction/champions.ts', 'utf8');
const ids = [...src.matchAll(/id: '([A-Za-z]+)'/g)].map(m => m[1]);
const CD = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global';

const cdSkins = await (await fetch(`${CD}/default/v1/skins.json`)).json();
const out = {};
for (const id of ids) {
  const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${dd.version}/data/pt_BR/champion/${id}.json`);
  if (!res.ok) { console.error('falhou', id, res.status); continue; }
  const c = (await res.json()).data[id];
  // num 0 = skin padrão; chromas não têm arte própria de carregamento
  out[id] = c.skins.filter(s => s.num > 0 && !s.parentSkin).map(s => {
    const cd = cdSkins[String(Number(c.key) * 1000 + s.num)];
    return { num: s.num, name: s.name, r: cd?.rarity ?? 'kNoRarity', ...(cd?.isLegacy ? { l: 1 } : {}) };
  });
  process.stdout.write('.');
}
writeFileSync('src/lib/champions/skins.json', JSON.stringify(out));
console.log(`\nSkins: ${Object.values(out).reduce((n, l) => n + l.length, 0)} em ${Object.keys(out).length} campeões.`);

// Ícones: só os que o Data Dragon serve (a imagem vem de lá), com o nome em português.
const ddIcons = await (await fetch(`https://ddragon.leagueoflegends.com/cdn/${dd.version}/data/pt_BR/profileicon.json`)).json();
const have = new Set(Object.keys(ddIcons.data).map(Number));
const cdIcons = await (await fetch(`${CD}/pt_br/v1/summoner-icons.json`)).json();
const icons = cdIcons
  .filter(i => have.has(i.id) && i.id > 28 && i.title && !/^(Ícone de )?Teste|placeholder|^\s*$/i.test(i.title))
  .map(i => [i.id, i.title.replace(/^Ícone( de| do| da)?\s+/i, '').trim() || i.title, i.yearReleased || 0])
  .sort((a, b) => b[2] - a[2] || b[0] - a[0]);
writeFileSync('src/lib/store/icons.json', JSON.stringify(icons));
console.log(`Ícones: ${icons.length}.`);
writeFileSync('src/lib/store/icon-ids.json', JSON.stringify(icons.map(i => i[0]).sort((a, b) => a - b)));
