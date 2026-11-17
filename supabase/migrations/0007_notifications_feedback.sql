-- 0007: notificações (sininho) e feedback dos jogadores.
-- Rode inteiro no SQL Editor do Supabase. Pode rodar de novo sem problema.

-- ---------------------------------------------------------------------------
-- Notificações. user_id nulo = aviso para todo mundo (ex.: notas de atualização).
-- "Não lida" = criada depois de profiles.notif_seen_at.
create table if not exists public.notifications (
  id          bigserial primary key,
  user_id     uuid references public.profiles (id) on delete cascade,
  kind        text not null default 'info',   -- info, recompensa, loja, vip, elo, campeonato, atualizacao
  title       text not null,
  body        text,
  link        text,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "notifications: leitura" on public.notifications;
create policy "notifications: leitura" on public.notifications for select
  using (user_id is null or user_id = auth.uid());

alter table public.profiles add column if not exists notif_seen_at timestamptz not null default now();
-- Quem já tinha conta vê o primeiro aviso como novo.
update public.profiles set notif_seen_at = now() - interval '1 day' where notif_seen_at > now() - interval '1 minute';

-- ---------------------------------------------------------------------------
-- Feedback: só o servidor grava e lê (sem leitura pública).
create table if not exists public.feedback (
  id          bigserial primary key,
  user_id     uuid references public.profiles (id) on delete set null,
  kind        text not null default 'sugestao' check (kind in ('sugestao', 'bug', 'elogio', 'outro')),
  body        text not null check (char_length(body) between 3 and 2000),
  page        text,
  created_at  timestamptz not null default now()
);
alter table public.feedback enable row level security;

-- Primeiro aviso geral.
insert into public.notifications (user_id, kind, title, body, link)
select null, 'atualizacao', 'Atualização: página inicial nova e loja maior',
  'Emblemas oficiais dos elos, ranking ao vivo, mais de 5 mil ícones, preços de skin como no LoL, novos títulos e o sininho de notificações.',
  '/'
where not exists (select 1 from public.notifications where title = 'Atualização: página inicial nova e loja maior');
