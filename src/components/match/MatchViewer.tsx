'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ROLES, type Role } from '@/lib/auction/engine';
import {
  type Lane, type Pt, type Side, BARON_PIT, DRAGON_PIT, LANES, LANE_PATH, NEXUS,
  inhibPos, nexusTowerPos, towerPos,
} from '@/lib/match/map';
import type { MatchResult, PlayerKey } from '@/lib/match/sim';
import { ROLE_LABEL } from '@/components/draft/ui';
import { ALL_KEYS, buildDeaths, isDeadAt, targetPosition } from './positions';
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
const MOVE_SPEED = 0.55; // unidades do mapa por segundo de jogo

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
  const splitTop: [boolean, boolean] = [!!sides[0].splitpush, !!sides[1].splitpush];

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
      const step = Math.max(gt - tRef.current, 0);
      tRef.current = gt;
      for (const k of ALL_KEYS) {
        const target = targetPosition(k, gt, result.events, deaths, splitTop).at;
        const cur = pos.current[k];
        if (!cur || step > 30 || isDeadAt(deaths, k, gt)) { pos.current[k] = target; continue; }
        const dx = target.x - cur.x, dy = target.y - cur.y;
        const dist = Math.hypot(dx, dy);
        const max = MOVE_SPEED * Math.max(step, dt * 4) + 0.02;
        pos.current[k] = dist <= max ? target : { x: cur.x + (dx / dist) * max, y: cur.y + (dy / dist) * max };
      }
      setT(gt);
      force(x => x + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, synced, syncStart, syncSpeed, result, end]);

  const past = result.events.filter(e => e.t <= t);
  const score = past.length ? past[past.length - 1].score : [0, 0];
  const lostTowers = (s: Side) => past.filter(e => e.type === 'tower' && e.side !== s);
  const destroyed = (s: Side, lane: Lane, tier: number) => lostTowers(s).filter(e => e.lane === lane).length > tier;
  const inhibDown = (s: Side, lane: Lane) => past.some(e => e.type === 'inhibitor' && e.side !== s && e.lane === lane);
  const nexusTowersDown = (s: Side) => past.filter(e => e.type === 'nexus_tower' && e.side !== s).length;
  const count = (s: Side, type: string) => past.filter(e => e.type === type && e.side === s).length;
  const flashes = result.events.filter(e => e.t <= t && t - e.t < 4 && (e.big || e.type !== 'tower'));
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
            <rect width="100" height="100" fill="#0b1510" />
            <path d="M0 100 L0 70 Q20 80 30 100 Z" fill={sides[0].color} opacity=".12" />
            <path d="M100 0 L100 30 Q80 20 70 0 Z" fill={sides[1].color} opacity=".12" />
            <path d="M4 4 L96 96" stroke="#16384d" strokeWidth="7" strokeLinecap="round" opacity=".8" />
            {LANES.map(l => (
              <polyline key={l} points={LANE_PATH[l].map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#2c3b2f" strokeWidth="3.4" strokeLinejoin="round" strokeLinecap="round" />
            ))}
            <circle cx={BARON_PIT.x} cy={BARON_PIT.y} r="3.2" fill="#3b2357" stroke="#9b7dff" strokeWidth=".4" />
            <circle cx={DRAGON_PIT.x} cy={DRAGON_PIT.y} r="3.2" fill="#4a2a17" stroke="#ff9f43" strokeWidth=".4" />
            {([0, 1] as Side[]).map(s => (
              <g key={s}>
                {LANES.map(l => [0, 1, 2].map(tier => {
                  const p = towerPos(s, l, tier);
                  return <rect key={`${l}${tier}`} x={p.x - 1.1} y={p.y - 1.1} width="2.2" height="2.2" rx=".3" fill={sides[s].color} opacity={destroyed(s, l, tier) ? 0.15 : 0.95} />;
                }))}
                {LANES.map(l => {
                  const p = inhibPos(s, l);
                  return <circle key={`i${l}`} cx={p.x} cy={p.y} r="1.3" fill="none" stroke={sides[s].color} strokeWidth=".6" opacity={inhibDown(s, l) ? 0.15 : 0.9} />;
                })}
                {[0, 1].map(i => {
                  const p = nexusTowerPos(s, i);
                  return <rect key={`n${i}`} x={p.x - 1} y={p.y - 1} width="2" height="2" fill={sides[s].color} opacity={nexusTowersDown(s) > i ? 0.15 : 0.95} />;
                })}
                <rect x={NEXUS[s].x - 2.4} y={NEXUS[s].y - 2.4} width="4.8" height="4.8" transform={`rotate(45 ${NEXUS[s].x} ${NEXUS[s].y})`}
                  fill={sides[s].color} opacity={finished && result.winner !== s ? 0.15 : 0.9} />
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
                <g key={k} transform={`translate(${p.x} ${p.y})`} opacity={dead ? 0.3 : 1}>
                  <title>{`${champ.name} (${ROLE_LABEL[k.slice(2) as Role]})`}</title>
                  <circle r="2.8" fill={sides[s].color} />
                  <image href={icon(champ.id)} x="-2.3" y="-2.3" width="4.6" height="4.6" clipPath={`url(#${uid}-c-${k})`} />
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
