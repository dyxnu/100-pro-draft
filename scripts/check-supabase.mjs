// Verifica a conexão com o Supabase usando a chave pública (igual ao site).
// Uso: npm run check:db
import { createClient } from '@supabase/supabase-js';

process.loadEnvFile('.env.local');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sb = createClient(url, key, { auth: { persistSession: false } });

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) failures++; };

const { data: champs, error: e1 } = await sb.from('champions').select('id');
ok(!e1 && champs?.length >= 36, `catálogo com campeões suficientes para 6 jogadores (${e1 ? e1.message : champs.length})`);

const { data: routes, error: e2 } = await sb.from('champion_routes').select('champion_id, lane, is_primary');
const primaries = routes?.filter(r => r.is_primary).length ?? 0;
ok(!e2 && primaries === champs?.length, `cada campeão tem rota principal (${e2 ? e2.message : `${routes.length} rotas, ${primaries} principais`})`);

const { error: e3 } = await sb.from('profiles').select('id').limit(1);
ok(!e3, `perfis legíveis publicamente${e3 ? ': ' + e3.message : ''}`);

// RLS: visitante NÃO pode escrever nas tabelas do jogo
const { error: w1 } = await sb.from('champions').insert({ id: 'Teste', name: 'Teste' });
ok(!!w1, `bloqueia criar campeão pelo navegador${w1 ? '' : ' (FALHA: inseriu!)'}`);
const { error: w2 } = await sb.from('bids').insert({ auction_id: '00000000-0000-0000-0000-000000000000', seq: 1, seat: 0, champion_id: 'Garen', amount_cents: 50 });
ok(!!w2, `bloqueia criar lance pelo navegador${w2 ? '' : ' (FALHA: inseriu!)'}`);
const { data: rooms } = await sb.from('rooms').select('id');
ok((rooms ?? []).length === 0, 'visitante não vê salas (só usuários logados)');

console.log(failures ? `\n${failures} verificação(ões) falharam` : '\nTudo certo com o banco!');
process.exit(failures ? 1 : 0);
