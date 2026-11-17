// Perfil no estilo do cliente do LoL: splash de fundo, ícone com borda e nível, título, brasão do
// elo, faixa de números, honra, maestria e histórico. Componente do servidor; as partes
// editáveis (ícone, título, personalizar, trocar nome) são ilhas de cliente.
import Link from 'next/link';
import { isVip, type Profile } from '@/lib/supabase/server';
import { AVATARS, avatarUrl } from '@/lib/profile/avatars';
import { SKINS, itemById, skinCenteredUrl, skinSplashUrl } from '@/lib/store/catalog';
import { NAME_CHANGE_PRICE, MASTERY_LEVELS, masteryLevel, xpToNext } from '@/lib/progress/rewards';
import { TIER_COLOR, TIER_LABEL, isApex } from '@/lib/progress/rank';
import { RankEmblem } from '@/components/profile/RankEmblem';
import { FramedIcon } from '@/components/profile/FramedIcon';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { TitleBadge } from '@/components/profile/TitleBadge';
import { ProfileEditor, type EditorOptions } from '@/components/profile/ProfileEditor';
import type { HistoryRow, MasteryRow } from '@/components/profile/data';
import {
  asTier, bannerOf, ownedIconIds, ownedOf, ownedTitles, placementLabel, relativeTime, winRate, type OwnerCtx,
} from '@/components/profile/ownership';
import '@/components/profile/cosmetics.css';
import '@/components/profile/profile.css';

const CHAMP_NAME = new Map(AVATARS.map(a => [a.id, a.name]));
const champName = (id: string) => CHAMP_NAME.get(id) ?? id;
const skinName = (champId: string, num: number) => SKINS[champId]?.find(s => s.num === num)?.name ?? null;
const fmt = (n: number) => n.toLocaleString('pt-BR');
const ROLE_LABEL: Record<string, string> = { TOP: 'Topo', JUNGLE: 'Selva', MID: 'Meio', ADC: 'Atirador', SUPORTE: 'Suporte' };
const ROMAN = ['', 'I', 'II', 'III', 'IV'];
const HONOR_NAME = ['Sem honra', 'Honra 1', 'Honra 2', 'Honra 3', 'Honra 4', 'Honra 5'];

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
  const since = new Date(p.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const banner = bannerOf(p);
  const theme = (p.theme_id ?? 'theme:noite').replace('theme:', '');
  const border = p.border_id?.replace('border:', '') ?? null;
  const tier = asTier(p.rank_tier);
  const peak = asTier(p.peak_tier);
  const wr = winRate(p.wins, p.games);
  const need = xpToNext(p.level);
  const vip = isVip(p);
  const titleName = p.title_id ? itemById(p.title_id)?.name ?? null : null;

  let editor: EditorOptions | null = null;
  if (isOwner) {
    const named = (ids: string[]) => ids.map(id => ({ id, name: itemById(id)?.name ?? id, rarity: itemById(id)?.rarity ?? 'comum' }));
    const skinBanners = [...ctx.inventory]
      .map(id => /^(?:skin|banner):([A-Za-z0-9]+)_(\d+)$/.exec(id))
      .filter((m): m is RegExpExecArray => !!m && Number(m[2]) > 0 && !!skinName(m[1], Number(m[2])))
      .map(m => ({ id: `banner:${m[1]}_${m[2]}`, name: skinName(m[1], Number(m[2]))!, img: skinCenteredUrl(m[1], Number(m[2])) }))
      .filter((b, i, all) => all.findIndex(x => x.id === b.id) === i)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
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

  const tierText = tier ? `${TIER_LABEL[tier]}${!isApex(tier) && p.rank_division ? ` ${ROMAN[p.rank_division]}` : ''}` : 'Sem elo';
  const [top, ...restMastery] = mastery;

  return (
    <div className={`pf-root cos-theme-${theme}`}>
      {/* ───────── Cabeçalho com a splash ───────── */}
      <section className="pf-hero">
        <img className="pf-hero-img" src={skinSplashUrl(banner.champId, banner.num)} alt="" draggable={false} />
        <div className="pf-hero-shade" />

        <div className="pf-hero-grid">
          <div className="pf-ident">
            <div className={`pf-icon cos-border-${border ?? 'none'}`}>
              {isOwner
                ? <ProfileAvatar current={p.avatar_url} border={border} level={p.level} ownedIcons={ownedIconIds(ctx.inventory)} size={128} />
                : <FramedIcon id={p.avatar_url} border={border} level={p.level} size={128} />}
            </div>
            <div className="pf-namebox">
              <div className="pf-badges">
                {p.is_beta && !p.is_guest && <span className="pf-chip alpha">Alpha</span>}
                {vip && <span className="pf-chip vip">VIP</span>}
                {p.is_guest && <span className="pf-chip">Convidado</span>}
              </div>
              <h1 className="pf-name">{p.username}{p.tag && <span className="pf-tag">#{p.tag}</span>}</h1>
              {isOwner && editor
                ? <ProfileEditor options={editor} part="title" />
                : <TitleBadge id={p.title_id} name={titleName} />}
              <div className="pf-xp" title={`${fmt(p.xp)} / ${fmt(need)} XP`}>
                <span>Nível {p.level}</span>
                <i><b style={{ width: `${Math.min(100, (p.xp / need) * 100)}%` }} /></i>
              </div>
              <div className="pf-actions">
                {isOwner && editor && <ProfileEditor options={editor} part="actions" />}
                {isOwner && <Link href={`/jogador/${encodeURIComponent(p.username)}`} className="pf-btn ghost">Perfil público</Link>}
                {!isOwner && isMe && <Link href="/perfil" className="pf-btn">Editar meu perfil</Link>}
              </div>
            </div>
          </div>

          <div className="pf-crest" style={{ ['--tier' as string]: tier ? TIER_COLOR[tier] : '#8b8fae' }}>
            <RankEmblem tier={tier} division={p.rank_division} size={170} />
            <p className="pf-crest-tier">{tierText}</p>
            <p className="pf-crest-lp">{tier ? `${fmt(p.lp)} PDL` : 'Jogue uma ranqueada'}</p>
            {tier && !isApex(tier) && <i className="pf-crest-bar"><b style={{ width: `${Math.min(100, p.lp)}%` }} /></i>}
            {peak && <p className="pf-crest-peak">Pico: <b style={{ color: TIER_COLOR[peak] }}>{TIER_LABEL[peak]}</b></p>}
          </div>
        </div>

        <dl className="pf-strip">
          <Num k="Campeonatos" v={fmt(p.tournaments)} />
          <Num k="Taças" v={fmt(p.titles_won)} gold />
          <Num k="Partidas" v={fmt(p.games)} sub={`${fmt(p.wins)}V ${fmt(Math.max(0, p.games - p.wins))}D`} />
          <Num k="Vitórias" v={wr == null ? '–' : `${wr}%`} />
          <Num k="Elogios" v={fmt(p.kudos_count)} />
          <Num k="Desde" v={since} small />
        </dl>
      </section>

      <div className="pf-body">
        {/* ───────── Coluna esquerda ───────── */}
        <div className="pf-col">
          <section className="pf-card pf-honor-card">
            <div className={`pf-honor-crest h${p.honor_level}`} aria-hidden>
              <svg viewBox="0 0 64 72"><path d="M32 3l25 9v20c0 17-11 30-25 37C18 62 7 49 7 32V12z" /></svg>
              <b>{p.honor_level}</b>
            </div>
            <div className="min-w-0 flex-1">
              <p className="pf-k">Honra</p>
              <p className="pf-v">{HONOR_NAME[p.honor_level] ?? 'Honra'}</p>
              <div className="pf-pips" aria-label={`Honra nível ${p.honor_level} de 5`}>
                {[1, 2, 3, 4, 5].map(i => <span key={i} className={i <= p.honor_level ? 'on' : ''} />)}
              </div>
              <p className="pf-s">{p.honor_level >= 5 ? 'Honra máxima: título Honrado liberado' : `${p.honor_progress}/100 até o próximo nível`}</p>
            </div>
          </section>

          {isOwner && (
            <section className="pf-card pf-wallet">
              <span className="pf-be-gem" aria-hidden />
              <span className="min-w-0 flex-1">
                <p className="pf-k">Essência Azul</p>
                <p className="pf-v">{fmt(p.blue_essence)}</p>
              </span>
              <Link href="/loja" className="pf-btn small">Loja</Link>
            </section>
          )}

          <section className="pf-card">
            <h2 className="pf-h">Maestria</h2>
            {!top ? (
              <p className="pf-s mt-2">Vença partidas com seus campeões para ganhar pontos de maestria.</p>
            ) : (
              <>
                <MasteryHero m={top} />
                {restMastery.length > 0 && (
                  <ul className="pf-mastery-list">
                    {restMastery.map(m => <MasteryRowItem key={m.champion_id} m={m} />)}
                  </ul>
                )}
              </>
            )}
          </section>
        </div>

        {/* ───────── Histórico ───────── */}
        <section className="pf-card pf-history">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="pf-h">Histórico</h2>
            {history.length > 0 && <span className="pf-s">Últimos {history.length} campeonatos</span>}
          </div>
          {history.length === 0 ? (
            <div className="pf-empty">
              <p>Nenhum campeonato ainda.</p>
              <span>Os campeonatos que você terminar aparecem aqui, com o time, a colocação e o que você ganhou.</span>
              {isOwner && <Link href="/jogar" className="pf-btn mt-3">Jogar agora</Link>}
            </div>
          ) : (
            <ul className="pf-matches">
              {history.map(h => <HistoryItem key={h.id} h={h} />)}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Num({ k, v, sub, gold, small }: { k: string; v: string; sub?: string; gold?: boolean; small?: boolean }) {
  return (
    <div className="pf-num">
      <dt>{k}</dt>
      <dd className={`${gold ? 'gold' : ''} ${small ? 'small' : ''}`}>{v}</dd>
      {sub && <dd className="sub">{sub}</dd>}
    </div>
  );
}

function masteryProgress(points: number) {
  const lvl = masteryLevel(points);
  const next = MASTERY_LEVELS[lvl] ?? null;
  const prev = MASTERY_LEVELS[lvl - 1] ?? 0;
  return { lvl, pct: next ? Math.min(100, ((points - prev) / (next - prev)) * 100) : 100 };
}

function MasteryHero({ m }: { m: MasteryRow }) {
  const { lvl, pct } = masteryProgress(m.points);
  return (
    <div className="pf-mhero">
      <img src={skinCenteredUrl(m.champion_id, 0)} alt="" draggable={false} loading="lazy" />
      <div className="pf-mhero-in">
        <span className={`pf-mcrest m${lvl}`}>{lvl}</span>
        <div className="min-w-0">
          <p className="pf-mhero-name">{champName(m.champion_id)}</p>
          <p className="pf-s">{fmt(m.points)} pontos · {m.wins}V {Math.max(0, m.games - m.wins)}D</p>
          <i className="pf-thin"><b style={{ width: `${pct}%` }} /></i>
        </div>
      </div>
    </div>
  );
}

function MasteryRowItem({ m }: { m: MasteryRow }) {
  const { lvl, pct } = masteryProgress(m.points);
  return (
    <li>
      <span className="pf-micon">
        <img src={avatarUrl(m.champion_id)} alt="" width={40} height={40} loading="lazy" />
        <span className={`pf-mcrest sm m${lvl}`}>{lvl}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{champName(m.champion_id)}</p>
        <i className="pf-thin"><b style={{ width: `${pct}%` }} /></i>
      </div>
      <span className="pf-s">{fmt(m.points)}</span>
    </li>
  );
}

function HistoryItem({ h }: { h: HistoryRow }) {
  const win = h.placement === 1;
  const ranked = h.mode === 'ranked';
  const team = Array.isArray(h.team) ? h.team : [];
  return (
    <li className={`pf-match ${win ? 'win' : 'loss'}`}>
      <div className="pf-match-res">
        <p className="pf-match-title">{win ? 'Campeão' : placementLabel(h.placement)}</p>
        <p className="pf-s">{ranked ? 'Ranqueada' : 'Casual'} · {relativeTime(h.played_at)}</p>
      </div>
      <div className="pf-match-team">
        {team.map((t, i) => {
          const skin = t.skin ? skinName(t.champId, t.skin) : null;
          return (
            <span key={`${t.champId}-${i}`} className={skin ? 'skin' : ''} title={`${ROLE_LABEL[t.role] ?? t.role}: ${skin ?? champName(t.champId)}`}>
              <img src={avatarUrl(t.champId)} alt={champName(t.champId)} width={34} height={34} loading="lazy" />
            </span>
          );
        })}
      </div>
      <div className="pf-match-score">
        <b>{h.matches_won}/{h.matches_played}</b>
        <small>confrontos</small>
      </div>
      <div className="pf-match-gain">
        {ranked && <p className={h.lp_delta >= 0 ? 'up' : 'down'}>{h.lp_delta >= 0 ? `+${h.lp_delta}` : `−${Math.abs(h.lp_delta)}`} PDL</p>}
        {h.be_gain > 0 && <p className="be">+{fmt(h.be_gain)} EA</p>}
      </div>
    </li>
  );
}
