CREATE OR REPLACE FUNCTION public.totus_backup_save_settings(p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE previous_enabled boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_admin() THEN RAISE EXCEPTION 'Solo administrador'; END IF;
 SELECT enabled INTO previous_enabled FROM public.ops_backup_config WHERE id=1 FOR UPDATE;
 UPDATE public.ops_backup_config SET
   enabled=coalesce((p->>'enabled')::boolean,false),
   frequency=coalesce(p->>'frequency','daily'),
   run_hour=coalesce((p->>'run_hour')::smallint,3),
   run_minute=coalesce((p->>'run_minute')::smallint,0),
   weekday=coalesce((p->>'weekday')::smallint,1),
   month_day=coalesce((p->>'month_day')::smallint,1),
   retention_days=5,
   destination_folder=coalesce(p->>'destination_folder','automaticas'),
   updated_at=now()
 WHERE id=1;
 PERFORM private.totus_audit('administracion','backup_settings_updated',null,
   jsonb_build_object(
      'previous_enabled',previous_enabled,
      'enabled',coalesce((p->>'enabled')::boolean,false),
      'frequency',coalesce(p->>'frequency','daily'),
      'run_time',lpad(coalesce(p->>'run_hour','3'),2,'0')||':'||lpad(coalesce(p->>'run_minute','0'),2,'0'),
      'retention_days',coalesce((p->>'retention_days')::integer,10),
      'destination_folder',coalesce(p->>'destination_folder','automaticas')
   ));
END $function$
