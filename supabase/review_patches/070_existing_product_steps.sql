-- Existing products receive an independent session journal. Never pretend they
-- were created by Totus or borrow another user's creation request.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE IF NOT EXISTS private.totus_prestashop_existing_products (
 request_id uuid PRIMARY KEY,actor_id uuid NOT NULL,connection_id uuid NOT NULL,
 revision bigint NOT NULL CHECK(revision>0),store text NOT NULL CHECK(store IN ('hortimatic','newoldsmok')),
 product_id bigint NOT NULL CHECK(product_id>0),created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS private.totus_prestashop_existing_product_steps (
 request_id uuid NOT NULL REFERENCES private.totus_prestashop_existing_products(request_id),
 stage text NOT NULL CHECK(stage ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),signature text NOT NULL CHECK(signature ~ '^[a-f0-9]{64}$'),
 status text NOT NULL CHECK(status IN ('pending','uncertain','completed')),record_id bigint CHECK(record_id>0),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(request_id,stage)
);
ALTER TABLE private.totus_prestashop_existing_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.totus_prestashop_existing_product_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS existing_product_service ON private.totus_prestashop_existing_products;
CREATE POLICY existing_product_service ON private.totus_prestashop_existing_products TO service_role USING(true) WITH CHECK(true);
DROP POLICY IF EXISTS existing_product_step_service ON private.totus_prestashop_existing_product_steps;
CREATE POLICY existing_product_step_service ON private.totus_prestashop_existing_product_steps TO service_role USING(true) WITH CHECK(true);
REVOKE ALL ON private.totus_prestashop_existing_products,private.totus_prestashop_existing_product_steps FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON private.totus_prestashop_existing_products,private.totus_prestashop_existing_product_steps TO service_role;
CREATE OR REPLACE FUNCTION public.totus_prestashop_existing_product_step(p_action text,p_request_id uuid,p_stage text,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE
 r private.totus_prestashop_existing_products%rowtype;
 s private.totus_prestashop_existing_product_steps%rowtype;
 a uuid:=(p_data->>'actor_id')::uuid;c uuid:=(p_data->>'connection_id')::uuid;
 v bigint:=(p_data->>'revision')::bigint;p bigint:=(p_data->>'product_id')::bigint;
 shop text:=p_data->>'store';sig text:=p_data->>'signature';rid bigint;
BEGIN
 IF p_action NOT IN ('lookup','claim','complete','uncertain') OR p_action IS NULL OR p_request_id IS NULL
 OR coalesce(p_stage,'') !~ '^[a-z0-9][a-z0-9_-]{0,79}$' OR a IS NULL OR c IS NULL
 OR v IS NULL OR v<1 OR p IS NULL OR p<1 OR shop IS NULL OR shop NOT IN ('hortimatic','newoldsmok')
 THEN RAISE EXCEPTION 'Invalid existing-product session';END IF;
 IF NOT EXISTS(SELECT 1 FROM private.totus_api_connections k WHERE k.id=c AND k.revision=v
 AND k.enabled IS TRUE AND k.verified_revision=v AND k.real_data_authorized IS TRUE
 AND k.name=CASE shop WHEN 'hortimatic' THEN 'PrestaShop · Hortimatic' ELSE 'PrestaShop · NewOldSmok' END)
 THEN RAISE EXCEPTION 'Store connection is not verified';END IF;
 IF p_action<>'lookup' AND coalesce(sig,'') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid stage signature';END IF;
 IF p_action='claim' THEN
  INSERT INTO private.totus_prestashop_existing_products(request_id,actor_id,connection_id,revision,store,product_id)
  VALUES(p_request_id,a,c,v,shop,p) ON CONFLICT DO NOTHING;
 END IF;
 SELECT * INTO r FROM private.totus_prestashop_existing_products WHERE request_id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN IF p_action='lookup' THEN RETURN NULL;ELSE RAISE EXCEPTION 'Unknown existing-product session';END IF;END IF;
 IF r.actor_id<>a OR r.connection_id<>c OR r.revision<>v OR r.store<>shop OR r.product_id<>p
 THEN RAISE EXCEPTION 'Existing-product session belongs to another identity or product';END IF;
 IF p_action='claim' THEN
  INSERT INTO private.totus_prestashop_existing_product_steps(request_id,stage,signature,status)
  VALUES(p_request_id,p_stage,sig,'pending') ON CONFLICT DO NOTHING RETURNING * INTO s;
  IF FOUND THEN RETURN jsonb_build_object('status','claimed');END IF;
 END IF;
 SELECT * INTO s FROM private.totus_prestashop_existing_product_steps WHERE request_id=p_request_id AND stage=p_stage FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL;END IF;
 IF p_action<>'lookup' AND s.signature<>sig THEN RAISE EXCEPTION 'Stage belongs to another intent';END IF;
 IF p_action='complete' THEN
  rid:=(p_data->>'record_id')::bigint;
  IF rid IS NULL OR rid<1 OR (s.record_id IS NOT NULL AND s.record_id<>rid) THEN RAISE EXCEPTION 'Invalid verified stage ID';END IF;
  UPDATE private.totus_prestashop_existing_product_steps SET status='completed',record_id=rid,updated_at=clock_timestamp()
  WHERE request_id=p_request_id AND stage=p_stage;
 ELSIF p_action='uncertain' AND s.status='pending' THEN
  UPDATE private.totus_prestashop_existing_product_steps SET status='uncertain',updated_at=clock_timestamp()
  WHERE request_id=p_request_id AND stage=p_stage;
 END IF;
 SELECT * INTO s FROM private.totus_prestashop_existing_product_steps WHERE request_id=p_request_id AND stage=p_stage;
 RETURN jsonb_build_object('status',s.status,'signature',s.signature,'record_id',s.record_id);
END $fn$;
REVOKE ALL ON FUNCTION public.totus_prestashop_existing_product_step(text,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.totus_prestashop_existing_product_step(text,uuid,text,jsonb) TO service_role;
COMMIT;
