import Link from 'next/link';
import { getCurrentUser } from '@/lib/supabase/server';
import { getCatalog } from '@/lib/champions/catalog';
import { buildCard } from '@/lib/champions/cards';
import { Showcase, type ShowcaseChamp } from '@/components/home/Showcase';
import { TrainButton } from './jogar/forms';

const STEPS = [
  { n: '1', t: 'Dê o lance', d: 'Cada campeão fica 10 segundos em leilão. Todo lance garante pelo menos 3 segundos no relógio.' },
  { n: '2', t: 'Monte as 5 rotas', d: 'Top, Jungle, Mid, ADC e Suporte. Guarde R$ 1 por vaga: sobrou dinheiro, sobrou.' },
  { n: '3', t: 'Dispute a taça', d: 'Mata-mata no Summoner’s Rift: escale, escolha a estratégia e mude a tática ao vivo.' },
];

export default async function Home() {
  const [session, catalog] = await Promise.all([getCurrentUser(), getCatalog()]);
  const champs: ShowcaseChamp[] = catalog.map(c => {
    const card = buildCard(c.id, c.routes);
    return { id: c.id, name: card.name, title: card.title, roles: card.roles, routes: c.routes };
  });
  const ordered = [...champs.filter(c => c.id === 'Diana'), ...champs.filter(c => c.id !== 'Diana').sort(() => Math.random() - 0.5)];

  return (
    <>
      <section className="mt-8 grid items-center gap-8 md:grid-cols-[minmax(0,380px)_1fr] md:gap-12">
        <Showcase
          champs={ordered}
          stats={[
            { v: 'R$ 100', k: 'Mesmo orçamento' },
            { v: `${Math.min(36, catalog.length)}`, k: `Sorteados entre ${catalog.length}` },
            { v: '6', k: 'Jogadores por sala' },
          ]}
        />
        <div className="anim-fade-up">
          <p className="eyebrow">Monte. Dispute. Conquiste.</p>
          <h1 className="mt-3 text-4xl font-black leading-tight text-gold2 sm:text-5xl">Seu próximo time começa no leilão.</h1>
          <p className="mt-4 max-w-lg text-lg text-muted">
            Dispute cada campeão com R$ 100 fictícios, feche as cinco rotas e leve sua equipe até a taça no Summoner’s Rift.
          </p>
          <div className="mt-7 grid max-w-md gap-3">
            {session ? (
              <>
                <Link href="/jogar" className="btn-primary py-3 text-base">Criar sala →</Link>
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/jogar#codigo" className="btn-secondary">Entrar com código</Link>
                  <TrainButton className="btn-secondary w-full" />
                </div>
              </>
            ) : (
              <>
                <Link href="/cadastro" className="btn-primary py-3 text-base">Criar conta e jogar →</Link>
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/entrar" className="btn-secondary">Fazer login</Link>
                  <Link href="/entrar?next=/jogar" className="btn-secondary">Treinar contra bots</Link>
                </div>
              </>
            )}
          </div>
          <p className="mt-4 text-sm text-muted">Sem dinheiro real. Times de 5, mata-mata e táticas ao vivo.</p>
        </div>
      </section>

      <section id="como-jogar" className="mt-16 grid gap-4 sm:grid-cols-3">
        {STEPS.map(s => (
          <div key={s.n} className="panel p-5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-moon text-lg font-black text-accent">{s.n}</span>
            <h2 className="mt-3 text-lg font-black text-gold2">{s.t}</h2>
            <p className="mt-1 text-sm text-muted">{s.d}</p>
          </div>
        ))}
      </section>
    </>
  );
}
