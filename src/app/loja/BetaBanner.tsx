'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { claimBetaAction } from './actions';
import { BETA_BONUS_BE } from '@/lib/progress/rewards';
import { EssenceAmount } from '@/components/header/EssenceIcon';
import { pingNotifications } from '@/components/header/NotificationBell';

const REWARDS = [
  { k: 'be', t: `${BETA_BONUS_BE.toLocaleString('pt-BR')} de Essência Azul`, d: 'Gaste na loja como quiser' },
  { k: 'title', t: 'Título Alpha Tester', d: 'Brilha embaixo do seu nome' },
  { k: 'border', t: 'Borda Prata Lunar', d: 'Moldura do seu ícone' },
  { k: 'fx', t: 'Efeito Chuva de Confete', d: 'Toca quando você é campeão' },
  { k: 'rename', t: '1 troca de nome grátis', d: 'Use no seu perfil' },
];

/** Janela de comemoração com tudo o que o bônus deu. */
function Rewards({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="st-modal" role="dialog" aria-modal="true" aria-label="Recompensas recebidas" onClick={onClose}>
      <div className="st-reward" onClick={e => e.stopPropagation()}>
        <div className="st-reward-rays" aria-hidden />
        <p className="st-beta-eyebrow">Recompensas recebidas</p>
        <h2><span className="st-title-alpha">Alpha Tester</span></h2>
        <ul>
          {REWARDS.map((r, i) => (
            <li key={r.k} style={{ animationDelay: `${0.15 + i * 0.12}s` }}>
              <span className={`st-reward-ic st-reward-${r.k}`} aria-hidden />
              <span><b>{r.t}</b><small>{r.d}</small></span>
            </li>
          ))}
        </ul>
        <div className="st-reward-actions">
          <Link href="/perfil" className="st-btn-gold">Equipar no perfil</Link>
          <button className="st-reward-close" onClick={onClose}>Continuar na loja</button>
        </div>
      </div>
    </div>
  );
}

/** Banner do bônus de Alpha Tester com botão de resgate. */
export function BetaBanner({ onClaimed }: { onClaimed?: (balance: number) => void }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string>();

  const claim = () => start(async () => {
    setError(undefined);
    const r = await claimBetaAction();
    if (!r.ok) return setError(r.error);
    setDone(true);
    setShow(true);
    onClaimed?.(r.balance);
    pingNotifications();
  });

  return (
    <>
      <section id="beta" className={`st-beta anim-fade-up ${done ? 'st-beta-done' : ''}`}>
        <div className="st-beta-glow" aria-hidden />
        <div className="relative min-w-0 flex-1">
          <p className="st-beta-eyebrow">Obrigado por testar desde o começo</p>
          <h2 className="text-2xl font-black sm:text-3xl">
            {done ? 'Bônus resgatado!' : <>Você é <span className="st-title-alpha">Alpha Tester</span>!</>}
          </h2>
          <p className="mt-1 text-sm text-[#e8e4ff]">
            {done
              ? 'Tudo já está na sua conta. Equipe o título, a borda e o efeito no seu perfil.'
              : 'Seu presente: essência azul, o título brilhante "Alpha Tester", a borda Prata Lunar, o efeito Chuva de Confete e 1 troca de nome grátis.'}
          </p>
          {error && <p className="mt-2 rounded-lg bg-[#d23f5c]/25 px-3 py-1.5 text-sm font-bold text-white">{error}</p>}
        </div>
        <div className="relative flex shrink-0 flex-col items-center gap-2">
          <span className="rounded-full bg-white/90 px-3 py-1 text-[#174a9c]"><EssenceAmount value={BETA_BONUS_BE} size={18} /></span>
          {done
            ? <Link href="/perfil" className="st-btn-gold">Ir para o perfil</Link>
            : <button className="st-btn-gold" disabled={pending} onClick={claim}>{pending ? 'Resgatando…' : 'Resgatar'}</button>}
        </div>
      </section>
      {show && <Rewards onClose={() => setShow(false)} />}
    </>
  );
}
