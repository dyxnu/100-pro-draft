// Motor de simulação de partidas (determinístico pela seed: o servidor decide,
// todos assistem exatamente o mesmo jogo). Tempo em segundos de jogo.
import { ROLES, type Role } from '@/lib/auction/engine';
import type { ChampionCard } from '@/lib/champions/cards';
import { type Strategy, type TeamProfile, classEdge, matchupEdge, styleFit, teamProfile } from './model';
import {
  type Lane, type Pt, type Side, BARON_PIT, DRAGON_PIT, LANES, NEXUS,
  alongLane, inhibPos, nexusTowerPos, towerPos,
} from './map';

export interface MatchTeam { name: string; cards: Record<Role, ChampionCard>; strategy: Strategy }
export type PlayerKey = `${Side}-${Role}`;

export type MatchEventType =
  | 'kill' | 'gank' | 'teamfight' | 'tower' | 'inhibitor' | 'nexus_tower' | 'nexus' | 'dragon' | 'baron';

export interface MatchEvent {
  t: number;
  type: MatchEventType;
  side: Side;            // lado que se beneficiou
  at: Pt;                // onde aconteceu (para o mini-mapa)
  actors: PlayerKey[];   // quem participou pelo lado que se beneficiou
  victims: PlayerKey[];  // quem morreu
  lane?: Lane;
  text: string;
  big?: boolean;
  score: [number, number]; // placar de abates depois do evento
}

export interface PlayerStats { kills: number; deaths: number; assists: number; gold: number }
export interface TeamStats { kills: number; towers: number; dragons: number; barons: number; gold: number }

export interface MatchResult {
  winner: Side;
  duration: number;
  events: MatchEvent[];
  players: Record<PlayerKey, PlayerStats>;
  teams: [TeamStats, TeamStats];
  mvp: PlayerKey;
  profiles: [TeamProfile, TeamProfile];
  preMatchWinChanceA: number; // 0–1
}

const MAX_TIME = 45 * 60;
const STEP = 30;
const LANE_ROLES: Record<Lane, Role[]> = { TOP: ['TOP'], MID: ['MID'], BOT: ['ADC', 'SUPORTE'] };
const AGGR = { defensiva: 0.75, equilibrada: 1, agressiva: 1.35 } as const;
const RISK = { conservador: 0.65, normal: 1, arriscado: 1.5 } as const;
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const lerp = (a: number, b: number, f: number) => a + (b - a) * Math.max(0, Math.min(1, f));
const fmtTime = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

function makeRng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function simulateMatch(a: MatchTeam, b: MatchTeam, seed: number): MatchResult {
  const rand = makeRng(seed);
  const teams = [a, b] as const;
  const prof: [TeamProfile, TeamProfile] = [teamProfile(a.cards), teamProfile(b.cards)];
  const fit = [styleFit(prof[0], a.strategy), styleFit(prof[1], b.strategy)];
  const aggr = (s: Side) => AGGR[teams[s].strategy.agressividade];
  const risk = (s: Side) => RISK[teams[s].strategy.risco];
  const prio = (s: Side) => teams[s].strategy.prioridade;
  const key = (s: Side, r: Role) => `${s}-${r}` as PlayerKey;
  const card = (k: PlayerKey) => teams[Number(k[0]) as Side].cards[k.slice(2) as Role];
  const name = (k: PlayerKey) => card(k).name;
  const teamName = (s: Side) => teams[s].name;
  const pick = <T>(arr: T[], w: (x: T) => number): T => {
    const total = arr.reduce((sum, x) => sum + Math.max(0.01, w(x)), 0);
    let r = rand() * total;
    for (const x of arr) { r -= Math.max(0.01, w(x)); if (r <= 0) return x; }
    return arr[arr.length - 1];
  };

  const players = {} as Record<PlayerKey, PlayerStats>;
  for (const s of [0, 1] as Side[]) for (const r of ROLES) players[key(s, r)] = { kills: 0, deaths: 0, assists: 0, gold: 500 };
  const deadUntil: Partial<Record<PlayerKey, number>> = {};
  const st = {
    gold: [2500, 2500], kills: [0, 0], dragons: [0, 0], barons: [0, 0], baronUntil: [0, 0],
    towersLost: [{ TOP: 0, MID: 0, BOT: 0 }, { TOP: 0, MID: 0, BOT: 0 }] as Record<Lane, number>[],
    inhibDown: [{ TOP: false, MID: false, BOT: false }, { TOP: false, MID: false, BOT: false }] as Record<Lane, boolean>[],
    nexusTowersLost: [0, 0], towersTaken: [0, 0],
  };
  const events: MatchEvent[] = [];
  let winner: Side | null = null;
  let endTime = 0;

  const isDead = (k: PlayerKey, t: number) => (deadUntil[k] ?? 0) > t;
  const alive = (s: Side, t: number) => ROLES.map(r => key(s, r)).filter(k => !isDead(k, t));
  const respawn = (t: number) => 8 + (t / 60) * 1.1;
  let lastT = 0; // eventos nunca voltam no tempo
  const push = (e: Omit<MatchEvent, 'score'>) => {
    lastT = Math.max(lastT, e.t);
    events.push({ ...e, t: lastT, text: e.text.replace(/^\d+:\d{2}/, fmtTime(lastT)), score: [st.kills[0], st.kills[1]] });
    return lastT;
  };
  // "Forma do dia": cada time tem um pouco de sorte/azar na partida (zebras acontecem).
  const form = [(rand() - 0.5) * 6, (rand() - 0.5) * 6];

  // --- força -----------------------------------------------------------------
  function champPower(k: PlayerKey, t: number) {
    const c = card(k);
    const m = t / 60;
    const curve = m < 14 ? lerp(c.curve.early, c.curve.mid, m / 14) : lerp(c.curve.mid, c.curve.late, (m - 14) / 12);
    return c.ovr[k.slice(2) as Role] * (0.85 + curve * 0.03);
  }
  let classEdgeCache: [number, number] | null = null;
  function teamClassEdge(s: Side) {
    if (!classEdgeCache) {
      let e = 0;
      for (const ra of ROLES) for (const rb of ROLES) e += classEdge(a.cards[ra].champClass, b.cards[rb].champClass);
      classEdgeCache = [e, -e];
    }
    return classEdgeCache[s];
  }
  function teamPower(s: Side, t: number, countDead = true) {
    const o = (1 - s) as Side;
    let sum = 0;
    for (const r of ROLES) {
      const k = key(s, r);
      if (countDead && isDead(k, t)) continue;
      sum += champPower(k, t);
    }
    let p = sum / 5 + form[s];
    p += teamClassEdge(s) * 0.12 + prof[s].synergy * 0.8;
    p *= fit[s];
    p += ((st.gold[s] - st.gold[o]) / 1000) * 1.1;
    if (st.baronUntil[s] > t) p += 5;
    p += st.dragons[s] * 0.8 + (st.dragons[s] >= 4 ? 4 : 0);
    if (teams[s].strategy.agressividade === 'agressiva' && t < 900) p += 1.5;
    if (teams[s].strategy.agressividade === 'defensiva' && st.towersLost[s].MID + st.towersLost[s].TOP + st.towersLost[s].BOT >= 4) p += 2;
    return p;
  }
  function laneEdge(s: Side, lane: Lane, t: number) {
    const o = (1 - s) as Side;
    let e = 0;
    for (const r of LANE_ROLES[lane]) {
      const mine = card(key(s, r));
      for (const r2 of LANE_ROLES[lane]) e += matchupEdge(mine, card(key(o, r2))) * 0.5;
      e += (champPower(key(s, r), t) - champPower(key(o, r), t)) / 4;
    }
    return e;
  }

  // --- abates -----------------------------------------------------------------
  function registerKill(killer: PlayerKey, victim: PlayerKey, assists: PlayerKey[], t: number) {
    const ks = Number(killer[0]) as Side;
    players[killer].kills++;
    players[killer].gold += 300;
    players[victim].deaths++;
    for (const as of assists) { players[as].assists++; players[as].gold += 100; }
    st.kills[ks]++;
    st.gold[ks] += 300 + assists.length * 100;
    deadUntil[victim] = t + respawn(t);
  }

  function teamfight(t: number, at: Pt, where: string): Side {
    const pA = teamPower(0, t), pB = teamPower(1, t);
    const pAWin = 0.5 + (sigmoid((pA - pB) / 6.5) - 0.5) / ((risk(0) + risk(1)) / 2);
    const w: Side = rand() < Math.max(0.05, Math.min(0.95, pAWin)) ? 0 : 1;
    const l = (1 - w) as Side;
    const aw = alive(w, t), al = alive(l, t);
    if (!aw.length || !al.length) return w;
    const winKills = Math.max(1, Math.min(al.length, Math.round(0.6 + rand() * 2.4 + prof[w].teamfight / 7 + (prio(w) === 'abates' ? 0.8 : 0))));
    const loseKills = Math.min(aw.length - 1, rand() < 0.55 ? Math.floor(rand() * 3) : 0);
    const victims: PlayerKey[] = [];
    const lostOnWinner: PlayerKey[] = [];
    let pool = [...al];
    for (let i = 0; i < winKills && pool.length; i++) {
      const v = pick(pool, k => 110 - card(k).attrs.DEF);
      pool = pool.filter(x => x !== v);
      const killer = pick(aw, k => Math.max(card(k).attrs.ATQ, card(k).attrs.MAG) - 35);
      registerKill(killer, v, aw.filter(x => x !== killer && rand() < 0.6), t);
      victims.push(v);
    }
    let pool2 = aw.filter(k => !victims.includes(k));
    for (let i = 0; i < loseKills && pool2.length > 1; i++) {
      const v = pick(pool2, k => 110 - card(k).attrs.DEF);
      pool2 = pool2.filter(x => x !== v);
      const killer = pick(al.filter(k => !victims.includes(k)).concat(al.slice(0, 1)), k => Math.max(card(k).attrs.ATQ, card(k).attrs.MAG) - 35);
      registerKill(killer, v, [], t);
      lostOnWinner.push(v);
    }
    const ace = victims.length === al.length && al.length === 5;
    push({
      t, type: 'teamfight', side: w, at, actors: aw, victims: [...victims, ...lostOnWinner], big: true,
      text: `${fmtTime(t)} · Team fight ${where}! ${teamName(w)} vence ${victims.length} a ${lostOnWinner.length}${ace ? ' — ACE!' : ''}`,
    });
    return w;
  }

  // --- estruturas ------------------------------------------------------------
  function destroyNext(s: Side, t: number, preferLane?: Lane): boolean {
    const o = (1 - s) as Side;
    const anyInhib = LANES.some(l => st.inhibDown[o][l]);
    if (anyInhib && st.nexusTowersLost[o] === 2) {
      endTime = push({ t, type: 'nexus', side: s, at: NEXUS[o], actors: alive(s, t), victims: [], big: true, text: `${fmtTime(Math.max(t, lastT))} · ${teamName(s)} destrói o Nexus! VITÓRIA!` });
      winner = s;
      return true;
    }
    if (anyInhib && st.nexusTowersLost[o] < 2 && (rand() < 0.6 || LANES.every(l => st.inhibDown[o][l]))) {
      const i = st.nexusTowersLost[o]++;
      st.gold[s] += 50;
      push({ t, type: 'nexus_tower', side: s, at: nexusTowerPos(o, i), actors: alive(s, t), victims: [], text: `${fmtTime(t)} · ${teamName(s)} derruba uma torre do Nexus` });
      return true;
    }
    const lanes = [...LANES].sort((x, y) => {
      if (preferLane) return (y === preferLane ? 1 : 0) - (x === preferLane ? 1 : 0);
      return (st.towersLost[o][y] - st.towersLost[o][x]) || rand() - 0.5;
    });
    for (const lane of lanes) {
      if (st.towersLost[o][lane] < 3) {
        const tier = st.towersLost[o][lane]++;
        st.towersTaken[s]++;
        st.gold[s] += 550;
        push({
          t, type: 'tower', side: s, lane, at: towerPos(o, lane, tier), actors: alive(s, t), victims: [],
          text: `${fmtTime(t)} · ${teamName(s)} destrói a torre ${['externa', 'interna', 'do inibidor'][tier]} do ${lane === 'BOT' ? 'bot' : lane === 'MID' ? 'mid' : 'top'}`,
        });
        return true;
      }
      if (!st.inhibDown[o][lane]) {
        st.inhibDown[o][lane] = true;
        st.gold[s] += 50;
        push({ t, type: 'inhibitor', side: s, lane, at: inhibPos(o, lane), actors: alive(s, t), victims: [], big: true, text: `${fmtTime(t)} · ${teamName(s)} destrói o inibidor do ${lane.toLowerCase()}!` });
        return true;
      }
    }
    return false;
  }

  // --- linha do tempo --------------------------------------------------------
  let nextDragon = 5 * 60;
  let nextBaron = 20 * 60;
  let nextFight = 14 * 60 + rand() * 120;
  const avgAggr = (aggr(0) + aggr(1)) / 2;

  for (let t = STEP; t <= MAX_TIME && winner == null; t += STEP) {
    st.gold[0] += 900; st.gold[1] += 900;
    for (const k of Object.keys(players) as PlayerKey[]) players[k].gold += 180;
    const m = t / 60;

    // Fase de rotas: abates solo, vantagem de farm e ganks
    if (m < 14) {
      for (const lane of LANES) {
        const e = laneEdge(0, lane, t);
        if (e > 0.5) st.gold[0] += Math.min(60, e * 15); else if (e < -0.5) st.gold[1] += Math.min(60, -e * 15);
        if (rand() < 0.03 * avgAggr) {
          const w: Side = rand() < sigmoid(e * 0.35) ? 0 : 1;
          const l = (1 - w) as Side;
          const killers = LANE_ROLES[lane].map(r => key(w, r)).filter(k => !isDead(k, t));
          const victimsPool = LANE_ROLES[lane].map(r => key(l, r)).filter(k => !isDead(k, t));
          if (killers.length && victimsPool.length) {
            const killer = pick(killers, k => card(k).attrs.ATQ + card(k).attrs.MAG);
            const victim = pick(victimsPool, k => 110 - card(k).attrs.DEF);
            const first = st.kills[0] + st.kills[1] === 0;
            registerKill(killer, victim, killers.filter(k => k !== killer), t);
            push({
              t, type: 'kill', side: w, lane, at: alongLane(lane, 0.5 + (w === 0 ? 0.04 : -0.04)), actors: killers, victims: [victim], big: first,
              text: `${fmtTime(t)} · ${first ? 'FIRST BLOOD! ' : ''}${name(killer)} abate ${name(victim)} no ${lane.toLowerCase()}`,
            });
          }
        }
      }
      for (const s of [0, 1] as Side[]) {
        const jg = key(s, 'JUNGLE');
        if (t < 180 || isDead(jg, t)) continue;
        if (rand() < 0.028 * aggr(s) * (card(jg).curve.early / 7)) {
          const lane = LANES[Math.floor(rand() * 3)];
          const o = (1 - s) as Side;
          const gankers = [jg, ...LANE_ROLES[lane].map(r => key(s, r))].filter(k => !isDead(k, t));
          const targets = LANE_ROLES[lane].map(r => key(o, r)).filter(k => !isDead(k, t));
          if (!targets.length) continue;
          const success = rand() < sigmoid(0.4 + laneEdge(s, lane, t) * 0.2 + (card(jg).attrs.CTR - 70) / 25);
          const first = st.kills[0] + st.kills[1] === 0;
          if (success) {
            const victim = pick(targets, k => 110 - card(k).attrs.DEF);
            const killer = pick(gankers, k => card(k).attrs.ATQ + card(k).attrs.MAG);
            registerKill(killer, victim, gankers.filter(k => k !== killer), t);
            push({
              t, type: 'gank', side: s, lane, at: alongLane(lane, 0.5), actors: gankers, victims: [victim], big: first,
              text: `${fmtTime(t)} · ${first ? 'FIRST BLOOD! ' : ''}Gank de ${name(jg)} no ${lane.toLowerCase()}: ${name(killer)} abate ${name(victim)}`,
            });
          } else if (rand() < 0.35) {
            const killer = pick(targets, k => card(k).attrs.ATQ + card(k).attrs.MAG);
            registerKill(killer, jg, [], t);
            push({
              t, type: 'kill', side: o, lane, at: alongLane(lane, 0.5), actors: [killer], victims: [jg],
              text: `${fmtTime(t)} · Gank frustrado! ${name(killer)} abate ${name(jg)} no ${lane.toLowerCase()}`,
            });
          }
        }
      }
      if (m >= 10) {
        for (const lane of LANES) {
          const e = laneEdge(0, lane, t);
          if (Math.abs(e) > 1.2 && rand() < 0.05) {
            const s: Side = e > 0 ? 0 : 1;
            if (st.towersLost[1 - s][lane] === 0) destroyNext(s, t, lane);
          }
        }
      }
    }

    // Dragões (até a alma: 4 dragões)
    if (t >= nextDragon && st.dragons[0] < 4 && st.dragons[1] < 4) {
      const contested = t >= 600 && rand() < 0.35 * avgAggr;
      let taker: Side;
      if (contested) taker = teamfight(t, DRAGON_PIT, 'no dragão');
      else {
        const bonus = (prio(0) === 'dragoes' ? 0.8 : 0) - (prio(1) === 'dragoes' ? 0.8 : 0);
        const x = laneEdge(0, 'BOT', t) * 0.3 + (champPower(key(0, 'JUNGLE'), t) - champPower(key(1, 'JUNGLE'), t)) / 8 + bonus;
        taker = rand() < sigmoid(x) ? 0 : 1;
      }
      st.dragons[taker]++;
      st.gold[taker] += 250;
      const soul = st.dragons[taker] === 4;
      push({
        t, type: 'dragon', side: taker, at: DRAGON_PIT, actors: alive(taker, t).filter(k => ['JUNGLE', 'ADC', 'SUPORTE', 'MID'].includes(k.slice(2))), victims: [], big: soul,
        text: `${fmtTime(t)} · ${teamName(taker)} pega o ${st.dragons[taker]}º dragão${soul ? ' — ALMA DO DRAGÃO!' : ''}`,
      });
      nextDragon = t + 5 * 60;
    }

    // Barão
    if (t >= nextBaron && rand() < 0.3) {
      const s: Side = teamPower(0, t) >= teamPower(1, t) ? 0 : 1;
      const taker = rand() < 0.55 ? teamfight(t, BARON_PIT, 'no Barão') : s;
      if (winner == null && alive(taker, t).length >= 3) {
        st.barons[taker]++;
        st.baronUntil[taker] = t + 180;
        st.gold[taker] += 1500;
        push({ t, type: 'baron', side: taker, at: BARON_PIT, actors: alive(taker, t), victims: [], big: true, text: `${fmtTime(t)} · ${teamName(taker)} derrota o BARÃO!` });
        destroyNext(taker, t + 45);
        if (winner == null) destroyNext(taker, t + 60);
      }
      nextBaron = t + 6 * 60;
    }

    // Team fights depois da fase de rotas
    if (winner == null && t >= nextFight) {
      const lane = LANES[Math.floor(rand() * 3)];
      const w = teamfight(t, alongLane(lane, 0.5 + (rand() - 0.5) * 0.3), lane === 'MID' ? 'no meio' : `no ${lane.toLowerCase()}`);
      // Depois de vencer a luta, o time empurra: às vezes nada (recua para curar), às vezes várias estruturas.
      const n = (rand() < 0.75 ? 1 : 0) + (prio(w) === 'torres' ? 1 : 0) + (alive(1 - w as Side, t).length <= 1 ? 1 : 0) + (st.baronUntil[w] > t ? 1 : 0);
      for (let i = 1; i <= n && winner == null; i++) destroyNext(w, t + 15 + i * 25);
      nextFight = t + (130 + rand() * 170) / avgAggr;
    }

    // Split push
    for (const s of [0, 1] as Side[]) {
      if (winner != null || m < 15 || teams[s].strategy.estilo !== 'splitpush') continue;
      const top = key(s, 'TOP');
      if (isDead(top, t)) continue;
      if (rand() < 0.05 * (prof[s].splitpush / 6) && champPower(top, t) >= champPower(key((1 - s) as Side, 'TOP'), t) - 2) {
        destroyNext(s, t, 'TOP');
      }
    }
  }

  // Morte súbita aos 45 minutos
  let t = MAX_TIME;
  while (winner == null) {
    t += 40;
    const w = teamfight(t, alongLane('MID', 0.5), 'decisiva');
    for (let i = 0; i < 3 && winner == null; i++) destroyNext(w, t + 10 + i * 15);
  }

  const w: Side = winner;
  const mvp = (Object.keys(players) as PlayerKey[])
    .filter(k => Number(k[0]) === w)
    .sort((x, y) => score(players[y]) - score(players[x]))[0];
  const teamStats = ([0, 1] as Side[]).map(s => ({
    kills: st.kills[s], towers: st.towersTaken[s], dragons: st.dragons[s], barons: st.barons[s], gold: Math.round(st.gold[s]),
  })) as [TeamStats, TeamStats];

  return {
    winner: w, duration: endTime, events: events.sort((x, y) => x.t - y.t), players, teams: teamStats, mvp,
    profiles: prof,
    preMatchWinChanceA: preMatchChance(a, b),
  };
}

const score = (p: PlayerStats) => p.kills * 3 + p.assists * 1.5 - p.deaths;

/** Chance de vitória estimada antes da partida (para mostrar na tela). */
export function preMatchChance(a: MatchTeam, b: MatchTeam): number {
  const pa = teamProfile(a.cards), pb = teamProfile(b.cards);
  const base = (t: MatchTeam) => ROLES.reduce((s, r) => s + t.cards[r].ovr[r], 0) / 5;
  let edge = 0;
  for (const ra of ROLES) for (const rb of ROLES) edge += classEdge(a.cards[ra].champClass, b.cards[rb].champClass);
  for (const r of ROLES) edge += matchupEdge(a.cards[r], b.cards[r]) * 0.5;
  const x = (base(a) * styleFit(pa, a.strategy) - base(b) * styleFit(pb, b.strategy)) + (pa.synergy - pb.synergy) * 0.8 + edge * 0.15;
  return sigmoid(x / 3.2);
}
