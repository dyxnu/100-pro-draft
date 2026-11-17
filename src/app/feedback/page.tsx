import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/supabase/server';
import { FeedbackForm } from './FeedbackForm';
import '../jogar/arena.css';
import './feedback.css';

export const metadata: Metadata = { title: 'Feedback', description: 'Mande sugestões, erros e elogios para o 100 pro Draft.' };

export default async function FeedbackPage() {
  const session = await getCurrentUser();
  return (
    <div className="fb-root">
      <section className="fb-card">
        <img className="fb-bg" src="https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Bard_0.jpg" alt="" draggable={false} />
        <div className="fb-in">
          <p className="ar-kicker">Feedback</p>
          <h1>Ajude a melhorar o jogo</h1>
          <p className="fb-lead">O site está em beta e muda toda semana. Diga o que achou, o que falta ou o que deu errado: tudo é lido.</p>
          {session?.profile ? (
            <FeedbackForm />
          ) : (
            <div className="fb-login">
              <p>Entre para mandar feedback. Dá para entrar como convidado, sem cadastro.</p>
              <div className="flex flex-wrap gap-2">
                <Link href="/entrar?next=/feedback" className="ar-btn">Entrar</Link>
                <Link href="/convidado" className="ar-btn ar-btn-ghost">Jogar como convidado</Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
