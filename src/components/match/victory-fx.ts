// Efeitos da tela de vitória (valores de `profiles.victory_fx`). Módulo comum: serve no servidor e no navegador.
export const VICTORY_FX = [
  'victory:confete', 'victory:estrelas', 'victory:moonfall', 'victory:fogos', 'victory:aurora', 'victory:brasas',
] as const;
export type VictoryFx = (typeof VICTORY_FX)[number];
export const isVictoryFx = (v: unknown): v is VictoryFx => typeof v === 'string' && (VICTORY_FX as readonly string[]).includes(v);
