-- Audit rows use the existing numeric identity. Retry UUIDs are separate metadata.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
CREATE UNIQUE INDEX IF NOT EXISTS totus_activity_event_unique ON public.ops_audit_log ((detail->>'evento')) WHERE detail->>'origen'='Interfaz Totus Central';
CREATE OR REPLACE FUNCTION public.totus_record_activity(p_area text,p_action text,p_reference text DEFAULT NULL,p_expected_actor text DEFAULT NULL,p_event uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor text;uid uuid=auth.uid();event_id uuid=coalesce(p_event,gen_random_uuid());
BEGIN
 SELECT lower(t.email) INTO actor FROM public.team_members t JOIN auth.users u ON lower(u.email)=lower(t.email) WHERE u.id=uid AND t.active LIMIT 1;
 IF p_expected_actor IS NOT NULL AND lower(p_expected_actor) IS DISTINCT FROM actor THEN RAISE EXCEPTION 'La sesión de actividad ha cambiado';END IF;
 IF actor IS NULL THEN RAISE EXCEPTION 'Sin acceso al registro de actividad'; END IF;
 IF p_area NOT IN ('inicio','pricing','cajas','gastos','facturacion','documentos','fiscalidad','informes','administracion','equipo','tareas','recepciones') OR p_action NOT IN ('abrir_modulo','abrir_seccion','consultar_documento','descarga_preparada','aplicar_filtros','consultar_estado','error_operacion','acceso_denegado') THEN RAISE EXCEPTION 'Actividad no válida';END IF;
 IF p_reference IS NOT NULL AND (length(p_reference)>80 OR p_reference !~ '^[A-Za-z0-9_-]+$') THEN RAISE EXCEPTION 'Referencia no válida'; END IF;
 IF p_action<>'acceso_denegado' AND NOT private.totus_can(CASE WHEN p_area='recepciones' THEN 'documentos' ELSE p_area END,'view') THEN RAISE EXCEPTION 'Sin acceso a ese módulo'; END IF;
 INSERT INTO public.ops_audit_log(user_id,user_email,area,action,detail) VALUES(uid,actor,p_area,p_action,jsonb_build_object('referencia',p_reference,'origen','Interfaz Totus Central','evento',event_id)) ON CONFLICT DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM public.ops_audit_log WHERE detail->>'evento'=event_id::text AND user_id=uid AND area=p_area AND action=p_action AND detail=jsonb_build_object('referencia',p_reference,'origen','Interfaz Totus Central','evento',event_id)) THEN RAISE EXCEPTION 'El identificador de actividad ya está usado';END IF;
END; $$;
REVOKE ALL ON FUNCTION public.totus_record_activity(text,text,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.totus_record_activity(text,text,text,text,uuid) TO authenticated;

COMMIT;
