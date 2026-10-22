-- ============================================================================
-- Iglesia Mundial del Mesias - Bolivia
-- 04 - Datos iniciales (ejecutar DESPUES de 01, 02 y 03)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Primer administrador
--    Registrate primero desde la app (creando una cuenta con el codigo
--    IGLESIA) y despues ejecuta esta linea con tu correo:
-- ---------------------------------------------------------------------------
-- update public.profiles set rol = 'administrador' where email = 'tucorreo@ejemplo.com';

-- ---------------------------------------------------------------------------
-- 2. Codigo de invitacion inicial (permite crear la primera cuenta)
-- ---------------------------------------------------------------------------
insert into public.invitaciones (codigo, descripcion, rol_sugerido)
values ('IGLESIA', 'Invitacion general de la iglesia', 'miembro')
on conflict (codigo) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Cronogramas base del anio en curso (regla RN02)
--    15 dias de anticipacion minima. Ajusta las fechas segun el calendario
--    real de la iglesia desde la app (Administrador > Cronogramas).
-- ---------------------------------------------------------------------------
insert into public.cronogramas (tipo, anio, dias_anticipacion)
select t.tipo, extract(year from current_date)::int, 15
from (values ('nensai'), ('ireisai'), ('shinrei'), ('senzo'), ('mitamaeshi'), ('eidai')) as t(tipo)
where not exists (
    select 1 from public.cronogramas c
    where c.tipo = t.tipo and c.anio = extract(year from current_date)::int
);

-- ---------------------------------------------------------------------------
-- 4. Feriados nacionales de Bolivia (para ajuste de cultos de antepasados)
--    Los feriados moviles (Carnaval, Corpus Christi) se ajustan por anio.
-- ---------------------------------------------------------------------------
insert into public.feriados (fecha, descripcion)
select make_date(extract(year from current_date)::int, m, d), descripcion
from (values
    (1, 1, 'Anio Nuevo'),
    (1, 22, 'Fundacion del Estado Plurinacional'),
    (5, 1, 'Dia del Trabajo'),
    (6, 21, 'Anio Nuevo Aymara'),
    (8, 6, 'Dia de la Independencia'),
    (11, 2, 'Dia de los Difuntos'),
    (12, 25, 'Navidad')
) as f(m, d, descripcion)
on conflict (fecha) do nothing;
