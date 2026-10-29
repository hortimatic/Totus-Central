CREATE OR REPLACE FUNCTION private.totus_codex_submit(p_action text,p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE job uuid=gen_random_uuid(); token text=encode(extensions.gen_random_bytes(32),'hex'); request bigint;
BEGIN
 IF session_user<>'postgres' OR current_user<>'postgres' OR auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Conector administrativo requerido'; END IF;
 IF p_action NOT IN ('setup','session_check','chat_read','chat_send','chat_direct') THEN RAISE EXCEPTION 'Acción no admitida'; END IF;
 IF jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>65536 THEN RAISE EXCEPTION 'Datos no válidos'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('totus_codex_setup',0));
 IF NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name='totus_codex_credentials') THEN
  IF p_action<>'setup' THEN RAISE EXCEPTION 'Codex todavía no está preparado'; END IF;
  PERFORM vault.create_secret(jsonb_build_object('email','codex@totuscentral.invalid','password','Aa1!'||encode(extensions.gen_random_bytes(48),'base64'))::text,'totus_codex_credentials','Codex own Auth credentials; never return them to a chat');
 END IF;
 PERFORM vault.create_secret(jsonb_build_object('actor','codex','action','codex_'||p_action,'payload',p_payload,
 'token_hash',encode(extensions.digest(token,'sha256'),'hex'),'status','queued','expires_at',now()+interval '2 minutes')::text,
 'totus_assistant_job_'||job,'Short-lived Codex chat operation');
 SELECT net.http_post(url:='https://awmojepsasikxocoeqtu.supabase.co/functions/v1/totus-assistant',
 headers:='{"Content-Type":"application/json"}'::jsonb,body:=jsonb_build_object('job',job,'ticket',token),timeout_milliseconds:=30000) INTO request;
 RETURN jsonb_build_object('job_id',job,'http_request_id',request,'status','queued');
END $$;
REVOKE ALL ON FUNCTION private.totus_codex_submit(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.totus_assistant_claim(p_job uuid,p_ticket text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE job_id uuid; data jsonb; credentials jsonb; credential_name text;
BEGIN
 IF length(coalesce(p_ticket,''))<>64 THEN RAISE EXCEPTION 'Solicitud no autorizada'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('totus_assistant_job_'||p_job,0));
 SELECT id INTO job_id FROM vault.secrets WHERE name='totus_assistant_job_'||p_job;
 SELECT decrypted_secret::jsonb INTO data FROM vault.decrypted_secrets WHERE id=job_id;
 IF data IS NULL OR data->>'status'<>'queued' OR (data->>'expires_at')::timestamptz<now()
 OR data->>'token_hash'<>encode(extensions.digest(p_ticket,'sha256'),'hex') THEN RAISE EXCEPTION 'Solicitud no autorizada o caducada'; END IF;
 IF coalesce(data->>'actor','chatgpt') NOT IN ('codex','chatgpt') THEN RAISE EXCEPTION 'Identidad no admitida'; END IF;
 credential_name=CASE WHEN data->>'actor'='codex' THEN 'totus_codex_credentials' ELSE 'totus_assistant_credentials' END;
 IF (data->>'actor'='codex') IS DISTINCT FROM ((data->>'action') LIKE 'codex_%') THEN
  IF data->>'actor'='codex' OR (data->>'action') LIKE 'codex_%' THEN RAISE EXCEPTION 'Identidad y acción no coinciden'; END IF;
 END IF;
 SELECT decrypted_secret::jsonb INTO credentials FROM vault.decrypted_secrets WHERE name=credential_name;
 IF credentials IS NULL THEN RAISE EXCEPTION 'Configuración no disponible'; END IF;
 PERFORM vault.update_secret(job_id,(data||jsonb_build_object('status','running'))::text);
 RETURN jsonb_build_object('action',data->>'action','payload',data->'payload','credentials',credentials);
END $$;
REVOKE ALL ON FUNCTION public.totus_assistant_claim(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.totus_assistant_claim(uuid,text) TO service_role;
