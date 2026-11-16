'use client';

import { useActionState } from 'react';
import type { FormState } from '@/app/auth/actions';

export interface Field {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  defaultValue?: string;
  hint?: string;
}

export function AuthForm({
  action, fields, submitLabel, hidden,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  fields: Field[];
  submitLabel: string;
  hidden?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4">
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {fields.map(f => (
        <label key={f.name} className="block">
          <span className="label">{f.label}</span>
          <input
            className="input"
            name={f.name}
            type={f.type ?? 'text'}
            autoComplete={f.autoComplete}
            placeholder={f.placeholder}
            defaultValue={f.defaultValue}
            required
          />
          {f.hint && <span className="mt-1 block text-xs text-muted">{f.hint}</span>}
        </label>
      ))}
      {state.error && (
        <p role="alert" className="alert-error">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="rounded-lg border border-teal/50 bg-teal/10 px-3 py-2 text-sm text-teal">
          {state.message}
        </p>
      )}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? 'Aguarde…' : submitLabel}
      </button>
    </form>
  );
}
