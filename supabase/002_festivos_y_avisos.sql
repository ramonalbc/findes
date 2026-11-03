-- ============================================================
-- Findes · migración 002: festivos propios y avisos al otro
-- Pegar entero en Supabase → SQL Editor → Run (se puede repetir).
-- IMPORTANTE: antes de ejecutar, cambia CAMBIAR_SECRETO por el secreto
-- que te pasó Claude (el mismo que pongas en la función "notify").
-- ============================================================

-- 1. Festivos declarados a mano: extra_days pasa a tener tipo
alter table public.extra_days add column if not exists kind text not null default 'puente';
do $$ begin
  alter table public.extra_days add constraint extra_days_kind_chk check (kind in ('puente', 'festivo'));
exception when duplicate_object then null; end $$;

-- 2. Suscripciones a avisos (una por iPhone)
create table if not exists public.push_subscriptions (
  endpoint    text primary key,
  email       text not null default lower(coalesce(auth.jwt() ->> 'email', '')),
  p256dh      text not null,
  auth        text not null,
  device      text,
  created_at  timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_own on public.push_subscriptions;
create policy push_own on public.push_subscriptions for all to authenticated
  using (public.is_member() and email = lower(auth.jwt() ->> 'email'))
  with check (public.is_member() and email = lower(auth.jwt() ->> 'email'));

-- 3. Configuración privada (no accesible desde la app)
create table if not exists public.app_config (key text primary key, value text not null);
alter table public.app_config enable row level security;   -- sin políticas: nadie la lee por la API
insert into public.app_config (key, value) values
  ('notify_url', 'https://sfizuisbomgkvvkvylmq.supabase.co/functions/v1/notify'),
  ('notify_secret', 'CAMBIAR_SECRETO')
on conflict (key) do update set value = excluded.value;

-- 4. Registro de cambios (también servirá para una futura pantalla de "novedades")
create table if not exists public.activity (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  actor_email text not null,
  kind        text not null,      -- plan / nota / dia
  action      text not null,      -- insert / update / delete
  title       text,
  detail      text,
  url         text
);
alter table public.activity enable row level security;
drop policy if exists activity_read on public.activity;
create policy activity_read on public.activity for select to authenticated using (public.is_member());

create extension if not exists pg_net;

-- Fecha corta en castellano: "sáb 14 nov"
create or replace function public.fmt_dia(d date) returns text language sql immutable as $$
  select (array['dom','lun','mar','mié','jue','vie','sáb'])[extract(dow from d)::int + 1]
      || ' ' || extract(day from d)::int || ' '
      || (array['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'])[extract(month from d)::int];
$$;

create or replace function public.fmt_rango(a date, b date) returns text language sql immutable as $$
  select case when a = b then public.fmt_dia(a) else public.fmt_dia(a) || ' – ' || public.fmt_dia(b) end;
$$;

-- Viernes del finde al que pertenece una fecha (lun/mar → finde anterior)
create or replace function public.viernes_de(d date) returns date language sql immutable as $$
  select case extract(isodow from d)::int
    when 5 then d when 6 then d - 1 when 7 then d - 2
    when 1 then d - 3 when 2 then d - 4
    else d + (5 - extract(isodow from d)::int) end;
$$;

-- Envía el aviso a los dispositivos del OTRO miembro
create or replace function public.send_push(p_actor text, p_title text, p_body text, p_url text, p_to_self boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare subs jsonb; v_url text; v_secret text;
begin
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth)), '[]'::jsonb)
    into subs
    from push_subscriptions
   where (p_to_self and email = p_actor) or (not p_to_self and email <> p_actor);
  if jsonb_array_length(subs) = 0 then return; end if;
  select value into v_url from app_config where key = 'notify_url';
  select value into v_secret from app_config where key = 'notify_secret';
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('title', p_title, 'body', p_body, 'url', p_url, 'subs', subs),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-findes-secret', v_secret)
  );
end;
$$;

create or replace function public.on_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor text := lower(coalesce(auth.jwt() ->> 'email', ''));
  name  text;
  t     text; b text; u text; changes text[] := '{}';
  r     record;
begin
  if actor = '' then return coalesce(new, old); end if;          -- cambios desde el SQL Editor: sin aviso
  select m.name into name from members m where m.email = actor;
  if name is null then return coalesce(new, old); end if;

  if tg_table_name = 'plans' then
    r := coalesce(new, old);
    u := '#/finde/' || viernes_de(r.date_from);
    if tg_op = 'INSERT' then
      t := name || ' ha añadido un plan';
      b := '«' || r.title || '» · ' || fmt_rango(r.date_from, r.date_to)
           || coalesce(' a las ' || left(r.start_time::text, 5), '');
    elsif tg_op = 'DELETE' then
      t := name || ' ha borrado un plan';
      b := '«' || r.title || '» · ' || fmt_rango(r.date_from, r.date_to);
    else
      if new.title is distinct from old.title then changes := array_append(changes, ('nombre')::text); end if;
      if (new.date_from, new.date_to) is distinct from (old.date_from, old.date_to) then changes := array_append(changes, (('fecha: ' || fmt_rango(new.date_from, new.date_to)))::text); end if;
      if (new.start_time, new.end_time) is distinct from (old.start_time, old.end_time) then
        changes := array_append(changes, (('hora: ' || coalesce(left(new.start_time::text, 5), 'sin hora')))::text); end if;
      if new.who is distinct from old.who then
        changes := array_append(changes, (('quién: ' || case new.who when 'ambos' then 'los dos' when 'ramon' then 'Ramón' else 'Irene' end))::text); end if;
      if new.status is distinct from old.status then changes := array_append(changes, (new.status)::text); end if;
      if new.location is distinct from old.location then changes := array_append(changes, ('lugar')::text); end if;
      if new.notes is distinct from old.notes then changes := array_append(changes, ('notas')::text); end if;
      if new.category is distinct from old.category then changes := array_append(changes, ('categoría')::text); end if;
      if cardinality(changes) = 0 then return new; end if;
      t := name || ' ha cambiado un plan';
      b := '«' || new.title || '» · ' || array_to_string(changes, ', ');
    end if;
    insert into activity (actor_email, kind, action, title, detail, url) values (actor, 'plan', lower(tg_op), t, b, u);

  elsif tg_table_name = 'week_notes' then
    if tg_op = 'DELETE' or coalesce(new.text, '') = '' then return coalesce(new, old); end if;
    if tg_op = 'UPDATE' and new.text is not distinct from old.text then return new; end if;
    t := name || ' ha escrito una nota';
    b := 'Semana del finde del ' || fmt_dia(new.weekend) || ': «' || left(new.text, 120) || '»';
    u := '#/finde/' || new.weekend;
    insert into activity (actor_email, kind, action, title, detail, url) values (actor, 'nota', lower(tg_op), t, b, u);

  elsif tg_table_name = 'extra_days' then
    r := coalesce(new, old);
    t := name || case when tg_op = 'DELETE' then ' ha quitado ' else ' ha marcado ' end
         || case when r.kind = 'festivo' then 'un festivo' else 'un puente' end;
    b := fmt_dia(r.day) || case when r.kind = 'festivo' then ' · ' || r.label else '' end;
    u := '#/finde/' || viernes_de(r.day);
    insert into activity (actor_email, kind, action, title, detail, url) values (actor, 'dia', lower(tg_op), t, b, u);
  end if;

  perform send_push(actor, t, b, u);
  return coalesce(new, old);
end;
$$;

drop trigger if exists plans_notify on public.plans;
create trigger plans_notify after insert or update or delete on public.plans
  for each row execute function public.on_change();
drop trigger if exists week_notes_notify on public.week_notes;
create trigger week_notes_notify after insert or update on public.week_notes
  for each row execute function public.on_change();
drop trigger if exists extra_days_notify on public.extra_days;
create trigger extra_days_notify after insert or delete on public.extra_days
  for each row execute function public.on_change();

-- 5. Aviso de prueba a tus propios dispositivos (botón en Ajustes)
create or replace function public.test_push() returns void
language plpgsql security definer set search_path = public as $$
declare actor text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if not is_member() then raise exception 'sin acceso'; end if;
  perform send_push(actor, 'Findes', 'Los avisos funcionan en este iPhone 👍', '#/', true);
end;
$$;
grant execute on function public.test_push() to authenticated;
