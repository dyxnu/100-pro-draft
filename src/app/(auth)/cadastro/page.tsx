import Link from 'next/link';
import type { Metadata } from 'next';
import { AuthCard } from '@/components/AuthCard';
import { AuthForm } from '@/components/AuthForm';
import { signUp } from '@/app/auth/actions';

export const metadata: Metadata = { title: 'Criar conta' };

export default async function CadastroPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthCard
      title="Criar conta"
      subtitle="Sua conta guarda seu histórico, seu elo e suas conquistas."
      footer={<>Já tem conta? <Link href={next ? `/entrar?next=${encodeURIComponent(next)}` : '/entrar'} className="text-gold hover:underline">Entrar</Link></>}
    >
      <AuthForm
        action={signUp}
        submitLabel="Criar conta"
        hidden={{ next: next ?? '/jogar' }}
        fields={[
          { name: 'username', label: 'Nome de usuário', autoComplete: 'username', hint: '3 a 16 caracteres: letras, números e _' },
          { name: 'email', label: 'E-mail', type: 'email', autoComplete: 'email' },
          { name: 'password', label: 'Senha', type: 'password', autoComplete: 'new-password', hint: 'Mínimo de 8 caracteres' },
        ]}
      />
    </AuthCard>
  );
}
