// Recompensas de um campeonato: PDL (ranqueada), essência azul, XP, maestria e honra.
// Puro e testável; quem grava no banco é progress/service.ts.

export interface PlayerOutcome {
  placement: number;      // 1 = campeão, 2 = vice, 3 = semifinal, ...
  players: number;        // participantes do campeonato (inclui bots)
  matchesWon: number;
  matchesPlayed: number;
  ranked: boolean;
  vip: boolean;
}

export interface Rewards { lp: number; be: number; xp: number; masteryPerChamp: number; honor: number }

/** PDL: vitória em confronto +12, derrota -10, campeão +20 extra; ajustado ao tamanho do campeonato. */
export function lpFor(o: PlayerOutcome): number {
  if (!o.ranked) return 0;
  const losses = o.matchesPlayed - o.matchesWon;
  let lp = o.matchesWon * 12 - losses * 10;
  if (o.placement === 1) lp += 20;
  else if (o.placement === 2) lp += 6;
  const size = Math.max(0.6, Math.min(1.2, o.players / 5)); // salas maiores valem um pouco mais
  return Math.round(lp * size);
}

/** Essência azul: o campeão leva a maior parte; todo mundo ganha algo por jogar. */
export function beFor(o: PlayerOutcome): number {
  const base = o.placement === 1 ? 400 : o.placement === 2 ? 200 : o.placement <= 4 ? 120 : 60;
  const perWin = 40 * o.matchesWon;
  const ranked = o.ranked ? 1.25 : 1;
  const vip = o.vip ? 1.25 : 1; // VIP ganha 25% a mais (cosmético; não dá vantagem em partida)
  return Math.round((base + perWin) * ranked * vip);
}

export function xpFor(o: PlayerOutcome): number {
  return 120 + o.matchesWon * 60 + (o.placement === 1 ? 150 : 0);
}

/** Pontos de maestria por campeão do time: cresce com vitórias (pedido: "a cada vitória com ele"). */
export function masteryFor(o: PlayerOutcome): number {
  return o.matchesWon * 120 + (o.placement === 1 ? 300 : 0);
}

export function rewardsFor(o: PlayerOutcome): Rewards {
  return { lp: lpFor(o), be: beFor(o), xp: xpFor(o), masteryPerChamp: masteryFor(o), honor: 10 };
}

// ---------------------------------------------------------------------------
// Nível da conta (XP cresce um pouco a cada nível)
export const xpToNext = (level: number) => 400 + (level - 1) * 60;

export function addXp(level: number, xp: number, gain: number): { level: number; xp: number; levelsUp: number } {
  let l = level, x = xp + gain, up = 0;
  while (x >= xpToNext(l)) { x -= xpToNext(l); l++; up++; }
  return { level: l, xp: x, levelsUp: up };
}
/** Essência azul de bônus a cada nível novo. */
export const BE_PER_LEVEL = 150;

// ---------------------------------------------------------------------------
// Maestria (níveis como no LoL)
export const MASTERY_LEVELS = [0, 1800, 6000, 12600, 21600, 32400, 45000]; // pontos para nível 1..7
export function masteryLevel(points: number): number {
  let lvl = 0;
  for (let i = 0; i < MASTERY_LEVELS.length; i++) if (points >= MASTERY_LEVELS[i]) lvl = i + 1;
  return Math.min(lvl, 7);
}

// ---------------------------------------------------------------------------
// Honra: progresso por partida completa e por elogio recebido (100 = sobe 1 nível, máx. 5)
export const HONOR_PER_GAME = 10;
export const HONOR_PER_KUDOS = 5;
export function addHonor(level: number, progress: number, gain: number): { level: number; progress: number } {
  let l = level, p = progress + gain;
  while (p >= 100 && l < 5) { p -= 100; l++; }
  if (l >= 5) p = Math.min(p, 100);
  return { level: l, progress: p };
}

// ---------------------------------------------------------------------------
// Economia
export const NAME_CHANGE_PRICE = 14_900;
export const BETA_BONUS_BE = 2_000;
export const VIP_DAYS_PER_REFERRAL = 3;
