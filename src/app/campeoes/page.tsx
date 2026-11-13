import type { Metadata } from 'next';
import { getCatalogCards } from '@/lib/champions/catalog';
import { CardGallery } from './gallery';

export const metadata: Metadata = { title: 'Campeões' };

export default async function CampeoesPage() {
  const items = await getCatalogCards();
  const patch = items[0]?.card.patch;
  return (
    <div className="mt-10">
      <p className="eyebrow">Cartas dos campeões</p>
      <h1 className="mt-1 text-3xl font-bold text-gold2">Conheça seu elenco</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Atributos calculados com os dados oficiais da Riot (Data Dragon, patch {patch}) e ajustados pelo kit de cada campeão.
        O overall muda de acordo com a rota. Clique numa carta para ver counters e sinergias.
      </p>
      <CardGallery items={items} />
    </div>
  );
}
