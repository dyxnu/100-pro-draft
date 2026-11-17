'use client';

import { useState, useTransition } from 'react';
import { claimBetaAction } from './actions';
import { BETA_BONUS_BE } from '@/lib/progress/rewards';
import { EssenceAmount } from '@/components/header/EssenceIcon';

/** Banner do bônus de Alpha Tester com botão de resgate. */
export function BetaBanner({ onClaimed }: { onClaimed?: (balance: number) => void }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();

  const claim = () => start(async () => {
    setError(undefined);
    const r = await claimBetaAction();
    if (!r.ok) return setError(r.error);
    setDone(true);
    onClaimed?.(r.balance);
  });

  return (
    <section id="beta" className={`st-beta anim-fade-up ${done ? 'st-beta-done' : ''}`}>
      <div className="st-beta-glow" aria-hidden />
      <div className="relative min-w-0 flex-1">
        <p className="st-beta-eyebrow">Obrigado por testar desde o começo</p>
        <h2 className="text-2xl font-black sm:text-3xl">
          {done ? 'Bônus resgatado!' : <>Você é <span className="st-title-alpha">Alpha Tester</span>!</>}
        </h2>
        <p className="mt-1 text-sm text-[#e8e4ff]">
          {done
            ? 'Os itens já estão no seu inventário. Equipe o título e a borda no seu perfil.'
            : 'Seu presente: essência azul, o título brilhante "Alpha Tester", a borda Prata Lunar, o efeito Chuva de Confete e 1 troca de nome grátis.'}
        </p>
        {error && <p className="mt-2 rounded-lg bg-[#d23f5c]/25 px-3 py-1.5 text-sm font-bold text-white">{error}</p>}
      </div>
      <div className="relative flex shrink-0 flex-col items-center gap-2">
        <span className="rounded-full bg-white/90 px-3 py-1 text-[#174a9c]"><EssenceAmount value={BETA_BONUS_BE} size={18} /></span>
        {!done && (
          <button className="st-btn-gold" disabled={pending} onClick={claim}>{pending ? 'Resgatando…' : 'Resgatar'}</button>
        )}
      </div>
    </section>
  );
}
