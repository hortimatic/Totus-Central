-- A retirement must preserve a verified recoverable original before removing it.
-- Applies after 007-009. Only the existing server may attest a verified archive.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
ALTER TABLE private.totus_document_removals
 ADD COLUMN IF NOT EXISTS archive_verified_at timestamptz,
 ADD COLUMN IF NOT EXISTS archive_item_id text,
 ADD COLUMN IF NOT EXISTS archive_sha256 text;

CREATE OR REPLACE FUNCTION public.totus_verify_document_removal_archive(p_id uuid,p_path text,p_sha256 text,p_archive_item_id text,p_archive_sha256 text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE document public.ops_documents; mirrored public.ops_onedrive_documents; changed bigint;
BEGIN
 IF coalesce(auth.jwt()->>'role','')<>'service_role' THEN RAISE EXCEPTION 'Solo el servidor puede verificar el archivo recuperable.'; END IF;
 SELECT * INTO document FROM public.ops_documents WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR document.storage_path IS DISTINCT FROM p_path OR document.sha256 IS DISTINCT FROM coalesce(p_sha256,'') THEN RAISE EXCEPTION 'El documento cambió antes de verificar su archivo.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.totus_document_removals WHERE document_id=p_id AND storage_path=p_path AND sha256=coalesce(p_sha256,'') AND completed_at IS NULL) THEN RAISE EXCEPTION 'No existe una retirada autorizada pendiente.'; END IF;
 SELECT * INTO mirrored FROM public.ops_onedrive_documents WHERE document_id=p_id;
 IF NOT FOUND OR mirrored.verified_at IS NULL OR mirrored.source_path IS DISTINCT FROM p_path
  OR mirrored.onedrive_item_id IS DISTINCT FROM p_archive_item_id OR mirrored.sha256 IS DISTINCT FROM p_archive_sha256
  OR coalesce(p_archive_sha256,'') !~ '^[a-f0-9]{64}$' OR nullif(btrim(p_archive_item_id),'') IS NULL OR mirrored.size_bytes IS DISTINCT FROM document.size_bytes
  OR (nullif(document.sha256,'') IS NOT NULL AND document.sha256 IS DISTINCT FROM p_archive_sha256) THEN
  RAISE EXCEPTION 'La copia recuperable no coincide con el original.';
 END IF;
 UPDATE private.totus_document_removals SET archive_verified_at=clock_timestamp(),archive_item_id=p_archive_item_id,archive_sha256=p_archive_sha256
 WHERE document_id=p_id AND storage_path=p_path AND completed_at IS NULL
 AND (archive_verified_at IS NULL OR archive_item_id IS DISTINCT FROM p_archive_item_id OR archive_sha256 IS DISTINCT FROM p_archive_sha256);
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed>0 THEN
  INSERT INTO public.ops_audit_log(user_email,area,action,entity_id,detail)
  VALUES('Tarea automática','documentos','archivo_recuperable_verificado',p_id,jsonb_build_object('archivo',document.original_name,'ubicacion','OneDrive'));
 END IF;
 RETURN jsonb_build_object('id',p_id,'storage_path',p_path,'sha256',coalesce(p_sha256,''),'status','archive_verified');
END $$;
REVOKE ALL ON FUNCTION public.totus_verify_document_removal_archive(uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.totus_verify_document_removal_archive(uuid,text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION private.totus_document_archive_verified(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.ops_documents d
 JOIN private.totus_document_removals q ON q.document_id=d.id AND q.completed_at IS NULL
 JOIN public.ops_onedrive_documents m ON m.document_id=d.id
 WHERE d.id=p_id AND q.storage_path=d.storage_path AND q.sha256=d.sha256 AND q.archive_verified_at IS NOT NULL
 AND m.verified_at IS NOT NULL AND m.source_path=d.storage_path AND m.size_bytes=d.size_bytes
 AND m.onedrive_item_id=q.archive_item_id AND m.sha256=q.archive_sha256
 AND (nullif(d.sha256,'') IS NULL OR m.sha256=d.sha256));
$$;
REVOKE ALL ON FUNCTION private.totus_document_archive_verified(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.totus_document_file_removal_allowed(p_bucket text,p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_bucket<>'business-documents'
 OR NOT EXISTS(SELECT 1 FROM public.ops_documents WHERE storage_path=p_path)
 OR ((SELECT count(*) FROM public.ops_documents WHERE storage_path=p_path)=1
 AND EXISTS(SELECT 1 FROM public.ops_documents d WHERE d.storage_path=p_path
 AND private.totus_document_archive_verified(d.id) AND NOT private.totus_document_has_links(d.id)));
$$;
REVOKE ALL ON FUNCTION private.totus_document_file_removal_allowed(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.totus_document_file_removal_allowed(text,text) TO authenticated,service_role;

DO $patch$
DECLARE original text; marker text='DELETE FROM public.ops_documents WHERE id=p_id;';
BEGIN
 original=pg_get_functiondef('public.totus_finish_document_removal(uuid,text,text)'::regprocedure);
 IF strpos(original,'private.totus_document_archive_verified(p_id)')=0 THEN
  IF strpos(original,marker)=0 THEN RAISE EXCEPTION 'Retirement implementation changed; review before patching'; END IF;
  EXECUTE replace(original,marker,'IF NOT private.totus_document_archive_verified(p_id) THEN RAISE EXCEPTION ''Todavía no se ha comprobado el original recuperable en OneDrive. Se conserva su ficha.''; END IF;'||E'\n '||marker);
 END IF;
END $patch$;
COMMIT;
