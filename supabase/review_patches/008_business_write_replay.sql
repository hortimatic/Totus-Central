-- Review only: apply before deploying its dependent application/worker.
-- No accounting records are changed. Never restore production as a test.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='20s';
CREATE TABLE IF NOT EXISTS private.totus_business_requests(
 actor uuid NOT NULL,operation text NOT NULL,request_id uuid NOT NULL,
 payload_hash text NOT NULL,result_id uuid,invalidated boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(actor,operation,request_id)
);
ALTER TABLE private.totus_business_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.totus_business_requests FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION private.totus_claim_business_request(p_operation text,p_payload jsonb,p_children jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE request uuid=nullif(p_payload->>'request_id','')::uuid; fingerprint text; saved private.totus_business_requests;
BEGIN
 IF request IS NULL THEN RETURN NULL; END IF;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sesión no válida'; END IF;
 fingerprint=encode(extensions.digest(jsonb_build_array(p_payload-'request_id',p_children)::text,'sha256'),'hex');
 INSERT INTO private.totus_business_requests(actor,operation,request_id,payload_hash)
 VALUES(auth.uid(),p_operation,request,fingerprint) ON CONFLICT DO NOTHING;
 SELECT * INTO saved FROM private.totus_business_requests WHERE actor=auth.uid() AND operation=p_operation AND request_id=request FOR UPDATE;
 IF saved.invalidated THEN RAISE EXCEPTION 'La herramienta se ha recuperado desde una copia. Actualiza la pantalla antes de guardar.'; END IF;
 IF saved.payload_hash<>fingerprint THEN RAISE EXCEPTION 'Esta solicitud corresponde a otros datos. Comprueba el guardado anterior antes de continuar.'; END IF;
 RETURN saved.result_id;
END $$;
CREATE OR REPLACE FUNCTION private.totus_finish_business_request(p_operation text,p_payload jsonb,p_result uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 UPDATE private.totus_business_requests SET result_id=p_result
 WHERE actor=auth.uid() AND operation=p_operation AND request_id=nullif(p_payload->>'request_id','')::uuid;
$$;
REVOKE ALL ON FUNCTION private.totus_claim_business_request(text,jsonb,jsonb),private.totus_finish_business_request(text,jsonb,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.totus_business_write_contract()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sesión no válida'; END IF;
 RETURN '{"request_replay":1}'::jsonb;
END $$;
REVOKE ALL ON FUNCTION public.totus_business_write_contract() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.totus_business_write_contract() TO authenticated;
DO $patch$
DECLARE entry record; original text; marker text; addition text;
BEGIN
 FOR entry IN SELECT * FROM (VALUES
 ('totus_save_expense(jsonb,jsonb)','expense','p_expense','p_lines','Solo administración o gerencia puede guardar gastos'),
 ('totus_save_closing(jsonb,jsonb)','closing','p_closing','p_drawers','Solo administración o gerencia puede guardar cierres'),
 ('totus_save_sales_document(jsonb,jsonb)','invoice','p_document','p_lines','Solo administración o gerencia puede guardar documentos de venta')
 ) v(signature,operation,arg,children,message) LOOP
  original=pg_get_functiondef(('public.'||entry.signature)::regprocedure);
  -- Take the recovery fence before permission/table reads and request row locks.
  -- Otherwise a restore holding table locks could wait on this request while
  -- this request waits on a business table held by that restore.
  IF strpos(original,'pg_advisory_xact_lock_shared(724021126::bigint)')=0 THEN
   original=replace(original,E'\r\n',E'\n');
   original=regexp_replace(original,E'begin\n',E'begin\n perform pg_catalog.pg_advisory_xact_lock_shared(724021126::bigint);\n');
   EXECUTE original;
  END IF;
  IF strpos(original,'private.totus_claim_business_request(')>0 THEN CONTINUE; END IF;
  marker='then raise exception '||quote_literal(entry.message)||'; end if;';
  IF strpos(original,marker)=0 OR original !~ 'declare[[:space:]]+' OR strpos(original,'return v_id;')=0 THEN RAISE EXCEPTION 'Write function shape changed: %',entry.signature; END IF;
  original=regexp_replace(original,'declare[[:space:]]+',E'declare\n v_request_result uuid;\n');
  addition=marker||E'\n v_request_result=private.totus_claim_business_request('||quote_literal(entry.operation)||','||entry.arg||','||entry.children||');'||E'\n IF v_request_result IS NOT NULL THEN RETURN v_request_result; END IF;';
  original=replace(original,marker,addition);
  original=replace(original,'return v_id;','perform private.totus_finish_business_request('||quote_literal(entry.operation)||','||entry.arg||',v_id);'||E'\n return v_id;');
  EXECUTE original;
 END LOOP;
END $patch$;
COMMIT;
