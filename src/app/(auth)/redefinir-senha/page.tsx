import type { Metadata } from 'next';
import { AuthCard } from '@/components/AuthCard';
import { AuthForm } from '@/components/AuthForm';
import { updatePassword } from '@/app/auth/actions';

export const metadata: Metadata = { title: 'Nova senha' };

// Chega aqui pelo link do e-mail (/auth/confirm já abriu a sessão de recuperação).
export default function RedefinirSenhaPage() {
  return (
    <AuthCard title="Nova senha" subtitle="Escolha uma nova senha para sua conta.">
      <AuthForm
        action={updatePassword}
        submitLabel="Salvar nova senha"
        fields={[
          { name: 'password', label: 'Nova senha', type: 'password', autoComplete: 'new-password', hint: 'Mínimo de 8 caracteres' },
          { name: 'confirm', label: 'Confirmar senha', type: 'password', autoComplete: 'new-password' },
        ]}
      />
    </AuthCard>
  );
}
