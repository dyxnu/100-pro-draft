import { describe, expect, it } from 'vitest';
import { CHAT_MAX, cleanBody, isKudosKind, isMissingSchema, parseChannel } from './shared';

describe('chat', () => {
  it('aceita só o canal global e salas com uuid', () => {
    expect(parseChannel('global')).toEqual({ roomId: null });
    expect(parseChannel('sala:0b6f1c1e-2a3b-4c5d-8e9f-0123456789ab')).toEqual({ roomId: '0b6f1c1e-2a3b-4c5d-8e9f-0123456789ab' });
    expect(parseChannel('sala:ABC')).toBeUndefined();
    expect(parseChannel('sala:')).toBeUndefined();
    expect(parseChannel('privado')).toBeUndefined();
  });

  it('limpa espaços e corta em 200 caracteres', () => {
    expect(cleanBody('  oi \n\n  tudo  bem? ')).toBe('oi tudo bem?');
    expect(cleanBody('a'.repeat(500))).toHaveLength(CHAT_MAX);
    expect(cleanBody('   ')).toBe('');
  });

  it('valida o tipo de elogio', () => {
    expect(isKudosKind('leiloeiro')).toBe(true);
    expect(isKudosKind('toxico')).toBe(false);
    expect(isKudosKind(3)).toBe(false);
  });

  it('reconhece banco sem a migração 0006', () => {
    expect(isMissingSchema({ code: '42P01' })).toBe(true);
    expect(isMissingSchema({ code: 'PGRST205', message: "Could not find the table 'public.kudos' in the schema cache" })).toBe(true);
    expect(isMissingSchema({ code: '23505' })).toBe(false);
    expect(isMissingSchema(null)).toBe(false);
  });
});
