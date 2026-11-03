-- ============================================================
-- Findes · importación de las notas 2025 y 2026
-- Pegar entero en Supabase → SQL Editor → New query → Run
-- · No toca los findes en los que ya hayáis creado planes en la app.
-- · Se puede ejecutar dos veces sin duplicar nada.
-- · Para deshacerlo:  delete from public.plans where source = 'notas';
-- ============================================================

alter table public.plans add column if not exists source text;

insert into public.plans (title, category, who, date_from, date_to, location, status, source)
select v.title, v.category, v.who, v.date_from, v.date_to, v.location, v.status, 'notas'
from (values
  ('Concierto en Madrid', 'concierto', 'ambos', date '2026-01-09', date '2026-01-09', null, 'confirmado', date '2026-01-09'),
  ('Cumple Noe', 'cumple', 'ambos', date '2026-01-16', date '2026-01-18', null, 'confirmado', date '2026-01-16'),
  ('Comida alumni', 'comida', 'ramon', date '2026-01-30', date '2026-02-01', null, 'confirmado', date '2026-01-30'),
  ('Comida Grupo Gastronómico', 'comida', 'ambos', date '2026-02-06', date '2026-02-08', null, 'confirmado', date '2026-02-06'),
  ('Valladolid', 'viaje', 'ambos', date '2026-02-13', date '2026-02-15', null, 'confirmado', date '2026-02-13'),
  ('Padres de Ramón en Salamanca', 'familia', 'ambos', date '2026-02-20', date '2026-02-22', null, 'confirmado', date '2026-02-20'),
  ('Pijama fuegote', 'otro', 'ambos', date '2026-02-27', date '2026-03-01', null, 'confirmado', date '2026-02-27'),
  ('Badajoz', 'familia', 'ambos', date '2026-03-06', date '2026-03-08', null, 'confirmado', date '2026-03-06'),
  ('Mid Amateur', 'golf', 'ramon', date '2026-03-13', date '2026-03-15', 'Madrid', 'confirmado', date '2026-03-13'),
  ('Copa Sevilla', 'golf', 'ramon', date '2026-03-20', date '2026-03-22', 'Madrid', 'confirmado', date '2026-03-20'),
  ('Irene en El Rompido', 'viaje', 'irene', date '2026-03-27', date '2026-03-29', null, 'confirmado', date '2026-03-27'),
  ('Semana Santa ⛷️🏔️', 'viaje', 'ambos', date '2026-04-03', date '2026-04-05', null, 'confirmado', date '2026-04-03'),
  ('Comida Grupo Gastronómico', 'comida', 'ambos', date '2026-04-10', date '2026-04-12', null, 'confirmado', date '2026-04-10'),
  ('Masters de Augusta', 'golf', 'ramon', date '2026-04-10', date '2026-04-12', null, 'confirmado', date '2026-04-10'),
  ('Despedida Carlos', 'boda', 'ramon', date '2026-04-17', date '2026-04-19', null, 'confirmado', date '2026-04-17'),
  ('Cumple Aitana', 'cumple', 'ambos', date '2026-04-24', date '2026-04-26', 'Badajoz', 'confirmado', date '2026-04-24'),
  ('Gonzalo y fitting', 'golf', 'ramon', date '2026-05-01', date '2026-05-03', null, 'confirmado', date '2026-05-01'),
  ('Concierto Eric Clapton', 'concierto', 'ambos', date '2026-05-08', date '2026-05-10', 'Madrid', 'confirmado', date '2026-05-08'),
  ('Campeonato de España', 'golf', 'ramon', date '2026-05-15', date '2026-05-17', 'Bilbao', 'confirmado', date '2026-05-15'),
  ('Copa Giralda', 'golf', 'ramon', date '2026-05-22', date '2026-05-24', null, 'confirmado', date '2026-05-22'),
  ('Brunch', 'comida', 'ambos', date '2026-05-29', date '2026-05-31', null, 'confirmado', date '2026-05-29'),
  ('Boda Carlos y Bea', 'boda', 'ambos', date '2026-06-12', date '2026-06-14', null, 'confirmado', date '2026-06-12'),
  ('Despedida Carola', 'boda', 'irene', date '2026-06-26', date '2026-06-28', null, 'confirmado', date '2026-06-26'),
  ('Boda Armandito', 'boda', 'ambos', date '2026-06-26', date '2026-06-28', null, 'confirmado', date '2026-06-26'),
  ('Lerma', 'viaje', 'ambos', date '2026-07-03', date '2026-07-05', null, 'confirmado', date '2026-07-03'),
  ('Campeonato Santander', 'golf', 'ramon', date '2026-07-10', date '2026-07-12', null, 'confirmado', date '2026-07-10'),
  ('British Open', 'golf', 'ramon', date '2026-07-17', date '2026-07-19', null, 'confirmado', date '2026-07-17'),
  ('Cena en Madrid', 'comida', 'ambos', date '2026-07-24', date '2026-07-24', 'Madrid', 'confirmado', date '2026-07-24'),
  ('Formentera', 'viaje', 'ambos', date '2026-07-31', date '2026-08-02', null, 'confirmado', date '2026-07-31'),
  ('Ida a St Andrews', 'viaje', 'ambos', date '2026-08-07', date '2026-08-09', null, 'confirmado', date '2026-08-07'),
  ('Vacaciones Escocia', 'viaje', 'ambos', date '2026-08-14', date '2026-08-16', null, 'confirmado', date '2026-08-14'),
  ('Vuelta de Escocia', 'viaje', 'ambos', date '2026-08-21', date '2026-08-23', null, 'confirmado', date '2026-08-21'),
  ('Pedida Carola', 'boda', 'ambos', date '2026-09-04', date '2026-09-06', null, 'confirmado', date '2026-09-04'),
  ('Open de Ferias', 'golf', 'ramon', date '2026-09-04', date '2026-09-06', null, 'confirmado', date '2026-09-04'),
  ('Olivenza', 'familia', 'ambos', date '2026-09-11', date '2026-09-13', null, 'confirmado', date '2026-09-11'),
  ('Feria de la loza', 'viaje', 'ambos', date '2026-09-11', date '2026-09-13', 'Elvas', 'confirmado', date '2026-09-11'),
  ('Ryder Badajoz-Puerto', 'golf', 'ramon', date '2026-09-18', date '2026-09-20', null, 'confirmado', date '2026-09-18'),
  ('Festi Madrid', 'concierto', 'irene', date '2026-09-18', date '2026-09-20', 'Madrid', 'confirmado', date '2026-09-18'),
  ('Torneo con Rosa', 'golf', 'ramon', date '2026-09-25', date '2026-09-27', null, 'confirmado', date '2026-09-25'),
  ('Ordenar la casa en profundidad', 'otro', 'ambos', date '2026-09-25', date '2026-09-27', null, 'confirmado', date '2026-09-25'),
  ('Aniversario de boda', 'boda', 'ambos', date '2026-10-02', date '2026-10-04', null, 'confirmado', date '2026-10-02'),
  ('Boda Tommy', 'boda', 'ambos', date '2026-10-09', date '2026-10-11', null, 'confirmado', date '2026-10-09'),
  ('Boda Carola', 'boda', 'ambos', date '2026-10-09', date '2026-10-11', null, 'confirmado', date '2026-10-09'),
  ('Comida Grupo Gastronómico', 'comida', 'ambos', date '2026-10-16', date '2026-10-18', null, 'confirmado', date '2026-10-16'),
  ('Trabajo', 'trabajo', 'ramon', date '2026-10-30', date '2026-10-30', null, 'confirmado', date '2026-10-30'),
  ('Cumple Irene', 'cumple', 'ambos', date '2026-11-06', date '2026-11-08', 'Madrid', 'confirmado', date '2026-11-06'),
  ('Torneo', 'golf', 'ramon', date '2026-11-13', date '2026-11-15', null, 'confirmado', date '2026-11-13'),
  ('Homenaje', 'familia', 'ambos', date '2026-11-13', date '2026-11-15', 'Badajoz', 'confirmado', date '2026-11-13'),
  ('Trabajo Irene', 'trabajo', 'irene', date '2026-11-20', date '2026-11-22', null, 'confirmado', date '2026-11-20'),
  ('Torneo Movember', 'golf', 'ramon', date '2026-11-20', date '2026-11-22', null, 'confirmado', date '2026-11-20'),
  ('Final Onda Cero', 'golf', 'ramon', date '2026-11-27', date '2026-11-29', 'La Manga', 'confirmado', date '2026-11-27'),
  ('Elecciones', 'otro', 'ambos', date '2026-11-27', date '2026-11-29', null, 'confirmado', date '2026-11-27'),
  ('Jerez', 'viaje', 'ambos', date '2026-12-04', date '2026-12-06', null, 'confirmado', date '2026-12-04'),
  ('Trabajo presencial ESIC', 'trabajo', 'ramon', date '2026-12-11', date '2026-12-13', null, 'confirmado', date '2026-12-11'),
  ('Comida de Navidad NA', 'comida', 'ambos', date '2026-12-18', date '2026-12-20', null, 'confirmado', date '2026-12-18'),
  ('Aniversario', 'viaje', 'ambos', date '2025-01-17', date '2025-01-19', 'Pamplona', 'confirmado', date '2025-01-17'),
  ('Comida Miriam', 'comida', 'ambos', date '2025-01-24', date '2025-01-24', null, 'confirmado', date '2025-01-24'),
  ('Cumple Lau', 'cumple', 'ambos', date '2025-01-31', date '2025-02-02', null, 'confirmado', date '2025-01-31'),
  ('Copa Sevilla', 'golf', 'ramon', date '2025-02-07', date '2025-02-09', null, 'confirmado', date '2025-02-07'),
  ('Quedada 🔥', 'otro', 'ambos', date '2025-02-07', date '2025-02-09', null, 'confirmado', date '2025-02-07'),
  ('Despedida de Ramón', 'boda', 'ramon', date '2025-02-14', date '2025-02-16', null, 'confirmado', date '2025-02-14'),
  ('Quedada Paula y Jonás', 'otro', 'ambos', date '2025-02-14', date '2025-02-16', null, 'confirmado', date '2025-02-14'),
  ('Torneo Golf Securitas', 'golf', 'ramon', date '2025-02-22', date '2025-02-22', null, 'confirmado', date '2025-02-21'),
  ('Viaje padres de Ramón', 'familia', 'ambos', date '2025-03-07', date '2025-03-09', null, 'confirmado', date '2025-03-07'),
  ('Despedida de Irene', 'boda', 'irene', date '2025-03-14', date '2025-03-16', null, 'confirmado', date '2025-03-14'),
  ('Despedida golf Ramón', 'golf', 'ramon', date '2025-03-21', date '2025-03-23', null, 'confirmado', date '2025-03-21'),
  ('Prueba de menú de la boda', 'boda', 'ambos', date '2025-03-28', date '2025-03-30', null, 'confirmado', date '2025-03-28'),
  ('Trabajo', 'trabajo', 'ambos', date '2025-04-04', date '2025-04-06', null, 'confirmado', date '2025-04-04'),
  ('Concierto Morgan', 'concierto', 'ambos', date '2025-04-11', date '2025-04-13', 'Toledo', 'confirmado', date '2025-04-11'),
  ('Semana Santa', 'viaje', 'ambos', date '2025-04-18', date '2025-04-20', null, 'confirmado', date '2025-04-18'),
  ('Copa Giralda', 'golf', 'ramon', date '2025-04-25', date '2025-04-27', null, 'confirmado', date '2025-04-25'),
  ('Mudanza', 'otro', 'ambos', date '2025-05-02', date '2025-05-04', null, 'confirmado', date '2025-05-02'),
  ('Despedida vecinos', 'viaje', 'ambos', date '2025-05-09', date '2025-05-11', 'Granada', 'confirmado', date '2025-05-09'),
  ('Carrera de caballos', 'otro', 'ambos', date '2025-05-16', date '2025-05-18', 'Hipódromo', 'confirmado', date '2025-05-16'),
  ('Viaje a Badajoz con vecinos', 'viaje', 'ambos', date '2025-05-23', date '2025-05-25', 'Badajoz', 'confirmado', date '2025-05-23'),
  ('Florista (tarde)', 'boda', 'ambos', date '2025-05-30', date '2025-05-30', null, 'confirmado', date '2025-05-30'),
  ('Torneo Asoc. Cáncer Valmuza', 'golf', 'ramon', date '2025-05-30', date '2025-06-01', null, 'confirmado', date '2025-05-30'),
  ('Madrid', 'viaje', 'ambos', date '2025-05-30', date '2025-06-01', null, 'pendiente', date '2025-05-30'),
  ('Aniversarios', 'otro', 'ambos', date '2025-06-06', date '2025-06-08', null, 'confirmado', date '2025-06-06'),
  ('Comida en casa de Carola', 'comida', 'ambos', date '2025-06-14', date '2025-06-14', null, 'confirmado', date '2025-06-13'),
  ('Trabajo', 'trabajo', 'ambos', date '2025-06-20', date '2025-06-20', null, 'confirmado', date '2025-06-20'),
  ('Reunión Palacio de Montarco', 'boda', 'ambos', date '2025-06-27', date '2025-06-27', null, 'confirmado', date '2025-06-27'),
  ('Cursillos', 'boda', 'ambos', date '2025-06-27', date '2025-06-29', null, 'confirmado', date '2025-06-27'),
  ('Boda Cris', 'boda', 'ambos', date '2025-07-04', date '2025-07-06', 'Burgos', 'confirmado', date '2025-07-04'),
  ('Boda Pablito', 'boda', 'ambos', date '2025-07-18', date '2025-07-20', 'Puerto de Santa María', 'confirmado', date '2025-07-18'),
  ('Vacaciones', 'viaje', 'ambos', date '2025-08-15', date '2025-08-17', null, 'confirmado', date '2025-08-15'),
  ('Vacaciones', 'viaje', 'ambos', date '2025-08-22', date '2025-08-24', null, 'confirmado', date '2025-08-22'),
  ('Nuestra pedida', 'boda', 'ambos', date '2025-09-05', date '2025-09-07', null, 'confirmado', date '2025-09-05'),
  ('Ryder Badajoz-Puerto', 'golf', 'ramon', date '2025-09-12', date '2025-09-14', null, 'confirmado', date '2025-09-12'),
  ('Facultad de Farmacia', 'otro', 'ambos', date '2025-09-20', date '2025-09-20', null, 'confirmado', date '2025-09-19'),
  ('Ryder Cup Europa-USA', 'golf', 'ramon', date '2025-09-26', date '2025-09-28', null, 'confirmado', date '2025-09-26'),
  ('Nuestra boda', 'boda', 'ambos', date '2025-10-03', date '2025-10-05', null, 'confirmado', date '2025-10-03'),
  ('Viaje de novios (1)', 'viaje', 'ambos', date '2025-10-10', date '2025-10-12', null, 'confirmado', date '2025-10-10'),
  ('Viaje de novios (2)', 'viaje', 'ambos', date '2025-10-17', date '2025-10-19', null, 'confirmado', date '2025-10-17'),
  ('Premios Salamanca y concierto', 'concierto', 'ambos', date '2025-10-24', date '2025-10-26', null, 'confirmado', date '2025-10-24'),
  ('Badajoz', 'familia', 'ambos', date '2025-10-31', date '2025-11-02', null, 'confirmado', date '2025-10-31'),
  ('Boda Paula y Jonás', 'boda', 'ambos', date '2025-11-07', date '2025-11-09', null, 'confirmado', date '2025-11-07'),
  ('Torneo', 'golf', 'ramon', date '2025-11-15', date '2025-11-15', null, 'confirmado', date '2025-11-14'),
  ('Campo', 'golf', 'ramon', date '2025-11-16', date '2025-11-16', null, 'confirmado', date '2025-11-14'),
  ('Comida Deusto', 'comida', 'ambos', date '2025-11-22', date '2025-11-22', null, 'confirmado', date '2025-11-21'),
  ('Cena fuegote', 'comida', 'ambos', date '2025-11-28', date '2025-11-28', null, 'confirmado', date '2025-11-28'),
  ('Sevilla', 'viaje', 'ambos', date '2025-11-28', date '2025-11-30', null, 'confirmado', date '2025-11-28'),
  ('Puerto de Santa María', 'viaje', 'ambos', date '2025-12-05', date '2025-12-07', null, 'confirmado', date '2025-12-05'),
  ('Clase ESIC', 'trabajo', 'ramon', date '2025-12-13', date '2025-12-13', null, 'confirmado', date '2025-12-12'),
  ('Concierto Morgan', 'concierto', 'ambos', date '2025-12-19', date '2025-12-19', 'Salamanca', 'confirmado', date '2025-12-19'),
  ('Madrid San', 'otro', 'ambos', date '2025-12-20', date '2025-12-20', null, 'confirmado', date '2025-12-19'),
  ('Comida Rivas', 'comida', 'ambos', date '2025-12-27', date '2025-12-27', null, 'confirmado', date '2025-12-26')
) as v(title, category, who, date_from, date_to, location, status, friday)
where not exists (
  select 1 from public.plans p
  where p.date_from <= v.friday + 2 and p.date_to >= v.friday
);

-- Notas de entre semana
insert into public.week_notes (weekend, text) values
  (date '2025-04-25', 'Miércoles 23: cena Raquel')
on conflict (weekend) do nothing;

-- Días de puente que aparecían en las notas (findes largos)
insert into public.extra_days (day, label) values
  (date '2025-08-11', 'Puente'),
  (date '2025-08-12', 'Puente'),
  (date '2026-08-10', 'Puente'),
  (date '2026-08-11', 'Puente')
on conflict (day) do nothing;

select count(*) as planes_importados from public.plans where source = 'notas';
