-- ============================================================================
-- Iglesia Mundial del Mesias - Bolivia
-- 01 - Nucleo comun: identidad, roles e invitaciones
-- Plataforma: Supabase (PostgreSQL 15+)
-- Ejecucion: Supabase > SQL Editor > New query > Run (en este orden: 01, 02, 03)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Perfil de identidad (1:1 con auth.users)
--    Reemplaza la tabla "usuarios" + "tokens" del backend PHP.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
    id           uuid primary key references auth.users(id) on delete cascade,
    email        text not null,
    username     text,
    nombre       text not null default '',
    rol          text not null default 'miembro'
                 check (rol in ('administrador','presidente','responsable','ministro','misionero','miembro','frecuentador')),
    sector       text,
    telefono     text,
    activo       boolean not null default true,
    creado_en    timestamptz not null default now()
);

create index if not exists idx_profiles_rol on public.profiles (rol);

-- ---------------------------------------------------------------------------
-- 2. Funciones de rol (SECURITY DEFINER: evitan la recursion de RLS)
-- ---------------------------------------------------------------------------
create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
    select exists (
        select 1 from public.profiles
        where id = auth.uid() and activo and rol = 'administrador'
    );
$$;

create or replace function public.es_gestor()
returns boolean language sql stable security definer set search_path = public as $$
    select exists (
        select 1 from public.profiles
        where id = auth.uid() and activo and rol in ('administrador','presidente','responsable')
    );
$$;

create or replace function public.es_disciplinador()
returns boolean language sql stable security definer set search_path = public as $$
    select exists (
        select 1 from public.profiles
        where id = auth.uid() and activo
          and rol in ('administrador','presidente','responsable','ministro')
    );
$$;

create or replace function public.es_ministro()
returns boolean language sql stable security definer set search_path = public as $$
    select exists (
        select 1 from public.profiles
        where id = auth.uid() and activo
          and rol in ('administrador','presidente','ministro')
    );
$$;

-- ---------------------------------------------------------------------------
-- 3. Alta automatica del perfil al registrarse (Supabase Auth -> profiles)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    insert into public.profiles (id, email, username, nombre, rol, sector)
    values (
        new.id,
        coalesce(new.email, ''),
        coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(coalesce(new.email, ''), '@', 1)),
        coalesce(nullif(new.raw_user_meta_data ->> 'nombre', ''), split_part(coalesce(new.email, ''), '@', 1)),
        'miembro',
        coalesce(new.raw_user_meta_data ->> 'sector', '')
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 4. Proteccion del perfil: nadie puede cambiar su propio rol ni su estado
-- ---------------------------------------------------------------------------
create or replace function public.proteger_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    if auth.uid() = old.id and not public.es_admin() then
        if new.rol is distinct from old.rol or new.activo is distinct from old.activo then
            raise exception 'No puedes modificar tu propio rol ni tu estado'
                using errcode = '42501';
        end if;
    end if;
    new.creado_en := old.creado_en;
    return new;
end;
$$;

drop trigger if exists trg_proteger_perfil on public.profiles;
create trigger trg_proteger_perfil
    before update on public.profiles
    for each row execute function public.proteger_perfil();

-- ---------------------------------------------------------------------------
-- 5. RLS de profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
    for select using (id = auth.uid());

drop policy if exists "profiles_select_staff" on public.profiles;
create policy "profiles_select_staff" on public.profiles
    for select using (public.es_disciplinador());

drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin" on public.profiles
    for insert with check (public.es_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
    for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
    for update using (public.es_admin()) with check (public.es_admin());

-- ---------------------------------------------------------------------------
-- 6. Invitaciones: registro de nuevos usuarios con codigo
-- ---------------------------------------------------------------------------
create table if not exists public.invitaciones (
    id           serial primary key,
    codigo       text unique not null,
    descripcion  text,
    rol_sugerido text not null default 'miembro'
                 check (rol_sugerido in ('administrador','presidente','responsable','ministro','misionero','miembro','frecuentador')),
    sector       text,
    usado_por    uuid references public.profiles(id) on delete set null,
    usado_en     timestamptz,
    activo       boolean not null default true,
    creado_en    timestamptz not null default now()
);

alter table public.invitaciones enable row level security;

drop policy if exists "invitaciones_select_admin" on public.invitaciones;
create policy "invitaciones_select_admin" on public.invitaciones
    for select using (public.es_admin() or public.es_gestor());

-- Valida un codigo (llamada anonima desde el formulario de registro)
create or replace function public.validar_invitacion(p_codigo text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_activo boolean;
begin
    if p_codigo is null or trim(p_codigo) = '' then
        return false;
    end if;
    select activo into v_activo
    from public.invitaciones
    where upper(codigo) = upper(trim(p_codigo)) and usado_por is null;
    return coalesce(v_activo, false);
end;
$$;

-- Crea un codigo de invitacion (solo administrador)
create or replace function public.crear_invitacion(
    p_descripcion text default null,
    p_rol text default 'miembro',
    p_sector text default null
)
returns text language plpgsql security definer set search_path = public as $$
declare v_codigo text;
begin
    if not public.es_admin() then
        raise exception 'Permiso denegado' using errcode = '42501';
    end if;
    if p_rol is null or p_rol not in ('administrador','presidente','responsable','ministro','misionero','miembro','frecuentador') then
        p_rol := 'miembro';
    end if;
    v_codigo := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    insert into public.invitaciones (codigo, descripcion, rol_sugerido, sector)
    values (v_codigo, p_descripcion, p_rol, p_sector);
    return v_codigo;
end;
$$;

-- Marca el codigo como usado y aplica el rol sugerido (tras el signUp)
create or replace function public.usar_invitacion(p_codigo text)
returns text language plpgsql security definer set search_path = public as $$
declare
    v_rol   text;
    v_id    uuid := auth.uid();
begin
    if v_id is null then
        raise exception 'No autenticado' using errcode = '42501';
    end if;
    select rol_sugerido into v_rol
    from public.invitaciones
    where upper(codigo) = upper(trim(p_codigo)) and activo and usado_por is null
    for update;
    if v_rol is null then
        raise exception 'Codigo de invitacion invalido o ya utilizado' using errcode = '42501';
    end if;
    update public.invitaciones set usado_por = v_id, usado_en = now()
    where upper(codigo) = upper(trim(p_codigo));
    update public.profiles set rol = v_rol, sector = coalesce(sector, (select i.sector from public.invitaciones i where i.usado_por = v_id))
    where id = v_id;
    return v_rol;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Gestion de usuarios
-- ---------------------------------------------------------------------------
create or replace function public.listar_usuarios()
returns table (
    id uuid, email text, username text, nombre text, rol text,
    sector text, telefono text, activo boolean, creado_en timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
    if not exists (
        select 1 from public.profiles
        where id = auth.uid() and activo and rol in ('administrador','presidente')
    ) then
        raise exception 'Permiso denegado' using errcode = '42501';
    end if;
    return query
        select p.id, p.email, p.username, p.nombre, p.rol,
               p.sector, p.telefono, p.activo, p.creado_en
        from public.profiles p
        order by p.nombre;
end;
$$;

create or replace function public.asignar_rol(p_usuario uuid, p_rol text, p_sector text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
    if not public.es_admin() then
        raise exception 'Permiso denegado' using errcode = '42501';
    end if;
    if p_rol is null or p_rol not in ('administrador','presidente','responsable','ministro','misionero','miembro','frecuentador') then
        raise exception 'Rol invalido' using errcode = '22023';
    end if;
    update public.profiles
    set rol = p_rol, sector = coalesce(p_sector, sector)
    where id = p_usuario;
    if not found then
        raise exception 'Usuario no encontrado' using errcode = 'P0002';
    end if;
end;
$$;

create or replace function public.actualizar_mi_perfil(
    p_nombre text,
    p_telefono text default null,
    p_sector text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
    if auth.uid() is null then
        raise exception 'No autenticado' using errcode = '42501';
    end if;
    update public.profiles
    set nombre = coalesce(nullif(trim(p_nombre), ''), nombre),
        telefono = p_telefono,
        sector = p_sector
    where id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Permisos de ejecucion
-- ---------------------------------------------------------------------------
grant execute on function public.validar_invitacion(text) to anon, authenticated;
grant execute on function public.crear_invitacion(text, text, text) to authenticated;
grant execute on function public.usar_invitacion(text) to authenticated;
grant execute on function public.listar_usuarios() to authenticated;
grant execute on function public.asignar_rol(uuid, text, text) to authenticated;
grant execute on function public.actualizar_mi_perfil(text, text, text) to authenticated;
