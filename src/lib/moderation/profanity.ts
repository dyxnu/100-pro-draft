// Filtro de palavras ofensivas (nomes, chat, títulos). Normaliza acentos, leetspeak e repetições
// para pegar variações como "n1gg3r", "p0rr4", "f.d.p".

const BLOCKED = [
  // ofensas raciais / discriminatórias (pt/en)
  'nigger', 'nigga', 'negrinho', 'macaco', 'crioulo', 'tiziu', 'senzala', 'escravo',
  'viado', 'veado', 'bicha', 'traveco', 'sapatao', 'boiola', 'faggot', 'fag', 'retard', 'retardado',
  'mongol', 'aleijado', 'judeu', 'nazi', 'nazista', 'hitler', 'kkk', 'heil',
  // palavrões
  'porra', 'caralho', 'buceta', 'boceta', 'xoxota', 'piroca', 'pica', 'rola', 'cacete', 'merda', 'bosta',
  'puta', 'puto', 'putaria', 'vadia', 'vagabunda', 'arrombado', 'arrombada', 'cuzao', 'cuzinho', 'fdp',
  'filhodaputa', 'foder', 'fodase', 'foda', 'corno', 'piranha', 'otario', 'babaca', 'desgracado',
  'fuck', 'fucker', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'whore', 'slut', 'asshole',
  // sexual / violência
  'estupro', 'estuprador', 'pedofilo', 'pedo', 'rape', 'porn', 'porno', 'sexo', 'suicidio', 'kys',
];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i' };

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[0-9@$!]/g, c => LEET[c] ?? c)
    .replace(/[^a-z]/g, '')
    .replace(/(.)\1+/g, '$1'); // "poorrraaa" → "pora"
}

// Versões sem letras repetidas, para comparar com o texto normalizado.
const BLOCKED_NORM = BLOCKED.map(w => w.replace(/(.)\1+/g, '$1'));
// Palavras curtas só contam inteiras (evita bloquear "picanha", "rolamento", "fagner"...).
const SHORT = new Set(['pica', 'rola', 'puto', 'puta', 'fag', 'pedo', 'kys', 'kk', 'foda', 'cock', 'dick', 'sexo', 'judeu', 'mongol']);

/** true se o texto contém algo ofensivo. */
export function isOffensive(text: string): boolean {
  const words = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9@$!]+/).map(normalize).filter(Boolean);
  const joined = normalize(text);
  return BLOCKED_NORM.some(w => (SHORT.has(w) ? words.includes(w) : joined.includes(w) || words.includes(w)));
}

/** Troca palavras ofensivas por asteriscos (para o chat). */
export function censor(text: string): string {
  return text.split(/(\s+)/).map(tok => (isOffensive(tok) ? '*'.repeat(Math.min(tok.length, 8)) : tok)).join('');
}
