-- NEXUS DRAFT: +10 campeões (40 no total, 8 por rota principal) e campos das novas regras.
-- Como aplicar: Supabase Dashboard → SQL Editor → colar e executar.

insert into public.champions (id, name, tier) values
  ('Fiora','Fiora',3), ('Sett','Sett',2), ('Graves','Graves',2), ('Ekko','Ekko',3),
  ('Syndra','Syndra',2), ('Katarina','Katarina',3), ('Ezreal','Ezreal',3), ('Vayne','Vayne',3),
  ('Nami','Nami',2), ('Blitzcrank','Blitzcrank',2)
on conflict (id) do nothing;

insert into public.champion_routes (champion_id, lane, is_primary) values
  ('Fiora','TOP',true),
  ('Sett','TOP',true), ('Sett','SUPORTE',false),
  ('Graves','JUNGLE',true), ('Graves','TOP',false),
  ('Ekko','JUNGLE',true), ('Ekko','MID',false),
  ('Syndra','MID',true),
  ('Katarina','MID',true),
  ('Ezreal','ADC',true),
  ('Vayne','ADC',true), ('Vayne','TOP',false),
  ('Nami','SUPORTE',true),
  ('Blitzcrank','SUPORTE',true)
on conflict do nothing;

-- Times montados com sobras: campeão fora da rota (rende metade) e forma de aquisição nova.
alter table public.rosters add column if not exists off_role boolean not null default false;
alter table public.rosters drop constraint if exists rosters_acquired_how_check;
alter table public.rosters add constraint rosters_acquired_how_check
  check (acquired_how in ('leilao', 'sobra', 'sorteio', 'unico'));

-- Configurações da sala inspiradas no 100pracada
alter table public.rooms add column if not exists show_overall boolean not null default true;
alter table public.room_members add column if not exists ready boolean not null default false;
