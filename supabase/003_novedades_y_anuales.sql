-- ============================================================
-- Findes · migración 003
--   · Borra el año 2024
--   · Planes que se repiten cada año (+ propuestas descartadas)
--   · Novedades en tiempo real
-- Pegar entero en Supabase → SQL Editor → Run (se puede repetir).
-- ============================================================

-- 1. Fuera 2024 (los findes cuyo domingo cae en 2024)
delete from public.plans      where date_from <= date '2024-12-29';
delete from public.week_notes where weekend   <= date '2024-12-27';
delete from public.extra_days where day       <= date '2024-12-31';

-- 2. Repetición anual de un plan
alter table public.plans add column if not exists repeat text;
do $$ begin
  alter table public.plans add constraint plans_repeat_chk check (repeat in ('fecha', 'finde'));
exception when duplicate_object then null; end $$;

-- Propuestas que se han descartado para un año concreto
create table if not exists public.repeat_dismissed (
  plan_id  uuid not null references public.plans(id) on delete cascade,
  year     int  not null,
  primary key (plan_id, year)
);
alter table public.repeat_dismissed enable row level security;
drop policy if exists repeat_dismissed_all on public.repeat_dismissed;
create policy repeat_dismissed_all on public.repeat_dismissed for all to authenticated
  using (public.is_member()) with check (public.is_member());

-- Marcado inicial de los planes de 2026 que se repiten (se puede cambiar luego en la app)
update public.plans set repeat = 'finde'
 where date_from between date '2026-01-01' and date '2026-12-31' and repeat is null
   and lower(title) in ('copa sevilla', 'masters de augusta', 'copa giralda', 'campeonato santander',
     'british open', 'ryder badajoz-puerto', 'mid amateur', 'open de ferias', 'torneo movember',
     'comida de navidad na', 'formentera');
update public.plans set repeat = 'fecha'
 where date_from between date '2026-01-01' and date '2026-12-31' and repeat is null
   and lower(title) in ('cumple noe', 'cumple aitana', 'cumple irene', 'aniversario de boda');

-- 3. Novedades y propuestas en tiempo real
do $$
declare t text;
begin
  foreach t in array array['activity', 'repeat_dismissed'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

select
  (select count(*) from public.plans where repeat is not null) as planes_anuales,
  (select count(*) from public.plans where date_from < date '2025-01-01') as quedan_de_2024;
