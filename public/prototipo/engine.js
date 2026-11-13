// NEXUS DRAFT — motor do leilão.
// Código puro (sem DOM, sem rede). No protótipo roda no navegador; no projeto final
// este mesmo arquivo vira o módulo autoritativo do servidor (Supabase Edge Function /
// rota Next.js), e o navegador só envia intenções: placeBid e chooseRoute.
// Todos os valores em CENTAVOS (inteiros) para evitar erro de ponto flutuante.
(function (root) {
  'use strict';

  const ROLES = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPORTE'];

  const DEFAULT_CONFIG = {
    budget: 10000,          // R$ 100,00
    minBid: 50,             // lance inicial R$ 0,50
    minIncrement: 50,       // incremento mínimo R$ 0,50
    bidTimeMs: 10000,       // 10 s, reinicia a cada lance válido
    routePickMs: 10000,     // 10 s para escolher a rota após vencer
    intermissionMs: 1500,   // pausa entre um campeão e outro (só visual)
    maxNoBidAttempts: 2,    // sem lances 2x => distribuição automática
    teamSize: 5,
    autoAssignSingleBidder: true, // se só 1 jogador pode receber o campeão, entrega direto (R$ 0)
  };

  // ---------- utilidades ----------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function formatBRL(cents) {
    return 'R$ ' + (cents / 100).toFixed(2).replace('.', ',');
  }

  const getPlayer = (s, id) => s.players.find(p => p.id === id);
  const openRoles = p => ROLES.filter(r => !p.roster[r]);

  function emit(s, event, now) {
    event.at = now;
    s.events.push(event);
    s.version++;
  }

  // Campeões que ainda não foram colocados em nenhum time.
  function unplacedChampIds(s) {
    const ids = s.queue.slice();
    if (s.current) ids.push(s.current.champId);
    if (s.routePick) ids.push(s.routePick.champId);
    return ids;
  }

  // Todas as vagas (jogador, rota) ainda vazias.
  function openSlots(s) {
    const out = [];
    s.players.forEach(p => openRoles(p).forEach(role => out.push({ playerId: p.id, role })));
    return out;
  }

  // ---------- viabilidade (o coração das "rotas flexíveis") ----------
  // Existe um jeito de preencher TODAS as vagas restantes com os campeões restantes,
  // respeitando as rotas permitidas? É um emparelhamento bipartido (algoritmo de Kuhn).
  // Com 30x30 isso roda em microssegundos.
  function canFillAllSlots(champIds, slots, champions) {
    if (champIds.length < slots.length) return false;
    const adj = slots.map(sl =>
      champIds.map((cid, i) => (champions[cid].routes.includes(sl.role) ? i : -1)).filter(i => i >= 0)
    );
    const champMatch = new Array(champIds.length).fill(-1);
    function tryAugment(u, seen) {
      for (const v of adj[u]) {
        if (seen[v]) continue;
        seen[v] = true;
        if (champMatch[v] === -1 || tryAugment(champMatch[v], seen)) {
          champMatch[v] = u;
          return true;
        }
      }
      return false;
    }
    for (let u = 0; u < slots.length; u++) {
      if (!tryAugment(u, new Array(champIds.length).fill(false))) return false;
    }
    return true;
  }

  // Rotas em que `playerId` pode colocar `champId` sem inviabilizar o draft de ninguém.
  function validRoles(s, playerId, champId) {
    const p = getPlayer(s, playerId);
    const champ = s.champions[champId];
    if (!p || !champ) return [];
    const pool = unplacedChampIds(s).filter(id => id !== champId);
    const slots = openSlots(s);
    return champ.routes.filter(role => {
      if (p.roster[role]) return false;
      const rest = slots.filter(sl => !(sl.playerId === playerId && sl.role === role));
      return canFillAllSlots(pool, rest, s.champions);
    });
  }

  // ---------- orçamento ----------
  // Lance máximo = saldo − (vagas restantes após este campeão × lance mínimo)
  function maxBid(s, playerId) {
    const p = getPlayer(s, playerId);
    const open = openRoles(p).length;
    if (!open) return 0;
    return p.budget - (open - 1) * s.config.minBid;
  }

  function minNextBid(s) {
    return s.current && s.current.highBid
      ? s.current.highBid.amount + s.config.minIncrement
      : s.config.minBid;
  }

  // O jogador pode participar da disputa do campeão atual?
  function bidEligibility(s, playerId) {
    if (s.phase !== 'bidding' || !s.current) return { ok: false, reason: 'Nenhum campeão em disputa.' };
    const p = getPlayer(s, playerId);
    if (!p) return { ok: false, reason: 'Jogador inválido.' };
    if (!openRoles(p).length) return { ok: false, reason: 'Seu time já está completo.' };
    if (!validRoles(s, playerId, s.current.champId).length)
      return { ok: false, reason: 'Você não tem rota livre para este campeão.' };
    if (maxBid(s, playerId) < minNextBid(s)) return { ok: false, reason: 'Saldo insuficiente para cobrir.' };
    return { ok: true };
  }

  // ---------- criação ----------
  function createGame(opts) {
    const config = Object.assign({}, DEFAULT_CONFIG, opts.config || {});
    const rng = opts.rng || mulberry32(opts.seed != null ? opts.seed : Date.now());
    const now = opts.now || 0;

    if (opts.champions.length !== opts.players.length * config.teamSize) {
      throw new Error(`Precisa de exatamente ${opts.players.length * config.teamSize} campeões para ${opts.players.length} jogadores.`);
    }

    const champions = {};
    opts.champions.forEach(c => { champions[c.id] = c; });

    const players = opts.players.map(p => ({
      id: p.id,
      name: p.name,
      isBot: !!p.isBot,
      botProfile: p.botProfile || null,
      budget: config.budget,
      roster: ROLES.reduce((r, k) => ((r[k] = null), r), {}),
    }));

    const state = {
      config, rng, champions, players,
      queue: shuffle(Object.keys(champions), rng),
      attempts: {},
      current: null,     // { champId, highBid, bidCount, startedAt, endsAt, attempt }
      routePick: null,   // { playerId, champId, price, how, options, deadline }
      phase: 'bidding',  // 'bidding' | 'routePick' | 'finished'
      intermissionUntil: now,
      sales: [],
      bids: [],
      events: [],
      seq: 0,
      version: 0,
    };

    if (!canFillAllSlots(Object.keys(champions), openSlots(state), champions)) {
      throw new Error('Catálogo inválido: as rotas não permitem montar todos os times.');
    }
    return state;
  }

  // ---------- ações do jogador ----------
  function placeBid(s, playerId, amount, now) {
    const el = bidEligibility(s, playerId);
    if (!el.ok) return el;
    const cur = s.current;
    if (now >= cur.endsAt) return { ok: false, reason: 'Tempo esgotado.' };
    if (cur.highBid && cur.highBid.playerId === playerId) return { ok: false, reason: 'Você já tem o maior lance.' };
    if (!Number.isInteger(amount) || amount % s.config.minIncrement !== 0)
      return { ok: false, reason: `Use múltiplos de ${formatBRL(s.config.minIncrement)}.` };
    const min = minNextBid(s);
    // Empate: um lance igual ao atual é recusado, então vence quem chegou primeiro.
    if (amount < min) return { ok: false, reason: `Lance mínimo: ${formatBRL(min)}.` };
    const max = maxBid(s, playerId);
    if (amount > max) return { ok: false, reason: `Seu lance máximo é ${formatBRL(max)}.` };

    s.seq++;
    const bid = { seq: s.seq, champId: cur.champId, playerId, amount, at: now };
    cur.highBid = bid;
    cur.bidCount++;
    cur.endsAt = now + s.config.bidTimeMs;
    s.bids.push(bid);
    emit(s, { type: 'bid', champId: cur.champId, playerId, amount }, now);
    return { ok: true, bid };
  }

  function chooseRoute(s, playerId, role, now) {
    if (s.phase !== 'routePick' || !s.routePick || s.routePick.playerId !== playerId)
      return { ok: false, reason: 'Não é sua vez de escolher rota.' };
    if (!s.routePick.options.includes(role)) return { ok: false, reason: 'Rota inválida.' };
    placeChampion(s, role, now, 'escolha');
    return { ok: true };
  }

  // ---------- relógio do servidor ----------
  function tick(s, now) {
    if (s.phase === 'finished') return;
    if (s.phase === 'routePick') {
      if (now >= s.routePick.deadline) autoPickRoute(s, now);
      return;
    }
    if (!s.current) {
      if (now >= s.intermissionUntil) startNextLot(s, now);
      return;
    }
    if (now >= s.current.endsAt) resolveLot(s, now);
  }

  function startNextLot(s, now) {
    if (!openSlots(s).length || !s.queue.length) return finish(s, now);
    const champId = s.queue.shift();
    s.current = {
      champId, highBid: null, bidCount: 0,
      startedAt: now, endsAt: now + s.config.bidTimeMs,
      attempt: (s.attempts[champId] || 0) + 1,
    };
    emit(s, { type: 'lot_start', champId, attempt: s.current.attempt }, now);

    const eligible = s.players.filter(p => bidEligibility(s, p.id).ok);
    if (eligible.length === 0) {
      // Defensivo: não deveria acontecer, mas garante que o draft nunca trava.
      const any = s.players.find(p => validRoles(s, p.id, champId).length);
      emit(s, { type: 'forced', champId, playerId: any.id }, now);
      beginPlacement(s, any.id, champId, 0, 'sorteio', now);
    } else if (eligible.length === 1 && s.config.autoAssignSingleBidder) {
      emit(s, { type: 'only_option', champId, playerId: eligible[0].id }, now);
      beginPlacement(s, eligible[0].id, champId, 0, 'unico', now);
    }
  }

  function resolveLot(s, now) {
    const cur = s.current;
    const champId = cur.champId;

    if (cur.highBid) {
      const p = getPlayer(s, cur.highBid.playerId);
      p.budget -= cur.highBid.amount;
      emit(s, { type: 'sold', champId, playerId: p.id, amount: cur.highBid.amount }, now);
      beginPlacement(s, p.id, champId, cur.highBid.amount, 'leilao', now);
      return;
    }

    s.attempts[champId] = (s.attempts[champId] || 0) + 1;
    if (s.attempts[champId] < s.config.maxNoBidAttempts) {
      s.queue.push(champId);
      s.current = null;
      s.intermissionUntil = now + s.config.intermissionMs;
      emit(s, { type: 'requeue', champId }, now);
      return;
    }

    // Distribuição automática: sorteio entre quem consegue receber o campeão, de graça.
    const eligible = s.players.filter(p => validRoles(s, p.id, champId).length > 0);
    const pick = eligible[Math.floor(s.rng() * eligible.length)];
    emit(s, { type: 'forced', champId, playerId: pick.id }, now);
    beginPlacement(s, pick.id, champId, 0, 'sorteio', now);
  }

  function beginPlacement(s, playerId, champId, price, how, now) {
    const options = validRoles(s, playerId, champId);
    s.current = null;
    s.routePick = { playerId, champId, price, how, options, deadline: now + s.config.routePickMs };
    if (options.length === 1) {
      placeChampion(s, options[0], now, 'unica');
      return;
    }
    s.phase = 'routePick';
    emit(s, { type: 'route_pick', champId, playerId, options }, now);
  }

  function autoPickRoute(s, now) {
    const rp = s.routePick;
    const champ = s.champions[rp.champId];
    const role = champ.routes.find(r => rp.options.includes(r)); // prefere a rota principal
    placeChampion(s, role, now, 'auto');
  }

  function placeChampion(s, role, now, via) {
    const rp = s.routePick;
    const p = getPlayer(s, rp.playerId);
    p.roster[role] = { champId: rp.champId, price: rp.price, how: rp.how };
    s.sales.push({ champId: rp.champId, playerId: p.id, price: rp.price, role, how: rp.how, at: now });
    s.routePick = null;
    s.phase = 'bidding';
    s.intermissionUntil = now + s.config.intermissionMs;
    emit(s, { type: 'placed', champId: rp.champId, playerId: p.id, role, via, price: rp.price, how: rp.how }, now);
    if (!openSlots(s).length) finish(s, now);
  }

  function finish(s, now) {
    s.phase = 'finished';
    s.current = null;
    emit(s, { type: 'finished' }, now);
  }

  root.NexusEngine = {
    ROLES, DEFAULT_CONFIG,
    createGame, tick, placeBid, chooseRoute,
    validRoles, maxBid, minNextBid, bidEligibility, openRoles, getPlayer,
    canFillAllSlots, mulberry32, shuffle, formatBRL,
  };
})(typeof window !== 'undefined' ? window : globalThis);
