import Link from 'next/link';
import type { CSSProperties } from 'react';
import { getCurrentUser } from '@/lib/supabase/server';
import { getCatalog } from '@/lib/champions/catalog';
import { buildCard } from '@/lib/champions/cards';
import { TIERS, TIER_COLOR, TIER_LABEL } from '@/lib/progress/rank';
import { MoonBladeEmblem } from '@/components/Logo';
import { NightSky } from '@/components/home/NightSky';
import { ChampionRing, type RingChamp } from '@/components/home/ChampionRing';
import { PixelLane } from '@/components/home/PixelLane';
import { HowItWorks } from '@/components/home/HowItWorks';
import { TierEmblem } from '@/components/home/TierEmblem';
import { RankingTable } from '@/components/home/RankingTable';
import { WhyAccount } from '@/components/home/WhyAccount';
import { getRanking } from '@/components/home/ranking';
import { pixelFont } from '@/components/home/fonts';
import { TrainButton } from './jogar/forms';
import '@/components/home/home.css';

/** Embaralha uma cópia (Fisher–Yates). */
function shuffled<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function SectionHead({ kicker, title, children }: { kicker: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 max-w-2xl">
      <p className="eyebrow">{kicker}</p>
      <h2 className="mt-2 text-3xl font-black leading-tight text-gold2 sm:text-4xl">{title}</h2>
      {children && <p className="mt-2 text-muted">{children}</p>}
    </div>
  );
}

export default async function Home() {
  const [session, catalog, ranking] = await Promise.all([getCurrentUser(), getCatalog(), getRanking(10)]);
  const champs: RingChamp[] = catalog.map(c => {
    const card = buildCard(c.id, c.routes);
    return { id: c.id, name: card.name, title: card.title };
  });
  const diana = champs.find(c => c.id === 'Diana');
  const mix = shuffled(champs.filter(c => c.id !== 'Diana'));
  const ring = [...(diana ? [diana] : []), ...mix].slice(0, 10);
  const pixels = shuffled(champs);
  const lane = pixels.slice(0, 11).map(c => ({ id: c.id, name: c.name }));
  const steps = [diana?.id ?? pixels[0]?.id, ...pixels.slice(11, 18).map(c => c.id)].filter((x): x is string => !!x);
  const loggedIn = !!session;
  const gate = (path: string) => (loggedIn ? path : `/entrar?next=${encodeURIComponent(path)}`);

  return (
    <div className={`${pixelFont.variable} overflow-x-clip`}>
      {/* ───────── Hero ───────── */}
      <section className="hm-hero mt-5 px-5 pb-6 pt-10 sm:px-10 sm:pt-14 lg:pb-10">
        <NightSky />
        <div className="hm-moon" aria-hidden>
          <div className="hm-moon-glow" />
          <MoonBladeEmblem className="relative h-full w-full opacity-90" />
        </div>

        <div className="grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-8">
          <div className="relative z-10">
            <span className="hm-kicker hm-reveal">
              <span className="h-1.5 w-1.5 rounded-full bg-[#f3d68a]" /> Leilão de campeões · Summoner’s Rift
            </span>
            <h1 className="hm-title hm-reveal mt-5 text-[2.6rem] font-black leading-[1.02] tracking-tight sm:text-6xl" style={{ '--d': '.08s' } as CSSProperties}>
              Cem reais.<br />Cinco rotas.<br /><span className="hm-title-gold">Uma taça.</span>
            </h1>
            <p className="hm-reveal mt-5 max-w-md text-base text-[#d9d5f7] sm:text-lg" style={{ '--d': '.16s' } as CSSProperties}>
              Dispute cada campeão com R$ 100 fictícios, feche o time nas cinco rotas e leve sua equipe até a taça sob a luz da lua.
            </p>

            <div className="hm-reveal mt-7 grid max-w-md gap-3" style={{ '--d': '.24s' } as CSSProperties}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Link href={gate('/jogar')} className="hm-cta text-base">Criar sala →</Link>
                {loggedIn
                  ? <Link href="/jogar#codigo" className="hm-ghost">Entrar com código</Link>
                  : <Link href="/convidado" className="hm-ghost gold">Jogar como convidado</Link>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {loggedIn
                  ? <><TrainButton className="hm-ghost w-full" /><Link href="/ranking" className="hm-ghost">Ranking mundial</Link></>
                  : <><Link href={gate('/jogar')} className="hm-ghost">Entrar com código</Link><Link href={gate('/jogar')} className="hm-ghost">Treinar contra bots</Link></>}
              </div>
            </div>

            <dl className="hm-reveal mt-8 grid max-w-md grid-cols-3 gap-3" style={{ '--d': '.32s' } as CSSProperties}>
              {[
                { v: 'R$ 100', k: 'por jogador' },
                { v: String(catalog.length), k: 'campeões' },
                { v: '10', k: 'elos ranqueados' },
              ].map(s => (
                <div key={s.k} className="hm-stat">
                  <dt className="sr-only">{s.k}</dt>
                  <dd className="text-xl font-black text-white sm:text-2xl">{s.v}</dd>
                  <dd className="text-[11px] font-semibold uppercase tracking-wider text-[#c9c3f5]">{s.k}</dd>
                </div>
              ))}
            </dl>
          </div>

          <ChampionRing champs={ring} />
        </div>
      </section>

      {/* ───────── Cena em pixel art ───────── */}
      <section className="mt-10">
        <PixelLane ids={lane} />
      </section>

      {/* ───────── Como funciona ───────── */}
      <section id="como-jogar" className="mt-16 scroll-mt-20">
        <SectionHead kicker="Como funciona" title="Do primeiro lance à taça em três passos" />
        <HowItWorks ids={steps} />
      </section>

      {/* ───────── Ranqueada ───────── */}
      <section className="hm-ranked mt-16 px-5 py-10 sm:px-10">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
          <div>
            <span className="hm-kicker">Modo ranqueado</span>
            <h2 className="hm-title mt-4 text-3xl font-black leading-tight sm:text-4xl">Do Ferro ao Desafiante.</h2>
            <p className="mt-3 max-w-md text-[#d9d5f7]">
              Cada campeonato ranqueado vale PDL. Suba divisões, alcance Mestre e dispute o topo do ranking mundial contra jogadores de todo o Brasil.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={loggedIn ? '/jogar' : '/cadastro'} className="hm-cta">{loggedIn ? 'Jogar ranqueada' : 'Criar conta e subir'}</Link>
              <Link href="/ranking" className="hm-ghost px-5">Ver ranking</Link>
            </div>
          </div>
          <ul className="hm-emblems grid grid-cols-5 gap-x-2 gap-y-5">
            {TIERS.map((t, i) => (
              <li key={t} className="hm-emblem grid justify-items-center gap-1 text-center">
                <span style={{ '--delay': `${i * -0.4}s` } as CSSProperties} className="contents">
                  <TierEmblem tier={t} size={72} className="h-12 w-12 sm:h-[72px] sm:w-[72px]" />
                </span>
                <span className="text-[11px] font-black sm:text-xs" style={{ color: TIER_COLOR[t] }}>{TIER_LABEL[t]}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───────── Ranking mundial ───────── */}
      <section id="ranking" className="mt-16 scroll-mt-20">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHead kicker="Ranking mundial" title="Os 10 melhores do momento">
            Ordenado por elo e PDL. Só aparece quem já jogou ranqueada.
          </SectionHead>
          <Link href="/ranking" className="btn-secondary mb-6">Ver top 100 →</Link>
        </div>
        <RankingTable data={ranking} />
      </section>

      {/* ───────── Por que criar conta ───────── */}
      <section className="mt-16">
        <SectionHead kicker="Sua conta" title={loggedIn ? 'Tudo o que sua conta guarda' : 'Por que criar conta?'}>
          {loggedIn
            ? 'Cada partida rende progresso: elo, essência azul, maestria e honra.'
            : 'Como convidado você joga na hora. Com conta, cada partida vira progresso.'}
        </SectionHead>
        <WhyAccount />
        {!loggedIn && (
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/cadastro" className="btn-primary px-6 py-3">Criar conta grátis</Link>
            <Link href="/entrar" className="btn-secondary px-6 py-3">Já tenho conta</Link>
          </div>
        )}
      </section>

      {/* ───────── Chamada final ───────── */}
      <section className="hm-hero mt-16 px-6 py-12 text-center sm:px-10">
        <NightSky />
        <MoonBladeEmblem className="mx-auto h-16 w-16 anim-float" />
        <h2 className="hm-title mt-4 text-3xl font-black sm:text-4xl">Pronto para o primeiro lance?</h2>
        <p className="mx-auto mt-2 max-w-md text-[#d9d5f7]">Sem dinheiro real. Times de 5, mata-mata e táticas ao vivo.</p>
        <div className="mx-auto mt-6 grid max-w-lg gap-3 sm:grid-cols-2">
          <Link href={gate('/jogar')} className="hm-cta">Criar sala →</Link>
          {loggedIn
            ? <Link href="/jogar#codigo" className="hm-ghost">Entrar com código</Link>
            : <Link href="/convidado" className="hm-ghost">Jogar como convidado</Link>}
        </div>
      </section>
    </div>
  );
}
