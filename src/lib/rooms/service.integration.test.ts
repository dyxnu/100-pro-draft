// Teste de integração contra o Supabase de verdade (precisa do .env.local com a chave secreta).
// Cria uma sala de teste, joga um draft inteiro só com bots pelo servidor e apaga tudo no fim.
// Rodar: npm run test:db
import { existsSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const enabled = process.env.RUN_DB_TESTS === '1' && (process.env.SUPABASE_SECRET_KEY ?? '').length > 20;

describe.runIf(enabled)('salas no Supabase (integração)', () => {
  let admin: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>;
  let svc: typeof import('./service');
  let host: { id: string; username: string };
  let code = '';

  beforeAll(async () => {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    svc = await import('./service');
    admin = createAdminClient();
    const { data } = await admin.from('profiles').select('id, username').limit(1).single();
    if (!data) throw new Error('Precisa existir pelo menos um perfil cadastrado.');
    host = data;
  });

  afterAll(async () => {
    if (code) await admin.from('rooms').delete().eq('code', code); // cascata apaga membros, leilão, lances e times
  });

  it('cria sala, completa com bots, joga o draft inteiro e salva o resultado', async () => {
    const created = await svc.createRoom(host.id, host.username, { botsEnabled: true, speed: 'rapido' });
    expect(created.ok).toBe(true);
    code = created.ok ? created.code : '';

    expect((await svc.joinRoom(code, host.id, host.username)).ok).toBe(true); // entrar de novo não duplica
    const t0 = Date.now();
    expect(await svc.startDraft(code, host.id, t0, { fillBots: true })).toEqual({ ok: true });
    expect((await svc.startDraft(code, host.id, t0)).ok).toBe(false); // não inicia duas vezes

    const { data: members } = await admin.from('room_members').select('seat, user_id').eq('room_id',
      (await admin.from('rooms').select('id').eq('code', code).single()).data!.id);
    expect(members).toHaveLength(6);
    expect(members!.filter(m => m.user_id)).toHaveLength(1);

    // O anfitrião não dá lances: os bots jogam e o servidor resolve o resto (rota automática, sobras).
    // O relógio pula 30 s por chamada: simula um servidor que só é chamado de vez em quando.
    let now = t0;
    let res = await svc.performAction(code, host.id, { type: 'tick' }, now);
    for (let i = 0; i < 200 && res.state?.phase !== 'finished'; i++) {
      now += 30_000;
      res = await svc.performAction(code, host.id, { type: 'tick' }, now);
    }
    expect(res.state?.phase).toBe('finished');
    expect(res.tournament).toBeTruthy();

    const { data: room } = await admin.from('rooms').select('id, status').eq('code', code).single();
    const { data: auction } = await admin.from('auctions').select('id').eq('room_id', room!.id).single();
    const { count: rosterCount } = await admin.from('rosters').select('*', { count: 'exact', head: true }).eq('auction_id', auction!.id);
    expect(rosterCount).toBe(30);
    const { count: bidCount } = await admin.from('bids').select('*', { count: 'exact', head: true }).eq('auction_id', auction!.id);
    expect(bidCount).toBe(res.state!.bids.length);

    const late = await svc.performAction(code, host.id, { type: 'bid', amount: 100 }, now + 1000);
    expect(late.ok).toBe(false);

    // Campeonato. Se o anfitrião (único humano) é cabeça de chave, ele folga e a rodada dos bots
    // começa sozinha; senão ele troca duas rotas, muda a estratégia e confirma.
    const strat = { agressividade: 'agressiva', prioridade: 'dragoes', estilo: 'teamfight', risco: 'normal' } as const;
    if (res.tournament!.stage === 'lineup') {
      expect((await svc.performAction(code, host.id, { type: 'lineup_swap', a: 'TOP', b: 'MID' }, now + 2000)).ok).toBe(true);
      expect((await svc.performAction(code, host.id, { type: 'lineup_swap', a: 'TOP', b: 'MID' }, now + 2500)).ok).toBe(true);
      expect((await svc.performAction(code, host.id, { type: 'strategy', strategy: strat }, now + 3000)).ok).toBe(true);
      res = await svc.performAction(code, host.id, { type: 'ready', ready: true }, now + 3500);
      expect(res.tournament!.stage).toBe('playing');
    } else {
      expect(res.tournament!.teams.seat0.seed).toBeLessThanOrEqual(2); // folga: é cabeça de chave
    }
    now += 4000;
    for (let i = 0; i < 100 && res.tournament?.stage !== 'done'; i++) {
      now += 20_000;
      res = await svc.performAction(code, host.id, { type: 'tick' }, now);
    }
    expect(res.tournament?.stage).toBe('done');
    expect(res.tournament?.champion).toBeTruthy();
    const { data: finished } = await admin.from('rooms').select('status').eq('code', code).single();
    expect(finished!.status).toBe('finished');
  });

  it('recusa ações de quem não está na sala', async () => {
    const r = await svc.performAction(code, '00000000-0000-0000-0000-000000000000', { type: 'tick' });
    expect(r.ok).toBe(false);
  });
});
