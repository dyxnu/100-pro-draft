// Baixa dados ricos dos campeões do Meraki Analytics (dataset público da comunidade,
// gerado a partir dos dados da Riot): avaliações oficiais de atributos, funções, rotas
// em que o campeão é jogado e habilidades. Salva em src/lib/champions/meraki.json.
// Rodar a cada patch: npm run sync:meraki
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('src/lib/auction/champions.ts', 'utf8');
const ids = [...src.matchAll(/id: '([A-Za-z]+)'/g)].map(m => m[1]);
const strip = s => (s ?? '').replace(/\s+/g, ' ').trim();

const out = {};
for (const id of ids) {
  const res = await fetch(`https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions/${id}.json`);
  if (!res.ok) { console.warn(`! ${id}: HTTP ${res.status}`); continue; }
  const d = await res.json();
  const ability = k => {
    const a = d.abilities?.[k]?.[0];
    if (!a) return null;
    const text = strip((a.effects ?? []).map(e => e.description).join(' '));
    return { name: a.name, damageType: a.damageType ?? null, text: text.length > 220 ? text.slice(0, 217) + '…' : text };
  };
  out[id] = {
    name: d.name,
    ratings: d.attributeRatings,          // damage, toughness, control, mobility, utility (1–3), difficulty, abilityReliance
    roles: d.roles,                       // ex.: ASSASSIN, DIVER, FIGHTER, MAGE, MARKSMAN, ENCHANTER, CATCHER, VANGUARD, WARDEN...
    positions: d.positions,               // TOP, JUNGLE, MIDDLE, BOTTOM, SUPPORT
    attackType: d.attackType,
    adaptiveType: d.adaptiveType,
    abilities: { P: ability('P'), Q: ability('Q'), W: ability('W'), E: ability('E'), R: ability('R') },
  };
  process.stdout.write('.');
}
writeFileSync('src/lib/champions/meraki.json', JSON.stringify(out));
console.log(`\nMeraki: ${Object.keys(out).length}/${ids.length} campeões salvos.`);
