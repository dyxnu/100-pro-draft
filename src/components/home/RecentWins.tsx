import Link from 'next/link';
import type { RecentWin } from './recent';
import { playerIconUrl } from './ranking-shared';
import { DD_VERSION } from '@/lib/profile/avatars';

const ORDER = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPORTE'];

function ago(iso: string, now: number) {
  const m = Math.max(1, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} dia${d > 1 ? 's' : ''}`;
}

/** Mural dos últimos campeões: quem levou a taça e com qual time. */
export function RecentWins({ wins, now }: { wins: RecentWin[]; now: number }) {
  if (wins.length === 0) {
    return (
      <div className="hm-wins-empty">
        <p>Nenhum campeonato terminou ainda.</p>
        <span>O primeiro a levantar a taça aparece aqui.</span>
      </div>
    );
  }
  return (
    <ul className="hm-wins">
      {wins.map(w => {
        const team = [...w.team].sort((a, b) => ORDER.indexOf(a.role) - ORDER.indexOf(b.role));
        const carry = team.reduce<(typeof team)[number] | undefined>((a, b) => (!a || (b.price ?? 0) > (a.price ?? 0) ? b : a), undefined);
        return (
          <li key={w.id} className="hm-win">
            {carry && (
              <img className="hm-win-bg" alt="" draggable={false} loading="lazy"
                src={`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${carry.champId}_${carry.skin ?? 0}.jpg`} />
            )}
            <div className="hm-win-in">
              <Link href={`/jogador/${encodeURIComponent(w.username)}`} className="hm-win-who">
                <img src={playerIconUrl(w.avatar)} alt="" width={36} height={36} draggable={false} />
                <span>
                  <b>{w.username}</b>
                  <small>{w.mode === 'ranked' ? 'Ranqueada' : 'Casual'} · {w.players} jogadores · {ago(w.playedAt, now)}</small>
                </span>
              </Link>
              <div className="hm-win-team">
                {team.map(c => (
                  <span key={c.role} title={c.price != null ? `R$ ${c.price}` : undefined}>
                    <img src={`https://ddragon.leagueoflegends.com/cdn/${DD_VERSION}/img/champion/${c.champId}.png`} alt={c.champId} draggable={false} loading="lazy" />
                    {c.price != null && <small>R$ {c.price}</small>}
                  </span>
                ))}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
