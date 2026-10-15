-- TOTUS CENTRAL · STAGING · esquema de permisos por usuario (15-10-2026).
-- Fuente canónica para reconstrucción. Ya aplicado en staging mediante migraciones
-- totus_user_permissions_table, totus_user_permission_checks,
-- totus_core_module_permission_rls, totus_module_user_grants_core_routines,
-- totus_document_storage_permissions, protect_issued_invoice_records.
-- NO ejecutar otra vez sobre el mismo proyecto: CREATE POLICY no admite duplicados.
-- NO aplicar en producción ni mezclar con las credenciales de producción.

CREATE TABLE public.ops_user_permissions (
 email text NOT NULL REFERENCES public.team_members(email) ON DELETE CASCADE,
 module text NOT NULL CHECK (module IN ('inicio','pricing','cajas','gastos','facturacion','documentos','fiscalidad','informes','administracion')),
 can_view boolean NOT NULL DEFAULT false,
 can_create boolean NOT NULL DEFAULT false,
 can_edit boolean NOT NULL DEFAULT false,
 can_delete boolean NOT NULL DEFAULT false,
 can_export boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid,
 PRIMARY KEY(email,module)
);
ALTER TABLE public.ops_user_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY perms_select ON public.ops_user_permissions FOR SELECT TO authenticated
 USING (private.is_admin() OR (private.is_team_member() AND lower(email)=lower(coalesce(auth.jwt()->>'email',''))));
CREATE POLICY perms_insert ON public.ops_user_permissions FOR INSERT TO authenticated WITH CHECK(private.is_admin());
CREATE POLICY perms_update ON public.ops_user_permissions FOR UPDATE TO authenticated USING(private.is_admin()) WITH CHECK(private.is_admin());
CREATE POLICY perms_delete ON public.ops_user_permissions FOR DELETE TO authenticated USING(private.is_admin());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.ops_user_permissions TO authenticated;

CREATE OR REPLACE FUNCTION private.totus_can(p_module text,p_action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public,private'
AS $permissions$
 SELECT coalesce((
  SELECT CASE WHEN tm.role='admin' THEN true ELSE coalesce(
   CASE p_action WHEN 'view' THEN perms.can_view WHEN 'create' THEN perms.can_create
      WHEN 'edit' THEN perms.can_edit WHEN 'delete' THEN perms.can_delete
      WHEN 'export' THEN perms.can_export ELSE false END,
   CASE WHEN tm.role='gerente' THEN
         ((p_module<>'administracion' OR p_action='view') AND NOT(p_module='fiscalidad' AND p_action='delete'))
        WHEN tm.role='encargado' THEN
         (p_module<>'administracion' AND (p_action='view' OR (p_module='documentos' AND p_action IN ('create','edit'))))
        ELSE false END)
   END
  FROM public.team_members tm
  LEFT JOIN public.ops_user_permissions perms ON lower(perms.email)=lower(tm.email) AND perms.module=p_module
  WHERE lower(tm.email)=lower(coalesce(auth.jwt()->>'email','')) AND tm.active=true LIMIT 1
 ),false)
 AND auth.uid() IS NOT NULL
 AND p_module IN ('inicio','pricing','cajas','gastos','facturacion','documentos','fiscalidad','informes','administracion')
 AND p_action IN ('view','create','edit','delete','export');
$permissions$;
REVOKE ALL ON FUNCTION private.totus_can(text,text) FROM public,anon;
GRANT EXECUTE ON FUNCTION private.totus_can(text,text) TO authenticated;

-- El primer grupo es RESTRICTIVE: ningún usuario puede saltarse las denegaciones
-- usando otra política PERMISSIVE existente.
DO $guards$
DECLARE rec record;
BEGIN
 FOR rec IN SELECT * FROM (VALUES
 ('ops_daily_closings','cajas'),('ops_daily_closing_drawers','cajas'),
 ('ops_expenses','gastos'),('ops_expense_lines','gastos'),('ops_suppliers','gastos'),
 ('ops_sales_invoices','facturacion'),('ops_sales_invoice_lines','facturacion'),
 ('ops_documents','documentos'),
 ('ops_fiscal_adjustments','fiscalidad'),('ops_income_adjustments','fiscalidad'),('ops_tax_payments','fiscalidad'),
 ('products','pricing'),('product_variants','pricing'),('brands','pricing'),('families','pricing'),
 ('providers','pricing'),('product_provider_prices','pricing'),('product_competitor_prices','pricing'),
 ('consultations','pricing')
 ) AS x(tbl,mod)
 LOOP
  EXECUTE format('CREATE POLICY totus_mod_view ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING ((select private.totus_can(%L,%L)))',rec.tbl,rec.mod,'view');
  EXECUTE format('CREATE POLICY totus_mod_create ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (private.totus_can(%L,%L))',rec.tbl,rec.mod,'create');
  EXECUTE format('CREATE POLICY totus_mod_edit ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (private.totus_can(%L,%L)) WITH CHECK (private.totus_can(%L,%L))',rec.tbl,rec.mod,'edit',rec.mod,'edit');
  EXECUTE format('CREATE POLICY totus_mod_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (private.totus_can(%L,%L))',rec.tbl,rec.mod,'delete');
 END LOOP;
END $guards$;

-- Estos permisos habilitan operaciones autorizadas para un usuario concreto,
-- sin eliminar las políticas originales ni anular las RESTRICTIVE.
DO $grants$
DECLARE rec record;
BEGIN
 FOR rec IN SELECT * FROM (VALUES
 ('ops_daily_closings','cajas'),('ops_daily_closing_drawers','cajas'),
 ('ops_expenses','gastos'),('ops_expense_lines','gastos'),('ops_suppliers','gastos'),
 ('ops_sales_invoices','facturacion'),('ops_sales_invoice_lines','facturacion'),
 ('ops_fiscal_adjustments','fiscalidad'),('ops_income_adjustments','fiscalidad'),('ops_tax_payments','fiscalidad')
 ) AS x(tbl,mod)
 LOOP
  EXECUTE format('CREATE POLICY totus_grant_create ON public.%I FOR INSERT TO authenticated WITH CHECK (private.totus_can(%L,%L))',rec.tbl,rec.mod,'create');
  EXECUTE format('CREATE POLICY totus_grant_edit ON public.%I FOR UPDATE TO authenticated USING (private.totus_can(%L,%L)) WITH CHECK (private.totus_can(%L,%L))',rec.tbl,rec.mod,'edit',rec.mod,'edit');
  IF rec.tbl='ops_sales_invoices' THEN
   EXECUTE format('CREATE POLICY totus_grant_delete ON public.%I FOR DELETE TO authenticated USING (private.totus_can(%L,%L) AND status=%L)',rec.tbl,rec.mod,'delete','borrador');
  ELSIF rec.tbl='ops_sales_invoice_lines' THEN
   EXECUTE format('CREATE POLICY totus_grant_delete ON public.%I FOR DELETE TO authenticated USING (private.totus_can(%L,%L) AND EXISTS (SELECT 1 FROM public.ops_sales_invoices i WHERE i.id=invoice_id AND i.status=%L))',rec.tbl,rec.mod,'delete','borrador');
  ELSE
   EXECUTE format('CREATE POLICY totus_grant_delete ON public.%I FOR DELETE TO authenticated USING (private.totus_can(%L,%L))',rec.tbl,rec.mod,'delete');
  END IF;
 END LOOP;
END $grants$;

-- Propiedad documental y almacenamiento privado.
CREATE POLICY totus_grant_document_delete ON public.ops_documents FOR DELETE TO authenticated
 USING(private.totus_can('documentos','delete') AND (private.is_manager() OR uploaded_by=(SELECT auth.uid())));
CREATE POLICY totus_grant_document_edit ON public.ops_documents FOR UPDATE TO authenticated
 USING(private.totus_can('documentos','edit') AND (private.is_manager() OR uploaded_by=(SELECT auth.uid())))
 WITH CHECK(private.totus_can('documentos','edit') AND (private.is_manager() OR uploaded_by=(SELECT auth.uid())));
CREATE POLICY totus_storage_document_view ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
 USING(bucket_id<>'business-documents' OR private.totus_can('documentos','view'));
CREATE POLICY totus_storage_document_create ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(bucket_id<>'business-documents' OR private.totus_can('documentos','create'));
CREATE POLICY totus_storage_document_edit ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(bucket_id<>'business-documents' OR private.totus_can('documentos','edit'))
 WITH CHECK(bucket_id<>'business-documents' OR private.totus_can('documentos','edit'));
CREATE POLICY totus_storage_document_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
 USING(bucket_id<>'business-documents' OR (private.totus_can('documentos','delete') AND (private.is_manager() OR owner_id=(SELECT auth.uid())::text)));
CREATE POLICY totus_grant_storage_doc_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='business-documents' AND private.totus_can('documentos','delete') AND owner_id=(SELECT auth.uid())::text);

-- Los documentos emitidos no son editables por acceso directo a PostgREST.
-- La emisión y las operaciones admitidas se realizan mediante las RPC auditadas.
CREATE POLICY totus_issued_invoice_immutable_update ON public.ops_sales_invoices AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(status='borrador') WITH CHECK(status='borrador');
CREATE POLICY totus_invoice_lines_draft_insert ON public.ops_sales_invoice_lines AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(EXISTS (SELECT 1 FROM public.ops_sales_invoices i WHERE i.id=invoice_id AND i.status='borrador'));
CREATE POLICY totus_invoice_lines_draft_update ON public.ops_sales_invoice_lines AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(EXISTS (SELECT 1 FROM public.ops_sales_invoices i WHERE i.id=invoice_id AND i.status='borrador'))
 WITH CHECK(EXISTS (SELECT 1 FROM public.ops_sales_invoices i WHERE i.id=invoice_id AND i.status='borrador'));
CREATE POLICY totus_invoice_lines_draft_delete ON public.ops_sales_invoice_lines AS RESTRICTIVE FOR DELETE TO authenticated
 USING(EXISTS (SELECT 1 FROM public.ops_sales_invoices i WHERE i.id=invoice_id AND i.status='borrador'));

-- Las nueve RPC de negocio tienen su control private.totus_can en totus_api.sql.
-- Las otras operaciones administrativas siguen teniendo protección propia.
