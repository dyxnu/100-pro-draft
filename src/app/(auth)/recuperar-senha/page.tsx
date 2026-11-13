import Link from 'next/link';
import type { Metadata } from 'next';
import { AuthCard } from '@/components/AuthCard';
import { AuthForm } from '@/components/AuthForm';
import { requestPasswordReset } from '@/app/auth/actions';

export const metadata: Metadata = { title: 'Recuperar senha' };

export default function RecuperarSenhaPage() {
  return (
    <AuthCard
      title="Recuperar senha"
      subtitle="Enviaremos um link para você criar uma nova senha."
      footer={<Link href="/entrar" className="text-gold hover:underline">Voltar para o login</Link>}
    >
      <AuthForm
        action={requestPasswordReset}
        submitLabel="Enviar link"
        fields={[{ name: 'email', label: 'E-mail', type: 'email', autoComplete: 'email' }]}
      />
    </AuthCard>
  );
}
