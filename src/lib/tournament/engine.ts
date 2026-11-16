// 100 PRO DRAFT: campeonato mata-mata depois do leilão (puro e serializável, como o leilão).
// Fluxo: escalação (todos confirmam "Pronto" ou o tempo acaba) → rodada com partidas
// simultâneas (táticas ao vivo) → próxima escalação → ... → campeão.
import { ROLES, type AuctionState, type Champion, type Role, nextRandom } from '@/lib/auction/engine';
import { buildCard, type ChampionCard } from '@/lib/champions/cards';
import { DEFAULT_STRATEGY, type Strategy, styleFit, teamProfile } from '@/lib/match/model';
import { type MatchResult, type MatchTeam, type TacticChange, simulateMatch } from '@/lib/match/sim';

export interface TeamEntry {
  playerId: string;
  name: string;
  isBot: boolean;
  lineup: Record<Role, string>; // rota → campeão
  strategy: Strategy;
  ready: boolean;
  eliminated: boolean;
  seed: number;
  rating: number;
}

export interface TMatch {
  id: string;
  round: number;
  a: string | null;
  b: string | null;
  seed: number;
  startedAt: number | null;
  endsAt: number | null;
  duration: number | null; // segundos de jogo
  changes: TacticChange[];
  winner: string | null;
  score: [number, number] | null;
}

export interface TournamentConfig {
  lineupMs: number;      // tempo para escalar antes de cada rodada
  speed: number;         // segundos de jogo por segundo real
  kickoffMs: number;     // contagem antes da bola rolar
  resultPauseMs: number; // pausa para ver o resultado
  maxChangesPerMatch: number;
}

export const DEFAULT_TOURNAMENT_CONFIG: TournamentConfig = {
  lineupMs: 45_000, speed: 30, kickoffMs: 3_000, resultPauseMs: 8_000, maxChangesPerMatch: 6,
};

export interface TournamentState {
  config: TournamentConfig;
  stage: 'lineup' | 'playing' | 'done';
  round: number;
  totalRounds: number;
  teams: Record<string, TeamEntry>;
  matches: TMatch[];
  lineupDeadline: number;
  champion: string | null;
  rngState: number;
  version: number;
}

type Result = { ok: true } | { ok: false; reason: string };
type Champs = Record<string, Champion>;

// ---------------------------------------------------------------------------
// Cartas e força dos times
// ---------------------------------------------------------------------------
export function teamCards(team: TeamEntry, champs: Champs): Record<Role, ChampionCard> {
  return Object.fromEntries(ROLES.map(r => [r, buildCard(team.lineup[r], champs[team.lineup[r]].routes)])) as Record<Role, ChampionCard>;
}

export function teamRating(team: TeamEntry, champs: Champs): number {
  const cards = teamCards(team, champs);
  return Math.round((ROLES.reduce((s, r) => s + cards[r].ovr[r], 0) / ROLES.length) * 10) / 10;
}

export function matchTeam(team: TeamEntry, champs: Champs): MatchTeam {
  return { name: team.name, cards: teamCards(team, champs), strategy: team.strategy };
}

/** Estratégia que mais combina com a composição (usada pelos bots). */
export function bestStrategy(cards: Record<Role, ChampionCard>): Strategy {
  const prof = teamProfile(cards);
  const estilo = (['teamfight', 'pickoff', 'splitpush', 'equilibrado'] as const)
    .reduce((x, y) => (styleFit(prof, { ...DEFAULT_STRATEGY, estilo: y }) > styleFit(prof, { ...DEFAULT_STRATEGY, estilo: x }) ? y : x));
  const early = prof.curve.early > prof.curve.late;
  return {
    agressividade: early ? 'agressiva' : 'equilibrada',
    prioridade: prof.curve.late > 7 ? 'dragoes' : 'torres',
    estilo,
    risco: 'normal',
  };
}

export function matchResult(t: TournamentState, m: TMatch, champs: Champs): MatchResult | null {
  if (!m.a || !m.b) return null;
  const A = t.teams[m.a], B = t.teams[m.b];
  return simulateMatch(matchTeam(A, champs), matchTeam(B, champs), m.seed, {
    changes: m.changes, adaptive: [A.isBot, B.isBot],
  });
}

// ---------------------------------------------------------------------------
// Criação e chaveamento
// ---------------------------------------------------------------------------
/** Ordem clássica de cabeças de chave: 1x8, 4x5, 2x7, 3x6... */
function bracketOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap(s => [s, n + 1 - s]);
  }
  return order;
}

export function createTournament(auction: AuctionState, now: number, config: Partial<TournamentConfig> = {}): TournamentState {
  const cfg = { ...DEFAULT_TOURNAMENT_CONFIG, ...config };
  const champs = auction.champions;
  const teams: Record<string, TeamEntry> = {};
  for (const p of auction.players) {
    const lineup = Object.fromEntries(ROLES.map(r => [r, p.roster[r]!.champId])) as Record<Role, string>;
    const entry: TeamEntry = {
      playerId: p.id, name: p.name, isBot: p.isBot, lineup, strategy: { ...DEFAULT_STRATEGY },
      ready: p.isBot, eliminated: false, seed: 0, rating: 0,
    };
    entry.rating = teamRating(entry, champs);
    if (p.isBot) entry.strategy = bestStrategy(teamCards(entry, champs));
    teams[p.id] = entry;
  }
  const t: TournamentState = {
    config: cfg, stage: 'lineup', round: 1, totalRounds: 0, teams, matches: [],
    lineupDeadline: now + cfg.lineupMs, champion: null, rngState: auction.rngState ^ 0x5bd1e995, version: 0,
  };

  // Cabeças de chave pela força do time montado no leilão (quem gastou melhor ganha folga).
  const ranked = Object.values(teams).sort((x, y) => y.rating - x.rating || x.playerId.localeCompare(y.playerId));
  ranked.forEach((e, i) => { e.seed = i + 1; });
  const size = 2 ** Math.ceil(Math.log2(Math.max(2, ranked.length)));
  t.totalRounds = Math.log2(size);
  const bySeed = (s: number) => ranked[s - 1]?.playerId ?? null;
  const order = bracketOrder(size);
  for (let i = 0; i < size; i += 2) {
    t.matches.push(newMatch(t, 1, bySeed(order[i]), bySeed(order[i + 1])));
  }
  return t;
}

function newMatch(t: TournamentState, round: number, a: string | null, b: string | null): TMatch {
  return {
    id: `r${round}m${t.matches.filter(m => m.round === round).length + 1}`,
    round, a, b, seed: Math.floor(nextRandom(t) * 2 ** 31),
    startedAt: null, endsAt: null, duration: null, changes: [], winner: null, score: null,
  };
}

export const roundMatches = (t: TournamentState, round = t.round) => t.matches.filter(m => m.round === round);
export const playingMatchOf = (t: TournamentState, playerId: string) =>
  roundMatches(t).find(m => m.a === playerId || m.b === playerId) ?? null;

// ---------------------------------------------------------------------------
// Ações dos jogadores
// ---------------------------------------------------------------------------
function activeTeam(t: TournamentState, playerId: string): TeamEntry | null {
  const team = t.teams[playerId];
  return team && !team.eliminated && t.stage !== 'done' ? team : null;
}

export function swapLineup(t: TournamentState, playerId: string, r1: Role, r2: Role): Result {
  const team = activeTeam(t, playerId);
  if (!team) return { ok: false, reason: 'Seu time não está mais no campeonato.' };
  if (t.stage !== 'lineup') return { ok: false, reason: 'Só dá para mexer na escalação antes da rodada.' };
  [team.lineup[r1], team.lineup[r2]] = [team.lineup[r2], team.lineup[r1]];
  team.ready = false; // mexer no time cancela a confirmação
  t.version++;
  return { ok: true };
}

export function setReady(t: TournamentState, playerId: string, ready: boolean): Result {
  const team = activeTeam(t, playerId);
  if (!team || t.stage !== 'lineup') return { ok: false, reason: 'Não há escalação aberta.' };
  team.ready = ready;
  t.version++;
  return { ok: true };
}

/** Na escalação, muda a estratégia inicial; durante a partida, muda a tática ao vivo. */
export function changeStrategy(t: TournamentState, playerId: string, strategy: Strategy, now: number, champs: Champs): Result {
  const team = activeTeam(t, playerId);
  if (!team) return { ok: false, reason: 'Seu time não está mais no campeonato.' };
  if (t.stage === 'lineup') {
    team.strategy = { ...strategy };
    t.version++;
    return { ok: true };
  }
  const m = playingMatchOf(t, playerId);
  if (!m || !m.startedAt || m.winner || !m.a || !m.b) return { ok: false, reason: 'Sua partida não está em andamento.' };
  if (m.changes.filter(c => c.side === (m.a === playerId ? 0 : 1)).length >= t.config.maxChangesPerMatch)
    return { ok: false, reason: 'Limite de mudanças de tática nesta partida.' };
  const gameT = Math.max(0, ((now - m.startedAt) / 1000) * t.config.speed);
  if (m.duration != null && gameT >= m.duration) return { ok: false, reason: 'A partida já acabou.' };
  // Vale a partir do próximo bloco de 30 s de jogo: nada do que já foi mostrado muda.
  const at = Math.ceil((gameT + 1) / 30) * 30 + 30;
  m.changes.push({ t: at, side: m.a === playerId ? 0 : 1, strategy: { ...strategy } });
  team.strategy = { ...strategy };
  refreshMatch(t, m, champs);
  t.version++;
  return { ok: true };
}

function refreshMatch(t: TournamentState, m: TMatch, champs: Champs) {
  const r = matchResult(t, m, champs);
  if (!r || m.startedAt == null) return;
  m.duration = r.duration;
  m.endsAt = m.startedAt + (r.duration / t.config.speed) * 1000 + t.config.resultPauseMs;
}

// ---------------------------------------------------------------------------
// Relógio
// ---------------------------------------------------------------------------
export function tickTournament(t: TournamentState, now: number, champs: Champs): void {
  if (t.stage === 'done') return;
  if (t.stage === 'lineup') {
    const playing = roundMatches(t).flatMap(m => (m.a && m.b ? [m.a, m.b] : []));
    const allReady = playing.every(id => t.teams[id].ready);
    if (allReady || now >= t.lineupDeadline) startRound(t, now, champs);
    return;
  }
  // playing
  for (const m of roundMatches(t)) {
    if (m.winner) continue;
    if (!m.a || !m.b) { m.winner = m.a ?? m.b; continue; }
    if (m.endsAt != null && now >= m.endsAt) {
      const r = matchResult(t, m, champs)!;
      m.winner = r.winner === 0 ? m.a : m.b;
      m.score = [r.teams[0].kills, r.teams[1].kills];
      t.teams[r.winner === 0 ? m.b : m.a].eliminated = true;
      t.version++;
    }
  }
  if (roundMatches(t).every(m => m.winner)) finishRound(t, now);
}

function startRound(t: TournamentState, now: number, champs: Champs) {
  t.stage = 'playing';
  for (const m of roundMatches(t)) {
    if (!m.a || !m.b) { m.winner = m.a ?? m.b; continue; }
    m.startedAt = now + t.config.kickoffMs;
    refreshMatch(t, m, champs);
  }
  t.version++;
}

function finishRound(t: TournamentState, now: number) {
  const winners = roundMatches(t).map(m => m.winner!).filter(Boolean);
  if (t.round >= t.totalRounds || winners.length <= 1) {
    t.stage = 'done';
    t.champion = winners[0] ?? null;
    t.version++;
    return;
  }
  t.round++;
  for (let i = 0; i < winners.length; i += 2) t.matches.push(newMatch(t, t.round, winners[i], winners[i + 1] ?? null));
  for (const team of Object.values(t.teams)) team.ready = team.isBot;
  t.stage = 'lineup';
  t.lineupDeadline = now + t.config.lineupMs;
  t.version++;
}

export function tournamentDeadline(t: TournamentState): number | null {
  if (t.stage === 'done') return null;
  if (t.stage === 'lineup') return t.lineupDeadline;
  const pending = roundMatches(t).filter(m => !m.winner);
  if (pending.some(m => !m.a || !m.b)) return 0;
  const ends = pending.map(m => m.endsAt).filter((x): x is number => x != null);
  return ends.length ? Math.min(...ends) : null;
}
