'use client';

import { useEffect } from 'react';

/** Envia ao servidor erros de JavaScript que não passam por nenhum error.tsx (diagnóstico). */
export function ErrorReporter() {
  useEffect(() => {
    const send = (kind: string, message: string, stack?: string) => {
      void fetch('/api/erro-cliente', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ where: `${kind} ${location.pathname}`, message, stack: stack?.slice(0, 2000), ua: navigator.userAgent }),
        keepalive: true,
      }).catch(() => {});
    };
    const onErr = (e: ErrorEvent) => send('window.error', e.message, e.error?.stack);
    const onRej = (e: PromiseRejectionEvent) => send('unhandledrejection', String(e.reason?.message ?? e.reason), e.reason?.stack);
    // Diagnóstico da tela branca: se a página da sala ficar sem conteúdo, avisa.
    const check = setTimeout(() => {
      const main = document.querySelector('main');
      if (location.pathname.startsWith('/sala/') && main && main.children.length === 0) {
        send('main-vazio', `main sem filhos; html=${main.innerHTML.length}; body=${document.body.innerHTML.length}; scripts=${document.scripts.length}`);
      }
    }, 4000);
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);
    return () => { clearTimeout(check); window.removeEventListener('error', onErr); window.removeEventListener('unhandledrejection', onRej); };
  }, []);
  return null;
}
