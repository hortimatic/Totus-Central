-- Reject obsolete rendered forms before changing their saved business records.
-- Opt-in JSON field: expected_updated_at. Existing integrations remain compatible.
-- No accounting rows, roles, grants to users or table schemas are changed.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
CREATE OR REPLACE FUNCTION private.totus_check_write_version(p_table text,p_id uuid,p_payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $body$
DECLARE actual timestamptz; expected timestamptz; matched bigint;
BEGIN
 IF p_id IS NULL OR NOT (p_payload ? 'expected_updated_at') THEN RETURN; END IF;
 IF p_table NOT IN ('ops_expenses','ops_daily_closings','ops_sales_invoices') THEN RAISE EXCEPTION 'Unsupported write target'; END IF;
 expected=nullif(p_payload->>'expected_updated_at','')::timestamptz;
 EXECUTE format('SELECT updated_at FROM public.%I WHERE id=$1 FOR UPDATE',p_table) INTO actual USING p_id;
 GET DIAGNOSTICS matched=ROW_COUNT;
 IF matched<>1 THEN RAISE EXCEPTION 'El registro ya no existe. Actualiza el listado antes de continuar.'; END IF;
 IF actual IS DISTINCT FROM expected THEN
  RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Este registro ha cambiado desde que abriste la ficha. Actualiza y revisa los cambios antes de guardar.';
 END IF;
END $body$;
REVOKE ALL ON FUNCTION private.totus_check_write_version(text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
DO $patch$
DECLARE entry record; original text; marker text; change text;
BEGIN
 FOR entry IN SELECT * FROM (VALUES
 ('totus_save_expense(jsonb,jsonb)','ops_expenses','p_expense','Solo administración o gerencia puede guardar gastos'),
 ('totus_save_closing(jsonb,jsonb)','ops_daily_closings','p_closing','Solo administración o gerencia puede guardar cierres'),
 ('totus_save_sales_document(jsonb,jsonb)','ops_sales_invoices','p_document','Solo administración o gerencia puede guardar documentos de venta')
 ) AS v(signature,target,arg,message)
 LOOP
  original=pg_get_functiondef(('public.'||entry.signature)::regprocedure);
  marker='then raise exception '||quote_literal(entry.message)||'; end if;';
  IF strpos(original,marker)=0 THEN RAISE EXCEPTION 'Expected authorization guard changed: %',entry.signature; END IF;
  change=marker||E'\n  perform private.totus_check_write_version('||quote_literal(entry.target)||',v_id,'||entry.arg||');';
  IF strpos(original,'private.totus_check_write_version(')=0 THEN EXECUTE replace(original,marker,change); END IF;
 END LOOP;
END $patch$;

COMMIT;
