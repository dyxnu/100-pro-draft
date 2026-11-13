import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/supabase/server';
import { CreateRoomForm, JoinRoomForm, TrainButton } from './forms';

export const metadata: Metadata = { title: 'Jogar' };

export default async function JogarPage() {
  const session = await getCurrentUser();
  if (!session) redirect('/entrar?next=/jogar');

  return (
    <div className="mt-10">
      <p className="eyebrow">Jogar com amigos</p>
      <h1 className="mt-1 text-3xl font-bold text-gold2">Monte sua sala</h1>
      <p className="mt-2 max-w-xl text-muted">
        Crie uma sala e mande o link para até 5 amigos. As vagas que sobrarem podem ser preenchidas com bots.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <section className="panel p-6">
          <h2 className="text-lg font-bold text-gold2">Criar sala</h2>
          <p className="mt-1 text-sm text-muted">Você vira o dono da sala e decide quando começar.</p>
          <div className="mt-5"><CreateRoomForm /></div>
        </section>
        <section className="panel p-6 md:col-span-2">
          <h2 className="text-lg font-bold text-gold2">Treinar contra bots</h2>
          <p className="mt-1 text-sm text-muted">Você contra 5 bots: leilão, escalação e campeonato completos, começando na hora.</p>
          <div className="mt-4 max-w-xs"><TrainButton className="btn-primary w-full" /></div>
        </section>
        <section className="panel p-6">
          <h2 className="text-lg font-bold text-gold2">Entrar com código</h2>
          <p className="mt-1 text-sm text-muted">Recebeu um código de 6 caracteres? Cole aqui.</p>
          <div className="mt-5"><JoinRoomForm /></div>
        </section>
      </div>
    </div>
  );
}
