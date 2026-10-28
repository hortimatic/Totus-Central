-- Recepciones: eliminación humana de ficha exclusivamente.
-- No borra PDF ni modifica stock/contabilidad. El circuito validado de
-- Documentos sigue siendo el único que puede retirar un original.
-- Revisión técnica obligatoria antes de aplicar esta migración en producción.
CREATE OR REPLACE FUNCTION public.totus_stock_delete(
  p_id uuid, p_revision integer, p_reference text, p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  r public.ops_stock_receipts;
  actor text;
  note text=trim(coalesce(p_reason,''));
  retained jsonb='[]'::jsonb;
  history_count integer;
  source_count integer;
BEGIN
  IF auth.uid() IS NULL
     OR NOT private.is_manager()
     OR NOT private.totus_can('documentos','delete') THEN
    RAISE EXCEPTION 'Solo gerencia con permiso de eliminar Documentos puede eliminar recepciones'
      USING ERRCODE='42501';
  END IF;
  actor=lower(auth.jwt()->>'email');

  IF length(note)<20 OR length(note)>5000 THEN
    RAISE EXCEPTION 'Escribe un motivo de eliminación de 20 a 5000 caracteres';
  END IF;
  SELECT * INTO STRICT r FROM public.ops_stock_receipts
    WHERE id=p_id FOR UPDATE;
  IF r.revision IS DISTINCT FROM p_revision
     OR r.reference IS DISTINCT FROM p_reference THEN
    RAISE EXCEPTION 'La recepción ha cambiado. Vuelve a abrirla antes de eliminar';
  END IF;

  -- Capture all documentary links BEFORE detaching them. The original files
  -- survive the deletion and remain accessible in Documentos.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
     'id',d.id,'name',d.original_name,
     'shared',EXISTS(SELECT 1 FROM public.ops_stock_sources other
                     WHERE other.document_id=d.id AND other.receipt_id<>p_id)
   ) ORDER BY d.original_name),'[]'::jsonb)
   INTO retained
  FROM public.ops_documents d
  WHERE (d.linked_entity_type='stock_receipt' AND d.linked_entity_id=p_id)
     OR EXISTS(SELECT 1 FROM public.ops_stock_sources s
               WHERE s.document_id=d.id AND s.receipt_id=p_id);
  SELECT count(*) INTO source_count
    FROM public.ops_stock_sources WHERE receipt_id=p_id;

  SELECT count(*) INTO history_count
    FROM public.ops_stock_revisions WHERE receipt_id=p_id;

  INSERT INTO public.ops_audit_log(user_id,user_email,area,action,entity_id,detail)
  VALUES(auth.uid(),actor,'documentos','stock_receipt_deleted',p_id,
    jsonb_build_object('reason',note,'receipt',to_jsonb(r),
                       'retained_documents',retained,
                       'source_count',source_count,
                       'revision_count',history_count));

  DELETE FROM public.ops_stock_sources WHERE receipt_id=p_id;

  -- Only detach the stock association, and only if no other receipt still
  -- refers to this document. Do not clear unrelated document links.
  UPDATE public.ops_documents d
     SET linked_entity_type='',linked_entity_id=NULL
   WHERE d.linked_entity_type='stock_receipt'
     AND d.linked_entity_id=p_id
     AND NOT EXISTS(SELECT 1 FROM public.ops_stock_sources s
                    WHERE s.document_id=d.id);

  -- If a document belongs to another remaining receipt too, keep its
  -- visible link pointing at that surviving receipt instead of a deleted ID.
  UPDATE public.ops_documents d
     SET linked_entity_id=(
       SELECT s.receipt_id
       FROM public.ops_stock_sources s
       WHERE s.document_id=d.id
       ORDER BY s.created_at,s.id LIMIT 1
     )
   WHERE d.linked_entity_type='stock_receipt'
     AND d.linked_entity_id=p_id
     AND EXISTS(SELECT 1 FROM public.ops_stock_sources s
                WHERE s.document_id=d.id);

  -- Revisions must be removed before the receipt because of FK NO ACTION.
  DELETE FROM public.ops_stock_revisions WHERE receipt_id=p_id;
  DELETE FROM public.ops_stock_receipts WHERE id=p_id;

  RETURN jsonb_build_object('deleted',true,'id',p_id,
    'retained_documents',retained,
    'removed_revisions',history_count,'removed_source_links',source_count);
END
$function$;

REVOKE ALL ON FUNCTION public.totus_stock_delete(uuid,integer,text,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.totus_stock_delete(uuid,integer,text,text)
  TO authenticated;
COMMENT ON FUNCTION public.totus_stock_delete(uuid,integer,text,text)
 IS 'Manager-controlled audited receipt deletion; source and revision rows removed, original documents preserved for the protected Documentos removal workflow.';
