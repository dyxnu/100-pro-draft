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
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="label">Velocidade</span>
        <select name="speed" className="input" defaultValue="normal">
          <option value="normal">Normal: 10 s por lance</option>
          <option value="rapido">Rápida: 5 s por lance</option>
        </select>
      </label>
      <ErrorText error={state.error} />
      <button className="btn-primary w-full" disabled={pending}>{pending ? 'Criando…' : 'Criar sala'}</button>
    </form>
  );
}

export function JoinRoomForm() {
  const [state, action, pending] = useActionState(goToRoomAction, {});
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="label">Código da sala</span>
        <input
          name="code" required maxLength={6} autoComplete="off" placeholder="A1B2C3"
          className="input font-mono text-lg uppercase tracking-[0.3em]"
        />
      </label>
      <ErrorText error={state.error} />
      <button className="btn-secondary w-full" disabled={pending}>Entrar</button>
    </form>
  );
}
