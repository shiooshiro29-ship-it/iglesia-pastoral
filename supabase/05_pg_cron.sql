-- ============================================================================
-- Iglesia Mundial del Mesias - Bolivia
-- 05 - Automatizacion (OPCIONAL) de cultos de antepasados con pg_cron
-- ============================================================================
-- Ejecutar DESPUES de 01, 02, 03 y 04.
--
-- Objetivo:
--   1. Renovar diariamente el proximo aniversario anual de cada fallecido.
--   2. (Refuerzo) Avisar/recordar al responsable los cultos de antepasados
--      que tocan en los proximos dias.
--
-- pg_cron viene disponible por defecto en Supabase (extension "pg_cron").
-- Si tu plan/proyecto no lo permite, puedes llamar manualmente a
-- public.ss_regenerar_anuales_antepasados() desde:
--   - SQL Editor, o
--   - un boton en la app (RPC ss_regenerar_anuales_antepasados).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Habilitar la extension
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron with schema extensions;

-- ---------------------------------------------------------------------------
-- 2. Renovar los aniversarios anuales todos los dias a las 00:05 (UTC)
--    Los anuales de los anios pasados ya no se regeneran; el proximo
--    aniversario se crea automaticamente en cuanto entra el nuevo anio.
-- ---------------------------------------------------------------------------
select cron.schedule(
    'regenerar-anuales-antepasados',
    '5 0 * * *',
    $$
    select public.ss_regenerar_anuales_antepasados(extract(year from current_date)::int);
    $$
);

-- ---------------------------------------------------------------------------
-- 3. (Opcional) Recalcular fechas de culto si se agregan feriados nuevos.
--    Vuelve a ajustar los hitos futuros pendientes contra la tabla feriados.
-- ---------------------------------------------------------------------------
create or replace function public.ss_recalcular_fechas_antepasados()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_hito record;
  v_adj record;
  v_n int := 0;
begin
  for v_hito in
    select id, fecha_objetivo
    from public.cultos_antepasados
    where estado in ('pendiente','avisado')
      and fecha_objetivo >= current_date
  loop
    select * into v_adj from public.ss_ajustar_culto_antepasado(v_hito.fecha_objetivo);
    update public.cultos_antepasados
    set fecha_culto = v_adj.fecha_culto,
        fecha_aviso = v_adj.fecha_aviso,
        es_domingo = v_adj.es_domingo,
        es_feriado = v_adj.es_feriado,
        ajustado = v_adj.ajustado,
        updated_at = now()
    where id = v_hito.id;
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('recalculados', v_n);
end;
$$;

grant execute on function public.ss_recalcular_fechas_antepasados() to authenticated;

select cron.schedule(
    'recalcular-fechas-antepasados',
    '10 0 * * *',
    $$ select public.ss_recalcular_fechas_antepasados(); $$
);

-- ---------------------------------------------------------------------------
-- Notas:
--   - Para ver los jobs:      select * from cron.job;
--   - Para ver la ejecucion:  select * from cron.job_run_details order by start_time desc limit 20;
--   - Para desprogramar:      select cron.unschedule('regenerar-anuales-antepasados');
--                             select cron.unschedule('recalcular-fechas-antepasados');
-- ============================================================================
