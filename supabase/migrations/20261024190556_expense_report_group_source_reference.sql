CREATE OR REPLACE FUNCTION public.totus_set_expense_report_group(p_id uuid,p_group text,p_expected_group text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE before_row jsonb; after_row jsonb; v_report_source text; previous_group text;
BEGIN
 IF auth.uid() IS NULL OR NOT private.totus_can('gastos','edit') THEN RAISE EXCEPTION 'No tienes permiso para editar gastos'; END IF;
 SELECT to_jsonb(e),e.source_ref INTO before_row,v_report_source FROM public.ops_expenses e WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Gasto no encontrado'; END IF;
 BEGIN previous_group=(coalesce(nullif(v_report_source,''),'{}')::jsonb)->'report_display'->>'group';
 EXCEPTION WHEN others THEN RAISE EXCEPTION 'No se puede leer el origen de este gasto. No se ha modificado'; END;
 IF nullif(previous_group,'') IS DISTINCT FROM nullif(p_expected_group,'') THEN RAISE EXCEPTION 'La categoría del Excel ha cambiado. Actualiza la ficha antes de guardar'; END IF;
 UPDATE public.ops_expenses e SET source_ref=private.totus_expense_report_source(v_report_source,p_group) WHERE id=p_id
 RETURNING to_jsonb(e) INTO after_row;
 IF before_row-ARRAY['source_ref','updated_at'] IS DISTINCT FROM after_row-ARRAY['source_ref','updated_at'] THEN
  RAISE EXCEPTION 'No se ha guardado: la operación intentaba cambiar otros datos del gasto';
 END IF;
 PERFORM private.totus_audit('gastos','categoria_excel',p_id,jsonb_build_object('antes',previous_group,'despues',nullif(p_group,'')));
 RETURN p_id;
END $fn$;
REVOKE ALL ON FUNCTION public.totus_set_expense_report_group(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.totus_set_expense_report_group(uuid,text,text) TO authenticated;

