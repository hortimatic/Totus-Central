-- Extend both own-Auth routes. Existing ACLs, RLS, ticket and claim lifecycle are preserved.

-- Own Auth identity; no owner impersonation and no JWT fabrication.
-- Ephemeral work requests and credentials are encrypted in the existing Vault.
CREATE OR REPLACE FUNCTION private.totus_assistant_submit(p_action text,p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE job uuid=gen_random_uuid(); token text=encode(extensions.gen_random_bytes(32),'hex'); request bigint; cred uuid;
BEGIN
 IF session_user<>'postgres' OR current_user<>'postgres' OR auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Conector administrativo requerido'; END IF;
 IF p_action NOT IN ('session_check','validate_expense','save_expense','attach_chat_file','expense_context','review_document','chat_read','chat_send','chat_direct','operation') THEN RAISE EXCEPTION 'Acción no admitida'; END IF;
 IF jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>131072 THEN RAISE EXCEPTION 'Solicitud demasiado grande'; END IF;
 IF p_action IN ('save_expense','validate_expense') AND nullif(p_payload#>>'{expense,request_id}','') IS NULL THEN RAISE EXCEPTION 'request_id obligatorio'; END IF;
 SELECT id INTO cred FROM vault.secrets WHERE name='totus_assistant_credentials';
 IF cred IS NULL THEN RAISE EXCEPTION 'La cuenta debe configurarse desde administración'; END IF;
 -- Retain only 7 days of ephemeral request payloads; audit remains in ops_audit_log.
 DELETE FROM vault.secrets WHERE name LIKE 'totus_assistant_job_%' AND created_at<now()-interval '7 days';
 PERFORM vault.create_secret(jsonb_build_object('action',p_action,'payload',p_payload,'token_hash',encode(extensions.digest(token,'sha256'),'hex'),'status','queued','expires_at',now()+interval '2 minutes')::text,'totus_assistant_job_'||job,'Short-lived authenticated connector work request');
 SELECT net.http_post(url:='https://awmojepsasikxocoeqtu.supabase.co/functions/v1/totus-assistant',
  headers:='{"Content-Type":"application/json"}'::jsonb,
  body:=jsonb_build_object('job',job,'ticket',token),timeout_milliseconds:=30000) INTO request;
 RETURN jsonb_build_object('job_id',job,'http_request_id',request,'status','queued');
END $$;
REVOKE ALL ON FUNCTION private.totus_assistant_submit(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;



CREATE OR REPLACE FUNCTION private.totus_codex_submit(p_action text,p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE job uuid=gen_random_uuid(); token text=encode(extensions.gen_random_bytes(32),'hex'); request bigint;
BEGIN
 IF session_user<>'postgres' OR current_user<>'postgres' OR auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Conector administrativo requerido'; END IF;
 IF p_action NOT IN ('setup','session_check','validate_expense','save_expense','attach_chat_file','expense_context','review_document','chat_read','chat_send','chat_direct','operation','grant_chatgpt_admin') THEN RAISE EXCEPTION 'Acción no admitida'; END IF;
 IF jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>65536 THEN RAISE EXCEPTION 'Datos no válidos'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('totus_codex_setup',0));
 IF NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name='totus_codex_credentials') THEN
  IF p_action<>'setup' THEN RAISE EXCEPTION 'Codex todavía no está preparado'; END IF;
  PERFORM vault.create_secret(jsonb_build_object('email','codex@totuscentral.invalid','password','Aa1!'||encode(extensions.gen_random_bytes(48),'base64'))::text,'totus_codex_credentials','Codex own Auth credentials; never return them to a chat');
 END IF;
 PERFORM vault.create_secret(jsonb_build_object('actor','codex','action','codex_'||p_action,'payload',p_payload,
 'token_hash',encode(extensions.digest(token,'sha256'),'hex'),'status','queued','expires_at',now()+interval '2 minutes')::text,
 'totus_assistant_job_'||job,'Short-lived Codex own-session operation');
 SELECT net.http_post(url:='https://awmojepsasikxocoeqtu.supabase.co/functions/v1/totus-assistant',
 headers:='{"Content-Type":"application/json"}'::jsonb,body:=jsonb_build_object('job',job,'ticket',token),timeout_milliseconds:=30000) INTO request;
 RETURN jsonb_build_object('job_id',job,'http_request_id',request,'status','queued');
END $$;
REVOKE ALL ON FUNCTION private.totus_codex_submit(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;


CREATE OR REPLACE FUNCTION public.totus_assistant_validate_expense(p_expense jsonb,p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE saved_id uuid; outcome jsonb; detail_text text;
BEGIN
 IF auth.uid() IS NULL OR (coalesce(auth.jwt()#>>'{app_metadata,totus_assistant}','')<>'true' AND coalesce(auth.jwt()#>>'{app_metadata,totus_codex}','')<>'true') THEN RAISE EXCEPTION 'Cuenta de asistente requerida'; END IF;
 BEGIN
  saved_id=public.totus_save_expense(p_expense,p_lines);
  SELECT jsonb_build_object('validated',true,'actor',auth.uid(),'expense',to_jsonb(e),'lines',(SELECT jsonb_agg(to_jsonb(l)) FROM public.ops_expense_lines l WHERE l.expense_id=saved_id)) INTO outcome FROM public.ops_expenses e WHERE e.id=saved_id;
  RAISE EXCEPTION USING ERRCODE='PT001',MESSAGE='Validación sin guardar',DETAIL=outcome::text;
 EXCEPTION WHEN SQLSTATE 'PT001' THEN GET STACKED DIAGNOSTICS detail_text=PG_EXCEPTION_DETAIL; RETURN detail_text::jsonb;
 END;
END $$;
REVOKE ALL ON FUNCTION public.totus_assistant_validate_expense(jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.totus_assistant_validate_expense(jsonb,jsonb) TO authenticated;


CREATE OR REPLACE FUNCTION private.totus_assistant_capabilities()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF session_user<>'postgres' OR current_user<>'postgres' THEN RAISE EXCEPTION 'Conector administrativo requerido'; END IF;
 RETURN jsonb_build_object('version',4,'identity','own_supabase_auth_user',
 'submit','private.totus_assistant_submit','codex_submit','private.totus_codex_submit','result','private.totus_assistant_result',
 'actions',jsonb_build_array('session_check','validate_expense','save_expense','attach_chat_file','expense_context','review_document','chat_read','chat_send','chat_direct','operation'),
 'catalogue',jsonb_build_object('action','operation','payload',jsonb_build_object('operation','catalogue')),
 'edits_require','expected_updated_at and unchanged request_id when retrying',
 'policy','Normal authenticated RLS/RPC only. No direct accounting SQL, invented data, automatic fiscal approval or secrets. Catalogue is authoritative; connected tools still require their own authorization.');
END $$;
REVOKE ALL ON FUNCTION private.totus_assistant_capabilities() FROM PUBLIC,anon,authenticated,service_role;
