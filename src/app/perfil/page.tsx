import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase/server';
import { ProfileView } from '@/components/ProfileView';
import { AuthForm } from '@/components/AuthForm';
import { updateUsername } from '@/app/auth/actions';

export const metadata: Metadata = { title: 'Meu perfil' };

export default async function PerfilPage() {
  const session = await getCurrentUser();
  if (!session) redirect('/entrar?next=/perfil');
  const { profile } = session;
  if (!profile) {
    return <p className="mt-10 text-muted">Seu perfil ainda está sendo criado. Recarregue a página em instantes.</p>;
  }

  return (
    <>
      <ProfileView profile={profile} isOwner />
      <section className="panel mt-6 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="eyebrow">Configurações da conta</h2>
          <Link href={`/jogador/${profile.username}`} className="text-sm text-gold hover:underline">Ver perfil público</Link>
        </div>
        <div className="mt-4 max-w-sm">
          <AuthForm
            action={updateUsername}
            submitLabel="Salvar nome"
            fields={[{ name: 'username', label: 'Nome de usuário', defaultValue: profile.username, autoComplete: 'username' }]}
          />
        </div>
      </section>
    </>
  );
}
