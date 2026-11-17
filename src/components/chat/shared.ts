// Tipos e regras do chat e dos elogios, usados no servidor (ações) e no navegador (componentes).

export const CHAT_MAX = 200;
export const CHAT_HISTORY = 50;
export const CHAT_COOLDOWN_MS = 1000;

export interface ChatMessage {
  id: number;
  channel: string;
  user_id: string;
  username: string;
  title_id: string | null;
  is_vip: boolean;
  body: string;
  created_at: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 'global' ou 'sala:<uuid>'. Devolve o id da sala (ou null para o global); undefined se inválido. */
export function parseChannel(channel: string): { roomId: string | null } | undefined {
  if (channel === 'global') return { roomId: null };
  const m = /^sala:(.+)$/.exec(channel);
  if (m && UUID.test(m[1])) return { roomId: m[1] };
  return undefined;
}

export const roomChannel = (roomId: string) => `sala:${roomId}`;

/** Espaços colapsados, sem caracteres de controle, no máximo 200 caracteres. */
export function cleanBody(raw: string): string {
  return Array.from(
    String(raw ?? '')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  ).slice(0, CHAT_MAX).join('').trim();
}

export const KUDOS_KINDS = ['esportivo', 'estrategista', 'leiloeiro', 'gente_boa'] as const;
export type KudosKind = (typeof KUDOS_KINDS)[number];
export const KUDOS_INFO: Record<KudosKind, { label: string; icon: string; hint: string }> = {
  esportivo: { label: 'Esportivo', icon: '🤝', hint: 'Jogou limpo, ganhando ou perdendo' },
  estrategista: { label: 'Estrategista', icon: '🧠', hint: 'Montou e escalou o time com cabeça' },
  leiloeiro: { label: 'Rei do leilão', icon: '🔨', hint: 'Deu os melhores lances' },
  gente_boa: { label: 'Gente boa', icon: '😊', hint: 'Deixou a sala mais divertida' },
};
export const isKudosKind = (k: unknown): k is KudosKind => typeof k === 'string' && (KUDOS_KINDS as readonly string[]).includes(k);

/** Erro do PostgREST/Postgres que indica tabela/coluna ainda não criada (migração 0006 não rodou). */
export function isMissingSchema(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error.code ?? '')
    || /does not exist|schema cache/i.test(error.message ?? '');
}

export const MISSING_SOCIAL = 'O chat e os elogios ficam disponíveis assim que o banco for atualizado (migração 0006).';
