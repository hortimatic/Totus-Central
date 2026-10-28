-- Revision closure is independent of the documentary differences.
-- Keep existing quantities, source references and the audit/history tables unchanged.
ALTER TABLE public.ops_stock_receipts
 DROP CONSTRAINT ops_stock_receipts_status_check;
ALTER TABLE public.ops_stock_receipts
 ADD CONSTRAINT ops_stock_receipts_status_check
 CHECK (status IN ('pending','needs_review','differences','matched','reviewed'));

-- Saving a new documentary comparison invalidates any earlier human sign-off.
-- The comparison calculator remains untouched, and never returns 'reviewed'.
CREATE OR REPLACE FUNCTION public.totus_stock_save_result(
 p_id uuid, p_revision integer, p_result jsonb, p_actor_email text DEFAULT NULL::text
) RETURNS public.ops_stock_receipts
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE actor text=private.totus_stock_actor('edit',p_actor_email);
 r public.ops_stock_receipts; new_status text; comparison jsonb;
BEGIN
 SELECT * INTO STRICT r FROM public.ops_stock_receipts WHERE id=p_id FOR UPDATE;
 IF r.revision<>p_revision THEN
  RAISE EXCEPTION 'La recepción ha cambiado. Vuelve a leerla antes de guardar el resultado';
 END IF;
 comparison=p_result-'review'; -- no caller can copy or forge a prior review record
 new_status=private.totus_stock_result(p_id,comparison);
 UPDATE public.ops_stock_receipts SET result=comparison,status=new_status,
  revision=revision+1,updated_at=now() WHERE id=p_id RETURNING * INTO r;
 PERFORM private.totus_stock_revision(p_id,'result_saved',actor);
 RETURN r;
END $function$;

-- A documented manager-only sign-off; never marks the documentary lines as matched.
CREATE OR REPLACE FUNCTION public.totus_stock_mark_reviewed(
 p_id uuid, p_revision integer, p_note text, p_actor_email text DEFAULT NULL::text
) RETURNS public.ops_stock_receipts
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE actor text=private.totus_stock_actor('edit',p_actor_email);
 r public.ops_stock_receipts; note text=trim(coalesce(p_note,'')); calculated text;
 source record; covered jsonb; line jsonb;
BEGIN
 IF auth.uid() IS NOT NULL AND NOT private.is_manager() THEN
  RAISE EXCEPTION 'Solo gerencia puede cerrar una revisión de mercancía';
 END IF;
 IF length(note)<20 OR length(note)>5000 THEN
  RAISE EXCEPTION 'Escribe una justificación de revisión de 20 a 5000 caracteres';
 END IF;
 SELECT * INTO STRICT r FROM public.ops_stock_receipts WHERE id=p_id FOR UPDATE;
 IF r.revision<>p_revision THEN
  RAISE EXCEPTION 'La recepción ha cambiado. Actualízala antes de cerrar la revisión';
 END IF;
 IF r.status NOT IN ('needs_review','differences') THEN
  RAISE EXCEPTION 'Solo se pueden cerrar recepciones cotejadas con incidencias';
 END IF;
 IF r.result->'complete' IS DISTINCT FROM 'true'::jsonb
  OR jsonb_typeof(r.result->'rows') IS DISTINCT FROM 'array'
  OR jsonb_array_length(r.result->'rows')=0 THEN
  RAISE EXCEPTION 'No se puede cerrar una recepción sin cotejo documentado';
 END IF;
 -- A green receipt must be fully documented, not simply acknowledged as unread.
 IF NOT EXISTS(SELECT 1 FROM public.ops_stock_sources WHERE receipt_id=p_id AND source_kind='supplier')
  OR NOT EXISTS(SELECT 1 FROM public.ops_stock_sources WHERE receipt_id=p_id AND source_kind='prestashop')
  OR jsonb_typeof(r.result->'coverage') IS DISTINCT FROM 'array'
  OR jsonb_array_length(r.result->'coverage') <>
   (SELECT count(*) FROM public.ops_stock_sources WHERE receipt_id=p_id) THEN
  RAISE EXCEPTION 'No se puede cerrar una recepción con documentos o cobertura pendientes';
 END IF;
 FOR source IN SELECT id,extraction FROM public.ops_stock_sources WHERE receipt_id=p_id LOOP
  SELECT c.value INTO covered FROM jsonb_array_elements(r.result->'coverage') c
   WHERE c.value->>'source_id'=source.id::text;
  IF covered IS NULL OR covered->'complete' IS DISTINCT FROM 'true'::jsonb
   OR length(trim(coalesce(covered->>'explanation','')))=0
   OR (source.extraction->>'state' IS DISTINCT FROM 'ready'
    AND NOT (covered->'manually_verified'='true'::jsonb AND length(trim(coalesce(covered->>'reading_note','')))>0)) THEN
   RAISE EXCEPTION 'Completa y verifica todos los documentos antes de cerrar la revisión';
  END IF;
 END LOOP;
 FOR line IN SELECT value FROM jsonb_array_elements(r.result->'rows') LOOP
  IF line->'supplier_qty' IS NULL OR line->'supplier_qty'='null'::jsonb
   OR line->'prestashop_qty' IS NULL OR line->'prestashop_qty'='null'::jsonb
   OR line->'adjustment_qty' IS NULL OR line->'adjustment_qty'='null'::jsonb
   OR line->'unit_factor' IS NULL OR line->'unit_factor'='null'::jsonb
   OR line->'unit_confirmed' IS DISTINCT FROM 'true'::jsonb
   OR length(trim(coalesce(line->>'unit','')))=0
   OR coalesce(line->>'adjustment_included','') NOT IN ('yes','no')
   OR (line->>'unit_factor')::numeric<=0
   OR ((line->>'unit_factor')::numeric<>1 AND length(trim(coalesce(line->>'conversion_reason','')))=0)
   OR ((line->>'adjustment_qty')::numeric<>0 AND length(trim(coalesce(line->>'adjustment_reason','')))=0) THEN
   RAISE EXCEPTION 'Hay cantidades, unidades o ajustes sin verificar; no se puede cerrar la revisión';
  END IF;
 END LOOP;
 calculated=private.totus_stock_result(p_id,r.result-'review');
 IF calculated NOT IN ('needs_review','differences') OR calculated<>r.status THEN
  RAISE EXCEPTION 'El cotejo ha cambiado. Vuelve a comprobarlo antes de revisar';
 END IF;
 UPDATE public.ops_stock_receipts SET
  result=jsonb_set(result,'{review}',jsonb_build_object(
   'note',note,'reviewed_by',actor,'reviewed_at',now(),
   'comparison_status',calculated,'comparison_revision',r.revision
  ),true),
  status='reviewed',revision=revision+1,updated_at=now()
 WHERE id=p_id RETURNING * INTO r;
 PERFORM private.totus_stock_revision(p_id,'reviewed',actor);
 RETURN r;
END $function$;

REVOKE ALL ON FUNCTION public.totus_stock_mark_reviewed(uuid,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.totus_stock_mark_reviewed(uuid,integer,text,text)
 TO authenticated,service_role;
