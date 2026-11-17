'use client';

import { useEffect } from 'react';

/** Se a tela da sala quebrar, mostra uma saída em vez de tela branca e registra o erro no servidor. */
export default function SalaError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    void fetch('/api/erro-cliente', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ where: location.pathname, message: error.message, stack: error.stack?.slice(0, 2000), digest: error.digest, ua: navigator.userAgent }),
    }).catch(() => {});
  }, [error]);
  return (
    <div className="panel mx-auto mt-16 max-w-md p-8 text-center">
      <h1 className="text-2xl font-bold text-gold2">Ops, a tela da sala travou</h1>
      <p className="mt-2 text-muted">O leilão continua rodando no servidor. Recarregue para voltar.</p>
      <div className="mt-6 flex justify-center gap-2">
        <button className="btn-primary" onClick={() => window.location.reload()}>Recarregar</button>
        <button className="btn-secondary" onClick={reset}>Tentar de novo</button>
      </div>
    </div>
  );
}
