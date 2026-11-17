import type { CSSProperties } from 'react';
import { DD_VERSION } from '@/lib/profile/avatars';
import { PixelChamp } from './PixelChamp';
import { COIN, COIN_PAL, MOON, MOON_PAL, PixelArt, TOWER } from './PixelArt';

const PRICES = [12, 7, 23, 31, 4, 18, 9, 27, 15, 5, 21, 11];

/** Cena 8-bit: campeões pixelados marchando pela rota, com lances pipocando sobre a cabeça. */
export function PixelLane({ ids }: { ids: { id: string; name: string }[] }) {
  const blue = ids.slice(0, 6), red = ids.slice(6, 11);
  const BLUE_DUR = 24, RED_DUR = 28;

  return (
    <div className="hm-scene" role="img" aria-label="Campeões em pixel art caminhando pela rota">
      <div className="hm-scene-stars" />
      <PixelArt map={MOON} palette={MOON_PAL} size={54} className="hm-scene-moon" />
      <div className="hm-ground" />
      <div className="hm-river" />
      <div className="hm-path" />
      <PixelArt map={TOWER} palette={{ a: '#14173f', b: '#4c4fb5', c: '#9fd3ff' }} size={44} className="hm-tower l" />
      <PixelArt map={TOWER} palette={{ a: '#3a0f1c', b: '#c2414f', c: '#ffc2a8' }} size={44} className="hm-tower r" />

      {red.map((c, i) => (
        <div
          key={`r-${c.id}`} className="hm-walker rev"
          style={{ bottom: 'calc(22% + 36px)', '--dur': `${RED_DUR}s`, '--delay': `${-(i * RED_DUR) / red.length - 3}s`, '--still': `${62 + i * 7}cqw` } as CSSProperties}
        >
          <div className="hm-hop" style={{ '--hop': `${-i * 0.13}s` } as CSSProperties}>
            <PixelChamp version={DD_VERSION} id={c.id} res={16} size={48} outline="#3a0f1c" />
          </div>
          <div className="hm-shadow" />
        </div>
      ))}

      {blue.map((c, i) => (
        <div
          key={`b-${c.id}`} className="hm-walker"
          style={{ bottom: 'calc(22% - 2px)', '--dur': `${BLUE_DUR}s`, '--delay': `${-(i * BLUE_DUR) / blue.length}s`, '--still': `${4 + i * 8}cqw` } as CSSProperties}
        >
          <div className="relative hm-hop" style={{ '--hop': `${-i * 0.17}s` } as CSSProperties}>
            {i % 2 === 0 && <span className="hm-tag hm-pixelfont">R$ {PRICES[i % PRICES.length]}</span>}
            {i % 2 === 1 && (
              <span className="hm-coin absolute -top-3 left-1/2 -translate-x-1/2" style={{ '--delay': `${i * 0.6}s` } as CSSProperties}>
                <PixelArt map={COIN} palette={COIN_PAL} size={16} />
              </span>
            )}
            <PixelChamp version={DD_VERSION} id={c.id} name={c.name} res={18} size={66} />
          </div>
          <div className="hm-shadow" />
        </div>
      ))}

      <p className="hm-pixelfont absolute left-3 top-3 text-[9px] leading-relaxed text-[#f3d68a] sm:left-5 sm:top-5 sm:text-[11px]">
        RIFT DO LEILÃO
        <span className="block text-[#c9c3f5]">LANCE AGORA ▶</span>
      </p>
    </div>
  );
}
