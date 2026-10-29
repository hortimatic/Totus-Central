BEGIN;

-- Only standalone event rows are removable. Never delete messages, tasks,
-- accounting rows, receipt revisions, backup runs or files through this API.
CREATE OR REPLACE FUNCTION private.totus_log_cleanup(
 p_from date DEFAULT NULL,p_to date DEFAULT NULL,
 p_execute boolean DEFAULT false,p_fingerprint text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_start timestamptz;v_end timestamptz;v_table text;v_count bigint;v_removed bigint;
 v_total bigint:=0;v_bytes bigint:=0;v_part_bytes bigint;v_hash text;
 v_parts jsonb:='[]';v_counts jsonb:='{}';v_fingerprint text;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_admin() THEN
  RAISE EXCEPTION 'Solo administración puede limpiar el Log';
 END IF;
 IF p_to IS NULL OR p_from>p_to OR p_to>(now() AT TIME ZONE 'Europe/Madrid')::date THEN
  RAISE EXCEPTION 'Indica un rango válido, sin fechas futuras';
 END IF;
 v_start:=p_from::timestamp AT TIME ZONE 'Europe/Madrid';
 v_end:=(p_to+1)::timestamp AT TIME ZONE 'Europe/Madrid';
 IF p_execute THEN
  IF p_fingerprint IS NULL OR p_fingerprint !~ '^[a-f0-9]{32}$' THEN
   RAISE EXCEPTION 'Consulta primero los registros que se eliminarán';
  END IF;
  -- Short, bounded lock prevents inserts/deletes between recheck and deletion.
  PERFORM set_config('lock_timeout','3s',true);
  LOCK TABLE public.ops_audit_log,public.team_user_audit_log,
   public.ops_chat_events,public.ops_task_events IN SHARE ROW EXCLUSIVE MODE;
 END IF;
 FOREACH v_table IN ARRAY ARRAY['ops_audit_log','team_user_audit_log','ops_chat_events','ops_task_events'] LOOP
  EXECUTE format('SELECT count(*),coalesce(sum(pg_column_size(e)),0),md5(coalesce(string_agg(id::text,'','' ORDER BY id),'''')) FROM public.%I e WHERE ($1 IS NULL OR created_at >= $1) AND created_at < $2 AND ($3 <> ''ops_audit_log'' OR action IS DISTINCT FROM ''limpiar_historial'')',v_table)
   INTO v_count,v_part_bytes,v_hash USING v_start,v_end,v_table;
  v_total:=v_total+v_count;v_bytes:=v_bytes+v_part_bytes;
  v_counts:=v_counts||jsonb_build_object(v_table,v_count);
  v_parts:=v_parts||jsonb_build_array(v_table,v_hash);
 END LOOP;
 IF v_total>50000 THEN RAISE EXCEPTION 'Hay más de 50.000 eventos. Elige un rango más pequeño';END IF;
 v_fingerprint:=md5(auth.uid()::text||':'||coalesce(p_from::text,'*')||':'||p_to::text||':'||v_parts::text);
 IF NOT p_execute THEN
  RETURN jsonb_build_object('count',v_total,'counts',v_counts,'estimated_bytes',v_bytes,'fingerprint',v_fingerprint,'from',p_from,'to',p_to);
 END IF;
 IF v_fingerprint IS DISTINCT FROM p_fingerprint THEN
  RAISE EXCEPTION 'El historial ha cambiado. Vuelve a consultar antes de eliminar';
 END IF;
 IF v_total=0 THEN RETURN jsonb_build_object('deleted',0,'counts',v_counts);END IF;
 FOREACH v_table IN ARRAY ARRAY['ops_audit_log','team_user_audit_log','ops_chat_events','ops_task_events'] LOOP
  EXECUTE format('DELETE FROM public.%I WHERE ($1 IS NULL OR created_at >= $1) AND created_at < $2 AND ($3 <> ''ops_audit_log'' OR action IS DISTINCT FROM ''limpiar_historial'')',v_table)
   USING v_start,v_end,v_table;
  GET DIAGNOSTICS v_removed=ROW_COUNT;
  IF v_removed<>(v_counts->>v_table)::bigint THEN RAISE EXCEPTION 'El historial cambió durante la limpieza';END IF;
 END LOOP;
 INSERT INTO public.ops_audit_log(user_id,user_email,area,action,detail)
 VALUES(auth.uid(),lower(auth.jwt()->>'email'),'administracion','limpiar_historial',
  jsonb_build_object('desde',p_from,'hasta',p_to,'eliminados',v_total,'por_tipo',v_counts));
 RETURN jsonb_build_object('deleted',v_total,'counts',v_counts);
END $$;
REVOKE ALL ON FUNCTION private.totus_log_cleanup(date,date,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.totus_log_cleanup(date,date,boolean,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.totus_log_cleanup(
 p_from date DEFAULT NULL,p_to date DEFAULT NULL,
 p_execute boolean DEFAULT false,p_fingerprint text DEFAULT NULL
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT private.totus_log_cleanup(p_from,p_to,p_execute,p_fingerprint)
$$;
REVOKE ALL ON FUNCTION public.totus_log_cleanup(date,date,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.totus_log_cleanup(date,date,boolean,text) TO authenticated;
COMMIT;
