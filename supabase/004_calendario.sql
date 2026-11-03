-- ============================================================
-- Findes · migración 004: sincronización con el Calendario del iPhone
-- Pegar entero en Supabase → SQL Editor → Run (se puede repetir).
-- ============================================================

-- 1. Enlace privado de calendario para cada uno
alter table public.members add column if not exists cal_token text;
update public.members
   set cal_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
 where cal_token is null;
do $$ begin
  alter table public.members add constraint members_cal_token_key unique (cal_token);
exception when duplicate_object or duplicate_table then null; end $$;

-- 2. Qué planes sincroniza cada uno (por defecto, ninguno)
create table if not exists public.calendar_sync (
  plan_id  uuid not null references public.plans(id) on delete cascade,
  email    text not null default lower(coalesce(auth.jwt() ->> 'email', '')),
  primary key (plan_id, email)
);
alter table public.calendar_sync enable row level security;
drop policy if exists calendar_sync_own on public.calendar_sync;
create policy calendar_sync_own on public.calendar_sync for all to authenticated
  using (public.is_member() and email = lower(auth.jwt() ->> 'email'))
  with check (public.is_member() and email = lower(auth.jwt() ->> 'email'));

-- 3. Planes sincronizados de quien tiene el enlace (lo usa la función "calendar")
create or replace function public.calendar_feed(p_token text)
returns table (
  id uuid, title text, category text, who text, date_from date, date_to date,
  start_time time, end_time time, location text, status text, notes text, updated_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.id, p.title, p.category, p.who, p.date_from, p.date_to,
         p.start_time, p.end_time, p.location, p.status, p.notes, p.updated_at
    from members m
    join calendar_sync s on s.email = m.email
    join plans p on p.id = s.plan_id
   where length(coalesce(p_token, '')) >= 32 and m.cal_token = p_token
   order by p.date_from;
$$;
revoke all on function public.calendar_feed(text) from public;
grant execute on function public.calendar_feed(text) to anon, authenticated;

select name, length(cal_token) as token_ok from public.members;
