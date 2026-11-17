'use client';

import { useEffect, useRef } from 'react';

export interface ActionClip { id: string; name: string; key: number; ability: 'Q' | 'W' | 'E' | 'R' }

const ABILITY_LABEL = { Q: 'Habilidade Q', W: 'Habilidade W', E: 'Habilidade E', R: 'Ultimate' } as const;
const clipUrl = (key: number, a: string) => {
  const k = String(key).padStart(4, '0');
  return `https://d28xe8vt774jo5.cloudfront.net/champion-abilities/${k}/ability_${k}_${a}1`;
};

/** Um vídeo que só baixa e toca quando aparece na tela (economiza dados no celular). */
function Clip({ c, big }: { c: ActionClip; big?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        if (!v.src) { v.src = `${clipUrl(c.key, c.ability)}.webm`; v.load(); }
        v.play().catch(() => {});
      } else v.pause();
    }, { threshold: 0.35 });
    io.observe(v);
    return () => io.disconnect();
  }, [c.key, c.ability]);
  return (
    <figure className={`hm-clip ${big ? 'big' : ''}`}>
      <video
        ref={ref} muted loop playsInline preload="none" disablePictureInPicture
        poster={`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${c.id}_0.jpg`}
        aria-label={`${c.name}: ${ABILITY_LABEL[c.ability]}`}
      />
      <figcaption>
        <span className="hm-clip-key">{c.ability}</span>
        <span><b>{c.name}</b><small>{ABILITY_LABEL[c.ability]}</small></span>
      </figcaption>
    </figure>
  );
}

/** Campeões em ação no jogo de verdade (clipes oficiais das habilidades, em 3D). */
export function RiftInAction({ clips }: { clips: ActionClip[] }) {
  const [main, ...rest] = clips;
  if (!main) return null;
  return (
    <div className="hm-action">
      <Clip c={main} big />
      <div className="hm-action-side">
        {rest.slice(0, 2).map(c => <Clip key={c.id} c={c} />)}
      </div>
    </div>
  );
}
