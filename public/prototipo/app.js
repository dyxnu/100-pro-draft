// NEXUS DRAFT — interface. Só lê o estado do motor e envia intenções (lance / rota).
(function () {
  'use strict';
  const E = window.NexusEngine;
  const B = window.NexusBots;
  const CATALOG = window.NEXUS_CHAMPIONS;
  const fmt = E.formatBRL;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const ME = 'p0';
  const ROLE_LABEL = { TOP: 'Top', JUNGLE: 'Jungle', MID: 'Mid', ADC: 'ADC', SUPORTE: 'Suporte' };
  const ROLE_SHORT = { TOP: 'TOP', JUNGLE: 'JG', MID: 'MID', ADC: 'ADC', SUPORTE: 'SUP' };
  const HOW_LABEL = { leilao: '', sorteio: 'sorteado', unico: 'sobra' };
  const COLORS = ['#c8aa6e', '#0ac8b9', '#e84057', '#9b7dff', '#5ccf6a', '#ff9f43'];
  const BOT_NAMES = ['Bot Barão', 'Bot Arauto', 'Bot Poro', 'Bot Arongueijo', 'Bot Dragão'];
  const DDRAGON = '14.23.1';

  const champById = {};
  CATALOG.forEach(c => { champById[c.id] = c; });

  let game = null, brains = null, loopId = null, lastVersion = -1, stageChamp = null, lastStageBidSeq = 0;
  const color = {};

  // ---------- imagens (Data Dragon, com fallback de iniciais) ----------
  const iconUrl = id => `https://ddragon.leagueoflegends.com/cdn/${DDRAGON}/img/champion/${id}.png`;
  const artUrl = id => `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${id}_0.jpg`;
  const initials = n => n.replace(/[^A-Za-zÀ-ú ]/g, '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  function img(id, cls = '', big = false) {
    const c = champById[id];
    return `<img class="${cls}" src="${big ? artUrl(id) : iconUrl(id)}" alt="${esc(c.name)}" data-initials="${initials(c.name)}">`;
  }
  document.addEventListener('error', e => {
    const t = e.target;
    if (t.tagName === 'IMG' && t.dataset.initials) {
      const d = document.createElement('div');
      d.className = (t.className + ' img-fallback').trim();
      d.textContent = t.dataset.initials;
      t.replaceWith(d);
    }
  }, true);

  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const pname = id => esc(E.getPlayer(game, id).name);
  const who = id => `<span class="who" style="--pc:${color[id]}">${pname(id)}</span>`;
  const cname = id => `<b>${esc(champById[id].name)}</b>`;

  function showScreen(name) {
    ['setup', 'auction', 'results'].forEach(n => $('#screen-' + n).classList.toggle('hidden', n !== name));
    window.scrollTo(0, 0);
  }

  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
  }

  // ---------- início ----------
  function startGame() {
    const nick = ($('#nick').value.trim() || 'Você').slice(0, 16);
    const fast = $('#speed').value === 'fast';
    const profiles = E.shuffle(['agressivo', 'economico', 'equilibrado', 'estrategico', 'equilibrado'], Math.random);
    const players = [{ id: ME, name: nick, isBot: false }].concat(
      BOT_NAMES.map((n, i) => ({ id: 'p' + (i + 1), name: n, isBot: true, botProfile: profiles[i] }))
    );
    players.forEach((p, i) => { color[p.id] = COLORS[i]; });
    const now = Date.now();
    game = E.createGame({
      players, champions: CATALOG, seed: (now ^ (Math.random() * 1e9)) >>> 0, now,
      config: fast ? { bidTimeMs: 4000, routePickMs: 6000, intermissionMs: 700 } : {},
    });
    brains = B.createBrains(game);
    window.__nexusGame = game; // para depuração no console
    lastVersion = -1; stageChamp = null;
    $('#customBid').value = '';
    showScreen('auction');
    clearInterval(loopId);
    loopId = setInterval(loop, 100);
    loop();
  }

  function loop() {
    const now = Date.now();
    B.step(game, brains, now);
    E.tick(game, now);
    if (game.version !== lastVersion) {
      lastVersion = game.version;
      renderAll();
    }
    renderTimer(now);
    if (game.phase === 'finished') {
      clearInterval(loopId);
      setTimeout(renderResults, 900);
    }
  }

  // ---------- ações do jogador ----------
  function bid(amount) {
    const r = E.placeBid(game, ME, amount, Date.now());
    if (!r.ok) toast(r.reason);
    else { lastVersion = -1; loop(); }
  }
  $$('.btn-bid').forEach(btn => btn.addEventListener('click', () => bid(Number(btn.dataset.amount))));
  $('#customBtn').addEventListener('click', submitCustom);
  $('#customBid').addEventListener('keydown', e => { if (e.key === 'Enter') submitCustom(); });
  $('#maxBtn').addEventListener('click', () => bid(E.maxBid(game, ME)));
  function submitCustom() {
    const raw = $('#customBid').value.replace(/[^\d,.]/g, '').replace(',', '.');
    const v = Math.round(parseFloat(raw) * 100);
    if (!Number.isFinite(v)) return toast('Digite um valor, ex.: 3,50');
    bid(v);
    $('#customBid').value = '';
  }
  $('#routeOverlay').addEventListener('click', e => {
    const b = e.target.closest('[data-role]');
    if (!b) return;
    const r = E.chooseRoute(game, ME, b.dataset.role, Date.now());
    if (!r.ok) toast(r.reason);
    lastVersion = -1; loop();
  });
  $('#startBtn').addEventListener('click', startGame);
  $('#nick').addEventListener('keydown', e => { if (e.key === 'Enter') startGame(); });
  $('#againBtn').addEventListener('click', () => showScreen('setup'));
  $('#copyBtn').addEventListener('click', copyResults);

  // ---------- render ----------
  function renderAll() {
    renderHeader();
    renderStage();
    renderControls();
    renderMyTeam();
    renderPlayers();
    renderPool();
    renderLog();
    renderRouteOverlay();
  }

  function renderHeader() {
    const placed = game.sales.length;
    $('#lotCounter').textContent = `${placed} de ${Object.keys(game.champions).length} campeões definidos`;
    $('#myBudget').textContent = fmt(E.getPlayer(game, ME).budget);
  }

  function lastEvent(types) {
    for (let i = game.events.length - 1; i >= 0; i--) if (types.includes(game.events[i].type)) return game.events[i];
    return null;
  }

  function renderStage() {
    const cur = game.current, rp = game.routePick;
    const lastPlaced = lastEvent(['placed']);
    const champId = cur ? cur.champId : rp ? rp.champId : lastPlaced ? lastPlaced.champId : null;

    if (champId !== stageChamp) {
      stageChamp = champId;
      $('#stageArt').innerHTML = champId ? img(champId, '', true) : '';
    }
    if (cur && cur.highBid && cur.highBid.seq !== lastStageBidSeq) {
      lastStageBidSeq = cur.highBid.seq;
      const art = $('#stageArt');
      art.classList.remove('pulse'); void art.offsetWidth; art.classList.add('pulse');
    }
    if (!champId) { $('#champName').textContent = 'Preparando…'; return; }

    const champ = champById[champId];
    $('#champName').textContent = champ.name;

    const myValid = cur ? E.validRoles(game, ME, champId) : [];
    $('#champRoutes').innerHTML = champ.routes.map(r => {
      const cls = !cur ? '' : myValid.includes(r) ? 'ok' : 'no';
      return `<span class="chip ${cls}" title="${cls === 'no' ? 'Indisponível para você' : ''}">${ROLE_LABEL[r]}</span>`;
    }).join('');

    let tag = '', amount = '—', leader = '';
    if (cur) {
      tag = 'Em disputa' + (cur.attempt > 1 ? ' · <span class="warn">2ª tentativa, sem lances será sorteado</span>' : '');
      if (cur.highBid) {
        amount = fmt(cur.highBid.amount);
        leader = `<span style="--pc:${color[cur.highBid.playerId]}">liderando: <b>${pname(cur.highBid.playerId)}</b></span> · ${cur.bidCount} lance${cur.bidCount > 1 ? 's' : ''}`;
      } else {
        amount = fmt(game.config.minBid);
        leader = 'Nenhum lance ainda. Esse é o lance inicial.';
      }
    } else if (rp) {
      tag = rp.how === 'leilao' ? 'Arrematado' : rp.how === 'sorteio' ? 'Sorteado' : 'Atribuído';
      amount = fmt(rp.price);
      leader = `<span style="--pc:${color[rp.playerId]}"><b>${pname(rp.playerId)}</b> está escolhendo a rota…</span>`;
    } else if (lastPlaced) {
      tag = lastPlaced.how === 'leilao' ? 'Vendido' : lastPlaced.how === 'sorteio' ? 'Sorteado (grátis)' : 'Sobra (grátis)';
      amount = fmt(lastPlaced.price);
      leader = `<span style="--pc:${color[lastPlaced.playerId]}"><b>${pname(lastPlaced.playerId)}</b> · ${ROLE_LABEL[lastPlaced.role]}</span>`;
    }
    $('#lotTag').innerHTML = tag;
    $('#highAmount').textContent = amount;
    $('#highLeader').innerHTML = leader;
  }

  function renderTimer(now) {
    const bar = $('#timerBar'), txt = $('#timerText');
    let left = 0, total = 1, label = '';
    if (game.current) {
      left = Math.max(0, game.current.endsAt - now); total = game.config.bidTimeMs;
      label = (left / 1000).toFixed(1) + ' s';
    } else if (game.routePick) {
      left = Math.max(0, game.routePick.deadline - now); total = game.config.routePickMs;
      label = 'Escolha de rota · ' + Math.ceil(left / 1000) + ' s';
      const rt = $('#routeTimer'); if (rt) rt.textContent = Math.ceil(left / 1000);
    } else {
      label = game.phase === 'finished' ? 'Fim do draft' : 'Próximo campeão…';
    }
    const pct = (left / total) * 100;
    bar.style.width = pct + '%';
    bar.classList.toggle('low', game.current && left < 3000);
    txt.textContent = label;
  }

  function renderControls() {
    const el = E.bidEligibility(game, ME);
    const cur = game.current;
    const leading = cur && cur.highBid && cur.highBid.playerId === ME;
    const min = E.minNextBid(game);
    const max = E.maxBid(game, ME);
    const base = cur && cur.highBid ? cur.highBid.amount : 0;

    $$('.btn-bid').forEach(btn => {
      const inc = Number(btn.dataset.inc);
      const amt = Math.max(min, base + inc);
      btn.dataset.amount = amt;
      btn.innerHTML = `${fmt(amt)}<small>+${fmt(inc).replace('R$ ', '')}</small>`;
      btn.disabled = !el.ok || leading || amt > max;
    });
    const can = el.ok && !leading;
    $('#customBtn').disabled = !can;
    $('#maxBtn').disabled = !can || max < min;
    $('#customBid').disabled = !can;

    const hint = $('#bidHint');
    hint.className = 'hint';
    if (!cur) hint.textContent = '';
    else if (leading) { hint.textContent = 'Você está liderando! Se ninguém cobrir, o campeão é seu.'; hint.classList.add('lead'); }
    else if (!el.ok) { hint.textContent = el.reason; hint.classList.add('bad'); }
    else hint.textContent = `Seu lance máximo agora: ${fmt(max)} (guardando ${fmt((E.openRoles(E.getPlayer(game, ME)).length - 1) * game.config.minBid)} para as outras vagas).`;
  }

  function renderMyTeam() {
    const me = E.getPlayer(game, ME);
    const spent = game.config.budget - me.budget;
    const filled = 5 - E.openRoles(me).length;
    $('#myTeamMeta').textContent = `${filled}/5 · gasto ${fmt(spent)}`;
    $('#mySlots').innerHTML = E.ROLES.map(r => {
      const s = me.roster[r];
      if (!s) return `<div class="slot"><div class="role">${ROLE_LABEL[r]}</div><div class="ic empty"></div><div class="nm" style="color:var(--muted)">vazio</div><div class="pr">&nbsp;</div></div>`;
      return `<div class="slot filled"><div class="role">${ROLE_LABEL[r]}</div>${img(s.champId, 'ic')}<div class="nm">${esc(champById[s.champId].name)}</div><div class="pr">${fmt(s.price)}${HOW_LABEL[s.how] ? ' · ' + HOW_LABEL[s.how] : ''}</div></div>`;
    }).join('');
  }

  function renderPlayers() {
    const cur = game.current;
    $('#playerList').innerHTML = game.players.map(p => {
      const leader = cur && cur.highBid && cur.highBid.playerId === p.id;
      const el = cur ? E.bidEligibility(game, p.id) : { ok: true };
      const open = E.openRoles(p).length;
      let status = '';
      if (leader) status = `Liderando com ${fmt(cur.highBid.amount)}`;
      else if (!open) status = 'Time completo';
      else if (cur && !el.ok) status = el.reason.replace('Você não tem', 'Sem').replace('Seu time', 'Time');
      else status = `Lance máx. ${fmt(E.maxBid(game, p.id))}`;
      const tag = p.isBot ? `Bot · ${B.PROFILES[p.botProfile].label}` : (p.id === ME ? 'Você' : 'Jogador');
      const slots = E.ROLES.map(r => {
        const s = p.roster[r];
        return `<div class="mini" title="${ROLE_LABEL[r]}${s ? ': ' + esc(champById[s.champId].name) + ' · ' + fmt(s.price) : ''}">${s ? img(s.champId) : ROLE_SHORT[r]}</div>`;
      }).join('');
      return `<div class="pcard ${leader ? 'leader' : ''} ${cur && !el.ok && !leader ? 'out' : ''}" style="--pc:${color[p.id]}">
        <div class="pc-head"><b>${esc(p.name)}</b><span class="tag">${tag}</span><span class="money">${fmt(p.budget)}</span></div>
        <div class="pc-slots">${slots}</div>
        <div class="pc-status ${leader ? 'lead' : ''}">${status}</div>
      </div>`;
    }).join('');
  }

  function renderPool() {
    const owner = {};
    game.sales.forEach(s => { owner[s.champId] = s; });
    const curId = game.current ? game.current.champId : game.routePick ? game.routePick.champId : null;
    const remaining = game.queue.length + (game.current ? 1 : 0);
    $('#poolMeta').textContent = `${remaining} na fila`;
    const next = game.queue.slice(0, 3);
    $('#nextUp').innerHTML = next.length
      ? `Próximos: ${next.map(id => `<div class="mini" title="${esc(champById[id].name)}">${img(id)}</div>`).join('')}`
      : '';
    $('#poolGrid').innerHTML = CATALOG.map(c => {
      const s = owner[c.id];
      const cls = s ? 'sold' : c.id === curId ? 'current' : '';
      const title = `${c.name} (${c.routes.map(r => ROLE_SHORT[r]).join('/')})${s ? ' · ' + E.getPlayer(game, s.playerId).name + ' · ' + fmt(s.price) : ''}`;
      return `<div class="pchamp ${cls}" style="--pc:${s ? color[s.playerId] : 'transparent'}" title="${esc(title)}">${img(c.id)}${s ? `<div class="price">${fmt(s.price).replace('R$ ', '')}</div>` : ''}</div>`;
    }).join('');
  }

  function eventText(ev) {
    switch (ev.type) {
      case 'lot_start': return `Em disputa: ${cname(ev.champId)}${ev.attempt > 1 ? ' (2ª tentativa)' : ''}`;
      case 'bid': return `${who(ev.playerId)} deu ${fmt(ev.amount)} em ${cname(ev.champId)}`;
      case 'sold': return `${cname(ev.champId)} arrematado por ${who(ev.playerId)} por <b>${fmt(ev.amount)}</b>`;
      case 'requeue': return `${cname(ev.champId)} ficou sem lances e voltou para o fim da fila`;
      case 'forced': return `${cname(ev.champId)} ficou sem lances de novo e foi sorteado para ${who(ev.playerId)} (grátis)`;
      case 'only_option': return `${cname(ev.champId)} só cabe no time de ${who(ev.playerId)}, que recebe de graça`;
      case 'route_pick': return `${who(ev.playerId)} está escolhendo a rota de ${cname(ev.champId)}`;
      case 'placed': return `${who(ev.playerId)} colocou ${cname(ev.champId)} no <b>${ROLE_LABEL[ev.role]}</b>${ev.via === 'auto' ? ' (automático)' : ''}`;
      case 'finished': return '<b>Draft encerrado!</b>';
      default: return ev.type;
    }
  }

  function renderLog() {
    const evs = game.events.slice(-60).reverse();
    $('#eventLog').innerHTML = evs.map(ev =>
      `<li class="${['sold', 'forced', 'only_option', 'finished'].includes(ev.type) ? 'big' : ''}">${eventText(ev)}</li>`
    ).join('');
  }

  function renderRouteOverlay() {
    const ov = $('#routeOverlay');
    const rp = game.routePick;
    if (game.phase !== 'routePick' || !rp || rp.playerId !== ME) { ov.classList.add('hidden'); ov.innerHTML = ''; return; }
    const c = champById[rp.champId];
    ov.innerHTML = `<div class="route-card">
      ${img(rp.champId)}
      <h2>${esc(c.name)} é seu!</h2>
      <p>${rp.price ? 'Pago: ' + fmt(rp.price) : 'De graça'} · escolha a rota em <b id="routeTimer"></b> s</p>
      <div class="route-btns">${rp.options.map(r => `<button class="btn-secondary" data-role="${r}">${ROLE_LABEL[r]}</button>`).join('')}</div>
      <p style="margin:14px 0 0;font-size:12px">Só aparecem as rotas que não travam o draft de ninguém.</p>
    </div>`;
    ov.classList.remove('hidden');
  }

  // ---------- resultados ----------
  function renderResults() {
    showScreen('results');
    const paid = game.sales.filter(s => s.price > 0);
    const priciest = paid.slice().sort((a, b) => b.price - a.price)[0];
    const totals = game.players.map(p => ({ p, spent: game.config.budget - p.budget }));
    const thrifty = totals.slice().sort((a, b) => a.spent - b.spent)[0];
    const spender = totals.slice().sort((a, b) => b.spent - a.spent)[0];
    const freebies = game.sales.filter(s => s.price === 0).length;
    $('#highlights').innerHTML = [
      priciest && hl('Mais caro', `${champById[priciest.champId].name} · ${fmt(priciest.price)}`, E.getPlayer(game, priciest.playerId).name),
      hl('Mais gastou', fmt(spender.spent), spender.p.name),
      hl('Mais econômico', fmt(thrifty.spent), thrifty.p.name),
      hl('Lances no total', String(game.bids.length), `${freebies} campeão(ões) saíram de graça`),
    ].filter(Boolean).join('');

    $('#teams').innerHTML = game.players.map(p => {
      const spent = game.config.budget - p.budget;
      return `<div class="team ${p.id === ME ? 'me' : ''}" style="--pc:${color[p.id]}">
        <div class="team-head"><b>${esc(p.name)}</b><span>gastou ${fmt(spent)} · sobrou ${fmt(p.budget)}</span></div>
        ${E.ROLES.map(r => {
          const s = p.roster[r];
          return `<div class="trow"><span class="role">${ROLE_LABEL[r]}</span>${img(s.champId)}<span>${esc(champById[s.champId].name)}<span class="how">${HOW_LABEL[s.how] || ''}</span></span><span class="pr">${fmt(s.price)}</span></div>`;
        }).join('')}
      </div>`;
    }).join('');
  }
  function hl(k, v, s) { return `<div class="hl"><div class="k">${k}</div><div class="v">${esc(v)}</div><div class="s">${esc(s)}</div></div>`; }

  function copyResults() {
    const lines = ['NEXUS DRAFT: resultado', ''];
    game.players.forEach(p => {
      lines.push(`${p.name} (gastou ${fmt(game.config.budget - p.budget)})`);
      E.ROLES.forEach(r => { const s = p.roster[r]; lines.push(`  ${ROLE_LABEL[r]}: ${champById[s.champId].name} · ${fmt(s.price)}`); });
      lines.push('');
    });
    const text = lines.join('\n');
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
      .then(() => toast('Resultado copiado!'))
      .catch(() => toast('Não consegui copiar automaticamente.'));
  }
})();
