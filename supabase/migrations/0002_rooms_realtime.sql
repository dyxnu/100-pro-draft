-- =====================================================================
-- NEXUS DRAFT: Fase 2 (salas e leilão em tempo real)
-- Como aplicar: Supabase Dashboard → SQL Editor → colar e executar.
-- =====================================================================

-- Velocidade da sala (normal = 10 s por lance; rapido = 5 s)
alter table public.rooms
  add column if not exists speed text not null default 'normal'
  check (speed in ('normal', 'rapido'));

create index if not exists rooms_status_idx on public.rooms (status);
create index if not exists room_members_user_idx on public.room_members (user_id);

-- Atualizações em tempo real (Supabase Realtime respeita o RLS de leitura)
do $$
declare t text;
begin
  foreach t in array array['rooms', 'room_members', 'auctions'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
