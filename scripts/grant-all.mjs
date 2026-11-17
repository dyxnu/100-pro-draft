// Libera tudo numa conta de testes: todos os itens da loja, essência, honra 5, VIP, maestria em
// todos os campeões e números altos no perfil.
// Uso: node scripts/grant-all.mjs <nome-de-usuário>
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const username = process.argv[2];
if (!username) { console.error('Uso: node scripts/grant-all.mjs <usuário>'); process.exit(1); }

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter(l => l.includes('=') && !l.trimStart().startsWith('#'))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);

const skins = JSON.parse(readFileSync('src/lib/champions/skins.json', 'utf8'));
const icons = JSON.parse(readFileSync('src/lib/store/icon-ids.json', 'utf8'));
const catalogSrc = readFileSync('src/lib/store/catalog.ts', 'utf8');
const fixed = [...catalogSrc.matchAll(/id: '((?:border|theme|victory|title):[a-z_]+)'/g)].map(m => m[1]);
const ids = [
  ...Object.entries(skins).flatMap(([c, list]) => list.map(s => `skin:${c}_${s.num}`)),
  ...icons.map(n => `icon:${n}`),
  ...fixed,
];

const { data: p, error } = await admin.from('profiles').select('id, username').eq('username', username).single();
if (error || !p) { console.error('Usuário não encontrado:', username); process.exit(1); }

for (let i = 0; i < ids.length; i += 500) {
  const chunk = ids.slice(i, i + 500).map(item_id => ({ user_id: p.id, item_id, source: 'teste' }));
  const r = await admin.from('inventory').upsert(chunk, { onConflict: 'user_id,item_id', ignoreDuplicates: true });
  if (r.error) { console.error(r.error); process.exit(1); }
}

const upd = await admin.from('profiles').update({
  blue_essence: 500000, honor_level: 5, honor_progress: 100, kudos_count: 120,
  titles_won: 120, tournaments: 150, games: 420, wins: 300, level: 150, xp: 0,
  peak_tier: 'DESAFIANTE', vip_until: new Date(Date.now() + 365 * 86_400_000).toISOString(),
  name_change_tokens: 5, beta_claimed: false,
}).eq('id', p.id);
if (upd.error) { console.error(upd.error); process.exit(1); }

const src = readFileSync('src/lib/auction/champions.ts', 'utf8');
const champs = [...src.matchAll(/id: '([A-Za-z]+)'/g)].map(m => m[1]);
const mastery = champs.map((id, i) => ({
  user_id: p.id, champion_id: id, points: Math.max(1800, 52000 - i * 700), games: 40 - (i % 20), wins: 25 - (i % 15),
  updated_at: new Date().toISOString(),
}));
const m = await admin.from('mastery').upsert(mastery, { onConflict: 'user_id,champion_id' });
if (m.error) { console.error(m.error); process.exit(1); }

console.log(`Pronto: ${ids.length} itens, ${champs.length} maestrias e perfil turbinado para ${p.username}.`);
