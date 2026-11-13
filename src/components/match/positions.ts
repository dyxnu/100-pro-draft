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

/** Posição-alvo do jogador no instante t (o desenho suaviza o movimento até ela). */
export function targetPosition(
  k: PlayerKey, t: number, events: MatchEvent[], deaths: Record<string, Deaths[]>, splitTop: [boolean, boolean],
): { at: Pt; dead: boolean } {
  const side = Number(k[0]) as Side;
  const role = k.slice(2) as Role;
  const j = JITTER[role];
  if (isDeadAt(deaths, k, t)) return { at: add(FOUNTAIN[side], j, 0.8), dead: true };

  // Participando de um evento próximo? Vai para o local dele.
  for (const e of events) {
    if (e.t - 14 > t) break;
    if (t <= e.t + 5 && (e.actors.includes(k) || e.victims.includes(k))) return { at: add(e.at, j), dead: false };
  }

  const lost = towersLostAt(events, t);
  const laneFront = (lane: Lane) => {
    // A frente da rota anda conforme as torres caem; cada lado fica um pouco do seu lado.
    const f = 0.5 + (lost[1][lane] - lost[0][lane]) * 0.11;
    return alongLane(lane, Math.max(0.1, Math.min(0.9, f + (side === 0 ? -0.035 : 0.035))));
  };

  if (t < 14 * 60) {
    const lane = ROLE_LANE[role];
    if (lane) return { at: add(laneFront(lane), j, 0.7), dead: false };
    const spots = JUNGLE_SPOTS[side];
    return { at: spots[Math.floor(t / 45) % spots.length], dead: false };
  }
  if (role === 'TOP' && splitTop[side]) return { at: add(laneFront('TOP'), j, 0.5), dead: false };
  // Meio/fim de jogo: o time se agrupa onde a próxima luta ou objetivo vai acontecer.
  const next = events.find(e => e.t >= t && (e.type === 'teamfight' || e.type === 'baron' || e.type === 'dragon'));
  const gather = next?.at === BARON_PIT || next?.at === DRAGON_PIT ? next.at : laneFront(nearestLane(next?.at));
  return { at: add(gather, j, 1.4), dead: false };
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
