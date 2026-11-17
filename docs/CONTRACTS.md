# 100 pro Draft — contratos compartilhados (v2: progressão, loja, social)

Leia antes de mexer. Idioma da interface: **português do Brasil**. Tema: Diana (índigo, prata lavanda, dourado).

## Regras de ouro
- **Nunca** use classes CSS começando com `ad`, `ads`, `banner-ad`, `sponsor` etc. (bloqueadores de anúncio escondem). Use prefixos próprios por área (ex.: `hm-` início, `pd-` leilão, `pf-` perfil, `st-` loja, `ch-` chat).
- Escrita em moeda/elo/inventário/perfil **só no servidor** com `createAdminClient()` (`src/lib/supabase/admin.ts`). A migração 0006 remove a permissão de UPDATE do navegador em `profiles`.
- Toda entrada de texto do usuário (nome, chat, título) passa por `isOffensive()`/`censor()` em `src/lib/moderation/profanity.ts`.
- Não mude o equilíbrio do simulador (`src/lib/match/*`) a menos que a tarefa seja de combate. Rode `npx vitest run`, `npx tsc --noEmit` e `npx eslint src` antes de terminar.
- **Não rode `next build`** (o servidor de desenvolvimento do dono pode estar rodando). Typecheck + testes bastam.
- Sem dependências novas sem necessidade forte (prefira CSS/SVG/Canvas). Se precisar, versão exata no package.json.
- Commits pequenos e claros, em português, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Banco (supabase/migrations/0006_progression.sql — o dono roda manualmente)
- `profiles`: + `is_guest, blue_essence, honor_level(0-5), honor_progress, kudos_count, games, wins, titles_won, tournaments, rank_tier, rank_division, lp, rank_score, peak_tier, title_id, banner_id, border_id, theme_id, victory_fx, vip_until, is_beta, beta_claimed, name_change_tokens, referral_code, referred_by`.
- `match_history(user_id, room_id, mode, placement, players, matches_won, matches_played, lp_delta, be_gain, xp_gain, team jsonb[{role,champId,skin,price}], played_at)`.
- `inventory(user_id, item_id, source, acquired_at)` — ids do catálogo (`src/lib/store/catalog.ts`).
- `mastery(user_id, champion_id, points, games, wins)`.
- `kudos(from_user, to_user, room_id, kind in esportivo|estrategista|leiloeiro|gente_boa)` — 1 por pessoa por sala.
- `chat_messages(channel 'global' | 'sala:<roomId>', user_id, username, title_id, is_vip, body ≤200)` — no Realtime.
- `referrals(referrer, referred, rewarded)`.
- `rooms.mode` ('casual'|'ranked') já existe; `rooms.results_recorded`.
- Tipo TS do perfil: `Profile` em `src/lib/supabase/server.ts` (+ `isVip()`). `getCurrentUser()` já traz `select('*')`.

## Módulos prontos (use, não duplique)
- `src/lib/progress/rank.ts` — `TIERS`, `TIER_LABEL`, `TIER_COLOR`, `applyLp`, `rankScore`, `rankLabel`, `isApex`.
- `src/lib/progress/rewards.ts` — PDL/essência/XP/maestria/honra, `xpToNext`, `masteryLevel`, `MASTERY_LEVELS`, `NAME_CHANGE_PRICE=14900`, `BETA_BONUS_BE=2000`, `VIP_DAYS_PER_REFERRAL=3`.
- `src/lib/progress/service.ts` — `recordResults()` já é chamado quando o campeonato termina (grava histórico, stats, elo, essência, nível, maestria, honra, VIP por convite).
- `src/lib/store/catalog.ts` — `CATALOG`, `itemById`, `SKINS`, urls de skin/ícone, `BETA_GRANTS`, `VIP_GRANTS`, `isFreeItem`, `TITLES`.
- `src/lib/moderation/profanity.ts` — `isOffensive`, `censor`.
- `src/lib/sound.ts` — sons sintetizados (`play('bid'|'myBid'|'sold'|'win'|...)`).
- Ícone de perfil: `avatar_url` = id de campeão (legado) **ou** `icon:<id>` (ícone de perfil do LoL). Componente `Avatar` em `src/components/profile/Avatar.tsx`.
- Skins no leilão: `Lot.skin?` e `RosterSlot.skin?` (número da skin do Data Dragon) em `src/lib/auction/engine.ts`.

## Rotas (quem cria)
- `/` início (agente Início) · `/loja` (agente Loja) · `/perfil`, `/jogador/[username]` (agente Perfil) · `/ranking` opcional (agente Início) · chat embutido no saguão/leilão e global (agente Social).
