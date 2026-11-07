-- PrestaShop product creation requests: durable, idempotent and isolated from accounting.
-- Store only request identity, hash, status and the verified PrestaShop ID: no credentials, PII or XML.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE IF NOT EXISTS private.totus_prestashop_product_create_requests (
 request_id uuid PRIMARY KEY,
 connection_id uuid NOT NULL,
 connection_revision bigint NOT NULL CHECK (connection_revision>0),
 actor_id uuid NOT NULL,
 store text NOT NULL CHECK (store IN ('hortimatic','newoldsmok')),
 reference text NOT NULL CHECK (length(reference) BETWEEN 3 AND 64 AND reference ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$'),
 signature text NOT NULL CHECK (signature ~ '^[0-9a-f]{64}$'),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','uncertain','completed')),
 product_id bigint CHECK (product_id>0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 completed_at timestamptz,
 CHECK (status <> 'completed' OR (product_id IS NOT NULL AND completed_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS totus_prestashop_product_create_store_reference
 ON private.totus_prestashop_product_create_requests (store, lower(reference));
CREATE INDEX IF NOT EXISTS totus_prestashop_product_create_pending
 ON private.totus_prestashop_product_create_requests (status, created_at) WHERE status <> 'completed';
ALTER TABLE private.totus_prestashop_product_create_requests ENABLE ROW LEVEL SECURITY;
DO $policy$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='private' AND tablename='totus_prestashop_product_create_requests' AND policyname='product_create_service') THEN
  CREATE POLICY product_create_service ON private.totus_prestashop_product_create_requests TO service_role USING (true) WITH CHECK (true);
 END IF;
END $policy$;

-- Only the existing server service client may call this journal. The signed-in browser
-- cannot invoke the RPC or read the private table. Invoker rights avoid RLS bypass.
CREATE OR REPLACE FUNCTION public.totus_prestashop_product_create_journal(
 p_action text, p_request_id uuid, p_data jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $fn$
DECLARE
 v_actor uuid;
 v_connection uuid;
 v_revision bigint;
 v_store text;
 v_reference text;
 v_signature text;
 v_product bigint;
 v_row private.totus_prestashop_product_create_requests%rowtype;
 v_conn record;
BEGIN
 IF p_action NOT IN ('lookup','claim','complete','uncertain')
    OR p_request_id IS NULL OR jsonb_typeof(p_data) <> 'object'
 THEN RAISE EXCEPTION 'Invalid product journal action'; END IF;
 BEGIN
  v_actor := (p_data->>'actor_id')::uuid;
  v_connection := (p_data->>'connection_id')::uuid;
  v_revision := (p_data->>'revision')::bigint;
 EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
  RAISE EXCEPTION 'Invalid journal actor or connection';
 END;
 IF v_actor IS NULL OR v_connection IS NULL OR v_revision IS NULL OR v_revision<1
 THEN RAISE EXCEPTION 'Missing journal actor or connection'; END IF;
 IF p_action='lookup' THEN
  SELECT * INTO v_row FROM private.totus_prestashop_product_create_requests
   WHERE request_id=p_request_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_row.actor_id<>v_actor OR v_row.connection_id<>v_connection OR v_row.connection_revision<>v_revision
   THEN RAISE EXCEPTION 'Journal request belongs to another actor or connection'; END IF;
  RETURN jsonb_build_object('status',v_row.status,'store',v_row.store,
   'reference',v_row.reference,'signature',v_row.signature,'product_id',v_row.product_id);
 END IF;
 v_signature:=p_data->>'signature';
 IF v_signature IS NULL OR v_signature !~ '^[0-9a-f]{64}$'
 THEN RAISE EXCEPTION 'Invalid request signature'; END IF;
 IF p_action='claim' THEN
  v_store:=p_data->>'store';v_reference:=p_data->>'reference';
  IF v_store NOT IN ('hortimatic','newoldsmok') OR
   v_reference IS NULL OR v_reference !~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$'
  THEN RAISE EXCEPTION 'Invalid shop or product reference'; END IF;
  SELECT id,name,revision,enabled,verified_revision,real_data_authorized
  INTO v_conn FROM private.totus_api_connections WHERE id=v_connection;
  IF NOT FOUND THEN RAISE EXCEPTION 'Store connection does not exist'; END IF;
  IF v_conn.revision<>v_revision OR v_conn.enabled IS DISTINCT FROM true OR
     v_conn.verified_revision<>v_revision OR v_conn.real_data_authorized IS DISTINCT FROM true OR
     v_conn.name<>(CASE WHEN v_store='hortimatic' THEN 'PrestaShop · Hortimatic' ELSE 'PrestaShop · NewOldSmok' END)
  THEN RAISE EXCEPTION 'Store connection is not verified'; END IF;
  INSERT INTO private.totus_prestashop_product_create_requests
   (request_id,connection_id,connection_revision,actor_id,store,reference,signature,status)
   VALUES (p_request_id,v_connection,v_revision,v_actor,v_store,v_reference,v_signature,'pending')
   ON CONFLICT DO NOTHING RETURNING * INTO v_row;
  IF FOUND THEN RETURN jsonb_build_object('status','claimed'); END IF;
  -- A request ID *or* a shop/reference already exists: never send another POST.
  SELECT * INTO v_row FROM private.totus_prestashop_product_create_requests WHERE request_id=p_request_id;
  IF FOUND THEN
   IF v_row.actor_id<>v_actor OR v_row.connection_id<>v_connection OR v_row.connection_revision<>v_revision
      OR v_row.signature<>v_signature OR v_row.store<>v_store OR v_row.reference<>v_reference
   THEN RAISE EXCEPTION 'Request ID is already bound to another operation'; END IF;
   RETURN jsonb_build_object('status',v_row.status);
  END IF;
  RETURN jsonb_build_object('status','duplicate_reference');
 END IF;
 IF p_action='complete' THEN
  BEGIN v_product := (p_data->>'product_id')::bigint;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
   RAISE EXCEPTION 'Invalid verified product ID'; END;
  IF v_product IS NULL OR v_product<1 THEN RAISE EXCEPTION 'Missing verified product ID'; END IF;
  UPDATE private.totus_prestashop_product_create_requests
   SET product_id=v_product,status='completed',completed_at=clock_timestamp(),updated_at=clock_timestamp()
   WHERE request_id=p_request_id AND actor_id=v_actor AND connection_id=v_connection
     AND connection_revision=v_revision AND signature=v_signature AND status IN ('pending','uncertain')
     AND (product_id IS NULL OR product_id=v_product)
   RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Journal request is not pending; reconcile before retry'; END IF;
  RETURN jsonb_build_object('status','completed','product_id',v_product);
 END IF;
 -- Any uncertain POST/verification keeps the reference locked until manual reconciliation.
 UPDATE private.totus_prestashop_product_create_requests
 SET status='uncertain',
   product_id=COALESCE(CASE WHEN (p_data->>'product_id') ~ '^[1-9][0-9]{0,14}$' THEN (p_data->>'product_id')::bigint ELSE NULL END,product_id),
   updated_at=clock_timestamp()
 WHERE request_id=p_request_id AND actor_id=v_actor AND connection_id=v_connection
   AND connection_revision=v_revision AND signature=v_signature AND status='pending'
 RETURNING * INTO v_row;
 IF NOT FOUND THEN RAISE EXCEPTION 'Journal request is not pending; no state changed'; END IF;
 RETURN jsonb_build_object('status','uncertain','product_id',v_row.product_id);
END $fn$;

REVOKE ALL ON TABLE private.totus_prestashop_product_create_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.totus_prestashop_product_create_journal(text,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
-- Read only the public connection metadata required by this journal, not stored secrets.
GRANT SELECT (id,name,revision,enabled,verified_revision,real_data_authorized)
 ON TABLE private.totus_api_connections TO service_role;
GRANT SELECT,INSERT,UPDATE ON TABLE private.totus_prestashop_product_create_requests TO service_role;
GRANT EXECUTE ON FUNCTION public.totus_prestashop_product_create_journal(text,uuid,jsonb) TO service_role;

COMMENT ON TABLE private.totus_prestashop_product_create_requests IS
 'Idempotent product POST journal, locked on shop/reference until explicit reconciliation; no shop data or keys stored.';
-- Child writes share the verified parent request but have independent immutable
-- intent hashes. Losing an HTTP response must not create a second combination,
-- price or image. The browser cannot inspect or call this journal directly.
CREATE TABLE IF NOT EXISTS private.totus_prestashop_product_steps (
 request_id uuid NOT NULL REFERENCES private.totus_prestashop_product_create_requests(request_id),
 stage text NOT NULL CHECK (stage ~ '^[a-z][a-z0-9_-]{1,95}$'),
 signature text NOT NULL CHECK (signature ~ '^[0-9a-f]{64}$'),
 status text NOT NULL CHECK (status IN ('pending','uncertain','completed')),
 record_id bigint CHECK (record_id>0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(request_id,stage)
);
ALTER TABLE private.totus_prestashop_product_steps ENABLE ROW LEVEL SECURITY;
DO $steps_policy$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='private' AND tablename='totus_prestashop_product_steps' AND policyname='product_steps_service') THEN
  CREATE POLICY product_steps_service ON private.totus_prestashop_product_steps TO service_role USING(true) WITH CHECK(true);
 END IF;
END $steps_policy$;
CREATE OR REPLACE FUNCTION public.totus_prestashop_product_step(
 p_action text,p_request_id uuid,p_stage text,p_data jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $step$
DECLARE
 v_parent private.totus_prestashop_product_create_requests%rowtype;
 v_step private.totus_prestashop_product_steps%rowtype;
 v_signature text:=p_data->>'signature';
 v_record bigint;
BEGIN
 IF p_action NOT IN ('lookup','claim','complete','uncertain') OR p_stage IS NULL OR p_stage !~ '^[a-z][a-z0-9_-]{1,95}$' OR jsonb_typeof(p_data)<>'object'
 THEN RAISE EXCEPTION 'Invalid product stage'; END IF;
 SELECT * INTO v_parent FROM private.totus_prestashop_product_create_requests WHERE request_id=p_request_id;
 IF NOT FOUND OR v_parent.status<>'completed' OR v_parent.actor_id IS DISTINCT FROM (p_data->>'actor_id')::uuid
  OR v_parent.connection_id IS DISTINCT FROM (p_data->>'connection_id')::uuid
  OR v_parent.connection_revision IS DISTINCT FROM (p_data->>'revision')::bigint
  OR v_parent.product_id IS DISTINCT FROM (p_data->>'product_id')::bigint
 THEN RAISE EXCEPTION 'Verified product request does not belong to this session'; END IF;
 IF p_action<>'lookup' AND (v_signature IS NULL OR v_signature !~ '^[0-9a-f]{64}$') THEN RAISE EXCEPTION 'Invalid stage signature'; END IF;
 IF p_action='claim' THEN
  INSERT INTO private.totus_prestashop_product_steps(request_id,stage,signature,status) VALUES(p_request_id,p_stage,v_signature,'pending') ON CONFLICT DO NOTHING RETURNING * INTO v_step;
  IF FOUND THEN RETURN jsonb_build_object('status','claimed'); END IF;
 END IF;
 SELECT * INTO v_step FROM private.totus_prestashop_product_steps WHERE request_id=p_request_id AND stage=p_stage FOR UPDATE;
 IF NOT FOUND THEN
  IF p_action='lookup' THEN RETURN NULL; END IF;
  RAISE EXCEPTION 'Stage has not been claimed';
 END IF;
 IF p_action<>'lookup' AND v_step.signature<>v_signature THEN RAISE EXCEPTION 'Stage is bound to another intent'; END IF;
 IF p_action='complete' THEN
  v_record:=(p_data->>'record_id')::bigint;
  IF v_record IS NULL OR v_record<1 OR v_step.status NOT IN ('pending','uncertain') OR (v_step.record_id IS NOT NULL AND v_step.record_id<>v_record) THEN RAISE EXCEPTION 'Stage cannot be completed'; END IF;
  UPDATE private.totus_prestashop_product_steps SET status='completed',record_id=v_record,updated_at=clock_timestamp() WHERE request_id=p_request_id AND stage=p_stage RETURNING * INTO v_step;
 ELSIF p_action='uncertain' THEN
  IF v_step.status<>'pending' THEN RAISE EXCEPTION 'Stage is no longer pending'; END IF;
  UPDATE private.totus_prestashop_product_steps SET status='uncertain',updated_at=clock_timestamp() WHERE request_id=p_request_id AND stage=p_stage RETURNING * INTO v_step;
 END IF;
 RETURN jsonb_build_object('status',v_step.status,'signature',v_step.signature,'record_id',v_step.record_id);
END $step$;
REVOKE ALL ON TABLE private.totus_prestashop_product_steps FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.totus_prestashop_product_step(text,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE private.totus_prestashop_product_steps TO service_role;
GRANT EXECUTE ON FUNCTION public.totus_prestashop_product_step(text,uuid,text,jsonb) TO service_role;

-- Independent journal for selective updates to pre-existing products. Its actor
-- comes from the verified JWT in totus-connections, never from browser arguments.
CREATE TABLE IF NOT EXISTS private.totus_prestashop_product_edits(
 request_id uuid PRIMARY KEY,actor_id uuid NOT NULL,connection_id uuid NOT NULL,
 revision bigint NOT NULL,signature text NOT NULL CHECK(signature ~ '^[a-f0-9]{64}$'),
 status text NOT NULL CHECK(status IN ('pending','uncertain','completed')),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE private.totus_prestashop_product_edits ENABLE ROW LEVEL SECURITY;
DO $p$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_policies WHERE schemaname='private' AND tablename='totus_prestashop_product_edits' AND policyname='product_edits_service') THEN
 CREATE POLICY product_edits_service ON private.totus_prestashop_product_edits TO service_role USING(true) WITH CHECK(true);
 END IF;
END $p$;
CREATE OR REPLACE FUNCTION public.totus_prestashop_product_edit(p_action text,p_request_id uuid,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $e$
DECLARE r private.totus_prestashop_product_edits%rowtype; c private.totus_api_connections%rowtype;
 a uuid:=(p_data->>'actor_id')::uuid; k uuid:=(p_data->>'connection_id')::uuid;
 v bigint:=(p_data->>'revision')::bigint; h text:=p_data->>'signature';
BEGIN
 IF p_action NOT IN ('lookup','claim','complete','uncertain') OR a IS NULL OR k IS NULL OR v IS NULL OR h IS NULL OR h !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid edit identity'; END IF;
 SELECT id,name,revision,enabled,verified_revision,real_data_authorized INTO c.id,c.name,c.revision,c.enabled,c.verified_revision,c.real_data_authorized FROM private.totus_api_connections WHERE id=k;
 IF NOT FOUND OR NOT c.enabled OR NOT c.real_data_authorized OR c.revision<>v OR c.verified_revision<>v THEN RAISE EXCEPTION 'Connection is not verified'; END IF;
 IF p_action='claim' THEN
 INSERT INTO private.totus_prestashop_product_edits(request_id,actor_id,connection_id,revision,signature,status) VALUES(p_request_id,a,k,v,h,'pending') ON CONFLICT DO NOTHING RETURNING * INTO r;
 IF FOUND THEN RETURN jsonb_build_object('status','claimed'); END IF;
 END IF;
 SELECT * INTO r FROM private.totus_prestashop_product_edits WHERE request_id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN IF p_action='lookup' THEN RETURN NULL; END IF; RAISE EXCEPTION 'Edit not claimed'; END IF;
 IF r.actor_id<>a OR r.connection_id<>k OR r.revision<>v OR r.signature<>h THEN RAISE EXCEPTION 'Edit belongs to another intent or identity'; END IF;
 IF p_action IN ('complete','uncertain') THEN
 IF r.status NOT IN ('pending','uncertain') THEN RAISE EXCEPTION 'Edit already completed'; END IF;
 UPDATE private.totus_prestashop_product_edits SET status=CASE WHEN p_action='complete' THEN 'completed' ELSE 'uncertain' END,updated_at=clock_timestamp() WHERE request_id=p_request_id RETURNING * INTO r;
 END IF;
 RETURN jsonb_build_object('status',r.status);
END $e$;
REVOKE ALL ON TABLE private.totus_prestashop_product_edits FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.totus_prestashop_product_edit(text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE private.totus_prestashop_product_edits TO service_role;
GRANT EXECUTE ON FUNCTION public.totus_prestashop_product_edit(text,uuid,jsonb) TO service_role;

-- Product images and rich descriptions use the existing own-account worker.
-- Preserve every other operation limit and all credential/access checks.
create or replace function private.totus_agent_submit(p_actor_email text,p_action text,p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare uid uuid;job uuid=gen_random_uuid();token text=encode(extensions.gen_random_bytes(32),'hex');request bigint;
begin
 if session_user<>'postgres' or current_user<>'postgres' or auth.uid() is not null then raise exception 'Conector administrativo requerido';end if;
 if p_action not in ('session_check','validate_expense','save_expense','attach_chat_file','expense_context','review_document','chat_read','chat_send','chat_direct','operation') then raise exception 'Acción no admitida';end if;
 if jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>case when p_action='operation' and p_payload->>'operation'='products' then 6291456 else 131072 end then raise exception 'Solicitud no válida o demasiado grande';end if;
 if p_action in ('save_expense','validate_expense') and nullif(p_payload#>>'{expense,request_id}','') is null then raise exception 'request_id obligatorio';end if;
 select u.id into uid from auth.users u join public.team_members t on lower(t.email)=lower(u.email)
 where lower(u.email)=lower(btrim(p_actor_email)) and u.deleted_at is null and t.active and t.deleted_at is null and t.purged_at is null;
 if uid is null then raise exception 'Cuenta propia de IA no activa';end if;
 if not exists(select 1 from vault.secrets where name='totus_agent_credentials_'||uid) then raise exception 'Vincula esta cuenta desde Administración → Usuarios → Acceso de IA.';end if;
 delete from vault.secrets where name like 'totus_assistant_job_%' and created_at<now()-interval '7 days';
 perform vault.create_secret(jsonb_build_object('actor','agent','actor_id',uid,'action','agent_'||p_action,'payload',p_payload,'token_hash',encode(extensions.digest(token,'sha256'),'hex'),'status','queued','expires_at',now()+interval '2 minutes')::text,'totus_assistant_job_'||job,'Short-lived own-account operation');
 select net.http_post(url:='https://awmojepsasikxocoeqtu.supabase.co/functions/v1/totus-assistant',headers:='{"Content-Type":"application/json"}'::jsonb,body:=jsonb_build_object('job',job,'ticket',token),timeout_milliseconds:=30000) into request;
 return jsonb_build_object('job_id',job,'http_request_id',request,'status','queued');
end$$;
revoke all on function private.totus_agent_submit(text,text,jsonb) from public,anon,authenticated,service_role;
COMMIT;
