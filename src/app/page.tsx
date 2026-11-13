import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { getCurrentUser } from '@/lib/supabase/server';
import { TrainButton } from './jogar/forms';

const STEPS = [
  { n: '01', t: 'R$ 100 fictícios', d: 'Todo mundo começa com o mesmo orçamento. Ninguém sai com saldo para gastar fora do jogo.' },
  { n: '02', t: 'Leilão campeão a campeão', d: '30 campeões em ordem aleatória. Cada lance reinicia o cronômetro de 10 segundos.' },
  { n: '03', t: 'Cinco rotas', d: 'Top, Jungle, Mid, ADC e Suporte. Rotas flexíveis, e o sistema nunca deixa um time travar.' },
];

const ROADMAP = [
  { t: 'Contas e perfis', s: 'pronto' },
  { t: 'Salas com amigos e bots', s: 'pronto' },
  { t: 'Leilão em tempo real', s: 'pronto' },
  { t: 'Histórico e compartilhamento', s: 'em breve' },
  { t: 'Simulador de partidas', s: 'em breve' },
  { t: 'Ranked, MD10 e temporadas', s: 'em breve' },
];

export default async function Home() {
  const session = await getCurrentUser();

  return (
    <>
      <section className="py-16 text-center sm:py-24">
        <Logo size="lg" />
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted">
          Monte o melhor time com apenas <b className="text-gold2">R$ 100 fictícios</b>. Dispute os campeões em
          leilão contra seus amigos e prove quem entende de draft.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={session ? '/jogar' : '/cadastro'} className="btn-primary px-6">
            {session ? 'Jogar com amigos' : 'Criar conta e jogar'}
          </Link>
          {session
            ? <TrainButton className="btn-secondary px-6" />
            : <Link href="/entrar?next=/jogar" className="btn-secondary px-6">Treinar contra bots</Link>}
        </div>
        <p className="mt-3 text-xs text-muted">Leilão, escalação e campeonato no mini-mapa, contra 5 bots, começando na hora.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {STEPS.map(s => (
          <div key={s.n} className="panel p-5">
            <p className="text-sm font-bold text-gold">{s.n}</p>
            <h2 className="mt-1 text-lg font-bold text-gold2">{s.t}</h2>
            <p className="mt-2 text-sm text-muted">{s.d}</p>
          </div>
        ))}
      </section>

      <section className="panel mt-6 p-6">
        <h2 className="eyebrow">Roadmap</h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ROADMAP.map(r => (
            <li key={r.t} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-bg2 px-3 py-2 text-sm">
              <span>{r.t}</span>
              <span className={`text-xs font-semibold ${r.s === 'pronto' ? 'text-teal' : 'text-muted'}`}>{r.s}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 text-center text-xs text-muted">
        Nexus Draft é um projeto de fãs, sem afiliação com a Riot Games. League of Legends e seus campeões são marcas da Riot Games, Inc.
      </p>
    </>
  );
}
