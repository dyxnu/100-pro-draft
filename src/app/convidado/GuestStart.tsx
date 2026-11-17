'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { guestSignInAction } from './actions';

/** Entra como convidado assim que a página abre; se der erro, mostra o motivo e um botão. */
export function GuestStart({ next }: { next: string }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const tried = useRef(false);

  const go = () => start(async () => {
    setError(undefined);
    const r = await guestSignInAction(next); // em caso de sucesso, redireciona
    if (r?.error) setError(r.error);
  });

  useEffect(() => {
    if (tried.current) return;
    tried.current = true;
    go();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="panel mx-auto mt-16 max-w-md p-8 text-center">
      <h1 className="text-2xl font-bold text-gold2">Jogar como convidado</h1>
      {error ? (
        <>
          <p role="alert" className="alert-error mt-4">{error}</p>
          <button className="btn-primary mt-6" disabled={pending} onClick={go}>{pending ? 'Entrando…' : 'Tentar de novo'}</button>
        </>
      ) : (
        <p className="mt-3 text-muted">{pending ? 'Preparando sua conta de convidado…' : 'Entrando…'}</p>
      )}
      <p className="mt-6 text-sm text-muted">
        Convidados podem criar salas, entrar e treinar, mas não ganham elo, essência azul nem histórico.
      </p>
      <p className="mt-3 text-sm">
        <Link href="/cadastro" className="text-gold hover:underline">Criar conta</Link>
        {' · '}
        <Link href="/entrar" className="text-gold hover:underline">Já tenho conta</Link>
      </p>
    </div>
  );
}
