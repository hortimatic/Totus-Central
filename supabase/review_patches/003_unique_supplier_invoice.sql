-- Totus Central · staging · correction 003 · 2026-10-14
-- Added to staging Supabase (zero rows in ops_expenses), and verified in pg_indexes.
-- Defensive UNIQUE index against concurrent duplicate invoices with a known supplier tax ID.
-- Existing index ops_expenses_supplier_invoice_date_uq deliberately retained.
-- Limitation: records lacking supplier_tax_id still rely on existing name/date index and RPC validation.
-- Run only after checking existing collisions in the target database; DO NOT apply to main/production automatically.
CREATE UNIQUE INDEX IF NOT EXISTS ops_expenses_supplier_tax_invoice_uq
ON public.ops_expenses (lower(btrim(supplier_tax_id)),lower(btrim(invoice_number)))
WHERE btrim(supplier_tax_id)<>'' AND btrim(invoice_number)<>'';

-- Preflight before applying in a populated database:
-- SELECT lower(btrim(supplier_tax_id)) supplier_id,lower(btrim(invoice_number)) invoice,count(*) n
-- FROM public.ops_expenses
-- WHERE btrim(supplier_tax_id)<>'' AND btrim(invoice_number)<>''
-- GROUP BY 1,2 HAVING count(*)>1;

-- Verification:
-- SELECT indexdef FROM pg_indexes WHERE schemaname='public'
-- AND indexname='ops_expenses_supplier_tax_invoice_uq';

-- Rollback (staging only, if authorized):
-- DROP INDEX IF EXISTS public.ops_expenses_supplier_tax_invoice_uq;
