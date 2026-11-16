import type { Metadata } from 'next';
import { STARTER_CHAMPIONS } from '@/lib/auction/champions';
import { AuctionDemo } from './demo';

export const metadata: Metadata = { title: 'Leilão de demonstração' };

// Leilão local (sem banco): você contra 5 bots, para ver a tela e as animações.
export default function Page() {
  return <AuctionDemo champions={STARTER_CHAMPIONS} />;
}
