import type { Profile } from '@/lib/supabase/server';

const STAT_PLACEHOLDERS = [
  { k: 'Elo', v: 'Sem classificação', s: 'MD10 libera com o modo Ranked' },
  { k: 'Partidas', v: '0', s: 'Vitórias 0 · Derrotas 0' },
  { k: 'Taxa de vitória', v: '–', s: 'Aparece após a 1ª partida' },
  { k: 'Melhor elo', v: '–', s: 'Temporada 1' },
];

export function ProfileView({ profile, isOwner }: { profile: Profile; isOwner: boolean }) {
  const since = new Date(profile.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  return (
    <div className="mt-8 space-y-6">
      <section className="panel flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border border-gold/50 bg-panel2 text-3xl font-extrabold text-gold">
          {profile.username.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{isOwner ? 'Seu perfil' : 'Perfil do jogador'}</p>
          <h1 className="truncate text-3xl font-bold text-gold2">
            {profile.username}<span className="ml-1 text-xl font-normal text-muted">#{profile.tag}</span>
          </h1>
          <p className="mt-1 text-sm text-muted">Nível {profile.level} · na plataforma desde {since}</p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STAT_PLACEHOLDERS.map(st => (
          <div key={st.k} className="panel p-4">
            <p className="text-xs uppercase tracking-widest text-muted">{st.k}</p>
            <p className="mt-1 text-xl font-bold text-gold2">{st.v}</p>
            <p className="text-xs text-muted">{st.s}</p>
          </div>
        ))}
      </section>

      <section className="panel p-6">
        <h2 className="eyebrow">Histórico de partidas</h2>
        <p className="mt-3 text-sm text-muted">
          Nenhuma partida ainda. Os drafts concluídos vão aparecer aqui com times, lances e resultado.
        </p>
      </section>
    </div>
  );
}
