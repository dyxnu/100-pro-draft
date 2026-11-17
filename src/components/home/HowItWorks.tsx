import type { CSSProperties } from 'react';

const DD = 'https://ddragon.leagueoflegends.com/cdn';
const LANES = [
  { k: 'top', l: 'Top' }, { k: 'jungle', l: 'Jungle' }, { k: 'middle', l: 'Mid' }, { k: 'bottom', l: 'ADC' }, { k: 'utility', l: 'Suporte' },
];

/** Passo 1: carta do leilão com lances subindo e o relógio correndo. */
function BidScene({ star, version }: { star: { id: string; name: string }; version: string }) {
  return (
    <div className="hm-illus hm-illus-bid">
      <img className="hm-illus-bg" src={`${DD}/img/champion/splash/${star.id}_0.jpg`} alt="" draggable={false} loading="lazy" />
      <div className="hm-bidcard">
        <img src={`${DD}/img/champion/loading/${star.id}_0.jpg`} alt="" draggable={false} loading="lazy" />
        <span>{star.name}</span>
      </div>
      <div className="hm-bidfeed">
        {[['R$ 14', 'Você'], ['R$ 17', 'Bot Lua'], ['R$ 21', 'Você']].map(([v, who], i) => (
          <span key={i} className="hm-bid" style={{ '--delay': `${i * 1.5}s` } as CSSProperties}>
            <img src={`${DD}/${version}/img/profileicon/${[4568, 588, 4568][i]}.png`} alt="" draggable={false} />
            <b>{v}</b><small>{who}</small>
          </span>
        ))}
      </div>
      <div className="hm-bidtimer"><span className="hm-timer" /></div>
    </div>
  );
}

/** Passo 2: as cinco rotas sendo preenchidas. */
function TeamScene({ team, version }: { team: string[]; version: string }) {
  return (
    <div className="hm-illus hm-illus-team">
      {LANES.map((l, i) => (
        <div key={l.k} className="hm-lane">
          <span className="hm-lane-slot">
            <span className="hm-slot" style={{ '--delay': `${i * 0.55}s` } as CSSProperties}>
              <img src={`${DD}/${version}/img/champion/${team[i % team.length]}.png`} alt="" draggable={false} loading="lazy" />
            </span>
          </span>
          <img className="hm-lane-ico" src={`/positions/${l.k}.svg`} alt="" draggable={false} />
          <small>{l.l}</small>
        </div>
      ))}
    </div>
  );
}

/** Passo 3: confronto e a taça. */
function CupScene({ a, b }: { a: string; b: string }) {
  return (
    <div className="hm-illus hm-illus-cup">
      <div className="hm-vs-side l"><img src={`${DD}/img/champion/centered/${a}_0.jpg`} alt="" draggable={false} loading="lazy" /></div>
      <div className="hm-vs-side r"><img src={`${DD}/img/champion/centered/${b}_0.jpg`} alt="" draggable={false} loading="lazy" /></div>
      <svg className="hm-cup" viewBox="0 0 64 72" aria-label="Taça" role="img">
        <defs>
          <linearGradient id="hmCupG" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff3c4" /><stop offset=".45" stopColor="#e2b85a" /><stop offset="1" stopColor="#8a6420" />
          </linearGradient>
        </defs>
        <path d="M16 6h32v14c0 11-7 19-16 19S16 31 16 20z" fill="url(#hmCupG)" stroke="#5c3f10" strokeWidth="1.5" />
        <path d="M16 10H7c0 9 4 14 10 15M48 10h9c0 9-4 14-10 15" fill="none" stroke="url(#hmCupG)" strokeWidth="4" strokeLinecap="round" />
        <path d="M28 39h8v10h-8z" fill="#c99a3a" />
        <path d="M18 66l4-17h20l4 17z" fill="url(#hmCupG)" stroke="#5c3f10" strokeWidth="1.5" />
        <path d="M32 12l2.4 5 5.4.6-4 3.7 1.1 5.3L32 24l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z" fill="#fff" opacity=".85" />
      </svg>
      <span className="hm-vs">VS</span>
    </div>
  );
}

/** "Como funciona" em três passos, cada um com uma cena animada feita com a arte dos campeões. */
export function HowItWorks({ ids, names, version }: { ids: string[]; names: Record<string, string>; version: string }) {
  const steps = [
    { n: '1', t: 'Dê o lance', d: 'Cada campeão vai a leilão com o relógio correndo. Todo lance garante mais alguns segundos para a resposta.', scene: <BidScene star={{ id: ids[0], name: names[ids[0]] ?? ids[0] }} version={version} /> },
    { n: '2', t: 'Monte as 5 rotas', d: 'Top, Jungle, Mid, ADC e Suporte com R$ 100 fictícios. Guarde dinheiro para fechar o time.', scene: <TeamScene team={ids.slice(1, 6)} version={version} /> },
    { n: '3', t: 'Dispute a taça', d: 'Mata-mata no Summoner’s Rift: escale, escolha a estratégia e mude a tática ao vivo.', scene: <CupScene a={ids[6] ?? ids[0]} b={ids[7] ?? ids[1]} /> },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {steps.map((s, i) => (
        <article key={s.n} className="hm-step hm-reveal" style={{ '--d': `${i * 0.1}s` } as CSSProperties}>
          {s.scene}
          <div className="hm-step-body">
            <span className="hm-step-n">{s.n}</span>
            <div>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
