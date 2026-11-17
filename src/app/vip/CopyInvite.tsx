'use client';

import { useState } from 'react';

/** Campo com o link de convite e botão de copiar. */
export function CopyInvite({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.getElementById('st-invite-url') as HTMLInputElement | null;
      el?.select();
      document.execCommand?.('copy');
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="st-invite">
      <input id="st-invite-url" className="input" readOnly value={url} onFocus={e => e.currentTarget.select()} aria-label="Seu link de convite" />
      <button className="st-btn-gold" onClick={copy}>{copied ? 'Copiado!' : 'Copiar link'}</button>
    </div>
  );
}
