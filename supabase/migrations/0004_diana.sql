-- 100 pro Draft: Diana entra no catálogo (Jungle / Mid).
insert into public.champions (id, name, tier) values ('Diana', 'Diana', 3) on conflict (id) do nothing;
insert into public.champion_routes (champion_id, lane, is_primary) values
  ('Diana', 'JUNGLE', true), ('Diana', 'MID', false)
on conflict do nothing;
