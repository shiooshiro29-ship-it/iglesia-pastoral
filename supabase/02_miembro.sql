-- ============================================================================
-- Iglesia Mundial del Mesias - Bolivia
-- 02 - Sistema de Seguimiento de Miembros (pastoral)
-- Port de las tablas y endpoints PHP (api/miembros.php, api/reportes.php)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------------
create table if not exists public.miembros (
    id                            uuid primary key default gen_random_uuid(),
    usuario_id                    uuid not null unique references public.profiles(id) on delete cascade,
    fecha_ingreso                 date not null default current_date,
    nivel_inicial_oracion         integer not null default 1 check (nivel_inicial_oracion between 1 and 5),
    nivel_inicial_cancion         integer not null default 1 check (nivel_inicial_cancion between 1 and 5),
    nivel_inicial_alimentacion    integer not null default 1 check (nivel_inicial_alimentacion between 1 and 5),
    notas_entrevista_inicial      text,
    estado                        text not null default 'nuevo'
                                  check (estado in ('nuevo','en_seguimiento','estable','inactivo')),
    created_at                    timestamptz not null default now(),
    updated_at                    timestamptz not null default now()
);

create table if not exists public.entrevistas (
    id                bigint generated always as identity primary key,
    perfil_id         uuid not null references public.miembros(id) on delete cascade,
    entrevistador_id  uuid not null references public.profiles(id),
    fecha             date not null default current_date,
    tipo              text not null default 'inicial' check (tipo in ('inicial','seguimiento')),
    nivel_oracion     integer check (nivel_oracion between 1 and 5),
    nivel_cancion     integer check (nivel_cancion between 1 and 5),
    nivel_alimentacion integer check (nivel_alimentacion between 1 and 5),
    observaciones     text,
    created_at        timestamptz not null default now()
);

create table if not exists public.visitas (
    id            bigint generated always as identity primary key,
    perfil_id     uuid not null references public.miembros(id) on delete cascade,
    visitador_id  uuid not null references public.profiles(id),
    fecha         date not null default current_date,
    tipo          text not null default 'domicilio' check (tipo in ('domicilio','hospital','escuela','otra')),
    motivo        text,
    observaciones text,
    created_at    timestamptz not null default now()
);

create table if not exists public.estudios (
    id            bigint generated always as identity primary key,
    perfil_id     uuid not null references public.miembros(id) on delete cascade,
    instructor_id uuid not null references public.profiles(id),
    fecha         date not null default current_date,
    tema          text not null,
    duracion_min  integer default 60,
    notas         text,
    created_at    timestamptz not null default now()
);

create table if not exists public.lecturas (
    id               bigint generated always as identity primary key,
    perfil_id        uuid not null references public.miembros(id) on delete cascade,
    titulo           text not null,
    autor            text,
    fecha_asignada   date not null default current_date,
    fecha_completada date,
    notas            text,
    estado           text not null default 'pendiente' check (estado in ('pendiente','en_progreso','completada')),
    created_at       timestamptz not null default now()
);

create table if not exists public.planes (
    id           bigint generated always as identity primary key,
    perfil_id    uuid not null references public.miembros(id) on delete cascade,
    creado_por   uuid not null references public.profiles(id),
    fecha_inicio date not null default current_date,
    fecha_fin    date,
    estado       text not null default 'activo' check (estado in ('activo','completado','cancelado')),
    notas        text,
    created_at   timestamptz not null default now()
);

create table if not exists public.actividades (
    id          bigint generated always as identity primary key,
    plan_id     bigint not null references public.planes(id) on delete cascade,
    pilar       text not null check (pilar in ('oracion','cancion','alimentacion')),
    actividad   text not null,
    meta        text,
    frecuencia  text not null default 'semanal' check (frecuencia in ('diaria','semanal','mensual')),
    estado      text not null default 'pendiente' check (estado in ('pendiente','en_progreso','completada')),
    created_at  timestamptz not null default now()
);

create table if not exists public.registros (
    id            bigint generated always as identity primary key,
    actividad_id  bigint not null references public.actividades(id) on delete cascade,
    fecha         date not null default current_date,
    cumplido      boolean not null default false,
    notas         text,
    created_at    timestamptz not null default now()
);

create index if not exists idx_entrevistas_perfil on public.entrevistas (perfil_id, fecha desc);
create index if not exists idx_visitas_perfil on public.visitas (perfil_id, fecha desc);
create index if not exists idx_estudios_perfil on public.estudios (perfil_id, fecha desc);
create index if not exists idx_lecturas_perfil on public.lecturas (perfil_id);
create index if not exists idx_planes_perfil on public.planes (perfil_id);
create index if not exists idx_actividades_plan on public.actividades (plan_id);
create index if not exists idx_registros_actividad on public.registros (actividad_id);

-- ---------------------------------------------------------------------------
-- 2. Alta automatica del perfil pastoral al crear la identidad
-- ---------------------------------------------------------------------------
create or replace function public.crear_miembro_automatico()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    insert into public.miembros (usuario_id) values (new.id) on conflict (usuario_id) do nothing;
    return new;
end;
$$;

drop trigger if exists trg_crear_miembro on public.profiles;
create trigger trg_crear_miembro
    after insert on public.profiles
    for each row execute function public.crear_miembro_automatico();

-- Backfill de perfiles ya existentes
insert into public.miembros (usuario_id)
select p.id from public.profiles p
where not exists (select 1 from public.miembros m where m.usuario_id = p.id);

-- ---------------------------------------------------------------------------
-- 3. RLS de las tablas
--    La logica de negocio (que puede ver o escribir quien) vive en las funciones
--    de la seccion 4. Estas politicas son la red de seguridad: un miembro
--    nunca puede leer datos de otro miembro.
-- ---------------------------------------------------------------------------
alter table public.miembros     enable row level security;
alter table public.entrevistas  enable row level security;
alter table public.visitas      enable row level security;
alter table public.estudios     enable row level security;
alter table public.lecturas     enable row level security;
alter table public.planes       enable row level security;
alter table public.actividades  enable row level security;
alter table public.registros    enable row level security;

create or replace function public.perfil_de_usuario(p_usuario uuid)
returns uuid language sql stable security definer set search_path = public as $$
    select m.id from public.miembros m where m.usuario_id = p_usuario;
$$;

-- Miembros: cada quien ve el suyo; el equipo pastoral ve todos.
drop policy if exists "miembros_select" on public.miembros;
create policy "miembros_select" on public.miembros
    for select using (usuario_id = auth.uid() or public.es_disciplinador());

drop policy if exists "miembros_update" on public.miembros;
create policy "miembros_update" on public.miembros
    for update using (public.es_disciplinador()) with check (public.es_disciplinador());

-- Tablas hijas: el dueño y el equipo pastoral.
drop policy if exists "entrevistas_select" on public.entrevistas;
create policy "entrevistas_select" on public.entrevistas
    for select using (perfil_id = public.perfil_de_usuario(auth.uid()) or public.es_disciplinador());

drop policy if exists "visitas_select" on public.visitas;
create policy "visitas_select" on public.visitas
    for select using (perfil_id = public.perfil_de_usuario(auth.uid()) or public.es_disciplinador());

drop policy if exists "estudios_select" on public.estudios;
create policy "estudios_select" on public.estudios
    for select using (perfil_id = public.perfil_de_usuario(auth.uid()) or public.es_disciplinador());

drop policy if exists "lecturas_select" on public.lecturas;
create policy "lecturas_select" on public.lecturas
    for select using (perfil_id = public.perfil_de_usuario(auth.uid()) or public.es_disciplinador());

drop policy if exists "lecturas_update_owner" on public.lecturas;
create policy "lecturas_update_owner" on public.lecturas
    for update using (perfil_id = public.perfil_de_usuario(auth.uid()) or public.es_disciplinador())
    with check (perfil_id = public.perfil_de_usuario(auth.uid()) or public.es_disciplinador());

drop policy if exists "planes_select" on public.planes;
create policy "planes_select" on public.planes
    for select using (perfil_id = public.perfil_de_usuario(auth.uid()) or public.es_disciplinador());

drop policy if exists "actividades_select" on public.actividades;
create policy "actividades_select" on public.actividades
    for select using (
        plan_id in (select pl.id from public.planes pl
                    where pl.perfil_id = public.perfil_de_usuario(auth.uid()))
        or public.es_disciplinador()
    );

drop policy if exists "registros_select" on public.registros;
create policy "registros_select" on public.registros
    for select using (
        actividad_id in (select a.id from public.actividades a
                         join public.planes pl on pl.id = a.plan_id
                         where pl.perfil_id = public.perfil_de_usuario(auth.uid()))
        or public.es_disciplinador()
    );

drop policy if exists "registros_insert_owner" on public.registros;
create policy "registros_insert_owner" on public.registros
    for insert with check (
        actividad_id in (select a.id from public.actividades a
                         join public.planes pl on pl.id = a.plan_id
                         where pl.perfil_id = public.perfil_de_usuario(auth.uid()))
        or public.es_disciplinador()
    );

-- ---------------------------------------------------------------------------
-- 4. Funciones de negocio (equivalente a api/miembros.php y api/reportes.php)
-- ---------------------------------------------------------------------------

-- Lista de miembros con niveles actuales y contadores
create or replace function public.mb_listar_miembros(p_filtro text default null, p_estado text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_filtro text := lower(trim(coalesce(p_filtro, '')));
    v_estado text := lower(trim(coalesce(p_estado, '')));
    v_res jsonb;
begin
    if not public.es_disciplinador() then
        raise exception 'No tienes permiso' using errcode = '42501';
    end if;

    select coalesce(jsonb_agg(t order by t.nombre), '[]'::jsonb) into v_res
    from (
        select
            p.id                       as usuario_id,
            p.nombre, p.username, p.sector, p.telefono, p.email, p.rol,
            m.id                       as perfil_id,
            m.estado, m.fecha_ingreso,
            m.nivel_inicial_oracion, m.nivel_inicial_cancion, m.nivel_inicial_alimentacion,
            (select count(*) from public.entrevistas e where e.perfil_id = m.id) as n_entrevistas,
            (select count(*) from public.visitas v where v.perfil_id = m.id) as n_visitas,
            (select count(*) from public.estudios es where es.perfil_id = m.id) as n_estudios,
            (select count(*) from public.lecturas l where l.perfil_id = m.id and l.estado <> 'completada') as lecturas_pendientes,
            (select count(*) from public.planes pl where pl.perfil_id = m.id and pl.estado = 'activo') as planes_activos,
            coalesce((select e.nivel_oracion from public.entrevistas e where e.perfil_id = m.id order by e.id desc limit 1), m.nivel_inicial_oracion) as oracion,
            coalesce((select e.nivel_cancion from public.entrevistas e where e.perfil_id = m.id order by e.id desc limit 1), m.nivel_inicial_cancion) as cancion,
            coalesce((select e.nivel_alimentacion from public.entrevistas e where e.perfil_id = m.id order by e.id desc limit 1), m.nivel_inicial_alimentacion) as alimentacion,
            round((
                coalesce((select e.nivel_oracion from public.entrevistas e where e.perfil_id = m.id order by e.id desc limit 1), m.nivel_inicial_oracion)
              + coalesce((select e.nivel_cancion from public.entrevistas e where e.perfil_id = m.id order by e.id desc limit 1), m.nivel_inicial_cancion)
              + coalesce((select e.nivel_alimentacion from public.entrevistas e where e.perfil_id = m.id order by e.id desc limit 1), m.nivel_inicial_alimentacion)
            )::numeric / 3, 1) as promedio
        from public.profiles p
        left join public.miembros m on m.usuario_id = p.id
        where (v_filtro = ''
               or lower(p.nombre) like '%' || v_filtro || '%'
               or lower(coalesce(p.username, '')) like '%' || v_filtro || '%')
          and (v_estado = '' or m.estado = v_estado)
    ) t;

    return v_res;
end;
$$;

-- Ficha completa de un miembro
create or replace function public.mb_perfil_miembro(p_usuario uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_uid       uuid := auth.uid();
    v_perfil    public.miembros%rowtype;
    v_prof      public.profiles%rowtype;
    v_perfil_id uuid;
    v_niv       jsonb;
    v_planes    jsonb;
begin
    if v_uid is null then
        raise exception 'No autenticado' using errcode = '42501';
    end if;
    if v_uid <> p_usuario and not public.es_disciplinador() then
        raise exception 'No tienes permiso' using errcode = '42501';
    end if;

    select * into v_prof from public.profiles where id = p_usuario;
    if not found then
        raise exception 'Miembro no encontrado' using errcode = 'P0002';
    end if;

    select * into v_perfil from public.miembros where usuario_id = p_usuario;
    if not found then
        insert into public.miembros (usuario_id) values (p_usuario) returning * into v_perfil;
    end if;
    v_perfil_id := v_perfil.id;

    v_niv := jsonb_build_object(
        'oracion',      coalesce((select e.nivel_oracion from public.entrevistas e where e.perfil_id = v_perfil_id order by e.id desc limit 1), v_perfil.nivel_inicial_oracion),
        'cancion',      coalesce((select e.nivel_cancion from public.entrevistas e where e.perfil_id = v_perfil_id order by e.id desc limit 1), v_perfil.nivel_inicial_cancion),
        'alimentacion', coalesce((select e.nivel_alimentacion from public.entrevistas e where e.perfil_id = v_perfil_id order by e.id desc limit 1), v_perfil.nivel_inicial_alimentacion)
    );
    v_niv := v_niv || jsonb_build_object(
        'promedio', round(((v_niv ->> 'oracion')::numeric + (v_niv ->> 'cancion')::numeric + (v_niv ->> 'alimentacion')::numeric) / 3, 1)
    );

    select coalesce(jsonb_agg(
        to_jsonb(pl) || jsonb_build_object(
            'cumplimiento', (select case when count(*) = 0 then 0
                                     else round((count(*) filter (where r.cumplido)::numeric / count(*) * 100), 1) end
                               from public.registros r
                               join public.actividades a on a.id = r.actividad_id
                               where a.plan_id = pl.id),
            'creador', (select pr.nombre from public.profiles pr where pr.id = pl.creado_por),
            'actividades', coalesce((select jsonb_agg(a order by a.id)
                                     from public.actividades a where a.plan_id = pl.id), '[]'::jsonb)
        ) order by pl.created_at desc
    ), '[]'::jsonb) into v_planes
    from public.planes pl
    where pl.perfil_id = v_perfil_id;

    return jsonb_build_object(
        'perfil', jsonb_build_object(
            'usuario_id', v_prof.id,
            'nombre', v_prof.nombre,
            'username', v_prof.username,
            'sector', v_prof.sector,
            'telefono', v_prof.telefono,
            'email', v_prof.email,
            'rol', v_prof.rol,
            'perfil_id', v_perfil.id,
            'estado', v_perfil.estado,
            'fecha_ingreso', v_perfil.fecha_ingreso,
            'notas_entrevista_inicial', v_perfil.notas_entrevista_inicial,
            'nivel_inicial_oracion', v_perfil.nivel_inicial_oracion,
            'nivel_inicial_cancion', v_perfil.nivel_inicial_cancion,
            'nivel_inicial_alimentacion', v_perfil.nivel_inicial_alimentacion,
            'niveles', v_niv
        ),
        'entrevistas', coalesce((
            select jsonb_agg(to_jsonb(e) || jsonb_build_object('entrevistador', pr.nombre) order by e.fecha desc)
            from public.entrevistas e
            join public.profiles pr on pr.id = e.entrevistador_id
            where e.perfil_id = v_perfil_id
        ), '[]'::jsonb),
        'visitas', coalesce((
            select jsonb_agg(to_jsonb(v) || jsonb_build_object('visitador', pr.nombre) order by v.fecha desc)
            from public.visitas v
            join public.profiles pr on pr.id = v.visitador_id
            where v.perfil_id = v_perfil_id
        ), '[]'::jsonb),
        'estudios', coalesce((
            select jsonb_agg(to_jsonb(es) || jsonb_build_object('instructor', pr.nombre) order by es.fecha desc)
            from public.estudios es
            join public.profiles pr on pr.id = es.instructor_id
            where es.perfil_id = v_perfil_id
        ), '[]'::jsonb),
        'lecturas', coalesce((
            select jsonb_agg(l order by l.fecha_asignada desc)
            from public.lecturas l where l.perfil_id = v_perfil_id
        ), '[]'::jsonb),
        'planes', v_planes
    );
end;
$$;

-- Mis actividades (para el miembro)
create or replace function public.mb_mi_actividad()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_uid uuid := auth.uid();
    v_perfil_id uuid;
begin
    if v_uid is null then
        raise exception 'No autenticado' using errcode = '42501';
    end if;

    select id into v_perfil_id from public.miembros where usuario_id = v_uid;
    if v_perfil_id is null then
        insert into public.miembros (usuario_id) values (v_uid) returning id into v_perfil_id;
    end if;

    return coalesce((
        select jsonb_agg(to_jsonb(a) || jsonb_build_object(
            'plan_id', pl.id,
            'plan_estado', pl.estado,
            'cumplidos', (select count(*) from public.registros r where r.actividad_id = a.id and r.cumplido),
            'registros', coalesce((select jsonb_agg(r order by r.fecha desc)
                                   from (select * from public.registros
                                         where actividad_id = a.id
                                         order by fecha desc limit 10) r), '[]'::jsonb)
        ) order by a.id desc)
        from public.planes pl
        join public.actividades a on a.plan_id = pl.id
        where pl.perfil_id = v_perfil_id and pl.estado <> 'cancelado'
    ), '[]'::jsonb);
end;
$$;

-- Guardar / actualizar el perfil pastoral
create or replace function public.mb_guardar_perfil(
    p_usuario uuid,
    p_nivel_oracion integer default 1,
    p_nivel_cancion integer default 1,
    p_nivel_alimentacion integer default 1,
    p_estado text default 'nuevo',
    p_notas text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_uid uuid := auth.uid();
    v_perfil_id uuid;
begin
    if v_uid <> p_usuario and not public.es_disciplinador() then
        raise exception 'No tienes permiso' using errcode = '42501';
    end if;
    if p_estado not in ('nuevo','en_seguimiento','estable','inactivo') then
        p_estado := 'nuevo';
    end if;

    insert into public.miembros (usuario_id)
    values (p_usuario)
    on conflict (usuario_id) do update set
        nivel_inicial_oracion = greatest(1, least(5, coalesce(p_nivel_oracion, 1))),
        nivel_inicial_cancion = greatest(1, least(5, coalesce(p_nivel_cancion, 1))),
        nivel_inicial_alimentacion = greatest(1, least(5, coalesce(p_nivel_alimentacion, 1))),
        estado = p_estado,
        notas_entrevista_inicial = coalesce(p_notas, notas_entrevista_inicial),
        updated_at = now()
    returning id into v_perfil_id;

    return jsonb_build_object('perfil_id', v_perfil_id, 'mensaje', 'Perfil actualizado');
end;
$$;

-- Registrar entrevista
create or replace function public.mb_registrar_entrevista(
    p_usuario_id uuid,
    p_fecha date default null,
    p_tipo text default 'seguimiento',
    p_nivel_oracion integer default 1,
    p_nivel_cancion integer default 1,
    p_nivel_alimentacion integer default 1,
    p_observaciones text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_uid uuid := auth.uid();
    v_perfil_id uuid;
    v_id bigint;
    v_total integer;
begin
    if not public.es_disciplinador() then
        raise exception 'No tienes permiso' using errcode = '42501';
    end if;
    if p_tipo not in ('inicial','seguimiento') then
        p_tipo := 'seguimiento';
    end if;

    insert into public.miembros (usuario_id) values (p_usuario_id)
    on conflict (usuario_id) do nothing;
    select id into v_perfil_id from public.miembros where usuario_id = p_usuario_id;
    if v_perfil_id is null then
        raise exception 'Miembro requerido' using errcode = 'P0002';
    end if;

    insert into public.entrevistas
        (perfil_id, entrevistador_id, fecha, tipo, nivel_oracion, nivel_cancion, nivel_alimentacion, observaciones)
    values
        (v_perfil_id, v_uid, coalesce(p_fecha, current_date), p_tipo,
         greatest(1, least(5, coalesce(p_nivel_oracion, 1))),
         greatest(1, least(5, coalesce(p_nivel_cancion, 1))),
         greatest(1, least(5, coalesce(p_nivel_alimentacion, 1))),
         p_observaciones)
    returning id into v_id;

    select count(*) into v_total from public.entrevistas where perfil_id = v_perfil_id;
    if v_total = 1 then
        update public.miembros
        set notas_entrevista_inicial = coalesce(nullif(notas_entrevista_inicial, ''), p_observaciones),
            updated_at = now()
        where id = v_perfil_id;
    end if;

    update public.miembros set estado = 'en_seguimiento', updated_at = now()
    where id = v_perfil_id and estado in ('nuevo', 'inactivo');

    return jsonb_build_object('mensaje', 'Entrevista registrada', 'id', v_id);
end;
$$;

-- Registrar visita
create or replace function public.mb_registrar_visita(
    p_usuario_id uuid,
    p_fecha date default null,
    p_tipo text default 'domicilio',
    p_motivo text default null,
    p_observaciones text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_uid uuid := auth.uid();
    v_perfil_id uuid;
    v_id bigint;
begin
    if not public.es_disciplinador() then
        raise exception 'No tienes permiso' using errcode = '42501';
    end if;
    if p_tipo not in ('domicilio','hospital','escuela','otra') then
        p_tipo := 'domicilio';
    end if;

    insert into public.miembros (usuario_id) values (p_usuario_id)
    on conflict (usuario_id) do nothing;
    select id into v_perfil_id from public.miembros where usuario_id = p_usuario_id;
    if v_perfil_id is null then
        raise exception 'Miembro requerido' using errcode = 'P0002';
    end if;

    insert into public.visitas (perfil_id, visitador_id, fecha, tipo, motivo, observaciones)
    values (v_perfil_id, v_uid, coalesce(p_fecha, current_date), p_tipo, p_motivo, p_observaciones)
    returning id into v_id;

    return jsonb_build_object('mensaje', 'Visita registrada', 'id', v_id);
end;
$$;

-- Registrar estudio
create or replace function public.mb_registrar_estudio(
    p_usuario_id uuid,
    p_tema text,
    p_fecha date default null,
    p_duracion_min integer default 60,
    p_notas text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_uid uuid := auth.uid();
    v_perfil_id uuid;
    v_id bigint;
begin
    if not public.es_disciplinador() then
        raise exception 'No tienes permiso' using errcode = '42501';
    end if;
    if p_tema is null or trim(p_tema) = '' then
        raise exception 'El tema es obligatorio' using errcode = '22023';
    end if;

    insert into public.miembros (usuario_id) values (p_usuario_id)
    on conflict (usuario_id) do nothing;
    select id into v_perfil_id from public.miembros where usuario_id = p_usuario_id;
    if v_perfil_id is null then
        raise exception 'Miembro requerido' using errcode = 'P0002';
    end if;

    insert into public.estudios (perfil_id, instructor_id, fecha, tema, duracion_min, notas)
    values (v_perfil_id, v_uid, coalesce(p_fecha, current_date), p_tema, p_duracion_min, p_notas)
    returning id into v_id;

    return jsonb_build_object('mensaje', 'Estudio registrado', 'id', v_id);
end;
$$;

-- Asignar lectura
create or replace function public.mb_asignar_lectura(
    p_usuario_id uuid,
    p_titulo text,
    p_autor text default null,
    p_fecha_asignada date default null,
    p_notas text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_perfil_id uuid;
    v_id bigint;
begin
    if not public.es_disciplinador() then
        raise exception 'No tienes permiso' using errcode = '42501';
    end if;
    if p_titulo is null or trim(p_titulo) = '' then
        raise exception 'El titulo es obligatorio' using errcode = '22023';
    end if;

    insert into public.miembros (usuario_id) values (p_usuario_id)
    on conflict (usuario_id) do nothing;
    select id into v_perfil_id from public.miembros where usuario_id = p_usuario_id;
    if v_perfil_id is null then
        raise exception 'Miembro requerido' using errcode = 'P0002';
    end if;

    insert into public.lecturas (perfil_id, titulo, autor, fecha_asignada, notas, estado)
    values (v_perfil_id, p_titulo, p_autor, coalesce(p_fecha_asignada, current_date), p_notas, 'pendiente')
    returning id into v_id;

    return jsonb_build_object('mensaje', 'Lectura asignada', 'id', v_id);
end;
$$;

-- Actualizar estado de una lectura
create or replace function public.mb_actualizar_lectura(
    p_id bigint,
    p_estado text,
    p_notas text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_perfil_id uuid;
begin
    if p_estado not in ('pendiente','en_progreso','completada') then
        raise exception 'Estado de lectura invalido' using errcode = '22023';
    end if;
    select perfil_id into v_perfil_id from public.lecturas where id = p_id;
    if v_perfil_id is null then
        raise exception 'Lectura no encontrada' using errcode = 'P0002';
    end if;
    if v_perfil_id <> public.perfil_de_usuario(auth.uid()) and not public.es_disciplinador() then
        raise exception 'No tienes permiso' using errcode = '42501';
    end if;

    update public.lecturas
    set estado = p_estado,
        fecha_completada = case when p_estado = 'completada' then current_date else null end,
        notas = p_notas
    where id = p_id;

    return jsonb_build_object('mensaje', 'Lectura actualizada');
end;
$$;

-- Crear plan de seguimiento (con actividades sugeridas si no se envian)
create or replace function public.mb_crear_plan(
    p_usuario_id uuid,
    p_fecha_inicio date default null,
    p_fecha_fin date default null,
    p_notas text default null,
    p_actividades jsonb default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_uid uuid := auth.uid();
    v_perfil_id uuid;
    v_plan_id bigint;
    v_o integer; v_c integer; v_a integer;
    v_enviado boolean;
    v_act jsonb;
    v_pilar text;
begin
    if not public.es_disciplinador() then
        raise exception 'No tienes permiso' using errcode = '42501';
    end if;

    insert into public.miembros (usuario_id) values (p_usuario_id)
    on conflict (usuario_id) do nothing;
    select id into v_perfil_id from public.miembros where usuario_id = p_usuario_id;
    if v_perfil_id is null then
        raise exception 'Miembro requerido' using errcode = 'P0002';
    end if;

    insert into public.planes (perfil_id, creado_por, fecha_inicio, fecha_fin, estado, notas)
    values (v_perfil_id, v_uid, coalesce(p_fecha_inicio, current_date), p_fecha_fin, 'activo', p_notas)
    returning id into v_plan_id;

    -- Niveles actuales para la sugerencia automatica
    select
        coalesce((select e.nivel_oracion from public.entrevistas e where e.perfil_id = v_perfil_id order by e.id desc limit 1),
                 (select nivel_inicial_oracion from public.miembros where id = v_perfil_id)),
        coalesce((select e.nivel_cancion from public.entrevistas e where e.perfil_id = v_perfil_id order by e.id desc limit 1),
                 (select nivel_inicial_cancion from public.miembros where id = v_perfil_id)),
        coalesce((select e.nivel_alimentacion from public.entrevistas e where e.perfil_id = v_perfil_id order by e.id desc limit 1),
                 (select nivel_inicial_alimentacion from public.miembros where id = v_perfil_id))
    into v_o, v_c, v_a;

    foreach v_pilar in array array['oracion','cancion','alimentacion'] loop
        v_enviado := false;
        if p_actividades is not null then
            for v_act in select * from jsonb_array_elements(p_actividades) loop
                if lower(coalesce(v_act ->> 'pilar', '')) = v_pilar
                   and coalesce(v_act ->> 'actividad', '') <> '' then
                    insert into public.actividades (plan_id, pilar, actividad, meta, frecuencia)
                    values (v_plan_id, v_pilar, v_act ->> 'actividad', v_act ->> 'meta',
                            coalesce(nullif(v_act ->> 'frecuencia', ''), 'semanal'));
                    v_enviado := true;
                    exit;
                end if;
            end loop;
        end if;

        if not v_enviado then
            if v_pilar = 'oracion' then
                insert into public.actividades (plan_id, pilar, actividad, meta, frecuencia)
                values (v_plan_id, v_pilar,
                    case when v_o <= 2 then 'Oracion personal diaria (5 minutos matutina)'
                         when v_o = 3 then 'Oracion personal diaria (15 minutos, 2 momentos)'
                         else 'Oracion personal diaria + intercesion' end,
                    case when v_o <= 2 then 'Obtener constancia de 7 dias seguidos'
                         else 'Mantener practica y sumar breve ayuno/meditacion' end,
                    'semanal');
            elsif v_pilar = 'cancion' then
                insert into public.actividades (plan_id, pilar, actividad, meta, frecuencia)
                values (v_plan_id, v_pilar,
                    case when v_c <= 2 then 'Aprender 1 cancion de alabanza semanal'
                         when v_c = 3 then 'Cantar 2-3 canciones de alabanza a la semana'
                         else 'Participar en el coro / liderar alabanza familiar' end,
                    case when v_c <= 2 then 'Memorizar y entonar la cancion con conviccion'
                         else 'Transmitir alabanza a la familia' end,
                    'semanal');
            else
                insert into public.actividades (plan_id, pilar, actividad, meta, frecuencia)
                values (v_plan_id, v_pilar,
                    case when v_a <= 2 then 'Estudio de la Palabra 3 veces por semana (15 min)'
                         when v_a = 3 then 'Estudio diario de la Palabra (20 min)'
                         else 'Estudio diario profundo + compartir ensenanzas' end,
                    case when v_a <= 2 then 'Completar un capitulo de la enseñanza semanal'
                         else 'Llevar registro y discipular a alguien' end,
                    'semanal');
            end if;
        end if;
    end loop;

    update public.miembros set estado = 'en_seguimiento', updated_at = now()
    where id = v_perfil_id and estado in ('nuevo', 'inactivo');

    return jsonb_build_object('mensaje', 'Plan creado', 'id', v_plan_id);
end;
$$;

-- Registrar cumplimiento de una actividad
create or replace function public.mb_registrar_progreso(
    p_actividad_id bigint,
    p_cumplido boolean default true,
    p_fecha date default null,
    p_notas text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_perfil_id uuid;
    v_id bigint;
begin
    select pl.perfil_id into v_perfil_id
    from public.actividades a join public.planes pl on pl.id = a.plan_id
    where a.id = p_actividad_id;

    if v_perfil_id is null then
        raise exception 'Actividad requerida' using errcode = 'P0002';
    end if;
    if v_perfil_id <> public.perfil_de_usuario(auth.uid()) and not public.es_disciplinador() then
        raise exception 'No tienes permiso' using errcode = '42501';
    end if;

    insert into public.registros (actividad_id, fecha, cumplido, notas)
    values (p_actividad_id, coalesce(p_fecha, current_date), coalesce(p_cumplido, true), p_notas)
    returning id into v_id;

    return jsonb_build_object('mensaje', 'Progreso registrado', 'id', v_id);
end;
$$;

-- Dashboard del equipo pastoral
create or replace function public.mb_dashboard()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_res jsonb;
begin
    if not public.es_disciplinador() then
        raise exception 'No tienes permiso' using errcode = '42501';
    end if;

    select jsonb_build_object(
        'total_miembros', (select count(*) from public.miembros),
        'total_activos', (select count(*) from public.miembros where estado in ('nuevo','en_seguimiento','estable')),
        'visitas_mes', (select count(*) from public.visitas where to_char(fecha, 'YYYY-MM') = to_char(current_date, 'YYYY-MM')),
        'estudios_mes', (select count(*) from public.estudios where to_char(fecha, 'YYYY-MM') = to_char(current_date, 'YYYY-MM')),
        'lecturas_pendientes', (select count(*) from public.lecturas where estado <> 'completada'),
        'planes_activos', (select count(*) from public.planes where estado = 'activo'),
        'por_estado', coalesce((select jsonb_agg(x order by x.estado) from (
                                  select estado, count(*)::int as total from public.miembros group by estado) x), '[]'::jsonb),
        'recientes', coalesce((
            select jsonb_agg(x order by x.ultima_actividad desc nulls last) from (
                select p.id, p.nombre, m.estado,
                       greatest(
                           (select max(v.fecha) from public.visitas v where v.perfil_id = m.id),
                           (select max(es.fecha) from public.estudios es where es.perfil_id = m.id),
                           (select max(e.fecha) from public.entrevistas e where e.perfil_id = m.id),
                           m.fecha_ingreso
                       ) as ultima_actividad,
                       (select max(e.fecha) from public.entrevistas e where e.perfil_id = m.id) as ultima_entrevista
                from public.miembros m
                join public.profiles p on p.id = m.usuario_id
            ) x), '[]'::jsonb)
    ) into v_res;

    return v_res;
end;
$$;

-- Reporte consolidado
create or replace function public.mb_reporte_consolidado()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_res jsonb;
begin
    if not public.es_disciplinador() then
        raise exception 'No tienes permiso para reportes' using errcode = '42501';
    end if;

    select jsonb_build_object(
        'total', (select count(*) from public.miembros),
        'por_estado', coalesce((select jsonb_agg(x order by x.estado) from (
                                  select estado, count(*)::int as total from public.miembros group by estado) x), '[]'::jsonb),
        'promedio_pilares', jsonb_build_object(
            'oracion', (select round(avg(n), 1) from (
                select coalesce((select e.nivel_oracion from public.entrevistas e where e.perfil_id = m.id order by e.id desc limit 1), m.nivel_inicial_oracion) as n
                from public.miembros m) t),
            'cancion', (select round(avg(n), 1) from (
                select coalesce((select e.nivel_cancion from public.entrevistas e where e.perfil_id = m.id order by e.id desc limit 1), m.nivel_inicial_cancion) as n
                from public.miembros m) t),
            'alimentacion', (select round(avg(n), 1) from (
                select coalesce((select e.nivel_alimentacion from public.entrevistas e where e.perfil_id = m.id order by e.id desc limit 1), m.nivel_inicial_alimentacion) as n
                from public.miembros m) t)
        ),
        'total_visitas', (select count(*) from public.visitas),
        'total_estudios', (select count(*) from public.estudios),
        'lecturas_completadas', (select count(*) from public.lecturas where estado = 'completada'),
        'planes_activos', (select count(*) from public.planes where estado = 'activo'),
        'por_mes', coalesce((select jsonb_agg(x order by x.mes) from (
                              select to_char(v.fecha, 'YYYY-MM') as mes, count(*)::int as total
                              from public.visitas v
                              where v.fecha >= (current_date - interval '5 months')::date
                              group by 1) x), '[]'::jsonb)
    ) into v_res;

    return v_res;
end;
$$;

-- Reporte / trazabilidad de un miembro
create or replace function public.mb_reporte_miembro(p_usuario uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_perfil_id uuid;
    v_res jsonb;
begin
    if not public.es_disciplinador() then
        raise exception 'No tienes permiso para reportes' using errcode = '42501';
    end if;

    select id into v_perfil_id from public.miembros where usuario_id = p_usuario;
    if v_perfil_id is null then
        raise exception 'Miembro no encontrado' using errcode = 'P0002';
    end if;

    select jsonb_build_object(
        'perfil', (select jsonb_build_object(
                'id', p.id, 'nombre', p.nombre, 'username', p.username, 'sector', p.sector,
                'estado', m.estado, 'fecha_ingreso', m.fecha_ingreso, 'updated_at', m.updated_at)
            from public.miembros m join public.profiles p on p.id = m.usuario_id
            where m.id = v_perfil_id),
        'linea_tiempo', coalesce((
            select jsonb_agg(x order by x.fecha) from (
                select 'entrevista' as tipo, e.fecha, 'Entrevista' as titulo
                from public.entrevistas e where e.perfil_id = v_perfil_id
                union all
                select 'visita', v.fecha, 'Visita (' || v.tipo || ')'
                from public.visitas v where v.perfil_id = v_perfil_id
                union all
                select 'estudio', es.fecha, 'Estudio'
                from public.estudios es where es.perfil_id = v_perfil_id
                union all
                select 'lectura', l.fecha_asignada, 'Lectura asignada'
                from public.lecturas l where l.perfil_id = v_perfil_id
            ) x), '[]'::jsonb),
        'evolucion', coalesce((
            select jsonb_agg(e order by e.fecha)
            from public.entrevistas e where e.perfil_id = v_perfil_id
        ), '[]'::jsonb)
    ) into v_res;

    return v_res;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Permisos de ejecucion
-- ---------------------------------------------------------------------------
grant execute on function public.perfil_de_usuario(uuid) to anon, authenticated;
grant execute on function public.mb_listar_miembros(text, text) to authenticated;
grant execute on function public.mb_perfil_miembro(uuid) to authenticated;
grant execute on function public.mb_mi_actividad() to authenticated;
grant execute on function public.mb_guardar_perfil(uuid, integer, integer, integer, text, text) to authenticated;
grant execute on function public.mb_registrar_entrevista(uuid, date, text, integer, integer, integer, text) to authenticated;
grant execute on function public.mb_registrar_visita(uuid, date, text, text, text) to authenticated;
grant execute on function public.mb_registrar_estudio(uuid, text, date, integer, text) to authenticated;
grant execute on function public.mb_asignar_lectura(uuid, text, text, date, text) to authenticated;
grant execute on function public.mb_actualizar_lectura(bigint, text, text) to authenticated;
grant execute on function public.mb_crear_plan(uuid, date, date, text, jsonb) to authenticated;
grant execute on function public.mb_registrar_progreso(bigint, boolean, date, text) to authenticated;
grant execute on function public.mb_dashboard() to authenticated;
grant execute on function public.mb_reporte_consolidado() to authenticated;
grant execute on function public.mb_reporte_miembro(uuid) to authenticated;
