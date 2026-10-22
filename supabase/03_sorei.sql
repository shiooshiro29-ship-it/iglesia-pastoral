-- ============================================================================
-- Iglesia Mundial del Mesias - Bolivia
-- 03 - Sorei Saishi: servicios conmemorativos y ancestrales
-- Port de las tablas y endpoints PHP (api/*.php)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------------
create table if not exists public.feriados (
    id bigserial primary key,
    fecha date not null unique,
    descripcion text,
    creado_en timestamptz default now()
);

create table if not exists public.antepasados (
    id                  bigint generated always as identity primary key,
    miembro_id          uuid not null references public.profiles(id) on delete cascade,
    nombres             text not null,
    apellidos           text,
    ci                  text,
    sexo                text check (sexo in ('masculino','femenino')),
    edad_fallecimiento  integer,
    fecha_fallecimiento date,
    es_miembro          boolean default false,
    solicitante_id      uuid references public.profiles(id),
    tipo_relacion       text,
    parentesco          text,
    fallecimiento_id    bigint,
    aniversario         text,
    notas               text,
    creado_en           timestamptz not null default now()
);

create table if not exists public.solicitudes (
    id             bigint generated always as identity primary key,
    solicitante_id uuid not null references public.profiles(id),
    tipo           text not null check (tipo in ('senzo','nensai','ireisai','shinrei','mitamaeshi','eidai')),
    antepasado_id  bigint references public.antepasados(id),
    fecha_evento   date,
    fecha_solicitud date not null default current_date,
    estado         text not null default 'pendiente_validacion'
                   check (estado in ('pendiente_validacion','en_revision','aprobada','registrada','observada','extemporanea','transferida')),
    fuera_plazo    boolean not null default false,
    primera_vez    boolean not null default false,
    observaciones  text,
    creado_en      timestamptz not null default now()
);

create table if not exists public.firma_eidai (
    id           bigint generated always as identity primary key,
    solicitud_id bigint not null references public.solicitudes(id) on delete cascade,
    nivel        text not null check (nivel in ('proponente','iglesia','region')),
    firmante_id  uuid references public.profiles(id),
    estado       text not null default 'pendiente' check (estado in ('pendiente','firmado','rechazado')),
    fecha        date,
    observaciones text
);

create table if not exists public.fallecimientos (
    id                    bigint generated always as identity primary key,
    fallecido_nombres     text not null,
    apellidos             text,
    ci                    text,
    sexo                  text check (sexo in ('masculino','femenino')),
    edad_fallecimiento    integer,
    fecha_fallecimiento   date,
    es_miembro            boolean default false,
    solicitante_id        uuid not null references public.profiles(id),
    tipo_relacion         text,
    certificado           text,
    estado                text not null default 'registrado',
    transferido           boolean not null default false,
    alerta                boolean not null default false,
    convertido_a_antepasado boolean default false,
    antepasado_id         bigint,
    creado_en             timestamptz not null default now()
);

create table if not exists public.transferencias (
    id          bigint generated always as identity primary key,
    registro_id bigint not null,
    tipo_origen text not null check (tipo_origen in ('fallecimiento','solicitud')),
    destino     text not null default 'Sede Nacional Santa Cruz',
    fecha       date not null default current_date,
    estado      text not null default 'enviada',
    datos_json  jsonb,
    creado_en   timestamptz not null default now()
);

create table if not exists public.orientaciones (
    id            bigint generated always as identity primary key,
    solicitante_id uuid not null references public.profiles(id),
    ministro_id   uuid not null references public.profiles(id),
    fecha         date not null default current_date,
    contenido     text,
    atendida      boolean not null default false,
    creado_en     timestamptz not null default now()
);

create table if not exists public.calendario_cultos (
    id           bigint generated always as identity primary key,
    solicitud_id bigint references public.solicitudes(id),
    fecha        date not null,
    hora         text,
    lugar        text,
    estado       text not null default 'programado' check (estado in ('programado','realizado','cancelado')),
    notas        text,
    creado_en    timestamptz not null default now()
);

create table if not exists public.cultos_antepasados (
    id                       bigint generated always as identity primary key,
    fallecimiento_id         bigint not null references public.fallecimientos(id) on delete cascade,
    antepasado_id            bigint references public.antepasados(id),
    tipo                     text not null check (tipo in ('decenal','anual')),
    dias_desde_fallecimiento integer,
    anio                     integer,
    fecha_objetivo           date not null,
    fecha_culto              date,
    fecha_aviso              date,
    es_domingo               boolean default false,
    es_feriado               boolean default false,
    ajustado                 boolean default false,
    avisado                  boolean default false,
    fecha_aviso_registrado   timestamptz,
    avisado_por              uuid references public.profiles(id),
    programado_culto_id      bigint references public.calendario_cultos(id),
    estado                   text not null default 'pendiente' check (estado in ('pendiente','avisado','programado','realizado','omitido')),
    notas                    text,
    created_at               timestamptz default now(),
    updated_at               timestamptz default now()
);

alter table public.cultos_antepasados add column if not exists anio integer;

create index if not exists idx_cultos_antepasados_culto on public.cultos_antepasados (fecha_culto, estado);
create index if not exists idx_cultos_antepasados_aviso on public.cultos_antepasados (fecha_aviso, avisado);
create index if not exists idx_cultos_antepasados_fallec on public.cultos_antepasados (fallecimiento_id);
create unique index if not exists uq_cultos_antepasados_hito on public.cultos_antepasados (fallecimiento_id, tipo, coalesce(dias_desde_fallecimiento, -1), coalesce(anio, -1));

create table if not exists public.cronogramas (
    id                bigint generated always as identity primary key,
    tipo              text not null check (tipo in ('nensai','ireisai','shinrei','senzo','mitamaeshi','eidai')),
    anio              integer not null,
    fecha_inicio      date,
    fecha_fin         date,
    dias_anticipacion integer not null default 15,
    creado_en         timestamptz not null default now()
);

create index if not exists idx_solicitudes_estado on public.solicitudes (estado);
create index if not exists idx_solicitudes_solicitante on public.solicitudes (solicitante_id);
create index if not exists idx_solicitudes_tipo on public.solicitudes (tipo);
create index if not exists idx_firma_solicitud on public.firma_eidai (solicitud_id);
create index if not exists idx_calendario_fecha on public.calendario_cultos (fecha);
create index if not exists idx_antepasados_miembro on public.antepasados (miembro_id);

-- ---------------------------------------------------------------------------
-- 2. RLS
-- ---------------------------------------------------------------------------
alter table public.antepasados       enable row level security;
alter table public.solicitudes       enable row level security;
alter table public.firma_eidai       enable row level security;
alter table public.fallecimientos     enable row level security;
alter table public.transferencias    enable row level security;
alter table public.orientaciones     enable row level security;
alter table public.feriados enable row level security;
alter table public.cultos_antepasados enable row level security;

drop policy if exists "feriados_select" on public.feriados;
create policy "feriados_select" on public.feriados for select using (auth.uid() is not null);

drop policy if exists "cultos_antepasados_all" on public.cultos_antepasados;
create policy "cultos_antepasados_all" on public.cultos_antepasados for all using (public.es_gestor() or auth.uid() = (select solicitante_id from public.fallecimientos f where f.id = fallecimiento_id)) with check (public.es_gestor() or auth.uid() = (select solicitante_id from public.fallecimientos f where f.id = fallecimiento_id));
alter table public.cronogramas       enable row level security;

drop policy if exists "antepasados_select" on public.antepasados;
create policy "antepasados_select" on public.antepasados
    for select using (miembro_id = auth.uid() or public.es_gestor());

drop policy if exists "solicitudes_select" on public.solicitudes;
create policy "solicitudes_select" on public.solicitudes
    for select using (solicitante_id = auth.uid() or public.es_gestor());

drop policy if exists "firma_select" on public.firma_eidai;
create policy "firma_select" on public.firma_eidai
    for select using (
        solicitud_id in (select id from public.solicitudes where solicitante_id = auth.uid())
        or public.es_gestor()
    );

drop policy if exists "fallecimientos_select" on public.fallecimientos;
create policy "fallecimientos_select" on public.fallecimientos
    for select using (solicitante_id = auth.uid() or public.es_gestor());

drop policy if exists "orientaciones_select" on public.orientaciones;
create policy "orientaciones_select" on public.orientaciones
    for select using (solicitante_id = auth.uid() or public.es_ministro());

drop policy if exists "cultos_select" on public.calendario_cultos;
create policy "cultos_select" on public.calendario_cultos
    for select using (true);

drop policy if exists "transferencias_select" on public.transferencias;
create policy "transferencias_select" on public.transferencias
    for select using (public.es_gestor());

drop policy if exists "cronogramas_select" on public.cronogramas;
create policy "cronogramas_select" on public.cronogramas
    for select using (public.es_gestor());

-- ---------------------------------------------------------------------------
-- 3. Reglas de negocio (RN02 plazos, UC7/UC8 validacion, UC12 orientacion,
--    UC13 firmas Eidai, UC10 transferencias)
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- Ajuste por domingo / feriado para cultos de antepasados
-- ---------------------------------------------------------------------------
create or replace function public.ss_es_domingo(p_fecha date)
returns boolean language sql immutable as $$
  select extract(dow from p_fecha) = 0;
$$;

create or replace function public.ss_es_feriado(p_fecha date)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.feriados where fecha = p_fecha);
$$;

create or replace function public.ss_ajustar_culto_antepasado(p_fecha date)
returns table(fecha_culto date, fecha_aviso date, es_domingo boolean, es_feriado boolean, ajustado boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  v_dom boolean;
  v_fer boolean;
begin
  if p_fecha is null then return; end if;
  v_dom := (extract(dow from p_fecha) = 0);
  v_fer := exists(select 1 from public.feriados where fecha = p_fecha);
  if v_dom or v_fer then
    return query select (p_fecha - 1), (p_fecha - 2), v_dom, v_fer, true;
  else
    return query select p_fecha, (p_fecha - 1), false, false, false;
  end if;
end;
$$;

create or replace function public.ss_generar_cultos_antepasados(p_fallecimiento_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_fal public.fallecimientos%rowtype;
  v_ant_id bigint;
  v_dias int;
  v_fecha_obj date;
  v_adj record;
  v_anio_siguiente date;
begin
  select * into v_fal from public.fallecimientos where id = p_fallecimiento_id;
  if not found or v_fal.fecha_fallecimiento is null then return; end if;
  select antepasado_id into v_ant_id from public.fallecimientos where id = p_fallecimiento_id;
  foreach v_dias in array array[10,20,30,40,50] loop
    v_fecha_obj := v_fal.fecha_fallecimiento + v_dias;
    select * into v_adj from public.ss_ajustar_culto_antepasado(v_fecha_obj);
    insert into public.cultos_antepasados (fallecimiento_id,antepasado_id,tipo,dias_desde_fallecimiento,fecha_objetivo,fecha_culto,fecha_aviso,es_domingo,es_feriado,ajustado)
    values (p_fallecimiento_id,v_ant_id,'decenal',v_dias,v_fecha_obj,v_adj.fecha_culto,v_adj.fecha_aviso,v_adj.es_domingo,v_adj.es_feriado,v_adj.ajustado)
    on conflict do nothing;
  end loop;
  v_anio_siguiente := make_date(
    extract(year from v_fal.fecha_fallecimiento)::int + 1,
    extract(month from v_fal.fecha_fallecimiento)::int,
    extract(day from v_fal.fecha_fallecimiento)::int
  );
  select * into v_adj from public.ss_ajustar_culto_antepasado(v_anio_siguiente);
  insert into public.cultos_antepasados (fallecimiento_id,antepasado_id,tipo,dias_desde_fallecimiento,fecha_objetivo,fecha_culto,fecha_aviso,es_domingo,es_feriado,ajustado,anio)
  values (p_fallecimiento_id,v_ant_id,'anual',null,v_anio_siguiente,v_adj.fecha_culto,v_adj.fecha_aviso,v_adj.es_domingo,v_adj.es_feriado,v_adj.ajustado,extract(year from v_anio_siguiente)::int)
  on conflict do nothing;
end;
$$;

-- Regenera el proximo aniversario anual de cada fallecido.
-- Idempotente: crea el hito anual del anio correspondiente si no existe.
create or replace function public.ss_regenerar_anuales_antepasados(p_anio integer default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_fal record;
  v_anio int := coalesce(p_anio, extract(year from current_date)::int);
  v_fecha_obj date;
  v_adj record;
  v_creados int := 0;
begin
  for v_fal in
    select id, antepasado_id, fecha_fallecimiento
    from public.fallecimientos
    where fecha_fallecimiento is not null
  loop
    v_fecha_obj := make_date(
      v_anio,
      extract(month from v_fal.fecha_fallecimiento)::int,
      extract(day from v_fal.fecha_fallecimiento)::int
    );
    -- Solo desde el primer aniversario en adelante
    if v_fecha_obj > v_fal.fecha_fallecimiento then
      select * into v_adj from public.ss_ajustar_culto_antepasado(v_fecha_obj);
      insert into public.cultos_antepasados
        (fallecimiento_id,antepasado_id,tipo,dias_desde_fallecimiento,
         fecha_objetivo,fecha_culto,fecha_aviso,es_domingo,es_feriado,ajustado,anio)
      values
        (v_fal.id,v_fal.antepasado_id,'anual',null,
         v_fecha_obj,v_adj.fecha_culto,v_adj.fecha_aviso,v_adj.es_domingo,v_adj.es_feriado,v_adj.ajustado,v_anio)
      on conflict do nothing;
      if found then v_creados := v_creados + 1; end if;
    end if;
  end loop;
  return jsonb_build_object('anio', v_anio, 'anuales_creados', v_creados);
end;
$$;

create or replace function public.ss_avisos_cultos_antepasados(p_dias integer default 7)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.es_gestor() then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(x order by x.fecha_aviso,x.fecha_culto) from (
    select ca.*, f.fallecido_nombres,f.apellidos,f.sexo,f.ci,f.edad_fallecimiento,f.fecha_fallecimiento,f.es_miembro,f.solicitante_id,f.tipo_relacion,pr.nombre as solicitante
    from public.cultos_antepasados ca
    join public.fallecimientos f on f.id=ca.fallecimiento_id
    left join public.profiles pr on pr.id=f.solicitante_id
    where ca.estado in ('pendiente','avisado') and ca.fecha_aviso between (current_date-1) and (current_date+coalesce(p_dias,7))
  ) x), '[]'::jsonb);
end;
$$;

create or replace function public.ss_marcar_aviso_antepasado(p_id bigint,p_notas text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.es_gestor() then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;
  update public.cultos_antepasados set avisado=true,estado='avisado',fecha_aviso_registrado=now(),avisado_por=auth.uid(),notas=coalesce(p_notas,notas),updated_at=now() where id=p_id;
  return jsonb_build_object('mensaje','Aviso marcado como avisado');
end;
$$;

create or replace function public.ss_programar_culto_antepasado(p_aviso_id bigint,p_fecha date default null,p_hora text default null,p_lugar text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ca public.cultos_antepasados%rowtype;
  v_culto_id bigint;
  v_nombre text;
  v_nota text;
begin
  if not public.es_gestor() then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;
  select * into v_ca from public.cultos_antepasados where id=p_aviso_id;
  if not found then raise exception 'Aviso no encontrado' using errcode='P0002'; end if;
  select fallecido_nombres || ' ' || coalesce(apellidos,'') into v_nombre from public.fallecimientos where id=v_ca.fallecimiento_id;
  v_nota := 'Culto de Antepasados (' || case when v_ca.tipo='decenal' then 'Decenal +' || v_ca.dias_desde_fallecimiento || ' dias' else 'Anual' end || ') - ' || v_nombre;
  insert into public.calendario_cultos (fecha,hora,lugar,estado,notas) values (coalesce(p_fecha,v_ca.fecha_culto),p_hora,p_lugar,'programado',v_nota) returning id into v_culto_id;
  update public.cultos_antepasados set programado_culto_id=v_culto_id,estado='programado',updated_at=now() where id=p_aviso_id;
  return jsonb_build_object('culto_id',v_culto_id,'mensaje','Culto de Antepasados programado');
end;
$$;

create or replace function public.ss_historial_cultos_antepasados(p_fallecimiento_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return coalesce((select jsonb_agg(x order by x.fecha_objetivo) from (
    select ca.*, pr.nombre as avisado_por_nombre from public.cultos_antepasados ca left join public.profiles pr on pr.id=ca.avisado_por where ca.fallecimiento_id=p_fallecimiento_id
  ) x),'[]'::jsonb);
end;
$$;

create or replace function public.ss_lista_fallecidos_completa()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return coalesce((select jsonb_agg(x order by x.creado_en desc) from (
    select f.*, a.id as antepasado_id_reg, pr.nombre as solicitante_nombre from public.fallecimientos f left join public.antepasados a on a.fallecimiento_id=f.id left join public.profiles pr on pr.id=f.solicitante_id
  ) x),'[]'::jsonb);
end;
$$;

create or replace function public.ss_perfiles_miembros()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return coalesce((select jsonb_agg(x order by x.nombre) from (
    select id, nombre, ci, rol, activo from public.profiles where activo = true
  ) x),'[]'::jsonb);
end;
$$;
create or replace function public.ss_evaluar_plazo(p_tipo text, p_fecha date)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
    v_cron public.cronogramas%rowtype;
    v_dias integer := 15;
    v_found boolean := false;
begin
    if p_fecha is null then
        return false;
    end if;
    select * into v_cron
    from public.cronogramas
    where tipo = p_tipo and anio = extract(year from current_date)::int
    order by id desc limit 1;
    v_found := found;

    if v_found and v_cron.dias_anticipacion > 0 then
        v_dias := v_cron.dias_anticipacion;
    end if;
    if current_date > p_fecha then
        return false;
    end if;
    if (p_fecha - current_date) < v_dias then
        return false;
    end if;
    if v_found and v_cron.fecha_inicio is not null and v_cron.fecha_fin is not null then
        if p_fecha < v_cron.fecha_inicio or p_fecha > v_cron.fecha_fin then
            return false;
        end if;
    end if;
    return true;
end;
$$;

create or replace function public.ss_crear_culto(p_solicitud_id bigint, p_fecha date)
returns void language plpgsql security definer set search_path = public as $$
begin
    if p_fecha is null then
        return;
    end if;
    if not exists (select 1 from public.calendario_cultos where solicitud_id = p_solicitud_id) then
        insert into public.calendario_cultos (solicitud_id, fecha) values (p_solicitud_id, p_fecha);
    end if;
end;
$$;

create or replace function public.ss_registrar_transferencia(
    p_registro_id bigint,
    p_tipo_origen text,
    p_datos jsonb default null
)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
    insert into public.transferencias (registro_id, tipo_origen, datos_json)
    values (p_registro_id, p_tipo_origen, p_datos)
    returning id into v_id;
    return v_id;
end;
$$;

create or replace function public.ss_nivel_para_rol(p_rol text)
returns text language sql stable as $$
    select case
        when p_rol = 'ministro' then 'iglesia'
        when p_rol in ('responsable','presidente','administrador') then 'region'
        else 'proponente'
    end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Antepasados
-- ---------------------------------------------------------------------------
create or replace function public.ss_antepasados()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
    return coalesce((
        select jsonb_agg(a order by a.aniversario nulls last, a.id)
        from public.antepasados a where a.miembro_id = auth.uid()
    ), '[]'::jsonb);
end;
$$;

create or replace function public.ss_crear_antepasado(
    p_nombres text,
    p_parentesco text default null,
    p_fecha_fallecimiento date default null,
    p_aniversario text default null,
    p_notas text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
    if p_nombres is null or trim(p_nombres) = '' then
        raise exception 'El nombre del antepasado es obligatorio' using errcode = '22023';
    end if;
    insert into public.antepasados (miembro_id, nombres, parentesco, fecha_fallecimiento, aniversario, notas)
    values (auth.uid(), p_nombres, p_parentesco, p_fecha_fallecimiento, p_aniversario, p_notas)
    returning id into v_id;
    return jsonb_build_object('id', v_id, 'mensaje', 'Antepasado registrado en el libro de almas');
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Solicitudes
-- ---------------------------------------------------------------------------
create or replace function public.ss_solicitudes(
    p_estado text default null,
    p_tipo text default null,
    p_buscar text default null,
    p_solo_mias boolean default false
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_buscar text := lower(trim(coalesce(p_buscar, '')));
begin
    if not p_solo_mias and not public.es_gestor() then
        raise exception 'No tienes permiso' using errcode = '42501';
    end if;

    return coalesce((
        select jsonb_agg(x order by x.id desc) from (
            select s.*,
                   pr.nombre as solicitante,
                   a.nombres as antepasado
            from public.solicitudes s
            join public.profiles pr on pr.id = s.solicitante_id
            left join public.antepasados a on a.id = s.antepasado_id
            where (not p_solo_mias or s.solicitante_id = auth.uid())
              and (nullif(trim(coalesce(p_estado, '')), '') is null or s.estado = p_estado)
              and (nullif(trim(coalesce(p_tipo, '')), '') is null or s.tipo = p_tipo)
              and (v_buscar = '' or lower(pr.nombre) like '%' || v_buscar || '%' or lower(coalesce(a.nombres, '')) like '%' || v_buscar || '%')
            order by s.id desc limit 200
        ) x
    ), '[]'::jsonb);
end;
$$;

create or replace function public.ss_detalle_solicitud(p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_sol jsonb;
    v_sol_tipo text;
    v_sol_solicitante uuid;
    v_firmas jsonb;
begin
    select to_jsonb(x), x.tipo, x.solicitante_id into v_sol, v_sol_tipo, v_sol_solicitante from (
        select s.*, pr.nombre as solicitante, a.nombres as antepasado
        from public.solicitudes s
        join public.profiles pr on pr.id = s.solicitante_id
        left join public.antepasados a on a.id = s.antepasado_id
        where s.id = p_id
    ) x;
    if v_sol is null then
        raise exception 'Solicitud no encontrada' using errcode = 'P0002';
    end if;
    if v_sol_solicitante <> auth.uid() and not public.es_gestor() then
        raise exception 'Permiso denegado' using errcode = '42501';
    end if;

    select coalesce(jsonb_agg(f order by (case f.nivel when 'proponente' then 1 when 'iglesia' then 2 else 3 end)), '[]'::jsonb)
    into v_firmas
    from (
        select f.id, f.nivel, f.estado, f.fecha, f.observaciones, pr.nombre as firmante
        from public.firma_eidai f
        left join public.profiles pr on pr.id = f.firmante_id
        where f.solicitud_id = p_id
    ) f;

    return jsonb_build_object(
        'solicitud', v_sol,
        'firmas', case when v_sol_tipo = 'eidai' then v_firmas else '[]'::jsonb end
    );
end;
$$;

create or replace function public.ss_solicitar(
    p_tipo text,
    p_antepasado_id bigint default null,
    p_fecha_evento date default null,
    p_observaciones text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_uid uuid := auth.uid();
    v_solicitud_id bigint;
    v_fuera_plazo boolean := false;
    v_primera boolean := false;
    v_estado text;
    v_ministro uuid;
begin
    if v_uid is null then
        raise exception 'No autenticado' using errcode = '42501';
    end if;
    if p_tipo not in ('senzo','nensai','ireisai','shinrei','mitamaeshi','eidai') then
        raise exception 'Tipo de solicitud invalido' using errcode = '22023';
    end if;
    if p_tipo <> 'eidai' and (p_antepasado_id is null or p_antepasado_id <= 0) then
        raise exception 'Debe seleccionar un antepasado del libro de almas' using errcode = '22023';
    end if;
    if p_fecha_evento is null then
        raise exception 'La fecha del evento es obligatoria' using errcode = '22023';
    end if;
    if p_antepasado_id is not null and p_antepasado_id > 0 then
        if not exists (select 1 from public.antepasados where id = p_antepasado_id and miembro_id = v_uid) then
            raise exception 'El antepasado no pertenece al solicitante' using errcode = '42501';
        end if;
    end if;

    if p_tipo in ('nensai','ireisai','shinrei') then
        v_fuera_plazo := not public.ss_evaluar_plazo(p_tipo, p_fecha_evento);
    end if;

    v_primera := (select count(*) from public.solicitudes where solicitante_id = v_uid) = 0;
    v_estado := case when v_fuera_plazo then 'extemporanea' else 'pendiente_validacion' end;

    insert into public.solicitudes
        (solicitante_id, tipo, antepasado_id, fecha_evento, estado, fuera_plazo, primera_vez, observaciones)
    values (v_uid, p_tipo, nullif(p_antepasado_id, 0), p_fecha_evento, v_estado, v_fuera_plazo, v_primera, p_observaciones)
    returning id into v_solicitud_id;

    if p_tipo = 'eidai' then
        insert into public.firma_eidai (solicitud_id, nivel, firmante_id, estado) values
            (v_solicitud_id, 'proponente', v_uid, 'firmado'),
            (v_solicitud_id, 'iglesia', null, 'pendiente'),
            (v_solicitud_id, 'region', null, 'pendiente');
    end if;

    -- UC12: el primerizo requiere orientacion previa del ministro responsable
    if v_primera then
        select pr.id into v_ministro
        from public.profiles pr
        where pr.rol in ('ministro','presidente','administrador') and pr.activo
        order by pr.creado_en limit 1;
        if v_ministro is not null then
            insert into public.orientaciones (solicitante_id, ministro_id, contenido, atendida)
            values (v_uid, v_ministro,
                    'Solicitante primerizo: se requiere orientacion previa del Ministro Responsable (UC12).', false);
        end if;
    end if;

    return jsonb_build_object(
        'id', v_solicitud_id,
        'estado', v_estado,
        'fuera_plazo', v_fuera_plazo,
        'primera_vez', v_primera,
        'mensaje', case when v_fuera_plazo
            then 'Solicitud fuera de plazo registrada como EXTEMPORANEA (UC14)'
            else 'Solicitud registrada. Pendiente de validacion.' end
    );
end;
$$;

create or replace function public.ss_editar_solicitud(
    p_id bigint,
    p_fecha_evento date default null,
    p_antepasado_id bigint default null,
    p_observaciones text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_sol public.solicitudes%rowtype;
    v_fuera_plazo boolean;
    v_estado text;
begin
    select * into v_sol from public.solicitudes where id = p_id;
    if not found then
        raise exception 'Solicitud no encontrada' using errcode = 'P0002';
    end if;
    if v_sol.solicitante_id <> auth.uid() then
        raise exception 'Permiso denegado' using errcode = '42501';
    end if;
    if v_sol.estado not in ('pendiente_validacion','extemporanea','observada') then
        raise exception 'La solicitud ya no puede editarse' using errcode = '22023';
    end if;

    if v_sol.tipo in ('nensai','ireisai','shinrei') then
        v_fuera_plazo := not public.ss_evaluar_plazo(v_sol.tipo, coalesce(p_fecha_evento, v_sol.fecha_evento));
    else
        v_fuera_plazo := v_sol.fuera_plazo;
    end if;
    v_estado := case when v_fuera_plazo then 'extemporanea' else 'pendiente_validacion' end;

    update public.solicitudes
    set antepasado_id = coalesce(nullif(p_antepasado_id, 0), antepasado_id),
        fecha_evento = coalesce(p_fecha_evento, fecha_evento),
        fuera_plazo = v_fuera_plazo,
        estado = v_estado,
        observaciones = coalesce(p_observaciones, observaciones)
    where id = p_id;

    return jsonb_build_object('mensaje', 'Solicitud actualizada', 'fuera_plazo', v_fuera_plazo);
end;
$$;

create or replace function public.ss_cancelar_solicitud(p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_sol public.solicitudes%rowtype;
begin
    select * into v_sol from public.solicitudes where id = p_id;
    if not found then
        raise exception 'Solicitud no encontrada' using errcode = 'P0002';
    end if;
    if v_sol.solicitante_id <> auth.uid() then
        raise exception 'Permiso denegado' using errcode = '42501';
    end if;
    if v_sol.estado <> 'pendiente_validacion' then
        raise exception 'Solo se pueden cancelar solicitudes pendientes de validacion' using errcode = '22023';
    end if;
    delete from public.solicitudes where id = p_id;
    return jsonb_build_object('mensaje', 'Solicitud cancelada');
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Validacion y aprobacion (UC7, UC8, UC14)
-- ---------------------------------------------------------------------------
create or replace function public.ss_bandeja(p_estados text default 'pendiente_validacion,en_revision,extemporanea,observada')
returns jsonb language plpgsql security definer set search_path = public as $$
begin
    if not public.es_gestor() then
        raise exception 'Permiso denegado' using errcode = '42501';
    end if;
    return coalesce((
        select jsonb_agg(x order by x.id desc) from (
            select s.*, pr.nombre as solicitante, a.nombres as antepasado
            from public.solicitudes s
            join public.profiles pr on pr.id = s.solicitante_id
            left join public.antepasados a on a.id = s.antepasado_id
            where s.estado = any (
                select trim(e) from unnest(string_to_array(coalesce(p_estados,
                    'pendiente_validacion,en_revision,extemporanea,observada'), ',')) e
            )
            order by (case when s.tipo = 'eidai' then 0 else 1 end), s.id desc
        ) x
    ), '[]'::jsonb);
end;
$$;

create or replace function public.ss_accion_validacion(
    p_accion text,
    p_id bigint,
    p_observaciones text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_sol public.solicitudes%rowtype;
    v_firmados integer;
begin
    if not public.es_gestor() then
        raise exception 'Permiso denegado' using errcode = '42501';
    end if;

    select * into v_sol from public.solicitudes where id = p_id;
    if not found then
        raise exception 'Solicitud no encontrada' using errcode = 'P0002';
    end if;

    if p_accion = 'validar' then
        if v_sol.estado not in ('pendiente_validacion','extemporanea') then
            raise exception 'La solicitud no esta pendiente de validacion' using errcode = '22023';
        end if;
        update public.solicitudes
        set estado = 'en_revision', observaciones = coalesce(p_observaciones, observaciones)
        where id = p_id;
        return jsonb_build_object('mensaje', 'Solicitud validada, pasa a revision');

    elsif p_accion = 'aprobar' then
        if v_sol.estado <> 'en_revision' then
            raise exception 'La solicitud debe estar en revision para aprobarse' using errcode = '22023';
        end if;
        if v_sol.tipo = 'eidai' then
            update public.solicitudes set estado = 'en_revision' where id = p_id;
            select count(*) into v_firmados
            from public.firma_eidai where solicitud_id = p_id and estado = 'firmado';
            if v_firmados = 3 then
                update public.solicitudes set estado = 'registrada' where id = p_id;
            end if;
        else
            update public.solicitudes set estado = 'aprobada' where id = p_id;
            perform public.ss_crear_culto(p_id, v_sol.fecha_evento);
        end if;
        return jsonb_build_object('mensaje', 'Solicitud aprobada y programada en el calendario');

    elsif p_accion = 'bloquear' then
        update public.solicitudes
        set estado = 'extemporanea',
            fuera_plazo = true,
            observaciones = coalesce(p_observaciones, 'Bloqueada fuera de plazo (UC14)')
        where id = p_id;
        return jsonb_build_object('mensaje', 'Solicitud bloqueada por fuera de plazo (UC14)');

    elsif p_accion = 'registrar' then
        if v_sol.estado <> 'aprobada' then
            raise exception 'La solicitud debe estar aprobada' using errcode = '22023';
        end if;
        update public.solicitudes set estado = 'registrada' where id = p_id;
        perform public.ss_registrar_transferencia(p_id, 'solicitud', jsonb_build_object('tipo', v_sol.tipo));
        return jsonb_build_object('mensaje', 'Solicitud registrada y transferida a la Sede Nacional');
    end if;

    raise exception 'Accion no valida' using errcode = '22023';
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Firmas Eidai (UC13)
-- ---------------------------------------------------------------------------
create or replace function public.ss_firmas_pendientes()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_nivel text;
begin
    v_nivel := public.ss_nivel_para_rol((select rol from public.profiles where id = auth.uid()));
    return coalesce((
        select jsonb_agg(x order by x.solicitud_id desc) from (
            select f.id, f.solicitud_id, f.nivel, f.estado, f.observaciones,
                   s.tipo, s.fecha_evento, pr.nombre as solicitante, a.nombres as antepasado
            from public.firma_eidai f
            join public.solicitudes s on s.id = f.solicitud_id
            join public.profiles pr on pr.id = s.solicitante_id
            left join public.antepasados a on a.id = s.antepasado_id
            where f.estado = 'pendiente' and f.nivel = v_nivel
        ) x
    ), '[]'::jsonb);
end;
$$;

create or replace function public.ss_detalle_firmas(p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
    return jsonb_build_object('firmas', coalesce((
        select jsonb_agg(x order by (case x.nivel when 'proponente' then 1 when 'iglesia' then 2 else 3 end))
        from (
            select f.nivel, f.estado, f.fecha, f.observaciones, pr.nombre as firmante
            from public.firma_eidai f
            left join public.profiles pr on pr.id = f.firmante_id
            where f.solicitud_id = p_id
        ) x
    ), '[]'::jsonb));
end;
$$;

create or replace function public.ss_firmar_eidai(
    p_solicitud_id bigint,
    p_aceptar boolean default true,
    p_observaciones text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_nivel text;
    v_firma public.firma_eidai%rowtype;
    v_total integer;
    v_firmados integer;
    v_rechazados integer;
begin
    v_nivel := public.ss_nivel_para_rol((select rol from public.profiles where id = auth.uid()));

    select * into v_firma
    from public.firma_eidai
    where solicitud_id = p_solicitud_id and nivel = v_nivel;

    if not found then
        raise exception 'No existe firma pendiente para este nivel' using errcode = 'P0002';
    end if;
    if v_firma.estado <> 'pendiente' then
        raise exception 'Esta firma ya fue resuelta' using errcode = '22023';
    end if;

    update public.firma_eidai
    set estado = case when coalesce(p_aceptar, true) then 'firmado' else 'rechazado' end,
        firmante_id = auth.uid(),
        fecha = current_date,
        observaciones = p_observaciones
    where id = v_firma.id;

    select count(*) into v_total from public.firma_eidai where solicitud_id = p_solicitud_id;
    select count(*) into v_firmados from public.firma_eidai where solicitud_id = p_solicitud_id and estado = 'firmado';
    select count(*) into v_rechazados from public.firma_eidai where solicitud_id = p_solicitud_id and estado = 'rechazado';

    if v_rechazados > 0 then
        update public.solicitudes set estado = 'observada' where id = p_solicitud_id;
    elsif v_total = 3 and v_firmados = 3 then
        update public.solicitudes set estado = 'registrada' where id = p_solicitud_id;
        perform public.ss_registrar_transferencia(p_solicitud_id, 'solicitud', jsonb_build_object('tipo', 'eidai'));
    end if;

    return jsonb_build_object('mensaje', case when coalesce(p_aceptar, true)
        then 'Firma estampada (UC13). La solicitud avanzo en sus niveles de aval.'
        else 'Firma rechazada. La solicitud paso a estado OBSERVADA.' end);
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Fallecimientos (UC9) y transferencias (UC10)
-- ---------------------------------------------------------------------------
create or replace function public.ss_fallecimientos()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
    if public.es_gestor() then
        return coalesce((
            select jsonb_agg(x order by x.id desc) from (
                select f.*, pr.nombre as registrante
                from public.fallecimientos f
                join public.profiles pr on pr.id = f.solicitante_id
            ) x
        ), '[]'::jsonb);
    end if;
    return coalesce((
        select jsonb_agg(f order by f.id desc)
        from public.fallecimientos f where f.solicitante_id = auth.uid()
    ), '[]'::jsonb);
end;
$$;

create or replace function public.ss_registrar_fallecimiento(
    p_nombres text,
    p_apellidos text default null,
    p_ci text default null,
    p_sexo text default null,
    p_edad integer default null,
    p_fecha_fallecimiento date default null,
    p_es_miembro boolean default false,
    p_solicitante_id uuid default null,
    p_tipo_relacion text default null,
    p_certificado text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_fal_id bigint;
    v_ant_id bigint;
    v_solicitante uuid := coalesce(p_solicitante_id, auth.uid());
    v_nombres_completo text;
    v_alerta boolean;
begin
    if not exists (select 1 from public.profiles where id = v_solicitante) then
        raise exception 'El miembro solicitante debe estar registrado' using errcode = '22023';
    end if;
    if coalesce(trim(p_nombres), '') = '' then
        raise exception 'Los nombres son obligatorios' using errcode = '22023';
    end if;
    if p_fecha_fallecimiento is null then
        raise exception 'La fecha de fallecimiento es obligatoria' using errcode = '22023';
    end if;
    if p_certificado is not null and length(p_certificado) > 350000 then
        raise exception 'El documento adjunto es demasiado grande' using errcode = '22023';
    end if;
    v_alerta := (p_certificado is null or length(p_certificado) < 5);
    v_nombres_completo := trim(p_nombres || ' ' || coalesce(p_apellidos, ''));

    insert into public.fallecimientos (
        fallecido_nombres, apellidos, ci, sexo, edad_fallecimiento,
        fecha_fallecimiento, es_miembro, solicitante_id, tipo_relacion, certificado,
        estado, transferido, alerta, convertido_a_antepasado
    )
    values (
        trim(p_nombres), nullif(trim(p_apellidos), ''), p_ci, p_sexo, p_edad,
        p_fecha_fallecimiento, coalesce(p_es_miembro, false), v_solicitante, p_tipo_relacion, p_certificado,
        'registrado', false, v_alerta, true
    )
    returning id into v_fal_id;

    insert into public.antepasados (
        miembro_id, nombres, apellidos, ci, sexo, edad_fallecimiento,
        fecha_fallecimiento, es_miembro, solicitante_id, tipo_relacion, parentesco,
        fallecimiento_id
    )
    values (
        v_solicitante, v_nombres_completo, nullif(trim(p_apellidos), ''), p_ci, p_sexo, p_edad,
        p_fecha_fallecimiento, coalesce(p_es_miembro, false), v_solicitante, p_tipo_relacion, p_tipo_relacion,
        v_fal_id
    )
    returning id into v_ant_id;

    update public.fallecimientos set antepasado_id = v_ant_id, convertido_a_antepasado = true where id = v_fal_id;

    perform public.ss_generar_cultos_antepasados(v_fal_id);

    perform public.ss_registrar_transferencia(v_fal_id, 'fallecimiento',
        jsonb_build_object('fallecido', v_nombres_completo, 'fecha_fallecimiento', p_fecha_fallecimiento, 'solicitante_id', v_solicitante));

    update public.fallecimientos set transferido = true, estado = 'transferido' where id = v_fal_id;

    return jsonb_build_object(
        'id', v_fal_id,
        'fallecimiento_id', v_fal_id,
        'antepasado_id', v_ant_id,
        'transferido', true,
        'mensaje', 'Fallecido registrado, agregado al Libro de Almas y cultos de antepasados generados'
    );
end;
$$;

create or replace function public.ss_transferencias()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
    if not public.es_gestor() then
        raise exception 'Permiso denegado' using errcode = '42501';
    end if;
    return coalesce((
        select jsonb_agg(x order by x.id desc) from (
            select t.*,
                   case when t.tipo_origen = 'fallecimiento' then f.fallecido_nombres else s.tipo end as detalle
            from public.transferencias t
            left join public.fallecimientos f on f.id = t.registro_id and t.tipo_origen = 'fallecimiento'
            left join public.solicitudes s on s.id = t.registro_id
        ) x
    ), '[]'::jsonb);
end;
$$;

create or replace function public.ss_crear_transferencia(
    p_registro_id bigint,
    p_tipo_origen text,
    p_destino text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
    if not public.es_gestor() then
        raise exception 'Permiso denegado' using errcode = '42501';
    end if;
    if p_registro_id is null or p_tipo_origen not in ('fallecimiento','solicitud') then
        raise exception 'Datos de transferencia invalidos' using errcode = '22023';
    end if;
    if exists (select 1 from public.transferencias where registro_id = p_registro_id and tipo_origen = p_tipo_origen) then
        raise exception 'Este registro ya fue transferido' using errcode = '22023';
    end if;

    perform public.ss_registrar_transferencia(p_registro_id, p_tipo_origen, null);

    if p_tipo_origen = 'fallecimiento' then
        update public.fallecimientos set transferido = true, estado = 'transferido' where id = p_registro_id;
    end if;

    return jsonb_build_object(
        'mensaje', 'Registro transferido a ' || coalesce(p_destino, 'Sede Nacional Santa Cruz') || ' (UC10)',
        'destino', coalesce(p_destino, 'Sede Nacional Santa Cruz')
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Orientaciones (UC12)
-- ---------------------------------------------------------------------------
create or replace function public.ss_orientaciones()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
    if public.es_ministro() then
        return coalesce((
            select jsonb_agg(x order by x.id desc) from (
                select o.*, pr.nombre as solicitante, mn.nombre as ministro
                from public.orientaciones o
                join public.profiles pr on pr.id = o.solicitante_id
                join public.profiles mn on mn.id = o.ministro_id
            ) x
        ), '[]'::jsonb);
    end if;
    return coalesce((
        select jsonb_agg(x order by x.id desc) from (
            select o.*, mn.nombre as ministro
            from public.orientaciones o
            join public.profiles mn on mn.id = o.ministro_id
            where o.solicitante_id = auth.uid()
        ) x
    ), '[]'::jsonb);
end;
$$;

create or replace function public.ss_orientaciones_necesarias()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
    if not public.es_ministro() then
        raise exception 'Permiso denegado' using errcode = '42501';
    end if;
    return jsonb_build_object('solicitantes', coalesce((
        select jsonb_agg(x order by x.ultima desc) from (
            select s.solicitante_id, pr.nombre as solicitante,
                   count(s.id)::int as solicitudes, max(s.id) as ultima
            from public.solicitudes s
            join public.profiles pr on pr.id = s.solicitante_id
            where s.primera_vez
              and not exists (
                  select 1 from public.orientaciones o
                  where o.solicitante_id = s.solicitante_id and o.atendida
              )
            group by s.solicitante_id, pr.nombre
        ) x
    ), '[]'::jsonb));
end;
$$;

create or replace function public.ss_registrar_orientacion(p_solicitante_id uuid, p_contenido text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_auto bigint;
begin
    if not public.es_ministro() then
        raise exception 'Permiso denegado' using errcode = '42501';
    end if;
    if p_contenido is null or trim(p_contenido) = '' then
        raise exception 'El contenido de la orientacion es obligatorio' using errcode = '22023';
    end if;
    if exists (select 1 from public.orientaciones where solicitante_id = p_solicitante_id and atendida) then
        raise exception 'Este solicitante ya fue orientado' using errcode = '22023';
    end if;

    select id into v_auto
    from public.orientaciones
    where solicitante_id = p_solicitante_id and not atendida
    order by id limit 1;

    if v_auto is not null then
        update public.orientaciones
        set contenido = p_contenido, atendida = true, ministro_id = auth.uid(), fecha = current_date
        where id = v_auto;
    else
        insert into public.orientaciones (solicitante_id, ministro_id, contenido, atendida)
        values (p_solicitante_id, auth.uid(), p_contenido, true);
    end if;

    return jsonb_build_object('mensaje', 'Orientacion registrada (UC12)');
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Calendario de cultos
-- ---------------------------------------------------------------------------
create or replace function public.ss_cultos(p_desde date default null, p_proximos boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
    if p_proximos then
        return jsonb_build_object('cultos', coalesce((
            select jsonb_agg(x order by x.fecha, x.hora) from (
                select c.*, s.tipo, s.estado as estado_solicitud, pr.nombre as solicitante
                from public.calendario_cultos c
                left join public.solicitudes s on s.id = c.solicitud_id
                left join public.profiles pr on pr.id = s.solicitante_id
                where c.fecha >= coalesce(p_desde, current_date) and c.estado = 'programado'
            ) x
        ), '[]'::jsonb));
    end if;
    return jsonb_build_object('cultos', coalesce((
        select jsonb_agg(x order by x.fecha desc) from (
            select c.*, s.tipo, pr.nombre as solicitante
            from public.calendario_cultos c
            left join public.solicitudes s on s.id = c.solicitud_id
            left join public.profiles pr on pr.id = s.solicitante_id
        ) x
    ), '[]'::jsonb));
end;
$$;

create or replace function public.ss_programar_culto(
    p_solicitud_id bigint default null,
    p_fecha date default null,
    p_hora text default null,
    p_lugar text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_fecha date;
    v_id bigint;
    v_sol public.solicitudes%rowtype;
begin
    if not public.es_gestor() then
        raise exception 'Permiso denegado' using errcode = '42501';
    end if;

    v_fecha := p_fecha;
    if p_solicitud_id is not null and p_solicitud_id > 0 then
        select * into v_sol from public.solicitudes where id = p_solicitud_id;
        if not found then
            raise exception 'Solicitud no encontrada' using errcode = 'P0002';
        end if;
        if v_sol.estado not in ('aprobada','registrada') then
            raise exception 'Solo se programan cultos de solicitudes aprobadas o registradas' using errcode = '22023';
        end if;
        if v_fecha is null then
            v_fecha := v_sol.fecha_evento;
        end if;
    end if;
    if v_fecha is null then
        raise exception 'La fecha del culto es obligatoria' using errcode = '22023';
    end if;

    insert into public.calendario_cultos (solicitud_id, fecha, hora, lugar)
    values (nullif(p_solicitud_id, 0), v_fecha, p_hora, p_lugar)
    returning id into v_id;

    return jsonb_build_object('id', v_id, 'mensaje', 'Culto programado en el calendario');
end;
$$;

create or replace function public.ss_eliminar_culto(p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
    if not exists (select 1 from public.profiles where id = auth.uid() and rol in ('administrador','presidente') and activo) then
        raise exception 'Permiso denegado' using errcode = '42501';
    end if;
    delete from public.calendario_cultos where id = p_id;
    return jsonb_build_object('mensaje', 'Culto eliminado del calendario');
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. Cronogramas (RN02)
-- ---------------------------------------------------------------------------
create or replace function public.ss_cronogramas(p_anio integer default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
    if not exists (select 1 from public.profiles where id = auth.uid() and rol in ('administrador','presidente') and activo) then
        raise exception 'Permiso denegado' using errcode = '42501';
    end if;
    return jsonb_build_object('cronogramas', coalesce((
        select jsonb_agg(c order by c.tipo)
        from public.cronogramas c
        where c.anio = coalesce(p_anio, extract(year from current_date)::int)
    ), '[]'::jsonb));
end;
$$;

create or replace function public.ss_crear_cronograma(
    p_tipo text,
    p_anio integer default null,
    p_fecha_inicio date default null,
    p_fecha_fin date default null,
    p_dias_anticipacion integer default 15
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_id bigint;
    v_anio integer := coalesce(p_anio, extract(year from current_date)::int);
begin
    if not public.es_admin() then
        raise exception 'Permiso denegado' using errcode = '42501';
    end if;
    if p_tipo not in ('nensai','ireisai','shinrei','senzo','mitamaeshi','eidai') then
        raise exception 'Tipo no valido para cronograma' using errcode = '22023';
    end if;

    select id into v_id from public.cronogramas where tipo = p_tipo and anio = v_anio;
    if v_id is not null then
        update public.cronogramas
        set fecha_inicio = p_fecha_inicio,
            fecha_fin = p_fecha_fin,
            dias_anticipacion = coalesce(p_dias_anticipacion, 15)
        where id = v_id;
        return jsonb_build_object('id', v_id, 'mensaje', 'Cronograma actualizado (regla RN02)');
    end if;

    insert into public.cronogramas (tipo, anio, fecha_inicio, fecha_fin, dias_anticipacion)
    values (p_tipo, v_anio, p_fecha_inicio, p_fecha_fin, coalesce(p_dias_anticipacion, 15))
    returning id into v_id;

    return jsonb_build_object('id', v_id, 'mensaje', 'Cronograma creado (regla RN02)');
end;
$$;

create or replace function public.ss_editar_cronograma(
    p_id bigint,
    p_tipo text default null,
    p_fecha_inicio date default null,
    p_fecha_fin date default null,
    p_dias_anticipacion integer default 15
)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
    if not public.es_admin() then
        raise exception 'Permiso denegado' using errcode = '42501';
    end if;
    update public.cronogramas
    set tipo = coalesce(nullif(p_tipo, ''), tipo),
        fecha_inicio = p_fecha_inicio,
        fecha_fin = p_fecha_fin,
        dias_anticipacion = coalesce(p_dias_anticipacion, 15)
    where id = p_id;
    return jsonb_build_object('mensaje', 'Cronograma actualizado');
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. Reportes y dashboard
-- ---------------------------------------------------------------------------
create or replace function public.ss_reporte_consolidado()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
    if not public.es_gestor() then
        raise exception 'Permiso denegado' using errcode = '42501';
    end if;
    return jsonb_build_object(
        'total_solicitudes', (select count(*) from public.solicitudes),
        'por_tipo', coalesce((select jsonb_agg(x order by x.tipo) from (
                              select tipo, count(*)::int as total from public.solicitudes group by tipo) x), '[]'::jsonb),
        'por_estado', coalesce((select jsonb_agg(x order by x.estado) from (
                              select estado, count(*)::int as total from public.solicitudes group by estado) x), '[]'::jsonb),
        'por_mes', coalesce((select jsonb_agg(x order by x.mes desc) from (
                              select to_char(creado_en, 'YYYY-MM') as mes, count(*)::int as total
                              from public.solicitudes group by 1 order by 1 desc limit 12) x), '[]'::jsonb),
        'fuera_plazo', (select count(*) from public.solicitudes where fuera_plazo),
        'primerizos', (select count(distinct solicitante_id) from public.solicitudes where primera_vez),
        'cultos_proximos', (select count(*) from public.calendario_cultos where fecha >= current_date),
        'fallecimientos', (select count(*) from public.fallecimientos),
        'firmas_pendientes', (select count(*) from public.firma_eidai where estado = 'pendiente'),
        'recientes', coalesce((
            select jsonb_agg(x order by x.id desc) from (
                select s.id, s.tipo, s.estado, s.fecha_solicitud, pr.nombre as solicitante
                from public.solicitudes s
                join public.profiles pr on pr.id = s.solicitante_id
                order by s.id desc limit 20
            ) x
        ), '[]'::jsonb)
    );
end;
$$;

create or replace function public.ss_reporte_listado(p_tipo text default null, p_estado text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
    if not public.es_gestor() then
        raise exception 'Permiso denegado' using errcode = '42501';
    end if;
    return jsonb_build_object('solicitudes', coalesce((
        select jsonb_agg(x order by x.id desc) from (
            select s.*, pr.nombre as solicitante, a.nombres as antepasado
            from public.solicitudes s
            join public.profiles pr on pr.id = s.solicitante_id
            left join public.antepasados a on a.id = s.antepasado_id
            where (nullif(trim(coalesce(p_tipo, '')), '') is null or s.tipo = p_tipo)
              and (nullif(trim(coalesce(p_estado, '')), '') is null or s.estado = p_estado)
            order by s.id desc limit 300
        ) x
    ), '[]'::jsonb));
end;
$$;

create or replace function public.ss_dashboard()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_rol text;
    v_totales jsonb;
begin
    v_rol := (select rol from public.profiles where id = auth.uid());

    select jsonb_build_object(
        'senzo', (select count(*) from public.solicitudes where tipo = 'senzo'),
        'nensai', (select count(*) from public.solicitudes where tipo = 'nensai'),
        'ireisai', (select count(*) from public.solicitudes where tipo = 'ireisai'),
        'shinrei', (select count(*) from public.solicitudes where tipo = 'shinrei'),
        'mitamaeshi', (select count(*) from public.solicitudes where tipo = 'mitamaeshi'),
        'eidai', (select count(*) from public.solicitudes where tipo = 'eidai'),
        'mias', (select count(*) from public.solicitudes where solicitante_id = auth.uid()),
        'antepasados', (select count(*) from public.antepasados where miembro_id = auth.uid()),
        'fallecimientos', (select count(*) from public.fallecimientos where solicitante_id = auth.uid())
    ) into v_totales;

    if v_rol in ('responsable','presidente','administrador') then
        v_totales := v_totales || jsonb_build_object(
            'bandeja', (select count(*) from public.solicitudes where estado in ('pendiente_validacion','en_revision','extemporanea','observada')),
            'registradas', (select count(*) from public.solicitudes where estado in ('aprobada','registrada'))
        );
    end if;
    if v_rol in ('ministro','presidente','administrador') then
        v_totales := v_totales || jsonb_build_object(
            'firmas_pendientes', (select count(*) from public.firma_eidai
                                  where estado = 'pendiente'
                                    and nivel = public.ss_nivel_para_rol(v_rol))
        );
    end if;

    return jsonb_build_object(
        'totales', v_totales,
        'rol', v_rol,
        'proximos_cultos', coalesce((
            select jsonb_agg(x order by x.fecha, x.hora) from (
                select c.fecha, c.hora, c.lugar, s.tipo, pr.nombre as solicitante
                from public.calendario_cultos c
                left join public.solicitudes s on s.id = c.solicitud_id
                left join public.profiles pr on pr.id = s.solicitante_id
                where c.fecha >= current_date and c.estado = 'programado'
                order by c.fecha, c.hora limit 10
            ) x
        ), '[]'::jsonb),
        'servidor', 'supabase'
    );
end;
$$;

-- Codigo de vinculacion de Telegram (el bot requiere una Edge Function para activarlo)
create or replace function public.ss_telegram_estado()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
    return jsonb_build_object(
        'codigo', upper(substr(replace(auth.uid()::text, '-', ''), 1, 8)),
        'vinculado', false,
        'chat_id', null
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- 13. Permisos de ejecucion
-- ---------------------------------------------------------------------------
grant execute on function public.ss_evaluar_plazo(text, date) to authenticated;
grant execute on function public.ss_crear_culto(bigint, date) to authenticated;
grant execute on function public.ss_registrar_transferencia(bigint, text, jsonb) to authenticated;
grant execute on function public.ss_nivel_para_rol(text) to authenticated;
grant execute on function public.ss_antepasados() to authenticated;
grant execute on function public.ss_crear_antepasado(text, text, date, text, text) to authenticated;
grant execute on function public.ss_solicitudes(text, text, text, boolean) to authenticated;
grant execute on function public.ss_detalle_solicitud(bigint) to authenticated;
grant execute on function public.ss_solicitar(text, bigint, date, text) to authenticated;
grant execute on function public.ss_editar_solicitud(bigint, date, bigint, text) to authenticated;
grant execute on function public.ss_cancelar_solicitud(bigint) to authenticated;
grant execute on function public.ss_bandeja(text) to authenticated;
grant execute on function public.ss_accion_validacion(text, bigint, text) to authenticated;
grant execute on function public.ss_firmas_pendientes() to authenticated;
grant execute on function public.ss_detalle_firmas(bigint) to authenticated;
grant execute on function public.ss_firmar_eidai(bigint, boolean, text) to authenticated;
grant execute on function public.ss_fallecimientos() to authenticated;
grant execute on function public.ss_registrar_fallecimiento(text, text, text, text, integer, date, boolean, uuid, text, text) to authenticated;
grant execute on function public.ss_lista_fallecidos_completa() to authenticated;
grant execute on function public.ss_perfiles_miembros() to authenticated;
grant execute on function public.ss_es_domingo(date) to authenticated;
grant execute on function public.ss_es_feriado(date) to authenticated;
grant execute on function public.ss_ajustar_culto_antepasado(date) to authenticated;
grant execute on function public.ss_generar_cultos_antepasados(bigint) to authenticated;
grant execute on function public.ss_regenerar_anuales_antepasados(integer) to authenticated;
grant execute on function public.ss_avisos_cultos_antepasados(integer) to authenticated;
grant execute on function public.ss_marcar_aviso_antepasado(bigint, text) to authenticated;
grant execute on function public.ss_programar_culto_antepasado(bigint, date, text, text) to authenticated;
grant execute on function public.ss_historial_cultos_antepasados(bigint) to authenticated;
grant execute on function public.ss_transferencias() to authenticated;
grant execute on function public.ss_crear_transferencia(bigint, text, text) to authenticated;
grant execute on function public.ss_orientaciones() to authenticated;
grant execute on function public.ss_orientaciones_necesarias() to authenticated;
grant execute on function public.ss_registrar_orientacion(uuid, text) to authenticated;
grant execute on function public.ss_cultos(date, boolean) to authenticated;
grant execute on function public.ss_programar_culto(bigint, date, text, text) to authenticated;
grant execute on function public.ss_eliminar_culto(bigint) to authenticated;
grant execute on function public.ss_cronogramas(integer) to authenticated;
grant execute on function public.ss_crear_cronograma(text, integer, date, date, integer) to authenticated;
grant execute on function public.ss_editar_cronograma(bigint, date, date, integer) to authenticated;
grant execute on function public.ss_reporte_consolidado() to authenticated;
grant execute on function public.ss_reporte_listado(text, text) to authenticated;
grant execute on function public.ss_dashboard() to authenticated;
grant execute on function public.ss_telegram_estado() to authenticated;

