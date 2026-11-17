// Calcula onde cada campeão está em um instante da partida, a partir dos eventos.
// Puro e determinístico: o mesmo instante sempre dá as mesmas posições.
import { ROLES, type Role } from '@/lib/auction/engine';
import {
  type Lane, type Pt, type Side, BARON_PIT, DRAGON_PIT, FOUNTAIN, JUNGLE_SPOTS, LANES, alongLane,
} from '@/lib/match/map';
import type { MatchEvent, PlayerKey } from '@/lib/match/sim';

export interface Deaths { from: number; until: number }

export function buildDeaths(events: MatchEvent[]): Record<string, Deaths[]> {
  const out: Record<string, Deaths[]> = {};
  for (const e of events) for (const v of e.victims) (out[v] ??= []).push({ from: e.t, until: e.t + 8 + (e.t / 60) * 1.1 });
  return out;
}

export function isDeadAt(deaths: Record<string, Deaths[]>, k: string, t: number) {
  return (deaths[k] ?? []).some(d => t >= d.from && t < d.until);
}

/** Quantas torres cada lado perdeu em cada rota até o instante t. */
export function towersLostAt(events: MatchEvent[], t: number): Record<Side, Record<Lane, number>> {
  const lost: Record<Side, Record<Lane, number>> = { 0: { TOP: 0, MID: 0, BOT: 0 }, 1: { TOP: 0, MID: 0, BOT: 0 } };
  for (const e of events) {
    if (e.t > t) break;
    if (e.type === 'tower' && e.lane) lost[(1 - e.side) as Side][e.lane]++;
  }
  return lost;
}

// Pequeno deslocamento fixo por jogador para os ícones não ficarem empilhados.
const JITTER: Record<Role, Pt> = {
  TOP: { x: -1.6, y: -1.2 }, JUNGLE: { x: 1.4, y: -1.6 }, MID: { x: 0, y: 0 }, ADC: { x: -1.4, y: 1.5 }, SUPORTE: { x: 1.6, y: 1.2 },
};
const add = (p: Pt, q: Pt, k = 1): Pt => ({ x: p.x + q.x * k, y: p.y + q.y * k });
const ROLE_LANE: Record<Role, Lane | null> = { TOP: 'TOP', JUNGLE: null, MID: 'MID', ADC: 'BOT', SUPORTE: 'BOT' };

// ---------------------------------------------------------------------------
// Trajetos: cada jogador tem uma linha do tempo de pontos (t, posição) e anda em linha reta
// entre eles na velocidade de um campeão. Para cada lance (gank, luta, dragão…) ele sai a tempo
// de chegar no local na hora certa; depois volta para a rota. Morto = na base até renascer.
// ---------------------------------------------------------------------------
/** Velocidade de um campeão em % do mapa por segundo de jogo (~345 de velocidade de movimento). */
export const CHAMP_SPEED = 2.4;
const HOLD_AFTER = 4;      // segundos que fica no local depois do lance
const CAMP_TIME = 22;      // tempo limpando cada acampamento
const FIRST_CAMP_AT = 90;  // acampamentos nascem com 1:30

interface Key { t: number; at: Pt; dead?: boolean }
export type Paths = Record<string, Key[]>;
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const lerpPt = (a: Pt, b: Pt, f: number): Pt => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });

/** Ordem de limpeza dos acampamentos: em volta da selva do próprio lado (sem atravessar o mapa). */
function jungleRoute(side: Side): Pt[] {
  const spots = JUNGLE_SPOTS[side];
  const c = spots.reduce((a, p) => ({ x: a.x + p.x / spots.length, y: a.y + p.y / spots.length }), { x: 0, y: 0 });
  return [...spots].sort((a, b) => Math.atan2(a.y - c.y, a.x - c.x) - Math.atan2(b.y - c.y, b.x - c.x));
}

/** Rota do jungler sem eventos: da base até o 1º acampamento e depois em ciclo. */
function jungleBaseline(side: Side, until: number): Key[] {
  const route = jungleRoute(side);
  const keys: Key[] = [{ t: 0, at: FOUNTAIN[side] }];
  let t = Math.max(FIRST_CAMP_AT - dist(FOUNTAIN[side], route[0]) / CHAMP_SPEED, 5);
  keys.push({ t, at: FOUNTAIN[side] });
  let pos = FOUNTAIN[side];
  for (let i = 0; t < until; i++) {
    const camp = route[i % route.length];
    t += dist(pos, camp) / CHAMP_SPEED;
    keys.push({ t, at: camp });
    t += CAMP_TIME;
    keys.push({ t, at: camp });
    pos = camp;
  }
  return keys;
}

function sample(keys: Key[], t: number): Pt {
  if (t <= keys[0].t) return keys[0].at;
  // Busca binária pelo primeiro ponto com b.t >= t (os tempos nunca diminuem).
  let lo = 1, hi = keys.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (keys[mid].t >= t) hi = mid; else lo = mid + 1; }
  if (lo >= keys.length) return keys[keys.length - 1].at;
  const a = keys[lo - 1], b = keys[lo];
  return b.dead || b.t === a.t ? b.at : lerpPt(a.at, b.at, (t - a.t) / (b.t - a.t));
}

/** Primeiro índice de `ts` (crescente) com valor > x (ou >= x, se `orEqual`). */
function bound(ts: number[], x: number, orEqual: boolean) {
  let lo = 0, hi = ts.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (orEqual ? ts[mid] >= x : ts[mid] > x) hi = mid; else lo = mid + 1; }
  return lo;
}

/**
 * Consultas rápidas sobre os eventos (torres perdidas até t, próximo lance grande depois de t),
 * equivalentes a `towersLostAt` e a um `events.find`, mas em O(log n) quando os eventos estão em ordem.
 */
function eventIndex(events: MatchEvent[]) {
  const sorted = events.every((e, i) => i === 0 || e.t >= events[i - 1].t);
  const towers = events.filter(e => e.type === 'tower' && e.lane);
  const towerT = towers.map(e => e.t);
  // Contagem acumulada de torres perdidas por lado e rota depois de cada torre.
  const cum: Record<Side, Record<Lane, number>>[] = [];
  const acc: Record<Side, Record<Lane, number>> = { 0: { TOP: 0, MID: 0, BOT: 0 }, 1: { TOP: 0, MID: 0, BOT: 0 } };
  for (const e of towers) {
    acc[(1 - e.side) as Side][e.lane!]++;
    cum.push({ 0: { ...acc[0] }, 1: { ...acc[1] } });
  }
  const ZERO: Record<Side, Record<Lane, number>> = { 0: { TOP: 0, MID: 0, BOT: 0 }, 1: { TOP: 0, MID: 0, BOT: 0 } };
  const big = events.filter(e => e.type === 'teamfight' || e.type === 'baron' || e.type === 'dragon');
  const bigT = big.map(e => e.t);
  return {
    lostAt(t: number): Record<Side, Record<Lane, number>> {
      if (!sorted) return towersLostAt(events, t);
      const n = bound(towerT, t, false);
      return n === 0 ? ZERO : cum[n - 1];
    },
    nextBig(t: number): MatchEvent | undefined {
      if (!sorted) return big.find(e => e.t >= t);
      return big[bound(bigT, t, true)];
    },
  };
}

export function buildPaths(events: MatchEvent[], deaths: Record<string, Deaths[]>, splitTop: [boolean, boolean], duration: number): Paths {
  const out: Paths = {};
  const jungle: Record<Side, Key[]> = { 0: jungleBaseline(0, duration + 60), 1: jungleBaseline(1, duration + 60) };
  const idx = eventIndex(events);
  const laneOf = new Map<MatchEvent | undefined, Lane>();
  const nearestLaneOf = (e: MatchEvent | undefined) => {
    let l = laneOf.get(e);
    if (!l) { l = nearestLane(e?.at); laneOf.set(e, l); }
    return l;
  };

  for (const k of ALL_KEYS) {
    const side = Number(k[0]) as Side;
    const role = k.slice(2) as Role;
    const j = JITTER[role];

    // Onde o jogador fica quando não está em nenhum lance.
    const home = (t: number): Pt => {
      const lost = idx.lostAt(t);
      const laneFront = (lane: Lane) => {
        const f = 0.5 + (lost[1][lane] - lost[0][lane]) * 0.11;
        return alongLane(lane, Math.max(0.1, Math.min(0.9, f + (side === 0 ? -0.035 : 0.035))));
      };
      if (t < 14 * 60) {
        const lane = ROLE_LANE[role];
        if (!lane) return sample(jungle[side], t);
        // Na rota ninguém fica parado: vai e volta trocando golpes e farmando.
        const ph = ROLES.indexOf(role) * 1.7 + side * 2.3;
        return { x: laneFront(lane).x + j.x * 0.7 + Math.sin(t / 5 + ph) * 1.3, y: laneFront(lane).y + j.y * 0.7 + Math.cos(t / 7 + ph) * 1.1 };
      }
      if (role === 'TOP' && splitTop[side]) return add(laneFront('TOP'), j, 0.5);
      const next = idx.nextBig(t);
      const gather = next?.at === BARON_PIT || next?.at === DRAGON_PIT ? next.at : laneFront(nearestLaneOf(next));
      return add(gather, j, 1.4);
    };

    // Compromissos em ordem: estar no local do lance e, se morreu, ir para a base.
    type Duty = { t: number; at: Pt; deadUntil?: number };
    const hard: Duty[] = [];
    const soft: Duty[] = [];
    const STRUCTURE = new Set(['tower', 'inhibitor', 'nexus_tower']);
    for (const e of events) {
      if (e.type === 'tactic' || e.type === 'nexus') continue;
      const victim = e.victims.includes(k);
      if (!victim && !e.actors.includes(k)) continue;
      const d = (deaths[k] ?? []).find(x => x.from === e.t);
      const duty: Duty = { t: e.t, at: add(e.at, j, 0.6), deadUntil: victim ? d?.until : undefined };
      if (STRUCTURE.has(e.type) && !victim) {
        // Torres: o simulador credita o time todo; no mapa só vai quem é daquela rota
        // (ou todos, depois dos 14 min, quando o time anda junto).
        const lane = ROLE_LANE[role];
        if (e.t >= 14 * 60 || (e.lane && lane === e.lane)) soft.push(duty);
      } else hard.push(duty);
    }
    // Torre só entra se não conflitar com um lance de verdade (luta, abate, objetivo) por perto.
    const free = (d: Duty) => !hard.some(h => {
      const gap = Math.abs(h.t - d.t);
      return gap < 25 && dist(h.at, d.at) / CHAMP_SPEED > gap;
    });
    const duties = [...hard, ...soft.filter(free)].sort((a, b) => a.t - b.t);

    const keys: Key[] = [];
    let cur: Key = { t: 0, at: FOUNTAIN[side] };
    keys.push(cur);
    // Segue a "casa" de 3 em 3 s entre cur.t e t1, começando de onde está (andando até ela primeiro).
    // Os passos inteiros a partir do mesmo ponto de partida são sempre iguais, então ficam guardados
    // (a busca da hora de sair chama isto muitas vezes com o mesmo `from`).
    let trajFrom: Key | null = null;
    let trajT: number[] = [], trajP: Pt[] = [];
    const stepFrom = (t: number, at: Pt, step: number): Pt => {
      const target = home(t + step);
      const d = dist(at, target);
      const reach = CHAMP_SPEED * step;
      return d <= reach ? target : lerpPt(at, target, reach / d);
    };
    const walkHome = (from: Key, t1: number, sink?: Key[]): Pt => {
      if (trajFrom !== from) { trajFrom = from; trajT = [from.t]; trajP = [from.at]; }
      // Estende os passos inteiros até onde o laço original chegaria (t1 − t < 3).
      while (t1 - trajT[trajT.length - 1] >= 3) {
        const i = trajT.length - 1;
        trajP.push(stepFrom(trajT[i], trajP[i], 3));
        trajT.push(trajT[i] + 3);
      }
      // Último índice inteiro do caminho: o primeiro com t1 − t < 3.
      let lo = 0, hi = trajT.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (t1 - trajT[mid] < 3) hi = mid; else lo = mid + 1; }
      if (sink) for (let i = 1; i <= lo; i++) sink.push({ t: trajT[i], at: trajP[i] });
      let t = trajT[lo], at = trajP[lo];
      while (t < t1) {
        const step = t1 - t;
        at = stepFrom(t, at, step);
        t += step;
        sink?.push({ t, at });
      }
      return at;
    };
    const followHome = (t1: number) => { cur = { t: t1, at: walkHome(cur, t1, keys) }; };

    for (const duty of duties) {
      if (duty.deadUntil == null && isDeadAt(deaths, k, duty.t)) continue;
      // Hora de sair: a mais tarde possível que ainda chega a tempo, partindo da posição real.
      let lo = cur.t, hi = Math.max(cur.t, duty.t);
      const fits = (dep: number) => dist(walkHome(cur, dep), duty.at) / CHAMP_SPEED <= duty.t - dep;
      if (fits(lo)) {
        for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
      }
      if (lo > cur.t) followHome(lo);
      // Se nem saindo agora dá tempo (lances colados), chega um pouco atrasado, sem teletransporte.
      const arrive = Math.max(duty.t, cur.t + dist(cur.at, duty.at) / (CHAMP_SPEED * 1.5));
      keys.push({ t: arrive, at: duty.at });
      cur = { t: arrive, at: duty.at };
      if (duty.deadUntil != null) {
        // Morre no local, some e reaparece na base.
        keys.push({ t: cur.t + 0.01, at: FOUNTAIN[side], dead: true });
        const back = Math.max(duty.deadUntil, cur.t + 0.02);
        keys.push({ t: back, at: FOUNTAIN[side] });
        cur = { t: back, at: FOUNTAIN[side] };
      } else {
        keys.push({ t: cur.t + HOLD_AFTER, at: cur.at });
        cur = { t: cur.t + HOLD_AFTER, at: cur.at };
      }
    }
    followHome(duration + 1);
    out[k] = keys;
  }
  return out;
}

/** Posição do jogador no instante t, seguindo o trajeto. */
export function positionAt(paths: Paths, k: string, t: number): Pt {
  return sample(paths[k], t);
}

function nearestLane(p?: Pt): Lane {
  if (!p) return 'MID';
  let best: Lane = 'MID', bestD = Infinity;
  for (const l of LANES) {
    for (let f = 0.2; f <= 0.8; f += 0.1) {
      const q = alongLane(l, f);
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < bestD) { bestD = d; best = l; }
    }
  }
  return best;
}

export const ALL_KEYS: PlayerKey[] = ([0, 1] as Side[]).flatMap(s => ROLES.map(r => `${s}-${r}` as PlayerKey));
