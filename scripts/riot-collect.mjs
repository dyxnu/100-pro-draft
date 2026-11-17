// Coleta partidas ranqueadas de alto elo pela API oficial da Riot e calcula, por campeão:
// winrate por rota, matchups de rota (A contra B), counters e sinergias da dupla bot.
// Precisa de RIOT_API_KEY no .env.local (developer.riotgames.com).
//
// Uso: npm run riot:collect -- --matches 1500 --platform br1
// A chave de desenvolvimento permite 100 pedidos a cada 2 minutos: 1500 partidas ≈ 35 min.
// O progresso fica salvo em .riot-cache/ — dá para parar e continuar depois.
//
// Só recalcular as estatísticas a partir do cache (sem chave e sem baixar nada):
//   node scripts/riot-collect.mjs --aggregate-only [--cache caminho/.riot-cache]   (ou RIOT_CACHE=caminho)
// Além das duplas do bot, agrega pares do mesmo time ("pairs") e pares de times opostos
// em rotas diferentes ("versus"), para sinergias e counters gerais.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const AGGREGATE_ONLY = process.argv.includes('--aggregate-only');
if (!AGGREGATE_ONLY) { try { process.loadEnvFile('.env.local'); } catch { /* sem .env.local */ } }
const KEY = process.env.RIOT_API_KEY;
if (!KEY && !AGGREGATE_ONLY) { console.error('Falta RIOT_API_KEY no .env.local'); process.exit(1); }

const TARGET = Number(arg('matches', 1500));
const PLATFORM = arg('platform', 'br1');
const REGION = { br1: 'americas', na1: 'americas', la1: 'americas', la2: 'americas', euw1: 'europe', eun1: 'europe', kr: 'asia' }[PLATFORM] ?? 'americas';
const CACHE = arg('cache', process.env.RIOT_CACHE || '.riot-cache');
mkdirSync(CACHE, { recursive: true });

// ---- limite de pedidos (20/s e 100/2min da chave de desenvolvimento) ----
const stamps = [];
async function riot(url) {
  for (;;) {
    const now = Date.now();
    while (stamps.length && now - stamps[0] > 120_000) stamps.shift();
    const wait = Math.max(stamps.length >= 95 ? 120_000 - (now - stamps[0]) + 250 : 0, stamps.length && now - stamps.at(-1) < 60 ? 60 : 0);
    if (wait) { await new Promise(r => setTimeout(r, wait)); continue; }
    stamps.push(Date.now());
    const res = await fetch(url, { headers: { 'X-Riot-Token': KEY } });
    if (res.status === 429) { await new Promise(r => setTimeout(r, (Number(res.headers.get('retry-after')) || 10) * 1000)); continue; }
    if (res.status === 401 || res.status === 403) throw new Error('Chave da Riot inválida ou expirada (chaves de desenvolvimento duram 24 h).');
    if (!res.ok) return null;
    return res.json();
  }
}
const cacheFile = n => `${CACHE}/${n}.json`;
const load = (n, d) => (existsSync(cacheFile(n)) ? JSON.parse(readFileSync(cacheFile(n), 'utf8')) : d);
const save = (n, v) => writeFileSync(cacheFile(n), JSON.stringify(v));

if (!AGGREGATE_ONLY) {
// ---- 1) jogadores de alto elo ----
let puuids = load(`puuids-${PLATFORM}`, null);
if (!puuids) {
  puuids = [];
  for (const tier of ['challengerleagues', 'grandmasterleagues', 'masterleagues']) {
    const league = await riot(`https://${PLATFORM}.api.riotgames.com/lol/league/v4/${tier}/by-queue/RANKED_SOLO_5x5`);
    for (const e of league?.entries ?? []) if (e.puuid) puuids.push(e.puuid);
    if (puuids.length > 600) break;
  }
  save(`puuids-${PLATFORM}`, puuids);
}
console.log(`Jogadores de alto elo: ${puuids.length}`);

// ---- 2) ids de partidas ----
const matchIds = new Set(load(`matchids-${PLATFORM}`, []));
for (const p of puuids) {
  if (matchIds.size >= TARGET * 1.2) break;
  const ids = await riot(`https://${REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${p}/ids?queue=420&type=ranked&count=20`);
  for (const id of ids ?? []) matchIds.add(id);
  save(`matchids-${PLATFORM}`, [...matchIds]);
}
console.log(`Partidas encontradas: ${matchIds.size}`);

// ---- 3) detalhes (só o essencial de cada partida) ----
const games = load(`games-${PLATFORM}`, {});
let n = Object.keys(games).length;
for (const id of matchIds) {
  if (n >= TARGET) break;
  if (games[id]) continue;
  const m = await riot(`https://${REGION}.api.riotgames.com/lol/match/v5/matches/${id}`);
  if (!m?.info?.participants) { games[id] = null; continue; }
  games[id] = {
    patch: m.info.gameVersion.split('.').slice(0, 2).join('.'),
    duration: m.info.gameDuration,
    p: m.info.participants.map(x => [x.championName, x.teamPosition, x.teamId, x.win ? 1 : 0]),
  };
  n++;
  if (n % 25 === 0) { save(`games-${PLATFORM}`, games); process.stdout.write(`\r${n}/${TARGET} partidas`); }
}
save(`games-${PLATFORM}`, games);
console.log(`\nPartidas analisadas: ${n}`);
}

// ---- 4) agregação (junta todas as regiões já coletadas em .riot-cache/) ----
const allGames = {};
const platforms = [];
for (const f of readdirSync(CACHE).filter(f => /^games-.+\.json$/.test(f))) {
  platforms.push(f.slice(6, -5));
  Object.assign(allGames, JSON.parse(readFileSync(`${CACHE}/${f}`, 'utf8')));
}
const POS = { TOP: 'TOP', JUNGLE: 'JUNGLE', MIDDLE: 'MID', BOTTOM: 'ADC', UTILITY: 'SUPORTE' };
const champ = {};      // id → { games, wins, roles: { ROLE: { games, wins } }, short, long }
const matchup = {};    // `A|B|ROLE` → { games, wins } (vitórias de A contra B na mesma rota)
const duo = {};        // `ADC|SUP` → { games, wins }
const pair = {};       // `A|B` (ordem alfabética) do mesmo time, qualquer rota → { games, wins }
const versus = {};     // `A|B` (ordem alfabética) de times opostos e rotas diferentes → vitórias de A
const inc = (o, k, w) => { o[k] ??= { games: 0, wins: 0 }; o[k].games++; o[k].wins += w; };
for (const g of Object.values(allGames)) {
  if (!g) continue;
  for (const [c, pos, team, win] of g.p) {
    const role = POS[pos];
    if (!role) continue;
    champ[c] ??= { games: 0, wins: 0, roles: {} };
    champ[c].games++; champ[c].wins += win;
    inc(champ[c].roles, role, win);
    // Jogos curtos (< 25 min) x longos (> 32 min): mostra quem é forte no começo e quem escala.
    if (g.duration < 1500) inc(champ[c], 'short', win);
    else if (g.duration > 1920) inc(champ[c], 'long', win);
    const opp = g.p.find(x => x[1] === pos && x[2] !== team);
    if (opp) inc(matchup, `${c}|${opp[0]}|${role}`, win);
  }
  for (const team of [100, 200]) {
    const adc = g.p.find(x => x[2] === team && x[1] === 'BOTTOM');
    const sup = g.p.find(x => x[2] === team && x[1] === 'UTILITY');
    if (adc && sup) inc(duo, `${adc[0]}|${sup[0]}`, adc[3]);
  }
  // Todos os pares da partida: do mesmo time (sinergia) e de times opostos em rotas diferentes (counter).
  const ps = g.p.filter(x => POS[x[1]]);
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const [x, y] = ps[i][0] < ps[j][0] ? [ps[i], ps[j]] : [ps[j], ps[i]];
    if (x[0] === y[0]) continue;
    if (x[2] === y[2]) inc(pair, `${x[0]}|${y[0]}`, x[3]);
    else if (x[1] !== y[1]) inc(versus, `${x[0]}|${y[0]}`, x[3]);
  }
}
// Só os campeões do catálogo (o arquivo vai para o navegador junto com as cartas).
const catalog = new Set([...readFileSync('src/lib/auction/champions.ts', 'utf8').matchAll(/id: '([A-Za-z]+)'/g)].map(m => m[1]));
const pick = (o, f) => Object.fromEntries(Object.entries(o).filter(([k, v]) => f(k, v)));
const inCatalog = k => k.split('|').slice(0, 2).every(c => catalog.has(c));
const total = Object.values(allGames).filter(Boolean).length;
const patches = [...new Set(Object.values(allGames).filter(Boolean).map(g => g.patch))];
const OUT = 'src/lib/champions/riot-stats.json';
// Só reagregando, a data da coleta continua a mesma.
const prevCollected = AGGREGATE_ONLY && existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')).collectedAt : null;
const pairs = pick(pair, (k, v) => inCatalog(k) && v.games >= 15);
const vs = pick(versus, (k, v) => inCatalog(k) && v.games >= 15);
writeFileSync(OUT, JSON.stringify({
  source: `Riot Match-V5 · ${platforms.join(", ")} · Challenger/GM/Master · solo/duo`,
  collectedAt: prevCollected ?? new Date().toISOString(), matches: total, patches,
  champions: pick(champ, k => catalog.has(k)),
  matchups: pick(matchup, (k, v) => inCatalog(k) && v.games >= 3),
  duos: pick(duo, (k, v) => inCatalog(k) && v.games >= 3),
  pairs,
  versus: vs,
}));
console.log(`Estatísticas salvas: ${Object.keys(champ).length} campeões, ${Object.keys(matchup).length} matchups, ${Object.keys(duo).length} duplas, `
  + `${Object.keys(pairs).length} pares do mesmo time, ${Object.keys(vs).length} confrontos entre rotas.`);
