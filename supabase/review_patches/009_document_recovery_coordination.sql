-- Review only: apply before deploying its dependent application/worker.
-- No accounting records are changed. Never restore production as a test.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='20s';
CREATE OR REPLACE FUNCTION private.totus_assert_recovery_document_paths(p_payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM private.totus_recovery_file_refs(p_payload) f
  JOIN private.totus_document_removals r ON r.storage_path=f.path
  WHERE f.bucket='business-documents') THEN
  RAISE EXCEPTION 'La recuperación debe preparar los documentos en rutas nuevas. Hay una retirada anterior reservando uno de los archivos.';
 END IF;
END $$;
REVOKE ALL ON FUNCTION private.totus_assert_recovery_document_paths(jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION private.totus_invalidate_business_requests_for_restore()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF to_regclass('private.totus_business_requests') IS NOT NULL THEN
  EXECUTE 'UPDATE private.totus_business_requests SET invalidated=true WHERE NOT invalidated';
 END IF;
END $$;
REVOKE ALL ON FUNCTION private.totus_invalidate_business_requests_for_restore() FROM PUBLIC,anon,authenticated,service_role;
DO $patch$
DECLARE original text; marker text; addition text;
BEGIN
 original=pg_get_functiondef('public.totus_commit_recovery(uuid,jsonb,jsonb)'::regprocedure);
 marker='execute ''truncate table ''||truncate_sql||'' restart identity'';';
 IF strpos(original,marker)=0 THEN RAISE EXCEPTION 'Recovery truncation point changed; review before patching'; END IF;
 IF strpos(original,'private.totus_cancel_document_removals_for_restore()')=0 THEN
  EXECUTE replace(original,marker,'perform private.totus_assert_recovery_document_paths(p_payload);'||E'\n perform private.totus_cancel_document_removals_for_restore();'||E'\n '||marker);
 END IF;
 original=pg_get_functiondef('public.totus_commit_recovery(uuid,jsonb,jsonb)'::regprocedure);
 IF strpos(original,'private.totus_invalidate_business_requests_for_restore()')=0 THEN
  EXECUTE replace(original,'perform private.totus_cancel_document_removals_for_restore();','perform private.totus_invalidate_business_requests_for_restore();'||E'\n perform private.totus_cancel_document_removals_for_restore();');
 END IF;
 original=pg_get_functiondef('public.totus_onedrive_mirror_tick()'::regprocedure);
 marker='or exists(select 1 from public.ops_onedrive_cleanup where archived_at is null)) then';
 addition='or exists(select 1 from public.ops_onedrive_cleanup where archived_at is null)'||E'\n   or exists(select 1 from private.totus_document_removals where completed_at is null)) then';
 IF strpos(original,'private.totus_document_removals')=0 THEN
  IF strpos(original,marker)=0 THEN RAISE EXCEPTION 'Document scheduler condition changed; review before patching'; END IF;
  EXECUTE replace(original,marker,addition);
 END IF;
END $patch$;

COMMIT;
