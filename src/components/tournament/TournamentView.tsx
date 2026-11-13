'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ROLES, type AuctionState, type Role } from '@/lib/auction/engine';
import type { ClientAction } from '@/lib/rooms/types';
import { STRATEGY_OPTIONS, type Strategy } from '@/lib/match/model';
import { preMatchChance } from '@/lib/match/sim';
import {
  type TMatch, type TeamEntry, type TournamentState,
  matchResult, matchTeam, playingMatchOf, roundMatches, teamCards, teamRating,
} from '@/lib/tournament/engine';
import { ChampionCard } from '@/components/cards/ChampionCard';
import { MatchViewer, type ViewerSide } from '@/components/match/MatchViewer';
import { ChampImg, ROLE_LABEL, seatColor } from '@/components/draft/ui';
import './tournament.css';

const BLUE = '#3b9cff';
const RED = '#e84057';
const ROUND_NAME = (round: number, total: number) =>
  round === total ? 'Final' : round === total - 1 ? 'Semifinal' : round === total - 2 ? 'Quartas de final' : `Rodada ${round}`;

export function TournamentView({ s, t, me, act, pending, serverTime, auctionSummary }: {
  s: AuctionState;
  t: TournamentState;
  me: string | null;
  act: (a: ClientAction) => void;
  pending: boolean;
  serverTime: () => number;
  auctionSummary: React.ReactNode;
}) {
  const myTeam = me ? t.teams[me] : null;
  const myMatch = me ? playingMatchOf(t, me) : null;
  const live = roundMatches(t).filter(m => m.a && m.b);
  const [watchId, setWatchId] = useState<string | null>(null);
  const watched = live.find(m => m.id === watchId) ?? (myMatch?.a && myMatch?.b ? myMatch : live[0]) ?? null;

  return (
    <div className="nx-tour">
      <header className="tour-head">
        <div>
          <p className="eyebrow">Campeonato mata-mata</p>
          <h1>{t.stage === 'done' ? 'Campeonato encerrado' : `${ROUND_NAME(t.round, t.totalRounds)} · ${t.stage === 'lineup' ? 'escalação' : 'bola rolando'}`}</h1>
        </div>
        {t.stage === 'lineup' && <Countdown until={t.lineupDeadline} now={serverTime} label="A rodada começa em" />}
      </header>

      <Bracket s={s} t={t} me={me} />

      {t.stage === 'done' && <Champion s={s} t={t} me={me} />}

      {t.stage === 'lineup' && myTeam && !myTeam.eliminated && (
        myMatch && myMatch.a && myMatch.b
          ? <LineupStage s={s} t={t} me={me!} match={myMatch} act={act} pending={pending} />
          : <p className="panel-t muted">Você é cabeça de chave e folga nesta rodada. Aguarde os outros jogos.</p>
      )}
      {t.stage === 'lineup' && myTeam?.eliminated && <p className="panel-t muted">Seu time foi eliminado. Você pode acompanhar as próximas partidas.</p>}

      {t.stage === 'playing' && watched && (
        <section className="watch">
          {live.length > 1 && (
            <div className="match-tabs">
              {live.map(m => (
                <button key={m.id} className={m.id === watched.id ? 'on' : ''} onClick={() => setWatchId(m.id)}>
                  {t.teams[m.a!].name} x {t.teams[m.b!].name}{(m.a === me || m.b === me) ? ' (você)' : ''}
                </button>
              ))}
            </div>
          )}
          <LiveMatch s={s} t={t} m={watched} me={me} act={act} pending={pending} serverTime={serverTime} />
        </section>
      )}

      <details className="summary"><summary>Resumo do leilão</summary>{auctionSummary}</details>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Countdown({ until, now, label }: { until: number; now: () => number; label: string }) {
  const [left, setLeft] = useState(() => Math.max(0, until - now()));
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, until - now())), 250);
    return () => clearInterval(id);
  }, [until, now]);
  return <div className="countdown">{label} <b>{Math.ceil(left / 1000)} s</b></div>;
}

function Bracket({ s, t, me }: { s: AuctionState; t: TournamentState; me: string | null }) {
  const rounds = Array.from({ length: t.totalRounds }, (_, i) => i + 1);
  const name = (id: string | null) => (id ? t.teams[id].name : '—');
  return (
    <div className="bracket" style={{ gridTemplateColumns: `repeat(${rounds.length}, minmax(0, 1fr))` }}>
      {rounds.map(r => {
        const ms = roundMatches(t, r);
        const expected = 2 ** (t.totalRounds - r);
        return (
          <div key={r} className="b-round">
            <p className="b-title">{ROUND_NAME(r, t.totalRounds)}</p>
            {Array.from({ length: expected }, (_, i) => ms[i]).map((m, i) => (
              <div key={i} className={`b-match ${m && r === t.round && t.stage === 'playing' && m.a && m.b && !m.winner ? 'live' : ''}`}>
                {m ? (
                  [m.a, m.b].map((id, k) => (
                    <div key={k} className={`b-team ${m.winner && m.winner === id ? 'win' : ''} ${m.winner && id && m.winner !== id ? 'lose' : ''} ${id === me ? 'me' : ''}`}>
                      {id && <span className="dot" style={{ background: seatColor(id) }} />}
                      <span className="nm">{id ? name(id) : (m.a || m.b ? 'folga' : 'A definir')}</span>
                      {id && <span className="sd">#{t.teams[id].seed}</span>}
                      {m.score && <span className="sc">{m.score[k]}</span>}
                    </div>
                  ))
                ) : (
                  <><div className="b-team muted">A definir</div><div className="b-team muted">A definir</div></>
                )}
              </div>
            ))}
          </div>
        );
      })}
      <span hidden>{s.version}</span>
    </div>
  );
}

function StrategyPicker({ value, onChange, disabled }: { value: Strategy; onChange: (s: Strategy) => void; disabled?: boolean }) {
  const groups: [keyof Strategy, string][] = [['agressividade', 'Postura'], ['estilo', 'Estilo'], ['prioridade', 'Prioridade'], ['risco', 'Risco']];
  return (
    <div className="strategy">
      {groups.map(([k, label]) => (
        <div key={k} className="sg">
          <span>{label}</span>
          <div className="opts">
            {(STRATEGY_OPTIONS[k] as readonly (readonly [string, string])[]).map(([v, l]) => (
              <button key={v} disabled={disabled} className={value[k] === v ? 'on' : ''} onClick={() => onChange({ ...value, [k]: v } as Strategy)}>{l}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LineupStage({ s, t, me, match, act, pending }: {
  s: AuctionState; t: TournamentState; me: string; match: TMatch; act: (a: ClientAction) => void; pending: boolean;
}) {
  const team = t.teams[me];
  const oppId = match.a === me ? match.b! : match.a!;
  const opp = t.teams[oppId];
  const [sel, setSel] = useState<Role | null>(null);
  const cards = useMemo(() => teamCards(team, s.champions), [team, s.champions]);
  const chance = useMemo(() => {
    const mine = matchTeam(team, s.champions), theirs = matchTeam(opp, s.champions);
    return preMatchChance(mine, theirs);
  }, [team, opp, s.champions]);
  const playing = roundMatches(t).flatMap(m => (m.a && m.b ? [m.a, m.b] : []));
  const readyCount = playing.filter(id => t.teams[id].ready).length;

  const clickSlot = (r: Role) => {
    if (!sel) return setSel(r);
    if (sel !== r) act({ type: 'lineup_swap', a: sel, b: r });
    setSel(null);
  };

  return (
    <section className="lineup">
      <div className="lineup-main">
        <div className="row-head">
          <h2>Seu time <small>overall {teamRating(team, s.champions)}</small></h2>
          <p className="muted">Clique em dois campeões para trocar de rota. Fora da rota o campeão rende metade.</p>
        </div>
        <div className="slots-t">
          {ROLES.map(r => {
            const card = cards[r];
            const off = !s.champions[team.lineup[r]].routes.includes(r);
            return (
              <div key={r} className={`slot-t ${sel === r ? 'sel' : ''} ${off ? 'off' : ''}`}>
                <div className="role">{ROLE_LABEL[r]}{off && <em> · fora da rota</em>}</div>
                <ChampionCard card={card} role={r} size="sm" onClick={() => clickSlot(r)} selected={sel === r} />
              </div>
            );
          })}
        </div>
        <h3 className="mt">Estratégia</h3>
        <StrategyPicker value={team.strategy} disabled={pending} onChange={st => act({ type: 'strategy', strategy: st })} />
      </div>

      <aside className="lineup-side">
        <p className="eyebrow">Próximo adversário</p>
        <h3>{opp.name} <small>#{opp.seed} · overall {teamRating(opp, s.champions)}</small></h3>
        <div className="opp">
          {ROLES.map(r => (
            <div key={r} className="opp-row">
              <span className="role">{ROLE_LABEL[r]}</span>
              <ChampImg id={opp.lineup[r]} name={s.champions[opp.lineup[r]].name} className="ic" />
              <span>{s.champions[opp.lineup[r]].name}</span>
            </div>
          ))}
        </div>
        <div className="chance">
          <span>Sua chance prevista</span>
          <b className={chance >= 0.5 ? 'good' : 'bad'}>{Math.round(chance * 100)}%</b>
          <div className="bar"><span style={{ width: `${chance * 100}%` }} /></div>
          <small>Muda com a escalação e a estratégia. Zebra acontece.</small>
        </div>
        <button className={team.ready ? 'btn-secondary w-full' : 'btn-primary w-full'} disabled={pending} onClick={() => act({ type: 'ready', ready: !team.ready })}>
          {team.ready ? 'Pronto! (clique para desfazer)' : 'Pronto para o jogo'}
        </button>
        <p className="muted small">{readyCount}/{playing.length} prontos · mexer no time cancela a sua confirmação.</p>
      </aside>
    </section>
  );
}

function LiveMatch({ s, t, m, me, act, pending, serverTime }: {
  s: AuctionState; t: TournamentState; m: TMatch; me: string | null; act: (a: ClientAction) => void; pending: boolean; serverTime: () => number;
}) {
  const changesKey = JSON.stringify(m.changes);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const result = useMemo(() => matchResult(t, m, s.champions), [m.id, m.seed, changesKey, s.champions]);
  if (!result || !m.startedAt) return null;
  const side = (id: string, color: string): ViewerSide => {
    const team: TeamEntry = t.teams[id];
    return {
      name: team.name, color, splitpush: team.strategy.estilo === 'splitpush',
      champs: Object.fromEntries(ROLES.map(r => [r, { id: team.lineup[r], name: s.champions[team.lineup[r]].name }])) as ViewerSide['champs'],
    };
  };
  const mine = me && (m.a === me || m.b === me) && !m.winner;
  return (
    <div className="live">
      <MatchViewer
        key={m.id}
        result={result}
        sides={[side(m.a!, BLUE), side(m.b!, RED)]}
        syncStart={m.startedAt}
        syncSpeed={t.config.speed}
        serverNow={serverTime}
      />
      {mine && (
        <div className="tactics">
          <h3>Tática ao vivo</h3>
          <p className="muted small">A mudança vale a partir do próximo lance da partida. Máximo de {t.config.maxChangesPerMatch} mudanças por jogo.</p>
          <StrategyPicker value={t.teams[me!].strategy} disabled={pending} onChange={st => act({ type: 'strategy', strategy: st })} />
        </div>
      )}
    </div>
  );
}

function Champion({ s, t, me }: { s: AuctionState; t: TournamentState; me: string | null }) {
  const champ = t.champion ? t.teams[t.champion] : null;
  if (!champ) return null;
  return (
    <section className="champion">
      <p className="eyebrow">Campeão</p>
      <h2 style={{ color: seatColor(champ.playerId) }}>{champ.name}{champ.playerId === me ? ' (você!)' : ''}</h2>
      <div className="champ-row">
        {ROLES.map(r => (
          <div key={r} className="cr"><ChampImg id={champ.lineup[r]} name={s.champions[champ.lineup[r]].name} className="ic" /><small>{ROLE_LABEL[r]}</small></div>
        ))}
      </div>
      <Link href="/jogar" className="btn-primary mt">Jogar de novo</Link>
    </section>
  );
}
