'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { sendFeedbackAction } from './actions';
import { pingNotifications } from '@/components/header/NotificationBell';

const KINDS = [
  { v: 'sugestao', l: 'Sugestão', d: 'Uma ideia para o site' },
  { v: 'bug', l: 'Erro', d: 'Algo quebrou ou ficou estranho' },
  { v: 'elogio', l: 'Elogio', d: 'Algo que você curtiu' },
  { v: 'outro', l: 'Outro', d: 'Qualquer outra coisa' },
];

export function FeedbackForm() {
  const [state, action, pending] = useActionState(sendFeedbackAction, {});
  const [kind, setKind] = useState('sugestao');
  const [len, setLen] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) { form.current?.reset(); setLen(0); pingNotifications(); }
  }, [state]);

  return (
    <form ref={form} action={action} className="fb-form">
      <fieldset className="fb-kinds">
        <legend className="sr-only">Tipo</legend>
        {KINDS.map(k => (
          <label key={k.v} className={kind === k.v ? 'on' : ''}>
            <input type="radio" name="kind" value={k.v} checked={kind === k.v} onChange={() => setKind(k.v)} />
            <b>{k.l}</b><small>{k.d}</small>
          </label>
        ))}
      </fieldset>
      <label className="fb-text">
        <span className="sr-only">Mensagem</span>
        <textarea
          name="body" required minLength={3} maxLength={2000} rows={6} onChange={e => setLen(e.target.value.length)}
          placeholder={kind === 'bug' ? 'O que aconteceu? Em qual tela? Estava no celular ou no computador?' : 'Conta pra gente…'}
        />
        <span className="fb-count">{len}/2000</span>
      </label>
      {state.error && <p role="alert" className="alert-error">{state.error}</p>}
      {state.ok && <p className="fb-ok">Enviado! Obrigado por ajudar a melhorar o 100 pro Draft.</p>}
      <button className="ar-btn" disabled={pending}>{pending ? 'Enviando…' : 'Enviar feedback'}</button>
    </form>
  );
}
