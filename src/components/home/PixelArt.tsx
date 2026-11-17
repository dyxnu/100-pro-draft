/** Desenho em pixel art a partir de um mapa de caracteres ('.' = vazio). Vira SVG nítido em qualquer tamanho. */
export function PixelArt({
  map, palette, size, className = '', label,
}: { map: string[]; palette: Record<string, string>; size: number; className?: string; label?: string }) {
  const h = map.length, w = Math.max(...map.map(r => r.length));
  const rects: React.ReactNode[] = [];
  map.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let run = 1;
      while (x + run < row.length && row[x + run] === ch) run++;
      if (ch !== '.' && palette[ch]) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={run} height={1} fill={palette[ch]} />);
      x += run;
    }
  });
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`} width={size} height={(size * h) / w} shapeRendering="crispEdges" className={className}
      role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
    >
      {rects}
    </svg>
  );
}

export const MOON = [
  '....aaaa....',
  '..aabbbbaa..',
  '.abbbba.....',
  '.abbba......',
  'abbba.......',
  'abbba.......',
  'abbba.......',
  'abbbba......',
  '.abbbbba....',
  '.aabbbbbaa..',
  '..aabbbbbaa.',
  '....aaaa....',
];
export const MOON_PAL = { a: '#b48a2f', b: '#e8e5ff' };

export const TOWER = [
  '..a.a.a.a..',
  '..aaaaaaa..',
  '...abbba...',
  '...abcba...',
  '...abbba...',
  '...abbba...',
  '..aabbbaa..',
  '..abbbbba..',
  '..abbcbba..',
  '..abbbbba..',
  '.aabbbbbaa.',
  '.abbbbbbba.',
  'aaaaaaaaaaa',
];

export const TROPHY = [
  'aaaaaaaaaa',
  'abbbbbbbba',
  'abbbcbbbba',
  'aabbcbbbaa',
  '.abbbbbba.',
  '..abbbba..',
  '...abba...',
  '....aa....',
  '....aa....',
  '..aaaaaa..',
  '..abbbba..',
  '.aaaaaaaa.',
];
export const TROPHY_PAL = { a: '#7a5c1c', b: '#f3d68a', c: '#ffffff' };

export const COIN = [
  '..aaaa..',
  '.abbbba.',
  'abbcbbba',
  'abcbbbba',
  'abbbbbba',
  'abbbbbba',
  '.abbbba.',
  '..aaaa..',
];
export const COIN_PAL = { a: '#8a6a22', b: '#f3d68a', c: '#ffffff' };
