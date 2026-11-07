-- Explicit recovery after two independent absence reads. Preserve the prior hash
-- in append-only retry history; keep UUID, actor, connection and reference unchanged.
BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE private.totus_prestashop_product_create_requests
 ADD COLUMN IF NOT EXISTS retry_history jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE OR REPLACE FUNCTION public.totus_prestashop_product_retry_absent(p_request_id uuid,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE r private.totus_prestashop_product_create_requests%rowtype;
BEGIN
 IF jsonb_typeof(p_data)<>'object' THEN RAISE EXCEPTION 'Invalid recovery'; END IF;
 SELECT * INTO r FROM private.totus_prestashop_product_create_requests
 WHERE request_id=p_request_id FOR UPDATE;
 IF NOT FOUND OR r.status<>'uncertain' OR r.product_id IS NOT NULL
 OR r.actor_id IS DISTINCT FROM (p_data->>'actor_id')::uuid
 OR r.connection_id IS DISTINCT FROM (p_data->>'connection_id')::uuid
 OR r.connection_revision IS DISTINCT FROM (p_data->>'revision')::bigint
 OR r.signature IS DISTINCT FROM coalesce(p_data->>'previous_signature',p_data->>'signature')
 OR coalesce(p_data->>'signature','') !~ '^[0-9a-f]{64}$'
 OR r.store IS DISTINCT FROM p_data->>'store'
 OR r.reference IS DISTINCT FROM p_data->>'reference'
 THEN RAISE EXCEPTION 'Recovery requires the same uncertain request without a product ID'; END IF;
 IF NOT EXISTS (SELECT 1 FROM private.totus_api_connections c WHERE c.id=r.connection_id
 AND c.revision=r.connection_revision AND c.enabled IS TRUE
 AND c.verified_revision=c.revision AND c.real_data_authorized IS TRUE)
 THEN RAISE EXCEPTION 'Recovery connection is not verified'; END IF;
 UPDATE private.totus_prestashop_product_create_requests
 SET status='pending',signature=p_data->>'signature',updated_at=clock_timestamp(),
 retry_history=retry_history||jsonb_build_array(jsonb_build_object(
  'previous_status','uncertain','previous_signature',r.signature,
  'replacement_signature',p_data->>'signature','previous_updated_at',r.updated_at,
  'confirmed_at',clock_timestamp(),'actor_id',r.actor_id))
 WHERE request_id=p_request_id;
 RETURN jsonb_build_object('status','claimed');
END $fn$;
REVOKE ALL ON FUNCTION public.totus_prestashop_product_retry_absent(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.totus_prestashop_product_retry_absent(uuid,jsonb) TO service_role;
COMMENT ON FUNCTION public.totus_prestashop_product_retry_absent(uuid,jsonb) IS
 'Service-only CAS for explicitly confirmed absent-product recovery; same identity and reference; previous and replacement signatures retained in history.';
COMMIT;
