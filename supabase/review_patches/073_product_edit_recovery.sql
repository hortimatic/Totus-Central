-- Same-intent recovery; existing service-only permissions remain unchanged.
begin;
alter table private.totus_prestashop_product_edits add column if not exists recovery_history jsonb not null default '[]'::jsonb;
CREATE OR REPLACE FUNCTION public.totus_prestashop_product_edit(p_action text,p_request_id uuid,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $e$
DECLARE r private.totus_prestashop_product_edits%rowtype; c private.totus_api_connections%rowtype;
 a uuid:=(p_data->>'actor_id')::uuid; k uuid:=(p_data->>'connection_id')::uuid;
 v bigint:=(p_data->>'revision')::bigint; h text:=p_data->>'signature';
BEGIN
 IF p_action NOT IN ('lookup','claim','complete','uncertain','recover_claim') OR a IS NULL OR k IS NULL OR v IS NULL OR h IS NULL OR h !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid edit identity'; END IF;
 SELECT id,name,revision,enabled,verified_revision,real_data_authorized INTO c.id,c.name,c.revision,c.enabled,c.verified_revision,c.real_data_authorized FROM private.totus_api_connections WHERE id=k;
 IF NOT FOUND OR NOT c.enabled OR NOT c.real_data_authorized OR c.revision<>v OR c.verified_revision<>v THEN RAISE EXCEPTION 'Connection is not verified'; END IF;
 IF p_action='claim' THEN
 INSERT INTO private.totus_prestashop_product_edits(request_id,actor_id,connection_id,revision,signature,status) VALUES(p_request_id,a,k,v,h,'pending') ON CONFLICT DO NOTHING RETURNING * INTO r;
 IF FOUND THEN RETURN jsonb_build_object('status','claimed'); END IF;
 END IF;
 SELECT * INTO r FROM private.totus_prestashop_product_edits WHERE request_id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN IF p_action='lookup' THEN RETURN NULL; END IF; RAISE EXCEPTION 'Edit not claimed'; END IF;
 IF r.actor_id<>a OR r.connection_id<>k OR r.revision<>v OR r.signature<>h THEN RAISE EXCEPTION 'Edit belongs to another intent or identity'; END IF;
 IF p_action='recover_claim' THEN
  IF r.status<>'uncertain' THEN RETURN jsonb_build_object('status',r.status);END IF;
  IF r.updated_at>clock_timestamp()-interval '2 minutes' THEN RAISE EXCEPTION 'La solicitud puede seguir en curso. Espera antes de revisar su recuperación.';END IF;
  IF coalesce(p_data->>'evidence_fingerprint','') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Falta la huella de la nueva revisión.';END IF;
  UPDATE private.totus_prestashop_product_edits SET recovery_history=recovery_history||jsonb_build_array(jsonb_build_object('at',clock_timestamp(),'previous_updated_at',r.updated_at,'fingerprint',p_data->>'evidence_fingerprint')),status='pending',updated_at=clock_timestamp() WHERE request_id=p_request_id RETURNING * INTO r;
  RETURN jsonb_build_object('status','claimed','recovered',true);
 END IF;
 IF p_action IN ('complete','uncertain') THEN
 IF r.status NOT IN ('pending','uncertain') THEN RAISE EXCEPTION 'Edit already completed'; END IF;
 UPDATE private.totus_prestashop_product_edits SET status=CASE WHEN p_action='complete' THEN 'completed' ELSE 'uncertain' END,updated_at=clock_timestamp() WHERE request_id=p_request_id RETURNING * INTO r;
 END IF;
 RETURN jsonb_build_object('status',r.status,'updated_at',r.updated_at,'recoveries',jsonb_array_length(r.recovery_history));
END $e$;
revoke all on function public.totus_prestashop_product_edit(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.totus_prestashop_product_edit(text,uuid,jsonb) to service_role;
commit;
