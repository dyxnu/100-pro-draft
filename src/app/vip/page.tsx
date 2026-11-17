import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { SITE_URL } from '@/lib/supabase/env';
import { VIP_DAYS_PER_REFERRAL } from '@/lib/progress/rewards';
import { canClaimBeta, daysLeft } from '@/lib/store/rules';
import { loadReferralStats, loadStoreSession } from '@/lib/store/service';
import { BetaBanner } from '../loja/BetaBanner';
import { InviteCard } from './InviteCard';
import { REFERRAL_MILESTONES } from '@/lib/store/catalog';
import '../loja/store.css';
import './vip.css';

export const metadata: Metadata = { title: 'VIP', description: 'Convide amigos e ganhe dias de VIP no 100 pro Draft.' };

async function siteOrigin(): Promise<string> {
  // Preferir o endereço oficial configurado; cair para o host do pedido em desenvolvimento/preview.
  if (process.env.NEXT_PUBLIC_SITE_URL && !/localhost|127\.0\.0\.1/.test(SITE_URL)) return SITE_URL.replace(/\/$/, '');
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host');
    if (host) {
      const proto = h.get('x-forwarded-proto') ?? (/^(localhost|127\.|\[::1\])/.test(host) ? 'http' : 'https');
      return `${proto.split(',')[0]}://${host}`;
    }
  } catch { /* sem cabeçalhos: usa a variável */ }
  return SITE_URL.replace(/\/$/, '');
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });

export default async function VipPage() {
  const s = await loadStoreSession();
  const p = s.profile;
  const member = !!s.userId && !p?.is_guest;
  const stats = member && s.ready ? await loadReferralStats(s.userId!) : { played: 0, signedUp: 0 };
  const code = s.ready ? p?.referral_code : null;
  const invite = code ? `${await siteOrigin()}/convite/${code}` : null;
  const left = daysLeft(p?.vip_until);

  return (
    <div className="flex flex-col gap-6 pt-6">
      <section className="st-vip-hero">
        <p className="st-hero-eyebrow">Programa de convites</p>
        <h1 className="mt-1 text-3xl font-black sm:text-4xl">Seja <span className="st-title st-title-vip text-3xl sm:text-4xl">VIP</span> trazendo amigos</h1>
        <p className="mt-2 max-w-2xl text-[#e8e4ff]">
          Cada amigo que cria conta pelo seu link e termina um campeonato dá <b>+{VIP_DAYS_PER_REFERRAL} dias de VIP</b>.
          Os dias se somam. Tudo é cosmético: VIP nunca dá vantagem no leilão nem nas partidas.
        </p>
        {s.vip && p?.vip_until && (
          <p className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-bold">
            ★ Você é VIP até {fmtDate(p.vip_until)} ({left} {left === 1 ? 'dia' : 'dias'})
          </p>
        )}
      </section>

      {s.ready && canClaimBeta(p) && <BetaBanner />}

      <section className="flex flex-col gap-4">
        {!s.userId && (
          <p className="text-sm text-muted"><Link href="/entrar?next=/vip" className="font-bold text-accent underline">Entre</Link> ou <Link href="/cadastro" className="font-bold text-accent underline">crie sua conta</Link> para ganhar seu link.</p>
        )}
        {s.userId && p?.is_guest && (
          <p className="text-sm text-muted">Convidados não têm link de convite. <Link href="/cadastro" className="font-bold text-accent underline">Crie sua conta grátis</Link> para participar.</p>
        )}
        {member && !invite && (
          <p className="text-sm text-muted">Seu link aparece aqui em breve (estamos preparando o programa de convites).</p>
        )}
        {member && invite && (
          <InviteCard
            url={invite} played={stats.played} signedUp={stats.signedUp} vipDays={VIP_DAYS_PER_REFERRAL}
            milestones={REFERRAL_MILESTONES.map(m => ({ friends: m.friends, label: m.label, done: stats.played >= m.friends }))}
          />
        )}
      </section>

      <section className="st-plans">
        <div className="st-plan">
          <div>
            <p className="eyebrow">Grátis</p>
            <h3 className="text-2xl font-black text-gold2">Invocador</h3>
          </div>
          <ul>
            <li>Leilão, campeonato, ranqueada e chat completos</li>
            <li>Essência Azul a cada campeonato</li>
            <li>Loja com skins, ícones, bordas, temas e títulos</li>
            <li className="no">Bônus de essência</li>
            <li className="no">Itens exclusivos VIP</li>
          </ul>
        </div>
        <div className="st-plan st-plan-vip">
          <span className="st-plan-tag" style={{ background: 'linear-gradient(180deg,#ffe7a0,#d9a83c)', color: '#3b2a05' }}>Por convite</span>
          <div>
            <p className="eyebrow">VIP</p>
            <h3 className="text-2xl font-black text-gold2">VIP</h3>
          </div>
          <ul>
            <li>Tudo do plano grátis</li>
            <li><b>+25% de Essência Azul</b> por campeonato</li>
            <li>Borda VIP animada</li>
            <li>Nome colorido no chat</li>
            <li>Emblema VIP no perfil</li>
          </ul>
          <p className="text-xs text-muted">Os itens VIP ficam ativos enquanto o VIP durar. Nada disso muda o leilão ou as partidas.</p>
        </div>
        <div className="st-plan st-plan-soon">
          <span className="st-plan-tag" style={{ background: 'var(--color-gold2)', color: '#f6e9c0' }}>Em breve</span>
          <div>
            <p className="eyebrow">Assinatura</p>
            <h3 className="text-2xl font-black text-gold2">Apoiar com assinatura</h3>
          </div>
          <p className="text-sm text-muted">Quer ajudar a manter o servidor no ar? Em breve vai dar para apoiar o projeto com uma assinatura: os mesmos benefícios do VIP e o título exclusivo de quem apoia.</p>
          <button className="btn-secondary mt-auto" disabled>Em breve</button>
        </div>
      </section>
    </div>
  );
}
