import type { CSSProperties } from 'react';
import { DD_VERSION } from '@/lib/profile/avatars';
import { PixelChamp } from './PixelChamp';
import { COIN, COIN_PAL, PixelArt, TROPHY, TROPHY_PAL } from './PixelArt';

const LANES = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];

function BidScene({ star }: { star: string }) {
  return (
    <div className="hm-illus">
      <div className="absolute inset-x-0 top-4 flex justify-center">
        <div className="relative">
          <PixelChamp version={DD_VERSION} id={star} res={20} size={72} outline="#f3d68a" />
          <span className="absolute -right-6 top-1"><PixelArt map={COIN} palette={COIN_PAL} size={18} className="hm-trophy" /></span>
        </div>
      </div>
      <div className="hm-pixelfont absolute inset-x-0 bottom-9 h-6 text-center text-[11px] text-[#f3d68a]">
        <span className="hm-bid inset-x-0" style={{ '--delay': '0s' } as CSSProperties}>R$ 14 · VOCÊ</span>
        <span className="hm-bid inset-x-0" style={{ '--delay': '1.5s' } as CSSProperties}>R$ 17 · BOT</span>
        <span className="hm-bid inset-x-0" style={{ '--delay': '3s' } as CSSProperties}>R$ 21 · VOCÊ</span>
      </div>
      <div className="absolute inset-x-6 bottom-5 h-2 bg-[#14173f]">
        <div className="hm-timer h-full bg-gradient-to-r from-[#f3d68a] to-[#6d63db]" />
      </div>
    </div>
  );
}

function TeamScene({ team }: { team: string[] }) {
  return (
    <div className="hm-illus flex items-center justify-center gap-1.5 px-2 sm:gap-2">
      {LANES.map((l, i) => (
        <div key={l} className="grid justify-items-center gap-1.5">
          <div className="grid h-12 w-12 place-items-center border-2 border-dashed border-[#6d63db] bg-[#14173f]/60 sm:h-14 sm:w-14">
            <span className="hm-slot" style={{ '--delay': `${i * 0.5}s` } as CSSProperties}>
              <PixelChamp version={DD_VERSION} id={team[i % team.length]} res={14} size={40} />
            </span>
          </div>
          <span className="hm-pixelfont text-[8px] text-[#c9c3f5]">{l}</span>
        </div>
      ))}
    </div>
  );
}

function CupScene({ a, b }: { a: string; b: string }) {
  return (
    <div className="hm-illus">
      <div className="absolute inset-x-0 top-3 flex justify-center">
        <PixelArt map={TROPHY} palette={TROPHY_PAL} size={44} className="hm-trophy" label="Taça" />
      </div>
      <div className="absolute inset-x-0 bottom-6 flex items-end justify-center gap-6">
        <div className="hm-clash-l"><PixelChamp version={DD_VERSION} id={a} res={16} size={52} outline="#14173f" /></div>
        <svg viewBox="0 0 10 10" width="26" height="26" className="hm-spark absolute bottom-10" shapeRendering="crispEdges" aria-hidden>
          <path d="M4 0h2v3h1v1h3v2H7v1H6v3H4V7H3V6H0V4h3V3h1z" fill="#fff3c4" />
        </svg>
        <div className="hm-clash-r"><PixelChamp version={DD_VERSION} id={b} res={16} size={52} outline="#3a0f1c" /></div>
      </div>
    </div>
  );
}

/** "Como funciona" em três passos, cada um com uma cena animada em pixel art. */
export function HowItWorks({ ids }: { ids: string[] }) {
  const steps = [
    { n: '1', t: 'Dê o lance', d: 'Cada campeão vai a leilão com o relógio correndo. Todo lance garante mais alguns segundos para a resposta.', scene: <BidScene star={ids[0]} /> },
    { n: '2', t: 'Monte as 5 rotas', d: 'Top, Jungle, Mid, ADC e Suporte com R$ 100 fictícios. Guarde dinheiro para fechar o time.', scene: <TeamScene team={ids.slice(1, 6)} /> },
    { n: '3', t: 'Dispute a taça', d: 'Mata-mata no Summoner’s Rift: escale, escolha a estratégia e mude a tática ao vivo.', scene: <CupScene a={ids[6] ?? ids[0]} b={ids[7] ?? ids[1]} /> },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {steps.map((s, i) => (
        <article key={s.n} className="panel hm-step hm-reveal p-4" style={{ '--d': `${i * 0.1}s` } as CSSProperties}>
          {s.scene}
          <div className="mt-4 flex items-start gap-3 px-1">
            <span className="hm-pixelfont grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gold2 text-sm text-[#f3d68a]">{s.n}</span>
            <div>
              <h3 className="text-lg font-black text-gold2">{s.t}</h3>
              <p className="mt-0.5 text-sm text-muted">{s.d}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
