'use client';

import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ROLES, type Role } from '@/lib/auction/engine';
import {
  type Lane, type Pt, type Side, BARON_PIT, DRAGON_PIT, LANES, MINIMAP_URL, NEXUS,
  alongLane, inhibPos, nexusTowerPos, towerPos,
} from '@/lib/match/map';
import type { MatchEvent, MatchResult, PlayerKey } from '@/lib/match/sim';
import { ROLE_LABEL } from '@/components/draft/ui';
import { ALL_KEYS, type Deaths, type Paths, buildDeaths, buildPaths, isDeadAt, positionAt, towersLostAt } from './positions';
import { VictoryEffect } from './VictoryEffect';
import type { VictoryFx } from './victory-fx';
import { play } from '@/lib/sound';
import './match.css';

export { type VictoryFx, VICTORY_FX, isVictoryFx } from './victory-fx';

export interface ViewerSide {
  name: string;
  color: string;
  champs: Record<Role, { id: string; name: string }>;
  splitpush?: boolean;
  /** Efeito da tela de vitória escolhido no perfil (`profiles.victory_fx`). Padrão: confete. */
  victoryFx?: VictoryFx | null;
}

const DDRAGON = '16.22.1';
const icon = (id: string) => `https://ddragon.leagueoflegends.com/cdn/${DDRAGON}/img/champion/${id}.png`;
const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const BARON_BUFF = 180; // segundos de jogo
const BARON_COLOR = '#b07cff';
const DRAGON_COLOR = '#ff9f43';
/** O React redesenha o mapa no máximo 20 vezes por segundo; os campeões andam a cada quadro. */
const RENDER_EVERY_MS = 50;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

/** Quantos eventos já aconteceram até t (eventos em ordem de tempo). */
function pastCount(events: MatchEvent[], t: number) {
  let lo = 0, hi = events.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (events[mid].t <= t) lo = mid + 1; else hi = mid; }
  return lo;
}

/** Momentos em que um time inteiro está morto ao mesmo tempo (ACE), com quem fez. */
function findAces(events: MatchEvent[], deaths: Record<string, Deaths[]>) {
  const out: { t: number; side: Side; at: Pt }[] = [];
  const until: [number, number] = [0, 0];
  for (const e of events) {
    for (const s of [0, 1] as Side[]) {
      if (!e.victims.some(v => Number(v[0]) === s) || e.t < until[s]) continue;
      const keys = ROLES.map(r => `${s}-${r}`);
      if (!keys.every(k => isDeadAt(deaths, k, e.t + 0.001))) continue;
      out.push({ t: e.t, side: (1 - s) as Side, at: e.at });
      until[s] = Math.min(...keys.map(k => (deaths[k] ?? []).find(d => e.t + 0.001 >= d.from && e.t + 0.001 < d.until)?.until ?? e.t));
    }
  }
  return out;
}

/**
 * Mini-mapa animado. Sem `syncStart`, o jogador controla play/pausa/velocidade.
 * Com `syncStart` (horário do servidor) todos assistem no mesmo ponto da partida.
 */
export function MatchViewer({ result, sides, syncStart, syncSpeed = 20, serverNow }: {
  result: MatchResult;
  sides: [ViewerSide, ViewerSide];
  syncStart?: number;
  syncSpeed?: number;
  serverNow?: () => number;
}) {
  const uid = useId().replace(/:/g, '');
  const synced = syncStart != null && serverNow != null;
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(20);
  const tRef = useRef(0);
  const dotRefs = useRef<Record<string, SVGGElement | null>>({});
  const reduced = usePrefersReducedMotion();
  const events = result.events;
  const deaths = useMemo(() => buildDeaths(events), [events]);
  const end = result.duration;
  const splitA = !!sides[0].splitpush, splitB = !!sides[1].splitpush;
  // Trajeto completo de cada campeão (calculado uma vez por partida).
  const paths = useMemo(() => buildPaths(events, deaths, [splitA, splitB], result.duration), [events, deaths, splitA, splitB, result.duration]);
  const aces = useMemo(() => findAces(events, deaths), [events, deaths]);
  // Identidade estável enquanto times e cores não mudam (o pai recria o array a cada render).
  const sidesKey = sides.map(s => `${s.name}|${s.color}|${ROLES.map(r => s.champs[r].id).join()}`).join('/');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableSides = useMemo(() => sides, [sidesKey]);
  const colors = useMemo(() => [stableSides[0].color, stableSides[1].color] as const, [stableSides]);

  // Campeões: posição atualizada direto no SVG a cada quadro, sem redesenhar o resto do mapa.
  const moveDots = (gt: number) => {
    for (const k of ALL_KEYS) {
      const g = dotRefs.current[k];
      if (!g) continue;
      const p = positionAt(paths, k, gt);
      g.setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);
      const op = isDeadAt(deaths, k, gt) ? '0' : '1';
      if (g.style.opacity !== op) g.style.opacity = op;
    }
  };
  useLayoutEffect(() => { moveDots(tRef.current); });

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastRender = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      let gt = tRef.current;
      if (synced) gt = Math.max(0, ((serverNow!() - syncStart!) / 1000) * syncSpeed);
      else if (playing) gt += dt * speed;
      gt = Math.min(end, gt);
      tRef.current = gt;
      moveDots(gt);
      if (now - lastRender >= RENDER_EVERY_MS || gt >= end) { lastRender = now; setT(gt); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, synced, syncStart, syncSpeed, result, end, paths]);

  // Sons dos lances conforme a partida avança (só os que acabaram de acontecer).
  const heard = useRef(-1);
  const n = pastCount(events, t);
  useEffect(() => {
    const idx = n - 1;
    if (heard.current < 0 || idx < heard.current || idx - heard.current > 6) { heard.current = idx; return; }
    for (let i = heard.current + 1; i <= idx; i++) {
      const e = events[i];
      if (e.type === 'nexus') play('victory');
      else if (e.type === 'baron' || e.type === 'dragon') play('objective');
      else if (e.type === 'tower' || e.type === 'inhibitor' || e.type === 'nexus_tower') play('tower');
      else if (e.type === 'kill' || e.type === 'gank' || e.type === 'teamfight') play('kill');
    }
    heard.current = idx;
  }, [n, events]);

  const finished = t >= end;
  // Tudo que só muda quando acontece um lance fica guardado entre os quadros.
  const board = useMemo(() => {
    const past = events.slice(0, n);
    const count = (s: Side, type: string) => past.filter(e => e.type === type && e.side === s).length;
    const lost = towersLostAt(events, past.length ? past[past.length - 1].t : -1);
    const inhib = ([0, 1] as Side[]).map(s => LANES.map(l => past.some(e => e.type === 'inhibitor' && e.side !== s && e.lane === l)));
    const nexusDown = ([0, 1] as Side[]).map(s => past.filter(e => e.type === 'nexus_tower' && e.side !== s).length);
    const lastOf = (type: string) => [...past].reverse().find(e => e.type === type);
    const baron = lastOf('baron');
    const soul = past.find(e => e.type === 'dragon' && e.text.includes('ALMA'));
    return {
      past, score: past.length ? past[past.length - 1].score : [0, 0],
      count, lost, inhib, nexusDown, winA: liveWinChance(past),
      lastDragon: lastOf('dragon'), lastBaron: baron,
      baronSide: baron ? baron.side : null, baronFrom: baron?.t ?? -Infinity,
      soulSide: soul ? soul.side : null,
    };
  }, [events, n]);
  const { past, score, count, winA } = board;
  const structures = useMemo(() => ({ lost: board.lost, inhib: board.inhib, nexusDown: board.nexusDown }), [board]);
  const baronOn: [boolean, boolean] = [board.baronSide === 0 && t < board.baronFrom + BARON_BUFF, board.baronSide === 1 && t < board.baronFrom + BARON_BUFF];
  const soulOn: [boolean, boolean] = [board.soulSide === 0, board.soulSide === 1];

  // Efeitos medidos em segundos REAIS (a partida corre dezenas de vezes mais rápido que o normal).
  const rate = synced ? syncSpeed : speed;
  const fx = (sec: number) => sec * rate; // segundos reais -> segundos de jogo
  const recent: { e: MatchEvent; i: number }[] = [];
  for (let i = n - 1; i >= 0 && t - events[i].t < fx(2.6); i--) if (events[i].type !== 'tactic') recent.push({ e: events[i], i });
  const banner = recent.find(({ e }) => t - e.t < fx(2.2) && e.big)?.e;
  const ace = [...aces].reverse().find(a => a.t <= t && t - a.t < fx(2.4));
  const waves = minionWaves(events, t);
  const dragonBack = respawnLeft(board.lastDragon, 300, t), baronBack = respawnLeft(board.lastBaron, 360, t);
  const nameOf = (k: PlayerKey) => sides[Number(k[0])].champs[k.slice(2) as Role].name;

  return (
    <div className="nx-match">
      <div className="nx-score">
        <TeamScore side={sides[0]} kills={score[0]} towers={count(0, 'tower')} dragons={count(0, 'dragon')} barons={count(0, 'baron')} buff={baronOn[0] ? 'baron' : soulOn[0] ? 'soul' : null} />
        <div className="clock">{fmt(t)}</div>
        <TeamScore side={sides[1]} kills={score[1]} towers={count(1, 'tower')} dragons={count(1, 'dragon')} barons={count(1, 'baron')} buff={baronOn[1] ? 'baron' : soulOn[1] ? 'soul' : null} right />
      </div>
      {/* Chance de vitória AO VIVO: muda com abates, torres, dragões e Barão */}
      <div className="nx-winbar" title="Chance de vitória ao vivo">
        <span style={{ width: `${winA * 100}%`, background: sides[0].color }} />
        <span style={{ width: `${(1 - winA) * 100}%`, background: sides[1].color }} />
        <b className="l">{Math.round(winA * 100)}%</b><b className="r">{Math.round((1 - winA) * 100)}%</b>
      </div>

      <div className="nx-match-body">
        <div className="nx-map-wrap">
          <svg viewBox="0 0 100 100" className="nx-map" role="img" aria-label="Mini-mapa da partida">
            <MapBase uid={uid} />
            {/* Barão e dragão: brilham quando estão vivos no mapa */}
            <EpicMarker at={BARON_PIT} color={BARON_COLOR} alive={baronBack == null && t >= 20 * 60} back={baronBack ?? (t < 20 * 60 ? 20 * 60 - t : null)} />
            <EpicMarker at={DRAGON_PIT} color={DRAGON_COLOR} alive={dragonBack == null && t >= 5 * 60} back={dragonBack ?? (t < 5 * 60 ? 5 * 60 - t : null)} />
            {/* Ondas de tropas andando pelas rotas */}
            {waves.map(w => (
              <g key={w.key} opacity={w.alpha}>
                {[-0.9, 0, 0.9].map(d => <circle key={d} cx={w.at.x + d * w.nx} cy={w.at.y + d * w.ny} r=".55" fill={colors[w.side]} stroke="#0b0f14" strokeWidth=".15" />)}
              </g>
            ))}
            <Structures colors={colors} state={structures} finished={finished} winner={result.winner} soul={soulOn[0] ? 0 : soulOn[1] ? 1 : null} />
            {/* Efeitos dos lances: habilidades nas lutas, explosões de torre, objetivos, marcas de abate */}
            {!reduced && recent.map(({ e, i }) => <EventFx key={i} uid={uid} e={e} colors={colors} paths={paths} />)}
            {reduced && recent.filter(({ e }) => e.victims.length).map(({ e, i }) => <KillMarks key={i} e={e} colors={colors} />)}
            <ChampLayer uid={uid} sides={stableSides} dotRefs={dotRefs} baron={baronOn} soul={soulOn} />
          </svg>
          {banner && !finished && !ace && <div key={`${banner.t}-${banner.type}`} className="nx-banner" style={{ borderColor: sides[banner.side].color }}>{bannerText(banner, sides)}</div>}
          {ace && !finished && (
            <div key={`ace-${ace.t}`} className="nx-ace" style={{ color: sides[ace.side].color }} aria-live="polite">
              <b>ACE</b><span>{sides[ace.side].name} derruba o time inteiro!</span>
            </div>
          )}
          {finished && (
            <>
              <VictoryEffect kind={sides[result.winner].victoryFx ?? 'victory:confete'} color={sides[result.winner].color} />
              <div className="nx-result">
                <p className="small">Vitória</p>
                <h3 style={{ color: sides[result.winner].color }}>{sides[result.winner].name}</h3>
                <p>{fmt(end)} · {result.teams[result.winner].kills} a {result.teams[1 - result.winner].kills} em abates</p>
                <p className="mvp">MVP: <b>{nameOf(result.mvp)}</b></p>
              </div>
            </>
          )}
        </div>

        <div className="nx-side">
          {!synced && (
            <div className="nx-controls">
              <button className="btn-secondary" onClick={() => setPlaying(p => !p)} disabled={finished}>{playing ? 'Pausar' : 'Continuar'}</button>
              {[10, 20, 40].map(v => (
                <button key={v} className={`spd ${speed === v ? 'on' : ''}`} onClick={() => setSpeed(v)}>{v}x</button>
              ))}
              <button className="spd" onClick={() => { tRef.current = end; }}>Fim</button>
            </div>
          )}
          <Feed past={past} colors={colors} />
          {finished && <Scoreboard result={result} sides={sides} />}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Camadas que quase nunca mudam (memo: só redesenham quando as props mudam)
// ---------------------------------------------------------------------------
const MapBase = memo(function MapBase({ uid }: { uid: string }) {
  return (
    <>
      <defs>
        {ALL_KEYS.map(k => (
          <clipPath key={k} id={`${uid}-c-${k}`}><circle r="2.3" cx="0" cy="0" /></clipPath>
        ))}
        <radialGradient id={`${uid}-boom`}>
          <stop offset="0" stopColor="#fff6d0" />
          <stop offset=".35" stopColor="#ffb340" />
          <stop offset=".7" stopColor="#ff5a1f" stopOpacity=".55" />
          <stop offset="1" stopColor="#ff5a1f" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Minimapa oficial de Summoner's Rift (Data Dragon) */}
      <image href={MINIMAP_URL} x="0" y="0" width="100" height="100" preserveAspectRatio="none" />
      <rect width="100" height="100" fill="#000" opacity=".12" />
    </>
  );
});

const Structures = memo(function Structures({ colors, state, finished, winner, soul }: {
  colors: readonly [string, string];
  state: { lost: Record<Side, Record<Lane, number>>; inhib: boolean[][]; nexusDown: number[] };
  finished: boolean; winner: Side; soul: Side | null;
}) {
  return (
    <>
      {([0, 1] as Side[]).map(s => (
        <g key={s}>
          {LANES.map(l => [0, 1, 2].map(tier => (
            <Turret key={`${l}${tier}`} at={towerPos(s, l, tier)} color={colors[s]} down={state.lost[s][l] > tier} />
          )))}
          {LANES.map((l, li) => {
            const p = inhibPos(s, l);
            const down = state.inhib[s][li];
            return <circle key={`i${l}`} cx={p.x} cy={p.y} r="1.25" fill={down ? '#2a2a2a' : '#0d1520'} stroke={down ? '#555' : colors[s]} strokeWidth=".55" />;
          })}
          {[0, 1].map(i => <Turret key={`n${i}`} at={nexusTowerPos(s, i)} color={colors[s]} down={state.nexusDown[s] > i} />)}
          {soul === s && <circle cx={NEXUS[s].x} cy={NEXUS[s].y} r="4.6" fill={DRAGON_COLOR} className="fx-soul-nexus" />}
          <rect x={NEXUS[s].x - 2.1} y={NEXUS[s].y - 2.1} width="4.2" height="4.2" transform={`rotate(45 ${NEXUS[s].x} ${NEXUS[s].y})`}
            fill={finished && winner !== s ? '#2a2a2a' : colors[s]} stroke="#0b0f14" strokeWidth=".5" />
        </g>
      ))}
    </>
  );
});

/** Ícones dos campeões. A posição é escrita direto no SVG pelo laço de animação (ver `moveDots`). */
const ChampLayer = memo(function ChampLayer({ uid, sides, dotRefs, baron, soul }: {
  uid: string; sides: [ViewerSide, ViewerSide]; dotRefs: React.RefObject<Record<string, SVGGElement | null>>;
  baron: [boolean, boolean]; soul: [boolean, boolean];
}) {
  return (
    <>
      {ALL_KEYS.map(k => {
        const s = Number(k[0]) as Side;
        const champ = sides[s].champs[k.slice(2) as Role];
        return (
          <g key={k} ref={el => { dotRefs.current[k] = el; }} className="champ-dot">
            <title>{`${champ.name} (${ROLE_LABEL[k.slice(2) as Role]})`}</title>
            {/* Aura do Barão (3 min de jogo) e brilho da Alma do Dragão */}
            {soul[s] && <circle r="3.5" fill="none" stroke={DRAGON_COLOR} strokeWidth=".5" className="fx-soul" />}
            {baron[s] && <circle r="3.9" fill={BARON_COLOR} className="fx-baron" />}
            <circle r="2.75" fill="#0b0f14" />
            <image href={icon(champ.id)} x="-2.3" y="-2.3" width="4.6" height="4.6" clipPath={`url(#${uid}-c-${k})`} />
            <circle r="2.45" fill="none" stroke={baron[s] ? BARON_COLOR : sides[s].color} strokeWidth=".55" />
          </g>
        );
      })}
    </>
  );
}, (a, b) => a.uid === b.uid && a.sides === b.sides && a.baron[0] === b.baron[0] && a.baron[1] === b.baron[1]
  && a.soul[0] === b.soul[0] && a.soul[1] === b.soul[1]);

const Feed = memo(function Feed({ past, colors }: { past: MatchEvent[]; colors: readonly [string, string] }) {
  return (
    <ol className="nx-feed">
      {[...past].reverse().slice(0, 12).map((e, i) => (
        <li key={`${e.t}-${past.length - i}`} className={e.big ? 'big' : ''}>
          <span className="dot" style={{ background: colors[e.side] }} />{e.text}
        </li>
      ))}
      {!past.length && <li className="muted">A partida vai começar…</li>}
    </ol>
  );
});

// ---------------------------------------------------------------------------
// Efeitos especiais (CSS: duram segundos reais, independentes da velocidade da partida)
// ---------------------------------------------------------------------------
const SPARKS = [0, 45, 90, 135, 180, 225, 270, 315];

/** Efeito de um lance. Montado quando o lance acontece; a animação CSS cuida do resto. */
const EventFx = memo(function EventFx({ uid, e, colors, paths }: { uid: string; e: MatchEvent; colors: readonly [string, string]; paths: Paths }) {
  const c = colors[e.side];
  // Onde cada participante estava na hora: habilidades saem de lá.
  const casters = useMemo(() => {
    if (e.type !== 'teamfight' && e.type !== 'gank' && e.type !== 'kill') return [];
    const ks = [...e.actors, ...e.victims].slice(0, 10);
    return ks.map((k, i) => ({ k, at: positionAt(paths, k, e.t - 0.5), side: Number(k[0]) as Side, delay: (i % 5) * 0.09 + (e.type === 'teamfight' ? 0.05 : 0) }));
  }, [e, paths]);
  const tower = e.type === 'tower' || e.type === 'inhibitor' || e.type === 'nexus_tower' || e.type === 'nexus';
  const epic = e.type === 'baron' || e.type === 'dragon';
  return (
    <g className="fx">
      {casters.map(({ k, at, side, delay }) => (
        <g key={k} transform={`translate(${at.x} ${at.y})`}>
          <circle r="2.2" fill="none" stroke={colors[side]} strokeWidth=".7" className="fx-ult" style={{ animationDelay: `${delay}s` }} />
          {e.type === 'teamfight' && (
            <g className="fx-rays" style={{ animationDelay: `${delay + 0.05}s` }}>
              {SPARKS.filter((_, i) => i % 2 === (side === e.side ? 0 : 1)).map(a => (
                <line key={a} x1="0" y1="-2.4" x2="0" y2="-4.4" stroke={colors[side]} strokeWidth=".45" strokeLinecap="round" transform={`rotate(${a})`} />
              ))}
            </g>
          )}
        </g>
      ))}
      <g transform={`translate(${e.at.x} ${e.at.y})`}>
        {tower ? (
          <>
            <circle r={e.type === 'nexus' ? 7 : 4.2} fill={`url(#${uid}-boom)`} className="fx-boom" />
            <circle r="2.6" fill="none" stroke="#ffcf73" strokeWidth=".6" className="fx-wave" />
            <g className="fx-debris">
              {SPARKS.map(a => <line key={a} x1="0" y1="-1.4" x2="0" y2="-3.6" stroke="#ffb340" strokeWidth=".5" strokeLinecap="round" transform={`rotate(${a + 22})`} />)}
            </g>
            <circle r="3" fill="#6b6b6b" opacity=".35" className="fx-smoke" />
          </>
        ) : (
          <>
            <circle r="2" fill="none" stroke={epic ? (e.type === 'baron' ? BARON_COLOR : DRAGON_COLOR) : c} strokeWidth=".6" className="fx-wave" />
            {(e.big || epic) && <circle r="2" fill="none" stroke={c} strokeWidth=".4" className="fx-wave" style={{ animationDelay: '.18s' }} />}
            {epic && <circle r="3.4" fill={e.type === 'baron' ? BARON_COLOR : DRAGON_COLOR} className="fx-flash" />}
          </>
        )}
      </g>
      {e.victims.length > 0 && <KillMarks e={e} colors={colors} />}
    </g>
  );
});

/** Marcas de abate no local da morte. */
function KillMarks({ e, colors }: { e: MatchEvent; colors: readonly [string, string] }) {
  return (
    <>
      {e.victims.map((v, j) => (
        <g key={v} transform={`translate(${e.at.x + (j - (e.victims.length - 1) / 2) * 2.6} ${e.at.y - 3.4})`}>
          <g className="fx-mark">
            <circle r="1.5" fill="#0b0f14" stroke={colors[Number(v[0])]} strokeWidth=".3" />
            <text textAnchor="middle" dy=".55" fontSize="1.7" fill="#fff">✕</text>
          </g>
        </g>
      ))}
    </>
  );
}

/** Ícone de torre do minimapa (escudo com a cor do time; cinza quando destruída). */
function Turret({ at, color, down }: { at: Pt; color: string; down: boolean }) {
  return (
    <g transform={`translate(${at.x} ${at.y})`}>
      <path d="M-1 -1.25 H1 V0.35 L0 1.35 L-1 0.35 Z" fill={down ? '#2a2a2a' : color} stroke="#0b0f14" strokeWidth=".35" opacity={down ? 0.7 : 1} />
    </g>
  );
}

function EpicMarker({ at, color, alive, back }: { at: Pt; color: string; alive: boolean; back: number | null }) {
  return (
    <g transform={`translate(${at.x} ${at.y})`}>
      {alive && <circle r="3" fill={color} opacity=".18" className="epic-glow" />}
      <circle r="1.3" fill="#0b0f14" stroke={color} strokeWidth=".5" opacity={alive ? 1 : 0.45} />
      {!alive && back != null && back > 0 && (
        <text y="-2.2" textAnchor="middle" fontSize="2" fontWeight="800" fill="#fff" stroke="#0b0f14" strokeWidth=".35" paintOrder="stroke">{fmt(back)}</text>
      )}
    </g>
  );
}

/** Tropas: uma onda por rota e lado a cada 30 s (a partir de 1:05), andando até a frente da rota. */
function minionWaves(events: MatchResult['events'], t: number) {
  const out: { key: string; side: Side; at: Pt; nx: number; ny: number; alpha: number }[] = [];
  if (t < 65) return out;
  const lost = towersLostAt(events, t);
  const SPEED = 0.022; // fração da rota por segundo de jogo
  const last = Math.floor((t - 65) / 30);
  for (const lane of LANES) {
    const front = Math.max(0.12, Math.min(0.88, 0.5 + (lost[1][lane] - lost[0][lane]) * 0.11));
    for (const side of [0, 1] as Side[]) {
      for (let k = last; k >= 0 && k >= last - 2; k--) {
        const age = t - (65 + k * 30);
        const start = side === 0 ? 0.1 : 0.9, dir = side === 0 ? 1 : -1;
        let f = start + dir * SPEED * age;
        const reached = side === 0 ? f >= front : f <= front;
        if (reached) f = front + (side === 0 ? -0.015 : 0.015);
        const travel = Math.abs(front - start) / SPEED;
        const alpha = reached ? Math.max(0, 1 - (age - travel) / 14) : 1;
        if (alpha <= 0) continue;
        const p = alongLane(lane, f), q = alongLane(lane, f + 0.01);
        const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
        // perpendicular à rota, para as 3 tropas ficarem lado a lado
        out.push({ key: `${lane}${side}${k}`, side, at: p, nx: -(q.y - p.y) / len, ny: (q.x - p.x) / len, alpha });
      }
    }
  }
  return out;
}

/** Chance de vitória ao vivo do lado azul (0–1), pelo que aconteceu na partida até agora. */
function liveWinChance(past: MatchResult['events']): number {
  let x = 0;
  for (const e of past) {
    const sg = e.side === 0 ? 1 : -1;
    if (e.type === 'kill' || e.type === 'gank') x += 0.12 * sg * Math.max(1, e.victims.length);
    else if (e.type === 'teamfight') x += 0.12 * sg * e.victims.length + 0.15 * sg;
    else if (e.type === 'tower') x += 0.3 * sg;
    else if (e.type === 'dragon') x += 0.22 * sg;
    else if (e.type === 'baron') x += 0.7 * sg;
    else if (e.type === 'inhibitor') x += 0.6 * sg;
    else if (e.type === 'nexus_tower') x += 0.8 * sg;
    else if (e.type === 'nexus') x += 50 * sg;
  }
  return 1 / (1 + Math.exp(-x));
}

/** Segundos até o objetivo voltar (null se está vivo). */
function respawnLeft(last: MatchEvent | undefined, every: number, t: number): number | null {
  if (!last) return null;
  const left = last.t + every - t;
  return left > 0 ? left : null;
}

function bannerText(e: MatchResult['events'][number], sides: [ViewerSide, ViewerSide]) {
  const team = sides[e.side].name;
  if (e.type === 'baron') return `${team} pega o BARÃO`;
  if (e.type === 'dragon') return e.text.includes('ALMA') ? `${team} conquista a ALMA DO DRAGÃO` : `${team} pega o Dragão`;
  if (e.type === 'inhibitor') return `${team} derruba um inibidor`;
  if (e.type === 'nexus') return `VITÓRIA de ${team}!`;
  if (e.type === 'teamfight') return `Team fight: vitória de ${team}`;
  if (e.text.includes('FIRST BLOOD')) return 'FIRST BLOOD!';
  return e.text.replace(/^\d+:\d{2} · /, '');
}

function TeamScore({ side, kills, towers, dragons, barons, right, buff }: {
  side: ViewerSide; kills: number; towers: number; dragons: number; barons: number; right?: boolean; buff?: 'baron' | 'soul' | null;
}) {
  return (
    <div className={`team ${right ? 'right' : ''}`}>
      <b style={{ color: side.color }}>{side.name}</b>
      <span className="kills">{kills}</span>
      <span className="objs" title="Torres · Dragões · Barões">Torres {towers} · Dragões {dragons} · Barões {barons}</span>
      {buff === 'baron' && <span className="nx-buff baron" title="Bônus do Barão ativo">Barão</span>}
      {buff === 'soul' && <span className="nx-buff soul" title="Alma do Dragão">Alma</span>}
    </div>
  );
}

function Scoreboard({ result, sides }: { result: MatchResult; sides: [ViewerSide, ViewerSide] }) {
  return (
    <div className="nx-board">
      {([0, 1] as Side[]).map(s => (
        <table key={s}>
          <thead><tr><th style={{ color: sides[s].color }}>{sides[s].name}</th><th>K</th><th>D</th><th>A</th></tr></thead>
          <tbody>
            {ROLES.map(r => {
              const k = `${s}-${r}` as PlayerKey;
              const p = result.players[k];
              return (
                <tr key={r} className={result.mvp === k ? 'mvp' : ''}>
                  <td>{sides[s].champs[r].name}{result.mvp === k ? ' ★' : ''}</td><td>{p.kills}</td><td>{p.deaths}</td><td>{p.assists}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ))}
    </div>
  );
}
