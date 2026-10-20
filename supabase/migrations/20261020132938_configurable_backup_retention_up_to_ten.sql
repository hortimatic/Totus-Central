create or replace function public.totus_backup_save_settings(p jsonb)
returns void language plpgsql security definer set search_path='' as $function$
declare previous_enabled boolean; saved_keep integer;
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Solo administrador'; end if;
 select enabled,retention_days into previous_enabled,saved_keep from public.ops_backup_config where id=1 for update;
 if not found then raise exception 'Configuración de copias no disponible'; end if;
 saved_keep:=coalesce((p->>'retention_days')::integer,saved_keep);
 if saved_keep<1 or saved_keep>10 then raise exception 'El número de copias debe estar entre 1 y 10'; end if;
 update public.ops_backup_config set
 enabled=coalesce((p->>'enabled')::boolean,false),frequency=coalesce(p->>'frequency','daily'),
 run_hour=coalesce((p->>'run_hour')::smallint,3),run_minute=coalesce((p->>'run_minute')::smallint,0),
 weekday=coalesce((p->>'weekday')::smallint,1),month_day=coalesce((p->>'month_day')::smallint,1),
 retention_days=saved_keep,destination_folder=coalesce(p->>'destination_folder','automaticas'),updated_at=now() where id=1;
 perform private.totus_audit('administracion','backup_settings_updated',null,jsonb_build_object(
 'previous_enabled',previous_enabled,'enabled',coalesce((p->>'enabled')::boolean,false),
 'frequency',coalesce(p->>'frequency','daily'),
 'run_time',lpad(coalesce(p->>'run_hour','3'),2,'0')||':'||lpad(coalesce(p->>'run_minute','0'),2,'0'),
 'retention_days',saved_keep,'destination_folder',coalesce(p->>'destination_folder','automaticas')));
end $function$;
revoke all on function public.totus_backup_save_settings(jsonb) from public,anon;
grant execute on function public.totus_backup_save_settings(jsonb) to authenticated,service_role;