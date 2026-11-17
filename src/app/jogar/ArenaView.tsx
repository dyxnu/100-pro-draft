import type { Profile } from '@/lib/supabase/server';
import { asTier } from '@/components/profile/ownership';
import { rankLabel, TIER_COLOR } from '@/lib/progress/rank';
import { TierEmblem } from '@/components/home/TierEmblem';
import { CreateRoomForm, JoinRoomForm, TrainButton } from './forms';
import './arena.css';

const SPLASH = (id: string, n = 0) => `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${id}_${n}.jpg`;

/** Tela da Arena: criar sala, treinar contra bots ou entrar com código. */
export function ArenaView({ p }: { p: Profile | null | undefined }) {
  const tier = asTier(p?.rank_tier);
  const rank = { tier, division: p?.rank_division ?? null, lp: p?.lp ?? 0 };

  return (
    <div className="ar-root">
      <header className="ar-head">
        <div>
          <p className="ar-kicker">Arena</p>
          <h1>Escolha como jogar</h1>
        </div>
        {p && !p.is_guest && (
          <div className="ar-me" style={{ '--tc': tier ? TIER_COLOR[tier] : '#8b8fae' } as React.CSSProperties}>
            {tier ? <TierEmblem tier={tier} size={52} /> : <span className="ar-unranked">?</span>}
            <span>
              <b>{tier ? rankLabel(rank) : 'Sem elo ainda'}</b>
              <small>{tier ? 'Ranqueada' : 'Jogue uma ranqueada para receber seu elo'}</small>
            </span>
          </div>
        )}
      </header>

      <div className="ar-grid">
        <section className="ar-tile ar-create">
          <img className="ar-bg" src={SPLASH('Diana', 11)} alt="" draggable={false} />
          <div className="ar-tile-in">
            <p className="ar-tag">Com amigos</p>
            <h2>Criar sala</h2>
            <p className="ar-desc">Você vira o dono. No saguão você escolhe <b>casual ou ranqueada</b>, o ritmo dos lances e quantas pessoas jogam, e manda o convite.</p>
            <CreateRoomForm />
          </div>
        </section>

        <section className="ar-tile ar-train">
          <img className="ar-bg" src={SPLASH('Jinx', 1)} alt="" draggable={false} />
          <div className="ar-tile-in">
            <p className="ar-tag">Sozinho</p>
            <h2>Treinar contra bots</h2>
            <p className="ar-desc">Você contra 5 bots: leilão, escalação e campeonato completos, começando na hora.</p>
            <TrainButton className="ar-btn ar-btn-ghost" />
          </div>
        </section>

        <section id="codigo" className="ar-tile ar-join scroll-mt-24">
          <img className="ar-bg" src={SPLASH('Ahri', 1)} alt="" draggable={false} />
          <div className="ar-tile-in">
            <p className="ar-tag">Recebeu um convite?</p>
            <h2>Entrar com código</h2>
            <JoinRoomForm />
          </div>
        </section>
      </div>
    </div>
  );
}
