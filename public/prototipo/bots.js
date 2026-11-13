// NEXUS DRAFT — bots. Usam só as ações públicas do motor (placeBid / chooseRoute),
// exatamente como um jogador humano: não conseguem trapacear.
(function (root) {
  'use strict';
  const E = root.NexusEngine;

  const PROFILES = {
    economico:   { label: 'Econômico',   mult: 0.65, jump: 0.0 },
    equilibrado: { label: 'Equilibrado', mult: 1.0,  jump: 0.1 },
    agressivo:   { label: 'Agressivo',   mult: 1.45, jump: 0.35 },
    estrategico: { label: 'Estratégico', mult: 0.8,  jump: 0.15, prefMult: 2.0 },
  };
  const TIER_FACTOR = { 1: 0.6, 2: 1.0, 3: 1.5 };

  function createBrains(s) {
    const brains = {};
    s.players.filter(p => p.isBot).forEach(p => {
      brains[p.id] = {
        prefRole: E.ROLES[Math.floor(s.rng() * E.ROLES.length)], // rota que o Estratégico prioriza
        lotKey: null, seen: -1, nextAt: Infinity, noise: 1, routeAt: null,
      };
    });
    return brains;
  }

  // Quanto o bot aceita pagar no campeão atual.
  function valuation(s, p, brain) {
    const champ = s.champions[s.current.champId];
    const prof = PROFILES[p.botProfile] || PROFILES.equilibrado;
    const open = E.openRoles(p).length;
    const avgPerSlot = p.budget / open;
    let mult = prof.mult;
    if (prof.prefMult && champ.routes.includes(brain.prefRole) && !p.roster[brain.prefRole]) mult = prof.prefMult;
    const v = avgPerSlot * mult * (TIER_FACTOR[champ.tier] || 1) * brain.noise;
    return Math.min(Math.floor(v / 50) * 50, E.maxBid(s, p.id));
  }

  function step(s, brains, now) {
    const rng = s.rng;
    for (const p of s.players) {
      if (!p.isBot) continue;
      const b = brains[p.id];

      if (s.phase === 'routePick') {
        if (s.routePick.playerId !== p.id) continue;
        if (b.routeAt == null) b.routeAt = now + 500 + rng() * 900;
        if (now < b.routeAt) continue;
        b.routeAt = null;
        const opts = s.routePick.options;
        const champ = s.champions[s.routePick.champId];
        const role = p.botProfile === 'estrategico' && opts.includes(b.prefRole)
          ? b.prefRole
          : champ.routes.find(r => opts.includes(r));
        E.chooseRoute(s, p.id, role, now);
        continue;
      }

      if (s.phase !== 'bidding' || !s.current) continue;

      const key = s.current.champId + '@' + s.current.startedAt;
      if (b.lotKey !== key) { b.lotKey = key; b.noise = 0.8 + rng() * 0.4; b.seen = -1; }
      // Cada novo lance reagenda a reação do bot em um momento aleatório da janela.
      if (b.seen !== s.seq) {
        b.seen = s.seq;
        b.nextAt = now + 350 + rng() * s.config.bidTimeMs * 0.75;
      }
      if (now < b.nextAt) continue;
      b.nextAt = Infinity;

      if (s.current.highBid && s.current.highBid.playerId === p.id) continue;
      if (!E.bidEligibility(s, p.id).ok) continue;
      const v = valuation(s, p, b);
      const min = E.minNextBid(s);
      if (min > v) continue;

      // Pula uma fração do espaço até o teto: os lances sobem rápido no começo e devagar no fim,
      // como gente de verdade (evita centenas de lances de R$ 0,50).
      const prof = PROFILES[p.botProfile] || PROFILES.equilibrado;
      const frac = 0.2 + rng() * 0.3 + (rng() < prof.jump ? 0.25 : 0);
      const amount = min + Math.floor(((v - min) * frac) / 50) * 50;
      E.placeBid(s, p.id, amount, now);
    }
  }

  root.NexusBots = { PROFILES, createBrains, step };
})(typeof window !== 'undefined' ? window : globalThis);
