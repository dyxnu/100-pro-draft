'use client';

import { useState } from 'react';

export interface Milestone { friends: number; label: string; done: boolean }

/** Painel de recrutamento: link, botões de copiar/compartilhar e a trilha de metas. */
export function InviteCard({ url, played, signedUp, vipDays, milestones }: {
  url: string; played: number; signedUp: number; vipDays: number; milestones: Milestone[];
}) {
  const [copied, setCopied] = useState(false);
  const text = `Bora jogar 100 pro Draft comigo? Leilão de campeões do LoL com R$ 100 fictícios: ${url}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); } catch {
      const el = document.getElementById('vp-url') as HTMLInputElement | null;
      el?.select(); document.execCommand?.('copy');
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: '100 pro Draft', text, url }); return; } catch { /* cancelado */ }
    }
    void copy();
  };
  const last = milestones[milestones.length - 1]?.friends ?? 10;
  const pct = Math.min(100, (played / last) * 100);

  return (
    <div className="vp-card">
      <img className="vp-bg" src="https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Diana_25.jpg" alt="" draggable={false} />
      <div className="vp-in">
        <p className="vp-kicker">Recrute amigos</p>
        <h2>Cada amigo vale <b>+{vipDays} dias de VIP</b></h2>
        <p className="vp-lead">Seu amigo cria a conta pelo link e termina um campeonato. Pronto: os dias caem na sua conta e você recebe um aviso no sininho.</p>

        <div className="vp-link">
          <input id="vp-url" readOnly value={url} onFocus={e => e.currentTarget.select()} aria-label="Seu link de convite" />
          <button type="button" className="vp-btn" onClick={copy}>{copied ? 'Copiado!' : 'Copiar'}</button>
        </div>
        <div className="vp-share">
          <a className="vp-chip wa" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <button type="button" className="vp-chip" onClick={share}>Compartilhar</button>
        </div>

        <div className="vp-track" aria-label={`${played} amigos jogaram`}>
          <div className="vp-bar"><b style={{ width: `${pct}%` }} /></div>
          <ol>
            {milestones.map(m => (
              <li key={m.friends} className={m.done ? 'done' : ''} style={{ left: `${(m.friends / last) * 100}%` }}>
                <span className="vp-node">{m.friends}</span>
                <small>{m.label}</small>
              </li>
            ))}
          </ol>
        </div>

        <dl className="vp-stats">
          <div><dt>Criaram conta</dt><dd>{signedUp}</dd></div>
          <div><dt>Já jogaram</dt><dd>{played}</dd></div>
          <div><dt>Dias ganhos</dt><dd>+{played * vipDays}</dd></div>
        </dl>
      </div>
    </div>
  );
}
