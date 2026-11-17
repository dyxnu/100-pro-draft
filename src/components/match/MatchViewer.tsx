'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ROLES, type Role } from '@/lib/auction/engine';
import {
  type Lane, type Pt, type Side, BARON_PIT, DRAGON_PIT, LANES, MINIMAP_URL, NEXUS,
  inhibPos, nexusTowerPos, towerPos,
} from '@/lib/match/map';
import type { MatchResult, PlayerKey } from '@/lib/match/sim';
import { ROLE_LABEL } from '@/components/draft/ui';
import { ALL_KEYS, buildDeaths, buildPaths, isDeadAt, positionAt, towersLostAt } from './positions';
import { alongLane } from '@/lib/match/map';
import { play } from '@/lib/sound';
import './match.css';

export interface ViewerSide {
  name: string;
  color: string;
  champs: Record<Role, { id: string; name: string }>;
  splitpush?: boolean;
}

const DDRAGON = '16.22.1';
const icon = (id: string) => `https://ddragon.leagueoflegends.com/cdn/${DDRAGON}/img/champion/${id}.png`;
const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

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
  const pos = useRef<Record<string, Pt>>({});
  const [, force] = useState(0);
  const deaths = useMemo(() => buildDeaths(result.events), [result]);
  const end = result.duration;
  const splitA = !!sides[0].splitpush, splitB = !!sides[1].splitpush;
  // Trajeto completo de cada campeão (calculado uma vez por partida).
  const paths = useMemo(() => buildPaths(result.events, deaths, [splitA, splitB], result.duration), [result, deaths, splitA, splitB]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      let gt = tRef.current;
      if (synced) gt = Math.max(0, ((serverNow!() - syncStart!) / 1000) * syncSpeed);
      else if (playing) gt += dt * speed;
      gt = Math.min(end, gt);
      tRef.current = gt;
      for (const k of ALL_KEYS) pos.current[k] = positionAt(paths, k, gt);
      setT(gt);
      force(x => x + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, synced, syncStart, syncSpeed, result, end, paths]);

  // Sons dos lances conforme a partida avança (só os que acabaram de acontecer).
  const heard = useRef(-1);
  useEffect(() => {
    const idx = result.events.reduce((n, e, i) => (e.t <= t ? i : n), -1);
    if (heard.current < 0 || idx < heard.current || idx - heard.current > 6) { heard.current = idx; return; }
    for (let i = heard.current + 1; i <= idx; i++) {
      const e = result.events[i];
      if (e.type === 'nexus') play('victory');
      else if (e.type === 'baron' || e.type === 'dragon') play('objective');
      else if (e.type === 'tower' || e.type === 'inhibitor' || e.type === 'nexus_tower') play('tower');
      else if (e.type === 'kill' || e.type === 'gank' || e.type === 'teamfight') play('kill');
    }
    heard.current = idx;
  }, [t, result]);

  const past = result.events.filter(e => e.t <= t);
  const score = past.length ? past[past.length - 1].score : [0, 0];
  const lostTowers = (s: Side) => past.filter(e => e.type === 'tower' && e.side !== s);
  const destroyed = (s: Side, lane: Lane, tier: number) => lostTowers(s).filter(e => e.lane === lane).length > tier;
  const inhibDown = (s: Side, lane: Lane) => past.some(e => e.type === 'inhibitor' && e.side !== s && e.lane === lane);
  const nexusTowersDown = (s: Side) => past.filter(e => e.type === 'nexus_tower' && e.side !== s).length;
  const count = (s: Side, type: string) => past.filter(e => e.type === type && e.side === s).length;
  // Efeitos medidos em segundos REAIS (a partida corre dezenas de vezes mais rápido que o normal).
  const rate = synced ? syncSpeed : speed;
  const fx = (sec: number) => sec * rate; // segundos reais -> segundos de jogo
  const flashes = result.events.filter(e => e.t <= t && t - e.t < fx(1.2) && e.type !== 'tactic' && (e.big || e.type !== 'tower'));
  const marks = result.events.filter(e => e.t <= t && t - e.t < fx(2.5) && e.victims.length > 0 && e.type !== 'tactic');
  const banner = [...result.events].reverse().find(e => e.t <= t && t - e.t < fx(2.2) && e.big && e.type !== 'tactic');
  const waves = minionWaves(result.events, t);
  const winA = liveWinChance(past);
  const dragonBack = respawnLeft(past, 'dragon', 300, t), baronBack = respawnLeft(past, 'baron', 360, t);
  const finished = t >= end;
  const nameOf = (k: PlayerKey) => sides[Number(k[0])].champs[k.slice(2) as Role].name;

  return (
    <div className="nx-match">
      <div className="nx-score">
        <TeamScore side={sides[0]} kills={score[0]} towers={count(0, 'tower')} dragons={count(0, 'dragon')} barons={count(0, 'baron')} />
        <div className="clock">{fmt(t)}</div>
        <TeamScore side={sides[1]} kills={score[1]} towers={count(1, 'tower')} dragons={count(1, 'dragon')} barons={count(1, 'baron')} right />
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
            <defs>
              {ALL_KEYS.map(k => (
                <clipPath key={k} id={`${uid}-c-${k}`}><circle r="2.3" cx="0" cy="0" /></clipPath>
              ))}
            </defs>
            {/* Minimapa oficial de Summoner's Rift (Data Dragon) */}
            <image href={MINIMAP_URL} x="0" y="0" width="100" height="100" preserveAspectRatio="none" />
            <rect width="100" height="100" fill="#000" opacity=".12" />
            {/* Barão e dragão: brilham quando estão vivos no mapa */}
            <EpicMarker at={BARON_PIT} color="#b07cff" alive={baronBack == null && t >= 20 * 60} back={baronBack ?? (t < 20 * 60 ? 20 * 60 - t : null)} />
            <EpicMarker at={DRAGON_PIT} color="#ff9f43" alive={dragonBack == null && t >= 5 * 60} back={dragonBack ?? (t < 5 * 60 ? 5 * 60 - t : null)} />
            {/* Ondas de tropas andando pelas rotas */}
            {waves.map(w => (
              <g key={w.key} opacity={w.alpha}>
                {[-0.9, 0, 0.9].map(d => <circle key={d} cx={w.at.x + d * w.nx} cy={w.at.y + d * w.ny} r=".55" fill={sides[w.side].color} stroke="#0b0f14" strokeWidth=".15" />)}
              </g>
            ))}
            {([0, 1] as Side[]).map(s => (
              <g key={s}>
                {LANES.map(l => [0, 1, 2].map(tier => (
                  <Turret key={`${l}${tier}`} at={towerPos(s, l, tier)} color={sides[s].color} down={destroyed(s, l, tier)} />
                )))}
                {LANES.map(l => {
                  const p = inhibPos(s, l);
                  const down = inhibDown(s, l);
                  return <circle key={`i${l}`} cx={p.x} cy={p.y} r="1.25" fill={down ? '#2a2a2a' : '#0d1520'} stroke={down ? '#555' : sides[s].color} strokeWidth=".55" />;
                })}
                {[0, 1].map(i => <Turret key={`n${i}`} at={nexusTowerPos(s, i)} color={sides[s].color} down={nexusTowersDown(s) > i} />)}
                <rect x={NEXUS[s].x - 2.1} y={NEXUS[s].y - 2.1} width="4.2" height="4.2" transform={`rotate(45 ${NEXUS[s].x} ${NEXUS[s].y})`}
                  fill={finished && result.winner !== s ? '#2a2a2a' : sides[s].color} stroke="#0b0f14" strokeWidth=".5" />
              </g>
            ))}
            {flashes.map((e, i) => {
              const k = (t - e.t) / fx(1.2);
              return <circle key={i} cx={e.at.x} cy={e.at.y} r={2 + k * 7} fill="none" stroke={sides[e.side].color} strokeWidth=".6" opacity={Math.max(0, 1 - k)} />;
            })}
            {/* Marcas de abate no local da morte */}
            {marks.flatMap((e, i) => e.victims.map((v, j) => {
              const k = (t - e.t) / fx(2.5);
              const vs = Number(v[0]) as Side;
              return (
                <g key={`m${i}-${j}`} transform={`translate(${e.at.x + (j - (e.victims.length - 1) / 2) * 2.6} ${e.at.y - 3.4})`} opacity={Math.max(0, 1 - k * k)}>
                  <circle r="1.5" fill="#0b0f14" stroke={sides[vs].color} strokeWidth=".3" />
                  <text textAnchor="middle" dy=".55" fontSize="1.7" fill="#fff">✕</text>
                </g>
              );
            }))}
            {ALL_KEYS.map(k => {
              const p = pos.current[k];
              if (!p) return null;
              const s = Number(k[0]) as Side;
              const champ = sides[s].champs[k.slice(2) as Role];
              const dead = isDeadAt(deaths, k, t);
              return (
                <g key={k} transform={`translate(${p.x} ${p.y})`} opacity={dead ? 0 : 1} className="champ-dot">
                  <title>{`${champ.name} (${ROLE_LABEL[k.slice(2) as Role]})`}</title>
                  <circle r="2.75" fill="#0b0f14" />
                  <image href={icon(champ.id)} x="-2.3" y="-2.3" width="4.6" height="4.6" clipPath={`url(#${uid}-c-${k})`} />
                  <circle r="2.45" fill="none" stroke={sides[s].color} strokeWidth=".55" />
                </g>
              );
            })}
          </svg>
          {banner && !finished && <div key={`${banner.t}-${banner.type}`} className="nx-banner" style={{ borderColor: sides[banner.side].color }}>{bannerText(banner, sides)}</div>}
          {finished && (
            <div className="nx-result">
              <p className="small">Vitória</p>
              <h3 style={{ color: sides[result.winner].color }}>{sides[result.winner].name}</h3>
              <p>{fmt(end)} · {result.teams[result.winner].kills} a {result.teams[1 - result.winner].kills} em abates</p>
              <p className="mvp">MVP: <b>{nameOf(result.mvp)}</b></p>
            </div>
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
          <ol className="nx-feed">
            {[...past].reverse().slice(0, 12).map((e, i) => (
              <li key={`${e.t}-${i}`} className={e.big ? 'big' : ''}>
                <span className="dot" style={{ background: sides[e.side].color }} />{e.text}
              </li>
            ))}
            {!past.length && <li className="muted">A partida vai começar…</li>}
          </ol>
          {finished && <Scoreboard result={result} sides={sides} />}
        </div>
      </div>
    </div>
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
function respawnLeft(past: MatchResult['events'], type: 'dragon' | 'baron', every: number, t: number): number | null {
  const last = [...past].reverse().find(e => e.type === type);
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

function TeamScore({ side, kills, towers, dragons, barons, right }: {
  side: ViewerSide; kills: number; towers: number; dragons: number; barons: number; right?: boolean;
}) {
  return (
    <div className={`team ${right ? 'right' : ''}`}>
      <b style={{ color: side.color }}>{side.name}</b>
      <span className="kills">{kills}</span>
      <span className="objs" title="Torres · Dragões · Barões">Torres {towers} · Dragões {dragons} · Barões {barons}</span>
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
