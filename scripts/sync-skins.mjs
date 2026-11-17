// Baixa a lista de skins de cada campeão do catálogo (Data Dragon, pt_BR).
// Uso: node scripts/sync-skins.mjs  →  src/lib/champions/skins.json
import { readFileSync, writeFileSync } from 'node:fs';

const dd = JSON.parse(readFileSync('src/lib/champions/ddragon.json', 'utf8'));
const src = readFileSync('src/lib/auction/champions.ts', 'utf8');
const ids = [...src.matchAll(/id: '([A-Za-z]+)'/g)].map(m => m[1]);
const out = {};
for (const id of ids) {
  const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${dd.version}/data/pt_BR/champion/${id}.json`);
  if (!res.ok) { console.error('falhou', id, res.status); continue; }
  const j = await res.json();
  const c = j.data[id];
  // num 0 = skin padrão; chromas não têm arte própria de carregamento
  out[id] = c.skins.filter(s => s.num > 0 && !s.parentSkin).map(s => ({ num: s.num, name: s.name }));
  process.stdout.write('.');
}
writeFileSync('src/lib/champions/skins.json', JSON.stringify(out));
console.log(`\nSkins: ${Object.values(out).reduce((n, l) => n + l.length, 0)} em ${Object.keys(out).length} campeões.`);
