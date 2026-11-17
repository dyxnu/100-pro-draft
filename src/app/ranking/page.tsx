import Link from 'next/link';
import type { Metadata } from 'next';
import { TIERS, TIER_COLOR, TIER_LABEL } from '@/lib/progress/rank';
import { getRanking } from '@/components/home/ranking';
import { RankingTable } from '@/components/home/RankingTable';
import { TierEmblem } from '@/components/home/TierEmblem';
import { NightSky } from '@/components/home/NightSky';
import { pixelFont } from '@/components/home/fonts';
import '@/components/home/home.css';

export const metadata: Metadata = {
  title: 'Ranking mundial',
  description: 'Os 100 melhores jogadores do 100 pro Draft, ordenados por elo e PDL.',
};

export default async function RankingPage() {
  const ranking = await getRanking(100);
  const podium = ranking.rows.slice(0, 3);

  return (
    <div className={`${pixelFont.variable} overflow-x-clip`}>
      <section className="hm-hero mt-5 px-5 py-10 text-center sm:px-10">
        <NightSky />
        <span className="hm-kicker">Temporada atual</span>
        <h1 className="hm-title mt-4 text-4xl font-black sm:text-5xl">Ranking mundial</h1>
        <p className="mx-auto mt-3 max-w-lg text-[#d9d5f7]">
          Os 100 melhores do 100 pro Draft, ordenados por elo e PDL. Jogue ranqueadas para entrar na lista.
        </p>
        {podium.length > 0 && (
          <ol className="mx-auto mt-8 grid max-w-xl grid-cols-3 items-end gap-3">
            {[podium[1], podium[0], podium[2]].map((p, i) => p && (
              <li key={p.id} className={`grid justify-items-center gap-1 ${i === 1 ? '' : 'pt-6'}`}>
                <TierEmblem tier={p.tier} size={i === 1 ? 84 : 64} />
                <span className="max-w-full truncate text-sm font-black text-white">{p.username}</span>
                <span className="text-xs font-bold" style={{ color: TIER_COLOR[p.tier] }}>{TIER_LABEL[p.tier]} · {p.lp} PDL</span>
                <span className={`hm-pixelfont mt-1 grid w-full place-items-center rounded-t-lg text-xs ${i === 1 ? 'h-16 hm-medal-1' : i === 0 ? 'h-11 hm-medal-2' : 'h-8 hm-medal-3'}`}>
                  {i === 1 ? '1º' : i === 0 ? '2º' : '3º'}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-8">
        <RankingTable data={ranking} />
        <p className="mt-4 text-center text-sm text-muted">
          <Link href="/" className="text-accent hover:underline">← Voltar ao início</Link>
        </p>
      </section>

      <section className="mt-10">
        <p className="eyebrow mb-3 text-center">Elos</p>
        <ul className="hm-emblems mx-auto grid max-w-3xl grid-cols-5 gap-3 sm:grid-cols-10">
          {TIERS.map(t => (
            <li key={t} className="hm-emblem grid justify-items-center gap-1 text-center">
              <TierEmblem tier={t} size={52} />
              <span className="text-[10px] font-black" style={{ color: TIER_COLOR[t] }}>{TIER_LABEL[t]}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
