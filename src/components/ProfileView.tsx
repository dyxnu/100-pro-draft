// Perfil estilo LoL: banner de splash, ícone com borda e nível, título, elo, estatísticas,
// maestria e histórico. Componente do servidor; as partes editáveis são ilhas de cliente.
import Link from 'next/link';
import { isVip, type Profile } from '@/lib/supabase/server';
import { AVATARS, avatarUrl } from '@/lib/profile/avatars';
import { SKINS, itemById, skinCenteredUrl, skinSplashUrl } from '@/lib/store/catalog';
import { NAME_CHANGE_PRICE, MASTERY_LEVELS, masteryLevel, xpToNext } from '@/lib/progress/rewards';
import { TIER_COLOR, TIER_LABEL, isApex, rankLabel } from '@/lib/progress/rank';
import { RankEmblem } from '@/components/profile/RankEmblem';
import { FramedIcon } from '@/components/profile/FramedIcon';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { TitleBadge } from '@/components/profile/TitleBadge';
import { ProfileEditor, type EditorOptions } from '@/components/profile/ProfileEditor';
import type { HistoryRow, MasteryRow } from '@/components/profile/data';
import {
  asTier, bannerOf, ownedIconIds, ownedOf, ownedTitles, placementLabel, relativeTime, winRate, type OwnerCtx,
} from '@/components/profile/ownership';
import '@/components/profile/profile.css';

const CHAMP_NAME = new Map(AVATARS.map(a => [a.id, a.name]));
const champName = (id: string) => CHAMP_NAME.get(id) ?? id;
const skinName = (champId: string, num: number) => SKINS[champId]?.find(s => s.num === num)?.name ?? null;
const fmt = (n: number) => n.toLocaleString('pt-BR');
const ROLE_LABEL: Record<string, string> = { TOP: 'Topo', JUNGLE: 'Selva', MID: 'Meio', ADC: 'Atirador', SUPORTE: 'Suporte' };
const ROMAN = ['', 'I', 'II', 'III', 'IV'];

export interface ProfileViewProps {
  profile: Profile;
  /** Pode editar (página /perfil do próprio usuário). */
  isOwner: boolean;
  /** É o próprio usuário vendo o perfil público (mostra o atalho para editar). */
  isMe?: boolean;
  ctx: OwnerCtx;
  mastery: MasteryRow[];
  history: HistoryRow[];
}

export function ProfileView({ profile: p, isOwner, isMe, ctx, mastery, history }: ProfileViewProps) {
  const since = new Date(p.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const banner = bannerOf(p);
  const theme = (p.theme_id ?? 'theme:noite').replace('theme:', '');
  const border = p.border_id?.replace('border:', '') ?? null;
  const tier = asTier(p.rank_tier);
  const peak = asTier(p.peak_tier);
  const wr = winRate(p.wins, p.games);
  const need = xpToNext(p.level);
  const vip = isVip(p);

  let editor: EditorOptions | null = null;
  if (isOwner) {
    const named = (ids: string[]) => ids.map(id => ({ id, name: itemById(id)?.name ?? id, rarity: itemById(id)?.rarity ?? 'comum' }));
    const skinBanners = [...ctx.inventory]
      .map(id => /^(?:skin|banner):([A-Za-z0-9]+)_(\d+)$/.exec(id))
      .filter((m): m is RegExpExecArray => !!m && Number(m[2]) > 0 && !!skinName(m[1], Number(m[2])))
      .map(m => ({ id: `banner:${m[1]}_${m[2]}`, name: skinName(m[1], Number(m[2]))!, img: skinCenteredUrl(m[1], Number(m[2])) }))
      .filter((b, i, all) => all.findIndex(x => x.id === b.id) === i);
    editor = {
      titles: named(ownedTitles(ctx)),
      borders: named(ownedOf('border', ctx)),
      themes: named(ownedOf('theme', ctx)),
      victories: named(ownedOf('victory', ctx)),
      skinBanners,
      current: { title: p.title_id, border: p.border_id, theme: p.theme_id ?? 'theme:noite', victory: p.victory_fx, banner: p.banner_id },
      rename: { tokens: p.name_change_tokens, essence: p.blue_essence, price: NAME_CHANGE_PRICE, guest: p.is_guest },
      username: p.username,
    };
  }

  return (
    <div className={`pf-root pf-theme-${theme} mt-6 space-y-6`}>
      {/* ---------------- Banner + identidade ---------------- */}
      <section className="pf-hero">
        <img className="pf-hero-img" src={skinSplashUrl(banner.champId, banner.num)} alt="" />
        <div className="pf-hero-shade" />
        <div className="pf-hero-body">
          <div className="pf-id">
            {isOwner
              ? <ProfileAvatar current={p.avatar_url} border={border} level={p.level} ownedIcons={ownedIconIds(ctx.inventory)} />
              : <FramedIcon id={p.avatar_url} border={border} level={p.level} />}
            <div className="min-w-0">
              <h1 className="pf-name">
                {p.username}{p.tag && <span className="pf-tag">#{p.tag}</span>}
                {vip && <span className="pf-vip" title="Apoiador VIP">VIP</span>}
              </h1>
              {isOwner && editor
                ? <ProfileEditor options={editor} part="title" />
                : <TitleBadge id={p.title_id} name={p.title_id ? itemById(p.title_id)?.name ?? null : null} />}
              <p className="pf-since">Na plataforma desde {since}</p>
            </div>
          </div>
          <div className="pf-hero-actions">
            {isOwner && editor && <ProfileEditor options={editor} part="actions" />}
            {isOwner && <Link href={`/jogador/${encodeURIComponent(p.username)}`} className="pf-ghost-btn">Ver perfil público</Link>}
            {!isOwner && isMe && <Link href="/perfil" className="pf-ghost-btn">Editar meu perfil</Link>}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* ---------------- Coluna esquerda ---------------- */}
        <div className="space-y-6">
          <section className="panel pf-rank" style={{ ['--pf-tier' as string]: tier ? TIER_COLOR[tier] : '#9a9cc0' }}>
            <p className="eyebrow">Ranqueada</p>
            <div className="mt-2 flex items-center gap-4">
              <RankEmblem tier={tier} division={p.rank_division} size={104} />
              <div className="min-w-0">
                <p className="pf-rank-tier">{tier ? `${TIER_LABEL[tier]}${!isApex(tier) && p.rank_division ? ` ${ROMAN[p.rank_division]}` : ''}` : 'Sem elo'}</p>
                <p className="text-sm text-muted">{tier ? `${fmt(p.lp)} PDL` : 'Jogue uma ranqueada para receber elo'}</p>
                <p className="mt-2 text-xs text-muted">
                  Pico: {peak ? <b style={{ color: TIER_COLOR[peak] }}>{TIER_LABEL[peak]}</b> : '–'}
                </p>
              </div>
            </div>
            {tier && !isApex(tier) && (
              <div className="pf-bar mt-4" title={rankLabel({ tier, division: p.rank_division, lp: p.lp })}>
                <span style={{ width: `${Math.min(100, p.lp)}%`, background: 'var(--pf-tier)' }} />
              </div>
            )}
          </section>

          <section className="panel p-5">
            <div className="flex items-baseline justify-between">
              <p className="eyebrow">Nível {p.level}</p>
              <p className="text-xs text-muted">{fmt(p.xp)} / {fmt(need)} XP</p>
            </div>
            <div className="pf-bar mt-2"><span style={{ width: `${Math.min(100, (p.xp / need) * 100)}%` }} /></div>

            <div className="mt-5 flex items-baseline justify-between">
              <p className="eyebrow">Honra {p.honor_level}</p>
              <p className="text-xs text-muted">{p.honor_level >= 5 ? 'Máxima' : `${p.honor_progress}/100`}</p>
            </div>
            <div className="pf-honor mt-2" aria-label={`Honra nível ${p.honor_level} de 5`}>
              {[1, 2, 3, 4, 5].map(i => <span key={i} className={i <= p.honor_level ? 'on' : ''} />)}
            </div>
            <div className="pf-bar pf-bar--honor mt-2"><span style={{ width: `${p.honor_level >= 5 ? 100 : Math.min(100, p.honor_progress)}%` }} /></div>

            {isOwner && (
              <div className="pf-be mt-5">
                <span className="pf-be-gem" aria-hidden />
                <span><b>{fmt(p.blue_essence)}</b> essência azul</span>
                {p.name_change_tokens > 0 && <span className="ml-auto text-xs text-muted">{p.name_change_tokens} troca(s) de nome</span>}
              </div>
            )}
          </section>

          <section className="panel p-5">
            <p className="eyebrow">Maestria</p>
            {mastery.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Vença partidas com seus campeões para ganhar pontos de maestria.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {mastery.map(m => {
                  const lvl = masteryLevel(m.points);
                  const next = MASTERY_LEVELS[lvl] ?? null;
                  const prev = MASTERY_LEVELS[lvl - 1] ?? 0;
                  return (
                    <li key={m.champion_id} className="pf-mastery">
                      <span className="pf-mastery-icon">
                        <img src={avatarUrl(m.champion_id)} alt="" width={44} height={44} loading="lazy" />
                        <span className={`pf-mastery-lvl pf-mlvl-${lvl}`}>{lvl}</span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-gold2">{champName(m.champion_id)}</p>
                        <p className="text-xs text-muted">{fmt(m.points)} pts · {m.wins}V {Math.max(0, m.games - m.wins)}D</p>
                        <div className="pf-bar pf-bar--thin mt-1">
                          <span style={{ width: `${next ? Math.min(100, ((m.points - prev) / (next - prev)) * 100) : 100}%` }} />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* ---------------- Coluna direita ---------------- */}
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat k="Campeonatos" v={fmt(p.tournaments)} s={`${fmt(p.titles_won)} vencidos`} />
            <Stat k="Títulos" v={fmt(p.titles_won)} s="campeonatos vencidos" gold />
            <Stat k="Partidas" v={fmt(p.games)} s={`${fmt(p.wins)}V · ${fmt(Math.max(0, p.games - p.wins))}D`} />
            <Stat k="Taxa de vitória" v={wr == null ? '–' : `${wr}%`} s={wr == null ? 'após a 1ª partida' : `${fmt(p.wins)} vitórias`} />
            <Stat k="Vitórias" v={fmt(p.wins)} s="confrontos vencidos" />
            <Stat k="Elogios" v={fmt(p.kudos_count)} s="recebidos" />
            <Stat k="Honra" v={`${p.honor_level}/5`} s={p.honor_level >= 5 ? 'máxima' : `${p.honor_progress}% até o próximo`} />
            <Stat k="Nível" v={String(p.level)} s={`${Math.max(0, need - p.xp)} XP para subir`} />
          </section>

          <section className="panel p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="eyebrow">Histórico de partidas</h2>
              {history.length > 0 && <span className="text-xs text-muted">Últimos {history.length} campeonatos</span>}
            </div>
            {history.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Nenhum campeonato ainda. Os campeonatos concluídos aparecem aqui com time, colocação e recompensas.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {history.map(h => <HistoryItem key={h.id} h={h} />)}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v, s, gold }: { k: string; v: string; s: string; gold?: boolean }) {
  return (
    <div className="panel pf-stat">
      <p className="pf-stat-k">{k}</p>
      <p className={`pf-stat-v ${gold ? 'pf-stat-v--gold' : ''}`}>{v}</p>
      <p className="pf-stat-s">{s}</p>
    </div>
  );
}

function HistoryItem({ h }: { h: HistoryRow }) {
  const win = h.placement === 1;
  const ranked = h.mode === 'ranked';
  const team = Array.isArray(h.team) ? h.team : [];
  return (
    <li className={`pf-match ${win ? 'pf-match--win' : 'pf-match--loss'}`}>
      <div className="pf-match-res">
        <p className="pf-match-title">{win ? 'Vitória · Campeão' : `Derrota · ${placementLabel(h.placement)}`}</p>
        <p className="text-xs text-muted">
          {ranked ? 'Ranqueada' : 'Casual'} · {h.players} jogadores · {h.matches_won}/{h.matches_played} confrontos
        </p>
        <p className="text-xs text-muted">{relativeTime(h.played_at)}</p>
      </div>
      <div className="pf-match-team">
        {team.map((t, i) => {
          const skin = t.skin ? skinName(t.champId, t.skin) : null;
          return (
            <span key={`${t.champId}-${i}`} className={`pf-match-champ ${skin ? 'pf-match-champ--skin' : ''}`}
              title={`${ROLE_LABEL[t.role] ?? t.role}: ${skin ?? champName(t.champId)}`}>
              <img src={avatarUrl(t.champId)} alt={champName(t.champId)} width={36} height={36} loading="lazy" />
            </span>
          );
        })}
      </div>
      <div className="pf-match-gain">
        {ranked && (
          <p className={`pf-lp ${h.lp_delta >= 0 ? 'pf-lp--up' : 'pf-lp--down'}`}>
            {h.lp_delta >= 0 ? `+${h.lp_delta}` : `−${Math.abs(h.lp_delta)}`} PDL
          </p>
        )}
        {h.be_gain > 0 && <p className="pf-match-be">+{fmt(h.be_gain)} EA</p>}
      </div>
    </li>
  );
}

