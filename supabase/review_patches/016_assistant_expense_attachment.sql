
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

