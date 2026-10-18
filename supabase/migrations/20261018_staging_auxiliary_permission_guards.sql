-- Totus Central: deny auxiliary-table writes when module-specific rights are revoked.
-- STAGING ONLY. 2026-10-18. No business rows are changed by this migration.
-- Existing permissive policies are intentionally retained: these new RESTRICTIVE
-- policies intersect with them, so both the legacy role check and editable module
-- permission must grant the requested action.
DO $totus_aux$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('ops_cash_drawers','cajas'),
      ('ops_customers','facturacion'),
      ('ops_document_templates','facturacion')
    ) AS x(tab, module)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename=r.tab
        AND policyname='totus_aux_create_guard'
    ) THEN
      EXECUTE format(
        'CREATE POLICY totus_aux_create_guard ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (private.totus_can(%L,%L))',
        r.tab,r.module,'create');
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename=r.tab
        AND policyname='totus_aux_edit_guard'
    ) THEN
      EXECUTE format(
        'CREATE POLICY totus_aux_edit_guard ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (private.totus_can(%L,%L)) WITH CHECK (private.totus_can(%L,%L))',
        r.tab,r.module,'edit',r.module,'edit');
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename=r.tab
        AND policyname='totus_aux_delete_guard'
    ) THEN
      EXECUTE format(
        'CREATE POLICY totus_aux_delete_guard ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (private.totus_can(%L,%L))',
        r.tab,r.module,'delete');
    END IF;
  END LOOP;
END $totus_aux$;
