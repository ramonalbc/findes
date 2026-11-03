-- ============================================================
-- Findes · esquema de base de datos (Supabase / PostgreSQL)
-- Pegar entero en Supabase → SQL Editor → New query → Run
-- Se puede ejecutar más de una vez sin romper nada.
-- ============================================================

-- 1. Miembros: solo estas dos personas pueden ver y editar datos
create table if not exists public.members (
  email   text primary key,
  person  text not null check (person in ('ramon', 'irene')),
  name    text not null
);

insert into public.members (email, person, name) values
  ('ramonalbc@gmail.com',  'ramon', 'Ramón'),
  ('irenepzgil@gmail.com', 'irene', 'Irene')
on conflict (email) do update set person = excluded.person, name = excluded.name;

create or replace function public.is_member()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.members
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- 2. Planes
create table if not exists public.plans (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(trim(title)) > 0),
  category    text not null default 'otro',
  who         text not null default 'ambos' check (who in ('ramon', 'irene', 'ambos')),
  date_from   date not null,
  date_to     date not null,
  start_time  time,
  end_time    time,
  location    text,
  status      text not null default 'confirmado' check (status in ('confirmado', 'pendiente')),
  notes       text,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (date_to >= date_from)
);
create index if not exists plans_dates_idx on public.plans (date_from, date_to);

-- 3. Nota "entre semana" de cada finde (clave = viernes del finde)
create table if not exists public.week_notes (
  weekend     date primary key,
  text        text not null default '',
  updated_at  timestamptz not null default now()
);

-- 4. Días extra marcados a mano (puente, vacaciones) que alargan un finde
create table if not exists public.extra_days (
  day    date primary key,
  label  text not null default 'Puente'
);

-- 5. Mantener updated_at al día
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists plans_touch on public.plans;
create trigger plans_touch before update on public.plans
  for each row execute function public.touch_updated_at();

drop trigger if exists week_notes_touch on public.week_notes;
create trigger week_notes_touch before update on public.week_notes
  for each row execute function public.touch_updated_at();

-- 6. Seguridad: nadie fuera de members puede leer ni escribir nada
alter table public.members    enable row level security;
alter table public.plans      enable row level security;
alter table public.week_notes enable row level security;
alter table public.extra_days enable row level security;

drop policy if exists members_read on public.members;
create policy members_read on public.members
  for select to authenticated using (public.is_member());

drop policy if exists plans_all on public.plans;
create policy plans_all on public.plans
  for all to authenticated using (public.is_member()) with check (public.is_member());

drop policy if exists week_notes_all on public.week_notes;
create policy week_notes_all on public.week_notes
  for all to authenticated using (public.is_member()) with check (public.is_member());

drop policy if exists extra_days_all on public.extra_days;
create policy extra_days_all on public.extra_days
  for all to authenticated using (public.is_member()) with check (public.is_member());

-- 7. Tiempo real: que los cambios de uno le lleguen al otro al momento
do $$
declare t text;
begin
  foreach t in array array['plans', 'week_notes', 'extra_days'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
