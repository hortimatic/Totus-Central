-- Applied to staging Supabase before this commit. Production must remain untouched.
CREATE OR REPLACE FUNCTION public.totus_delete_income_adjustment(p_id uuid,p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='public,private'
AS $$
DECLARE v_row public.ops_income_adjustments%ROWTYPE;
BEGIN
 IF NOT private.totus_can('fiscalidad','delete') THEN
  RAISE EXCEPTION 'No tienes permiso para eliminar ingresos manuales.';
 END IF;
 IF nullif(btrim(coalesce(p_reason,'')),'') IS NULL THEN
  RAISE EXCEPTION 'Es obligatorio indicar el motivo de eliminación.';
 END IF;
 SELECT * INTO v_row FROM public.ops_income_adjustments WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ingreso manual no encontrado.'; END IF;
 PERFORM private.totus_audit('fiscalidad','eliminar_ingreso_manual',p_id,
  jsonb_build_object('motivo',btrim(p_reason),'fecha',v_row.income_date,'tienda',v_row.store_id,
    'importe',v_row.amount,'concepto',v_row.concept));
 DELETE FROM public.ops_income_adjustments WHERE id=p_id;
 RETURN p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.totus_delete_income_adjustment(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.totus_delete_income_adjustment(uuid,text) TO authenticated;
