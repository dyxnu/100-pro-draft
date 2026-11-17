import Link from 'next/link';
import type { Metadata } from 'next';
import { AuthCard } from '@/components/AuthCard';
import { AuthForm } from '@/components/AuthForm';
import { signIn } from '@/app/auth/actions';

export const metadata: Metadata = { title: 'Entrar' };

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  const { next, erro } = await searchParams;
  return (
    <AuthCard
      title="Entrar"
      subtitle={erro === 'link' ? 'O link expirou ou é inválido. Entre ou peça um novo.' : 'Bem-vindo de volta, invocador.'}
      footer={<>Ainda não tem conta? <Link href={next ? `/cadastro?next=${encodeURIComponent(next)}` : '/cadastro'} className="text-gold hover:underline">Criar conta</Link></>}
    >
      <AuthForm
        action={signIn}
        submitLabel="Entrar"
        hidden={{ next: next ?? '/jogar' }}
        fields={[
          { name: 'email', label: 'E-mail', type: 'email', autoComplete: 'email' },
          { name: 'password', label: 'Senha', type: 'password', autoComplete: 'current-password' },
        ]}
      />
      <p className="mt-4 text-center text-sm">
        <Link href="/recuperar-senha" className="text-muted hover:text-text">Esqueci minha senha</Link>
      </p>
    </AuthCard>
  );
}
