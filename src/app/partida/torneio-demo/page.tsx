import type { Metadata } from 'next';
import { STARTER_CHAMPIONS } from '@/lib/auction/champions';
import { TournamentDemo } from './demo';

export const metadata: Metadata = { title: 'Campeonato de demonstração' };

// Demonstração local do campeonato (sem banco): você contra 5 bots, já depois do leilão.
export default function Page() {
  return <TournamentDemo champions={STARTER_CHAMPIONS} />;
}
