-- =====================================================================
-- NEXUS DRAFT: Fase 1 (fundação)
-- Perfis, catálogo de campeões, salas, leilões, lances e times.
-- Regra de ouro: o NAVEGADOR NUNCA escreve em leilões, lances, saldos
-- ou times. Só o servidor (service role) escreve nessas tabelas; os
-- clientes só leem. O RLS abaixo garante isso.
-- Como aplicar: Supabase Dashboard → SQL Editor → colar e executar.
-- =====================================================================

create extension if not exists citext;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
do $$ begin
  create type public.lane as enum ('TOP', 'JUNGLE', 'MID', 'ADC', 'SUPORTE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.room_status as enum ('lobby', 'drafting', 'finished', 'abandoned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.room_mode as enum ('casual', 'ranked');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Perfis (1:1 com auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      citext not null unique
                check (username ~ '^[A-Za-z0-9_]{3,16}$'),
  tag           text not null default lpad((floor(random() * 10000))::int::text, 4, '0'),
  avatar_url    text,
  level         int  not null default 1 check (level >= 1),
  xp            int  not null default 0 check (xp >= 0),
  is_admin      boolean not null default false,
  is_banned     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on column public.profiles.tag is 'Identificador público (ex.: Danilo#1234).';

-- Cria o perfil automaticamente no cadastro, usando o username enviado no signUp.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  wanted text := coalesce(new.raw_user_meta_data ->> 'username', '');
  final  text;
begin
  if wanted !~ '^[A-Za-z0-9_]{3,16}$' then
    wanted := 'invocador_' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  final := wanted;
  -- se já existir, acrescenta sufixo
  while exists (select 1 from public.profiles where username = final) loop
    final := left(wanted, 12) || '_' || substr(md5(random()::text), 1, 3);
  end loop;
  insert into public.profiles (id, username) values (new.id, final);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Usuário comum não pode se promover a admin nem se desbanir.
create or replace function public.protect_profile_columns()
returns trigger language plpgsql as $$
begin
  if auth.role() = 'authenticated' then
    new.is_admin  := old.is_admin;
    new.is_banned := old.is_banned;
    new.level     := old.level;
    new.xp        := old.xp;
    new.tag       := old.tag;
  end if;
  return new;
end $$;

drop trigger if exists profiles_protect on public.profiles;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ---------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------
create table if not exists public.champions (
  id          text primary key,           -- chave do Data Dragon (ex.: 'LeeSin')
  name        text not null,
  tier        smallint not null default 2 check (tier between 1 and 3),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.champion_routes (
  champion_id text not null references public.champions (id) on delete cascade,
  lane        public.lane not null,
  is_primary  boolean not null default false,
  primary key (champion_id, lane)
);
create unique index if not exists champion_routes_one_primary
  on public.champion_routes (champion_id) where is_primary;

-- ---------------------------------------------------------------------
-- Salas
-- ---------------------------------------------------------------------
create table if not exists public.rooms (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique default upper(substr(md5(random()::text), 1, 6)),
  host_id      uuid not null references public.profiles (id),
  mode         public.room_mode not null default 'casual',
  status       public.room_status not null default 'lobby',
  bots_enabled boolean not null default true,
  max_players  smallint not null default 6 check (max_players between 2 and 6),
  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz,
  constraint ranked_without_bots check (mode = 'casual' or bots_enabled = false)
);

create table if not exists public.room_members (
  room_id      uuid not null references public.rooms (id) on delete cascade,
  seat         smallint not null check (seat between 0 and 5),
  user_id      uuid references public.profiles (id),
  bot_profile  text check (bot_profile in ('economico', 'equilibrado', 'agressivo', 'estrategico')),
  display_name text not null,
  joined_at    timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  left_at      timestamptz,
  primary key (room_id, seat),
  constraint human_xor_bot check ((user_id is null) <> (bot_profile is null))
);
create unique index if not exists room_members_one_seat_per_user
  on public.room_members (room_id, user_id) where user_id is not null;

-- ---------------------------------------------------------------------
-- Leilão (estado autoritativo é escrito só pelo servidor)
-- ---------------------------------------------------------------------
create table if not exists public.auctions (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null unique references public.rooms (id) on delete cascade,
  seed         int not null,
  config       jsonb not null,
  state        jsonb not null,             -- AuctionState serializado (src/lib/auction/engine.ts)
  bot_brains   jsonb not null default '{}'::jsonb,
  version      int not null default 0,     -- trava otimista contra condição de corrida
  next_tick_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.bids (
  id           bigint generated always as identity primary key,
  auction_id   uuid not null references public.auctions (id) on delete cascade,
  seq          int not null,
  seat         smallint not null,
  champion_id  text not null references public.champions (id),
  amount_cents int not null check (amount_cents > 0),
  created_at   timestamptz not null default now(),
  unique (auction_id, seq)
);

create table if not exists public.rosters (
  auction_id   uuid not null references public.auctions (id) on delete cascade,
  seat         smallint not null,
  lane         public.lane not null,
  champion_id  text not null references public.champions (id),
  price_cents  int not null check (price_cents >= 0),
  acquired_how text not null check (acquired_how in ('leilao', 'sorteio', 'unico')),
  created_at   timestamptz not null default now(),
  primary key (auction_id, seat, lane),
  unique (auction_id, champion_id)          -- nunca o mesmo campeão duas vezes na sala
);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.champions       enable row level security;
alter table public.champion_routes enable row level security;
alter table public.rooms           enable row level security;
alter table public.room_members    enable row level security;
alter table public.auctions        enable row level security;
alter table public.bids            enable row level security;
alter table public.rosters         enable row level security;

-- Perfis: públicos para leitura; cada um edita só o próprio.
drop policy if exists "profiles: leitura pública" on public.profiles;
create policy "profiles: leitura pública" on public.profiles
  for select using (true);
drop policy if exists "profiles: dono edita" on public.profiles;
create policy "profiles: dono edita" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Catálogo: leitura pública. Escrita só via service role / painel admin.
drop policy if exists "champions: leitura" on public.champions;
create policy "champions: leitura" on public.champions for select using (true);
drop policy if exists "routes: leitura" on public.champion_routes;
create policy "routes: leitura" on public.champion_routes for select using (true);

-- Salas e membros: leitura para usuários logados (precisam ver o lobby pelo código).
-- Criação/entrada acontecem por rotas do servidor, não direto pelo cliente.
drop policy if exists "rooms: leitura" on public.rooms;
create policy "rooms: leitura" on public.rooms for select to authenticated using (true);
drop policy if exists "members: leitura" on public.room_members;
create policy "members: leitura" on public.room_members for select to authenticated using (true);

-- Leilão, lances e times: leitura para quem está na sala (ou sala encerrada = histórico público).
create or replace function public.is_room_member(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.room_members where room_id = p_room and user_id = auth.uid());
$$;

drop policy if exists "auctions: membros leem" on public.auctions;
create policy "auctions: membros leem" on public.auctions for select to authenticated
  using (public.is_room_member(room_id)
         or exists (select 1 from public.rooms r where r.id = room_id and r.status = 'finished'));

drop policy if exists "bids: membros leem" on public.bids;
create policy "bids: membros leem" on public.bids for select to authenticated
  using (exists (select 1 from public.auctions a where a.id = auction_id
                 and (public.is_room_member(a.room_id)
                      or exists (select 1 from public.rooms r where r.id = a.room_id and r.status = 'finished'))));

drop policy if exists "rosters: leitura" on public.rosters;
create policy "rosters: leitura" on public.rosters for select using (true);

-- Nenhuma policy de INSERT/UPDATE/DELETE em rooms, room_members, auctions, bids, rosters:
-- para o cliente (anon/authenticated) essas escritas ficam bloqueadas. O servidor usa service role.

-- ---------------------------------------------------------------------
-- Seed: catálogo inicial (30 campeões)
-- ---------------------------------------------------------------------
insert into public.champions (id, name, tier) values
  ('Garen','Garen',1), ('Darius','Darius',2), ('Malphite','Malphite',1), ('Jax','Jax',2),
  ('Camille','Camille',3), ('Renekton','Renekton',2),
  ('Warwick','Warwick',2), ('Vi','Vi',2), ('Amumu','Amumu',1), ('LeeSin','Lee Sin',3),
  ('XinZhao','Xin Zhao',2), ('Sejuani','Sejuani',2),
  ('Ahri','Ahri',3), ('Annie','Annie',1), ('Lux','Lux',2), ('Yasuo','Yasuo',3),
  ('Zed','Zed',3), ('Orianna','Orianna',2),
  ('Ashe','Ashe',2), ('Jinx','Jinx',3), ('Caitlyn','Caitlyn',2), ('MissFortune','Miss Fortune',2),
  ('Kaisa','Kai''Sa',3), ('Jhin','Jhin',3),
  ('Soraka','Soraka',1), ('Leona','Leona',2), ('Nautilus','Nautilus',2), ('Lulu','Lulu',2),
  ('Morgana','Morgana',2), ('Thresh','Thresh',3)
on conflict (id) do nothing;

insert into public.champion_routes (champion_id, lane, is_primary) values
  ('Garen','TOP',true),
  ('Darius','TOP',true), ('Darius','JUNGLE',false),
  ('Malphite','TOP',true), ('Malphite','MID',false), ('Malphite','SUPORTE',false),
  ('Jax','TOP',true), ('Jax','JUNGLE',false),
  ('Camille','TOP',true),
  ('Renekton','TOP',true), ('Renekton','MID',false),
  ('Warwick','JUNGLE',true), ('Warwick','TOP',false),
  ('Vi','JUNGLE',true),
  ('Amumu','JUNGLE',true), ('Amumu','SUPORTE',false),
  ('LeeSin','JUNGLE',true), ('LeeSin','TOP',false),
  ('XinZhao','JUNGLE',true),
  ('Sejuani','JUNGLE',true), ('Sejuani','TOP',false),
  ('Ahri','MID',true),
  ('Annie','MID',true), ('Annie','SUPORTE',false),
  ('Lux','MID',true), ('Lux','SUPORTE',false),
  ('Yasuo','MID',true), ('Yasuo','TOP',false), ('Yasuo','ADC',false),
  ('Zed','MID',true), ('Zed','JUNGLE',false),
  ('Orianna','MID',true),
  ('Ashe','ADC',true), ('Ashe','SUPORTE',false),
  ('Jinx','ADC',true), ('Caitlyn','ADC',true), ('MissFortune','ADC',true),
  ('Kaisa','ADC',true), ('Jhin','ADC',true),
  ('Soraka','SUPORTE',true), ('Leona','SUPORTE',true),
  ('Nautilus','SUPORTE',true), ('Nautilus','TOP',false),
  ('Lulu','SUPORTE',true), ('Lulu','MID',false),
  ('Morgana','SUPORTE',true), ('Morgana','MID',false), ('Morgana','JUNGLE',false),
  ('Thresh','SUPORTE',true)
on conflict do nothing;
