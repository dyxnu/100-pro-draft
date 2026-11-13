// Baixa os dados oficiais dos campeões do Data Dragon (CDN pública da Riot) e salva um
// "retrato" em src/lib/champions/ddragon.json. Rodar a cada patch: npm run sync:champions
import { writeFileSync } from 'node:fs';

const versions = await (await fetch('https://ddragon.leagueoflegends.com/api/versions.json')).json();
const version = versions[0];
const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/pt_BR/champion.json`);
const { data } = await res.json();

const champions = {};
for (const [id, c] of Object.entries(data)) {
  const s = c.stats;
  champions[id] = {
    name: c.name,
    title: c.title,
    tags: c.tags,
    info: c.info, // attack, defense, magic, difficulty (0–10, avaliação oficial da Riot)
    stats: {
      hp: s.hp, hpPerLevel: s.hpperlevel,
      armor: s.armor, armorPerLevel: s.armorperlevel,
      mr: s.spellblock, mrPerLevel: s.spellblockperlevel,
      ad: s.attackdamage, adPerLevel: s.attackdamageperlevel,
      attackSpeed: s.attackspeed, attackSpeedPerLevel: s.attackspeedperlevel,
      moveSpeed: s.movespeed, range: s.attackrange,
    },
  };
}

writeFileSync('src/lib/champions/ddragon.json', JSON.stringify({ version, champions }, null, 0));
console.log(`Data Dragon ${version}: ${Object.keys(champions).length} campeões salvos.`);
