-- PrestaShop product creation requests: durable, idempotent and isolated from accounting.
-- Store only request identity, hash, status and the verified PrestaShop ID: no credentials, PII or XML.
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
     AND connection_revision=v_revision AND signature=v_signature AND status='pending'
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
