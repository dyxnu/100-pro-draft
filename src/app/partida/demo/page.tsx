import type { Metadata } from 'next';
import Link from 'next/link';
import { ROLES, type Role } from '@/lib/auction/engine';
import { getCatalog } from '@/lib/champions/catalog';
import { buildCard, type ChampionCard } from '@/lib/champions/cards';
import { STRATEGY_OPTIONS, type Strategy } from '@/lib/match/model';
import { type MatchTeam, simulateMatch } from '@/lib/match/sim';
import { MatchViewer, type ViewerSide } from '@/components/match/MatchViewer';

export const metadata: Metadata = { title: 'Partida de demonstração' };

const BLUE = '#3b9cff';
const RED = '#e84057';

function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ seed?: string }> }) {
  const seed = Number((await searchParams).seed) || 1 + Math.floor(Math.random() * 1e6);
  const rand = rng(seed);
  const catalog = await getCatalog();
  const used = new Set<string>();

  const makeTeam = (name: string): MatchTeam => {
    const cards = {} as Record<Role, ChampionCard>;
    for (const r of ROLES) {
      const options = catalog.filter(c => c.routes.includes(r) && !used.has(c.id));
      const c = options[Math.floor(rand() * options.length)];
      used.add(c.id);
      cards[r] = buildCard(c.id, c.routes);
    }
    const pick = <K extends keyof Strategy>(k: K) => {
      const opts = STRATEGY_OPTIONS[k];
      return opts[Math.floor(rand() * opts.length)][0] as Strategy[K];
    };
    return { name, cards, strategy: { agressividade: pick('agressividade'), prioridade: pick('prioridade'), estilo: pick('estilo'), risco: pick('risco') } };
  };

  const a = makeTeam('Time Azul');
  const b = makeTeam('Time Vermelho');
  const result = simulateMatch(a, b, seed);
  const toSide = (t: MatchTeam, color: string): ViewerSide => ({
    name: t.name, color, splitpush: t.strategy.estilo === 'splitpush',
    champs: Object.fromEntries(ROLES.map(r => [r, { id: t.cards[r].id, name: t.cards[r].name }])) as ViewerSide['champs'],
  });
  const label = (t: MatchTeam) => Object.values(t.strategy).join(' · ');

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Simulador · demonstração</p>
          <h1 className="mt-1 text-2xl font-bold text-gold2">Time Azul x Time Vermelho</h1>
          <p className="mt-1 text-sm text-muted">
            Chance prevista do Azul: <b className="text-text">{Math.round(result.preMatchWinChanceA * 100)}%</b>
            {' '}· Estratégia Azul: {label(a)} · Vermelho: {label(b)}
          </p>
        </div>
        <Link href={`/partida/demo?seed=${seed + 1}`} className="btn-secondary">Outra partida</Link>
      </div>
      <MatchViewer result={result} sides={[toSide(a, BLUE), toSide(b, RED)]} />
    </div>
  );
}
