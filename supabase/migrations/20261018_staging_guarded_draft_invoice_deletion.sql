-- Aplicado únicamente a Supabase staging. No borra facturas existentes ni altera producción.
CREATE OR REPLACE FUNCTION public.totus_delete_sales_draft(p_id uuid,p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='public,private'
AS $$
DECLARE v_row public.ops_sales_invoices%ROWTYPE;
BEGIN
 IF NOT private.totus_can('facturacion','delete') THEN RAISE EXCEPTION 'No tienes permiso para eliminar documentos de facturación.'; END IF;
 IF nullif(btrim(coalesce(p_reason,'')),'') IS NULL THEN RAISE EXCEPTION 'Es obligatorio indicar el motivo de eliminación.'; END IF;
 SELECT * INTO v_row FROM public.ops_sales_invoices WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Borrador no encontrado.'; END IF;
 IF v_row.status <> 'borrador' OR v_row.number IS NOT NULL OR nullif(btrim(coalesce(v_row.display_number,'')),'') IS NOT NULL OR v_row.issued_at IS NOT NULL THEN
  RAISE EXCEPTION 'Un documento emitido o numerado no se puede eliminar. Utiliza una rectificativa.';
 END IF;
 IF EXISTS (SELECT 1 FROM public.ops_sales_invoices WHERE source_proforma_document_id=p_id OR converted_invoice_id=p_id) THEN
  RAISE EXCEPTION 'Este borrador está relacionado con otro documento; revisa esa relación antes de borrarlo.';
 END IF;
 PERFORM private.totus_audit('facturacion','eliminar_borrador',p_id,jsonb_build_object('motivo',btrim(p_reason),'tipo',v_row.document_type,'tienda',v_row.store_id,'cliente',v_row.customer_name,'total',v_row.total_amount));
 DELETE FROM public.ops_sales_invoice_lines WHERE invoice_id=p_id;
 DELETE FROM public.ops_sales_invoices WHERE id=p_id;
 RETURN p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.totus_delete_sales_draft(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.totus_delete_sales_draft(uuid,text) TO authenticated;
DROP POLICY IF EXISTS totus_invoice_delete_drafts_only ON public.ops_sales_invoices;
CREATE POLICY totus_invoice_delete_drafts_only ON public.ops_sales_invoices AS RESTRICTIVE FOR DELETE TO authenticated
 USING (private.totus_can('facturacion','delete') AND status='borrador' AND number IS NULL AND nullif(btrim(coalesce(display_number,'')),'') IS NULL AND issued_at IS NULL);
DROP POLICY IF EXISTS totus_invoice_lines_delete_drafts_only ON public.ops_sales_invoice_lines;
CREATE POLICY totus_invoice_lines_delete_drafts_only ON public.ops_sales_invoice_lines AS RESTRICTIVE FOR DELETE TO authenticated
 USING (private.totus_can('facturacion','delete') AND EXISTS (
  SELECT 1 FROM public.ops_sales_invoices inv WHERE inv.id=invoice_id AND inv.status='borrador' AND inv.number IS NULL AND inv.issued_at IS NULL
 ));
