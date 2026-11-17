'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ROLES, type Role } from '@/lib/auction/engine';
import {
  type Lane, type Pt, type Side, BARON_PIT, DRAGON_PIT, LANES, MINIMAP_URL, NEXUS,
  inhibPos, nexusTowerPos, towerPos,
} from '@/lib/match/map';
import type { MatchResult, PlayerKey } from '@/lib/match/sim';
import { ROLE_LABEL } from '@/components/draft/ui';
import { ALL_KEYS, buildDeaths, buildPaths, isDeadAt, positionAt } from './positions';
import { play } from '@/lib/sound';
import './match.css';

export interface ViewerSide {
  name: string;
  color: string;
  champs: Record<Role, { id: string; name: string }>;
  splitpush?: boolean;
}

const DDRAGON = '14.23.1';
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
  const flashes = result.events.filter(e => e.t <= t && t - e.t < 4 && e.type !== 'tactic' && (e.big || e.type !== 'tower'));
  const finished = t >= end;
  const nameOf = (k: PlayerKey) => sides[Number(k[0])].champs[k.slice(2) as Role].name;

  return (
    <div className="nx-match">
      <div className="nx-score">
        <TeamScore side={sides[0]} kills={score[0]} towers={count(0, 'tower')} dragons={count(0, 'dragon')} barons={count(0, 'baron')} />
        <div className="clock">{fmt(t)}</div>
        <TeamScore side={sides[1]} kills={score[1]} towers={count(1, 'tower')} dragons={count(1, 'dragon')} barons={count(1, 'baron')} right />
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
            <EpicMarker at={BARON_PIT} color="#b07cff" alive={!past.some(e => e.type === 'baron' && t - e.t < 360)} />
            <EpicMarker at={DRAGON_PIT} color="#ff9f43" alive={!past.some(e => e.type === 'dragon' && t - e.t < 300)} />
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
            {flashes.map((e, i) => (
              <circle key={i} cx={e.at.x} cy={e.at.y} r={2 + (t - e.t) * 1.6} fill="none" stroke={sides[e.side].color} strokeWidth=".5" opacity={Math.max(0, 1 - (t - e.t) / 4)} />
            ))}
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

function EpicMarker({ at, color, alive }: { at: Pt; color: string; alive: boolean }) {
  return (
    <g transform={`translate(${at.x} ${at.y})`} opacity={alive ? 1 : 0.25}>
      {alive && <circle r="3" fill={color} opacity=".18" className="epic-glow" />}
      <circle r="1.3" fill="#0b0f14" stroke={color} strokeWidth=".5" />
    </g>
  );
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
