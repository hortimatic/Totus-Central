
-- Own Auth identity; no owner impersonation and no JWT fabrication.
-- Ephemeral work requests and credentials are encrypted in the existing Vault.
CREATE OR REPLACE FUNCTION private.totus_assistant_submit(p_action text,p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE job uuid=gen_random_uuid(); token text=encode(extensions.gen_random_bytes(32),'hex'); request bigint; cred uuid;
BEGIN
 IF session_user<>'postgres' OR current_user<>'postgres' OR auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Conector administrativo requerido'; END IF;
 IF p_action NOT IN ('setup','session_check','validate_expense','save_expense','attach_chat_file') THEN RAISE EXCEPTION 'Acción no admitida'; END IF;
 IF octet_length(p_payload::text)>131072 THEN RAISE EXCEPTION 'Solicitud demasiado grande'; END IF;
 IF p_action IN ('save_expense','validate_expense') AND nullif(p_payload#>>'{expense,request_id}','') IS NULL THEN RAISE EXCEPTION 'request_id obligatorio'; END IF;
 SELECT id INTO cred FROM vault.secrets WHERE name='totus_assistant_credentials';
 IF cred IS NULL THEN
  IF p_action<>'setup' THEN RAISE EXCEPTION 'Cuenta todavía no preparada'; END IF;
  PERFORM vault.create_secret(jsonb_build_object('email','chatgpt@totuscentral.invalid','password','Aa1!'||encode(extensions.gen_random_bytes(48),'base64'))::text,'totus_assistant_credentials','Own technical Auth account; never reveal its password to chats');
 END IF;
 -- Retain only 7 days of ephemeral request payloads; audit remains in ops_audit_log.
 DELETE FROM vault.secrets WHERE name LIKE 'totus_assistant_job_%' AND created_at<now()-interval '7 days';
 PERFORM vault.create_secret(jsonb_build_object('action',p_action,'payload',p_payload,'token_hash',encode(extensions.digest(token,'sha256'),'hex'),'status','queued','expires_at',now()+interval '2 minutes')::text,'totus_assistant_job_'||job,'Short-lived authenticated connector work request');
 SELECT net.http_post(url:='https://awmojepsasikxocoeqtu.supabase.co/functions/v1/totus-assistant',
  headers:='{"Content-Type":"application/json"}'::jsonb,
  body:=jsonb_build_object('job',job,'ticket',token),timeout_milliseconds:=30000) INTO request;
 RETURN jsonb_build_object('job_id',job,'http_request_id',request,'status','queued');
END $$;
REVOKE ALL ON FUNCTION private.totus_assistant_submit(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.totus_assistant_result(p_job uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE data jsonb;
BEGIN
 IF session_user<>'postgres' OR current_user<>'postgres' THEN RAISE EXCEPTION 'Conector administrativo requerido'; END IF;
 SELECT decrypted_secret::jsonb INTO data FROM vault.decrypted_secrets WHERE name='totus_assistant_job_'||p_job;
 IF data IS NULL THEN RAISE EXCEPTION 'Solicitud inexistente'; END IF;
 RETURN jsonb_build_object('job_id',p_job,'action',data->>'action','status',data->>'status','result',data->'result','error',data->>'error','finished_at',data->>'finished_at');
END $$;
REVOKE ALL ON FUNCTION private.totus_assistant_result(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.totus_assistant_claim(p_job uuid,p_ticket text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE job_id uuid; data jsonb; credentials jsonb;
BEGIN
 IF length(coalesce(p_ticket,''))<>64 THEN RAISE EXCEPTION 'Solicitud no autorizada'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('totus_assistant_job_'||p_job,0));
 SELECT id INTO job_id FROM vault.secrets WHERE name='totus_assistant_job_'||p_job;
 SELECT decrypted_secret::jsonb INTO data FROM vault.decrypted_secrets WHERE id=job_id;
 IF data IS NULL OR data->>'status'<>'queued' OR (data->>'expires_at')::timestamptz<now()
  OR data->>'token_hash'<>encode(extensions.digest(p_ticket,'sha256'),'hex') THEN RAISE EXCEPTION 'Solicitud no autorizada o caducada'; END IF;
 SELECT decrypted_secret::jsonb INTO credentials FROM vault.decrypted_secrets WHERE name='totus_assistant_credentials';
 IF credentials IS NULL THEN RAISE EXCEPTION 'Configuración no disponible'; END IF;
 PERFORM vault.update_secret(job_id,(data||jsonb_build_object('status','running'))::text);
 RETURN jsonb_build_object('action',data->>'action','payload',data->'payload','credentials',credentials);
END $$;
REVOKE ALL ON FUNCTION public.totus_assistant_claim(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.totus_assistant_claim(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.totus_assistant_complete(p_job uuid,p_result jsonb,p_error text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE job_id uuid; data jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('totus_assistant_job_'||p_job,0));
 SELECT id INTO job_id FROM vault.secrets WHERE name='totus_assistant_job_'||p_job;
 SELECT decrypted_secret::jsonb INTO data FROM vault.decrypted_secrets WHERE id=job_id;
 IF data IS NULL OR data->>'status'<>'running' THEN RAISE EXCEPTION 'Solicitud no activa'; END IF;
 PERFORM vault.update_secret(job_id,(data-'payload'-'token_hash'||jsonb_build_object('status',CASE WHEN p_error IS NULL THEN 'completed' ELSE 'failed' END,'result',p_result,'error',left(p_error,1000),'finished_at',clock_timestamp()))::text);
END $$;
REVOKE ALL ON FUNCTION public.totus_assistant_complete(uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.totus_assistant_complete(uuid,jsonb,text) TO service_role;

CREATE OR REPLACE FUNCTION public.totus_assistant_validate_expense(p_expense jsonb,p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE saved_id uuid; outcome jsonb; detail_text text;
BEGIN
 IF auth.uid() IS NULL OR coalesce(auth.jwt()#>>'{app_metadata,totus_assistant}','')<>'true' THEN RAISE EXCEPTION 'Cuenta de asistente requerida'; END IF;
 BEGIN
  saved_id=public.totus_save_expense(p_expense,p_lines);
  SELECT jsonb_build_object('validated',true,'actor',auth.uid(),'expense',to_jsonb(e),'lines',(SELECT jsonb_agg(to_jsonb(l)) FROM public.ops_expense_lines l WHERE l.expense_id=saved_id)) INTO outcome FROM public.ops_expenses e WHERE e.id=saved_id;
  RAISE EXCEPTION USING ERRCODE='PT001',MESSAGE='Validación sin guardar',DETAIL=outcome::text;
 EXCEPTION WHEN SQLSTATE 'PT001' THEN GET STACKED DIAGNOSTICS detail_text=PG_EXCEPTION_DETAIL; RETURN detail_text::jsonb;
 END;
END $$;
REVOKE ALL ON FUNCTION public.totus_assistant_validate_expense(jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.totus_assistant_validate_expense(jsonb,jsonb) TO authenticated;

-- Retire superseded owner-context bridge; no business rows are removed.
DROP FUNCTION IF EXISTS private.totus_connector_save_expense(text,jsonb,jsonb);
