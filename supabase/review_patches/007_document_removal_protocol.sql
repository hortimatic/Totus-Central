-- Review only: apply before deploying its dependent application/worker.
-- No accounting records are changed. Never restore production as a test.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='20s';
CREATE TABLE IF NOT EXISTS private.totus_document_removals(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),document_id uuid NOT NULL,
 storage_path text NOT NULL,sha256 text NOT NULL,requested_by uuid NOT NULL,
 requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),completed_at timestamptz
);
-- Rehearsal upgrade only: the final new-table definition has no FK. Completed
-- paths stay reserved, making delayed duplicate removals safe against reuse.
ALTER TABLE private.totus_document_removals DROP CONSTRAINT IF EXISTS totus_document_removals_document_id_fkey;
ALTER TABLE private.totus_document_removals ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE private.totus_document_removals ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE private.totus_document_removals DROP CONSTRAINT IF EXISTS totus_document_removals_pkey;
ALTER TABLE private.totus_document_removals ADD PRIMARY KEY(id);
CREATE UNIQUE INDEX IF NOT EXISTS totus_one_pending_document_removal ON private.totus_document_removals(document_id) WHERE completed_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS totus_removed_document_path ON private.totus_document_removals(storage_path) WHERE storage_path<>'';
ALTER TABLE private.totus_document_removals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.totus_document_removals FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.totus_document_has_links(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.ops_expenses WHERE document_id=p_id)
 OR EXISTS(SELECT 1 FROM public.ops_tax_payments WHERE document_id=p_id)
 OR EXISTS(SELECT 1 FROM public.ops_sales_invoices WHERE p_id IN(source_document_id,generated_document_id))
 OR EXISTS(SELECT 1 FROM public.ops_fiscal_adjustments WHERE document_id=p_id)
 OR EXISTS(SELECT 1 FROM public.ops_stock_sources WHERE document_id=p_id);
$$;
REVOKE ALL ON FUNCTION private.totus_document_has_links(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.totus_guard_document_reference()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE document uuid=nullif(to_jsonb(NEW)->>TG_ARGV[0],'')::uuid;
BEGIN
 IF document IS NULL THEN RETURN NEW; END IF;
 PERFORM 1 FROM public.ops_documents WHERE id=document FOR KEY SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='El documento ya no existe. Actualiza la ficha antes de asociarlo.'; END IF;
 IF EXISTS(SELECT 1 FROM private.totus_document_removals WHERE document_id=document AND completed_at IS NULL) THEN
  RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Este documento está pendiente de eliminar. No puede asociarse a otro registro.';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.totus_guard_document_reference() FROM PUBLIC,anon,authenticated,service_role;
DO $triggers$
DECLARE entry record; name text;
BEGIN
 FOR entry IN SELECT * FROM (VALUES
 ('ops_expenses','document_id'),('ops_tax_payments','document_id'),
 ('ops_sales_invoices','source_document_id'),('ops_sales_invoices','generated_document_id'),
 ('ops_fiscal_adjustments','document_id'),('ops_stock_sources','document_id')
 ) AS v(target,field)
 LOOP
  name='totus_reference_'||entry.field;
  EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I',name,entry.target);
  EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF %I ON public.%I FOR EACH ROW EXECUTE FUNCTION private.totus_guard_document_reference(%L)',name,entry.field,entry.target,entry.field);
 END LOOP;
END $triggers$;

CREATE OR REPLACE FUNCTION private.totus_guard_document_removal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF current_setting('totus.document_removal_id',true) IS DISTINCT FROM OLD.id::text
   OR NOT EXISTS(SELECT 1 FROM private.totus_document_removals WHERE document_id=OLD.id AND completed_at IS NULL)
   OR private.totus_document_has_links(OLD.id) THEN
   RAISE EXCEPTION 'Retira el documento mediante su proceso de eliminación; los vínculos y el original deben comprobarse primero.';
  END IF;
  RETURN OLD;
 END IF;
 IF NEW.storage_path<>'' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('totus-document-path:'||NEW.storage_path,0));
  IF EXISTS(SELECT 1 FROM private.totus_document_removals WHERE storage_path=NEW.storage_path) THEN
   RAISE EXCEPTION 'La ruta de este archivo está reservada por una retirada. Sube el original como un documento nuevo.';
  END IF;
 END IF;
 IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM private.totus_document_removals WHERE document_id=OLD.id AND completed_at IS NULL) AND to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
  RAISE EXCEPTION 'El documento está pendiente de eliminar. Completa primero esa operación.';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.totus_guard_document_removal() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS totus_document_removal_guard ON public.ops_documents;
CREATE TRIGGER totus_document_removal_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ops_documents
FOR EACH ROW EXECUTE FUNCTION private.totus_guard_document_removal();

CREATE OR REPLACE FUNCTION public.totus_begin_document_removal(p_id uuid,p_path text,p_sha256 text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE document public.ops_documents; inserted bigint;
BEGIN
 IF auth.uid() IS NULL OR NOT private.totus_can('documentos','delete') THEN RAISE EXCEPTION 'No tienes permiso para eliminar documentos.'; END IF;
 SELECT * INTO document FROM public.ops_documents WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN
  IF EXISTS(SELECT 1 FROM private.totus_document_removals WHERE document_id=p_id AND storage_path=p_path AND sha256=coalesce(p_sha256,'') AND completed_at IS NOT NULL AND (requested_by=auth.uid() OR private.is_manager())) THEN
   RETURN jsonb_build_object('id',p_id,'status','already_removed');
  END IF;
  RAISE EXCEPTION 'El documento ya no está disponible. Actualiza el listado.';
 END IF;
 IF NOT(private.is_manager() OR document.uploaded_by=auth.uid()) THEN RAISE EXCEPTION 'Solo puedes eliminar documentos que hayas subido.'; END IF;
 IF document.storage_path IS DISTINCT FROM p_path OR document.sha256 IS DISTINCT FROM coalesce(p_sha256,'') THEN
  RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='El archivo ha cambiado desde que abriste la ficha. Actualiza antes de eliminarlo.';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('totus-document-path:'||document.storage_path,0));
 IF private.totus_document_has_links(p_id) THEN RAISE EXCEPTION 'Este documento está vinculado a otro registro. Quita primero el vínculo desde su ficha.'; END IF;
 IF EXISTS(SELECT 1 FROM public.ops_documents WHERE storage_path=p_path AND id<>p_id) THEN RAISE EXCEPTION 'El archivo tiene otra ficha documental. No se ha retirado un original compartido.'; END IF;
 INSERT INTO private.totus_document_removals(document_id,storage_path,sha256,requested_by)
 VALUES(p_id,document.storage_path,document.sha256,auth.uid()) ON CONFLICT(document_id) WHERE completed_at IS NULL DO NOTHING;
 GET DIAGNOSTICS inserted=ROW_COUNT;
 IF inserted=1 THEN PERFORM private.totus_audit('documentos','retirada_solicitada',p_id,jsonb_build_object('archivo',document.original_name)); END IF;
 RETURN jsonb_build_object('id',p_id,'status','pending');
END $$;
REVOKE ALL ON FUNCTION public.totus_begin_document_removal(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.totus_begin_document_removal(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.totus_pending_document_removals()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',q.document_id,'storage_path',q.storage_path,'sha256',q.sha256) ORDER BY q.requested_at),'[]'::jsonb)
 FROM private.totus_document_removals q JOIN public.ops_documents d ON d.id=q.document_id
 WHERE q.completed_at IS NULL AND q.storage_path=d.storage_path AND q.sha256=d.sha256 AND (coalesce(auth.jwt()->>'role','')='service_role'
 OR (auth.uid() IS NOT NULL AND private.totus_can('documentos','view')));
$$;
REVOKE ALL ON FUNCTION public.totus_pending_document_removals() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.totus_pending_document_removals() TO authenticated,service_role;

CREATE OR REPLACE FUNCTION private.totus_document_file_removal_allowed(p_bucket text,p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_bucket<>'business-documents'
 OR NOT EXISTS(SELECT 1 FROM public.ops_documents WHERE storage_path=p_path)
 OR ((SELECT count(*) FROM public.ops_documents WHERE storage_path=p_path)=1
  AND EXISTS(SELECT 1 FROM public.ops_documents d JOIN private.totus_document_removals q ON q.document_id=d.id
   WHERE d.storage_path=p_path AND q.storage_path=p_path AND q.sha256=d.sha256 AND q.completed_at IS NULL AND NOT private.totus_document_has_links(d.id)));
$$;
REVOKE ALL ON FUNCTION private.totus_document_file_removal_allowed(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.totus_document_file_removal_allowed(text,text) TO authenticated,service_role;
DROP POLICY IF EXISTS totus_document_removal_delete_lock ON storage.objects;
CREATE POLICY totus_document_removal_delete_lock ON storage.objects AS RESTRICTIVE
FOR DELETE TO authenticated USING(private.totus_document_file_removal_allowed(bucket_id,name));

CREATE OR REPLACE FUNCTION private.totus_document_file_path_available(p_bucket text,p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_bucket<>'business-documents' OR NOT EXISTS(SELECT 1 FROM private.totus_document_removals WHERE storage_path=p_path);
$$;
REVOKE ALL ON FUNCTION private.totus_document_file_path_available(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.totus_document_file_path_available(text,text) TO authenticated,service_role;
DROP POLICY IF EXISTS totus_document_removal_insert_lock ON storage.objects;
CREATE POLICY totus_document_removal_insert_lock ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK(private.totus_document_file_path_available(bucket_id,name));
DROP POLICY IF EXISTS totus_document_removal_update_lock ON storage.objects;
CREATE POLICY totus_document_removal_update_lock ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
USING(private.totus_document_file_path_available(bucket_id,name)) WITH CHECK(private.totus_document_file_path_available(bucket_id,name));

CREATE OR REPLACE FUNCTION public.totus_finish_document_removal(p_id uuid,p_path text,p_sha256 text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE document public.ops_documents; server boolean=coalesce(auth.jwt()->>'role','')='service_role'; previous text;
BEGIN
 IF NOT server AND (auth.uid() IS NULL OR NOT private.totus_can('documentos','delete')) THEN RAISE EXCEPTION 'No tienes permiso para eliminar documentos.'; END IF;
 SELECT * INTO document FROM public.ops_documents WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('id',p_id,'status','already_removed'); END IF;
 IF NOT server AND NOT(private.is_manager() OR document.uploaded_by=auth.uid()) THEN RAISE EXCEPTION 'Solo puedes eliminar documentos que hayas subido.'; END IF;
 IF document.storage_path IS DISTINCT FROM p_path OR document.sha256 IS DISTINCT FROM coalesce(p_sha256,'')
  OR NOT EXISTS(SELECT 1 FROM private.totus_document_removals WHERE document_id=p_id AND storage_path=p_path AND sha256=coalesce(p_sha256,'') AND completed_at IS NULL) THEN
  RAISE EXCEPTION 'No coincide la solicitud de eliminación con el archivo actual.';
 END IF;
 IF private.totus_document_has_links(p_id) THEN RAISE EXCEPTION 'El documento tiene vínculos y no puede eliminarse.'; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='business-documents' AND name=p_path) THEN RAISE EXCEPTION 'El archivo sigue en Supabase. Su ficha se conserva para reintentar la eliminación.'; END IF;
 previous=current_setting('totus.document_removal_id',true);
 PERFORM set_config('totus.document_removal_id',p_id::text,true);
 DELETE FROM public.ops_documents WHERE id=p_id;
 UPDATE private.totus_document_removals SET completed_at=clock_timestamp() WHERE document_id=p_id AND storage_path=p_path AND completed_at IS NULL;
 PERFORM set_config('totus.document_removal_id',coalesce(previous,''),true);
 IF server THEN
  INSERT INTO public.ops_audit_log(user_email,area,action,entity_id,detail) VALUES('Tarea automática','documentos','retirada_completada',p_id,jsonb_build_object('archivo',document.original_name));
 ELSE PERFORM private.totus_audit('documentos','retirada_completada',p_id,jsonb_build_object('archivo',document.original_name)); END IF;
 RETURN jsonb_build_object('id',p_id,'status','removed');
END $$;
REVOKE ALL ON FUNCTION public.totus_finish_document_removal(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.totus_finish_document_removal(uuid,text,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION private.totus_cancel_document_removals_for_restore()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE private.totus_document_removals SET completed_at=clock_timestamp() WHERE completed_at IS NULL;
$$;
REVOKE ALL ON FUNCTION private.totus_cancel_document_removals_for_restore() FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
