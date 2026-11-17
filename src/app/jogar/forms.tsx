'use client';

import { useActionState } from 'react';
import { createRoomAction, goToRoomAction, trainAction } from '@/app/sala/actions';

export function TrainButton({ className = 'btn-secondary w-full' }: { className?: string }) {
  const [state, action, pending] = useActionState(trainAction, {});
  return (
    <form action={action} className="space-y-2">
      <button className={className} disabled={pending}>{pending ? 'Montando a sala…' : 'Treinar contra bots'}</button>
      <ErrorText error={state.error} />
    </form>
  );
}

function ErrorText({ error }: { error?: string }) {
  if (!error) return null;
  return <p role="alert" className="alert-error">{error}</p>;
}

export function CreateRoomForm() {
  const [state, action, pending] = useActionState(createRoomAction, {});
  return (
    <form action={action} className="space-y-2">
      <ErrorText error={state.error} />
      <button className="ar-btn" disabled={pending}>{pending ? 'Criando a sala…' : 'Criar sala'}</button>
    </form>
  );
}

export function JoinRoomForm() {
  const [state, action, pending] = useActionState(goToRoomAction, {});
  return (
    <form action={action} className="space-y-2">
      <div className="ar-code">
        <input
          name="code" required maxLength={6} autoComplete="off" placeholder="A1B2C3" aria-label="Código da sala"
          className="font-mono uppercase"
        />
        <button className="ar-btn" disabled={pending}>Entrar</button>
      </div>
      <ErrorText error={state.error} />
    </form>
  );
}
