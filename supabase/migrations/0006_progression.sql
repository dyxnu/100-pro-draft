-- =====================================================================
-- 100 pro Draft — progressão: nível, honra, elogios, elo/PDL, essência azul,
-- loja/inventário, maestria, histórico, chat, convites/VIP e beta.
-- Como aplicar: Supabase Dashboard → SQL Editor → colar e executar.
-- Tudo que mexe em moeda, elo ou inventário é gravado SÓ pelo servidor (service role).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Perfil: novas colunas
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_guest        boolean not null default false,
  add column if not exists blue_essence    int     not null default 0 check (blue_essence >= 0),
  add column if not exists honor_level     smallint not null default 2 check (honor_level between 0 and 5),
  add column if not exists honor_progress  int     not null default 0,
  add column if not exists kudos_count     int     not null default 0,
  add column if not exists games           int     not null default 0,
  add column if not exists wins            int     not null default 0,   -- partidas (confrontos) vencidas
  add column if not exists titles_won      int     not null default 0,   -- campeonatos vencidos
  add column if not exists tournaments     int     not null default 0,   -- campeonatos disputados
  add column if not exists rank_tier       text,                          -- null = sem elo
  add column if not exists rank_division   smallint,                      -- 4..1 (null em Mestre+)
  add column if not exists lp              int     not null default 0,
  add column if not exists rank_score      int     not null default -1,  -- para ordenar o ranking
  add column if not exists peak_tier       text,
  add column if not exists title_id        text,
  add column if not exists banner_id       text,
  add column if not exists border_id       text,
  add column if not exists theme_id        text,
  add column if not exists victory_fx      text,
  add column if not exists vip_until       timestamptz,
  add column if not exists is_beta         boolean not null default false,
  add column if not exists beta_claimed    boolean not null default false,
  add column if not exists name_change_tokens int  not null default 0,
  add column if not exists referral_code   text,
  add column if not exists referred_by     uuid references public.profiles (id) on delete set null;

update public.profiles set referral_code = substr(md5(id::text || random()::text), 1, 8) where referral_code is null;
alter table public.profiles alter column referral_code set default substr(md5(gen_random_uuid()::text), 1, 8);
create unique index if not exists profiles_referral_code_idx on public.profiles (referral_code);
create index if not exists profiles_rank_score_idx on public.profiles (rank_score desc);

-- Convidado (login anônimo do Supabase) vira perfil "convidado_xxxx".
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  wanted text := coalesce(new.raw_user_meta_data ->> 'username', '');
  guest  boolean := coalesce(new.is_anonymous, false);
  final  text;
  ref    uuid;
begin
  if guest then
    wanted := 'convidado_' || substr(replace(new.id::text, '-', ''), 1, 6);
  elsif wanted !~ '^[A-Za-z0-9_]{3,16}$' then
    wanted := 'invocador_' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  final := wanted;
  while exists (select 1 from public.profiles where username = final) loop
    final := left(wanted, 12) || '_' || substr(md5(random()::text), 1, 3);
  end loop;
  select id into ref from public.profiles where referral_code = nullif(new.raw_user_meta_data ->> 'ref', '');
  insert into public.profiles (id, username, is_guest, is_beta, referred_by)
  values (new.id, final, guest, not guest, ref);
  return new;
end $$;

-- O navegador não grava mais o perfil: tudo passa por ações do servidor (que validam e cobram).
drop policy if exists "profiles: dono edita" on public.profiles;
drop policy if exists "profiles: atualizar o próprio" on public.profiles;
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'profiles' and cmd = 'UPDATE' loop
    execute format('drop policy %I on public.profiles', p.policyname);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Histórico de partidas (um registro por jogador humano por campeonato)
-- ---------------------------------------------------------------------
create table if not exists public.match_history (
  id          bigserial primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  room_id     uuid references public.rooms (id) on delete set null,
  mode        text not null default 'casual' check (mode in ('casual', 'ranked')),
  placement   smallint not null,          -- 1 = campeão
  players     smallint not null,
  matches_won smallint not null default 0,
  matches_played smallint not null default 0,
  lp_delta    int not null default 0,
  be_gain     int not null default 0,
  xp_gain     int not null default 0,
  team        jsonb not null,             -- [{role, champId, skin, price}]
  played_at   timestamptz not null default now(),
  unique (user_id, room_id)
);
create index if not exists match_history_user_idx on public.match_history (user_id, played_at desc);

-- ---------------------------------------------------------------------
-- Inventário (skins, ícones, banners, bordas, temas, efeitos, títulos)
-- ---------------------------------------------------------------------
create table if not exists public.inventory (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  item_id     text not null,              -- ex.: 'skin:Ahri_7', 'icon:4567', 'title:beta'
  source      text not null default 'loja', -- loja, beta, vip, conquista, convite
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- ---------------------------------------------------------------------
-- Maestria de campeão
-- ---------------------------------------------------------------------
create table if not exists public.mastery (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  champion_id text not null,
  points      int not null default 0,
  games       int not null default 0,
  wins        int not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (user_id, champion_id)
);
create index if not exists mastery_user_idx on public.mastery (user_id, points desc);

-- ---------------------------------------------------------------------
-- Elogios (honra) — um por pessoa por sala
-- ---------------------------------------------------------------------
create table if not exists public.kudos (
  id          bigserial primary key,
  from_user   uuid not null references public.profiles (id) on delete cascade,
  to_user     uuid not null references public.profiles (id) on delete cascade,
  room_id     uuid not null references public.rooms (id) on delete cascade,
  kind        text not null check (kind in ('esportivo', 'estrategista', 'leiloeiro', 'gente_boa')),
  created_at  timestamptz not null default now(),
  unique (from_user, room_id),
  check (from_user <> to_user)
);

-- ---------------------------------------------------------------------
-- Chat (global e por sala)
-- ---------------------------------------------------------------------
create table if not exists public.chat_messages (
  id          bigserial primary key,
  channel     text not null,              -- 'global' ou 'sala:<uuid>'
  user_id     uuid not null references public.profiles (id) on delete cascade,
  username    text not null,
  title_id    text,
  is_vip      boolean not null default false,
  body        text not null check (char_length(body) between 1 and 200),
  created_at  timestamptz not null default now()
);
create index if not exists chat_channel_idx on public.chat_messages (channel, created_at desc);

-- ---------------------------------------------------------------------
-- Convites (VIP por indicação)
-- ---------------------------------------------------------------------
create table if not exists public.referrals (
  referrer    uuid not null references public.profiles (id) on delete cascade,
  referred    uuid not null references public.profiles (id) on delete cascade primary key,
  rewarded    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- RLS: leitura pública do que é de perfil; escrita só pelo servidor.
-- ---------------------------------------------------------------------
alter table public.match_history enable row level security;
alter table public.inventory     enable row level security;
alter table public.mastery       enable row level security;
alter table public.kudos         enable row level security;
alter table public.chat_messages enable row level security;
alter table public.referrals     enable row level security;

drop policy if exists "history: leitura" on public.match_history;
create policy "history: leitura" on public.match_history for select using (true);
drop policy if exists "inventory: leitura" on public.inventory;
create policy "inventory: leitura" on public.inventory for select using (true);
drop policy if exists "mastery: leitura" on public.mastery;
create policy "mastery: leitura" on public.mastery for select using (true);
drop policy if exists "kudos: leitura" on public.kudos;
create policy "kudos: leitura" on public.kudos for select using (true);
drop policy if exists "chat: leitura" on public.chat_messages;
create policy "chat: leitura" on public.chat_messages for select to authenticated using (true);
drop policy if exists "referrals: o próprio" on public.referrals;
create policy "referrals: o próprio" on public.referrals for select to authenticated using (referrer = auth.uid());

-- Chat em tempo real
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages') then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;

-- Salas ranqueadas
alter table public.rooms add column if not exists results_recorded boolean not null default false;

-- ---------------------------------------------------------------------
-- Beta: todo mundo que já tem conta é testador beta
-- ---------------------------------------------------------------------
update public.profiles set is_beta = true where not is_guest;

-- Elo máximo para o dono do projeto ver como fica (pedido do dono).
update public.profiles
   set rank_tier = 'DESAFIANTE', rank_division = null, lp = 1250, peak_tier = 'DESAFIANTE',
       rank_score = 10 * 400 + 1250
 where username = 'dyxnu';
