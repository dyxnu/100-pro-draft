import Link from 'next/link';
import { TIER_COLOR, TIER_LABEL, isApex } from '@/lib/progress/rank';
import { TierEmblem } from './TierEmblem';
import { playerIconUrl, type RankingResult } from './ranking-shared';

const ROMAN = ['', 'I', 'II', 'III', 'IV'];

/** Tabela do ranking mundial (top N por pontuação de elo). */
export function RankingTable({ data, empty, flash }: { data: RankingResult; empty?: React.ReactNode; flash?: ReadonlySet<string> }) {
  if (data.error || data.rows.length === 0) {
    return (
      <div className="panel grid place-items-center gap-2 px-6 py-10 text-center">
        <TierEmblem tier="FERRO" size={56} className="opacity-60 grayscale" />
        <p className="font-black text-gold2">{data.error ?? 'Ninguém subiu no ranking ainda.'}</p>
        <p className="max-w-sm text-sm text-muted">{empty ?? 'Jogue uma partida ranqueada e seja o primeiro nome da lista.'}</p>
      </div>
    );
  }

  return (
    <ol className="panel divide-y divide-line overflow-hidden">
      {data.rows.map((p, i) => {
        const pos = i + 1;
        return (
          <li key={p.id} className={flash?.has(p.id) ? 'hm-rank-flash' : undefined}>
            <Link href={`/jogador/${encodeURIComponent(p.username)}`} className="hm-rank-row flex items-center gap-3 px-3 py-2.5 sm:gap-4 sm:px-5">
              <span className={`hm-pos grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-black ${pos <= 3 ? `hm-medal-${pos}` : 'bg-panel2 text-muted'}`}>
                {pos}
              </span>
              <img
                src={playerIconUrl(p.avatar_url)} alt="" width={40} height={40} loading="lazy" decoding="async"
                className="h-10 w-10 shrink-0 rounded-full object-cover"
                style={{ boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${TIER_COLOR[p.tier]}` }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-black text-gold2">
                  {p.username}{p.tag && <span className="font-semibold text-muted"> #{p.tag}</span>}
                </span>
                <span className="block text-xs font-bold" style={{ color: TIER_COLOR[p.tier] }}>
                  {TIER_LABEL[p.tier]}{!isApex(p.tier) && p.division ? ` ${ROMAN[p.division]}` : ''}
                </span>
              </span>
              <TierEmblem tier={p.tier} size={44} className="shrink-0" />
              <span className="w-16 shrink-0 text-right sm:w-20">
                <span className="block font-black tabular-nums text-gold2">{p.lp}</span>
                <span className="block text-[10px] font-bold uppercase tracking-widest text-muted">PDL</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
