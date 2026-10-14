-- Totus Central / STAGING ONLY / 2026-10-14
-- Security audit: anonymous role must never execute privileged mutation RPCs.
-- Applied to Supabase staging awmojepsasikxocoeqtu; do not run on production.
-- Each RPC still needs its own authenticated user+role validation.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.totus_convert_proforma(uuid,uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.totus_delete_closing(uuid,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.totus_finalize_sales_document(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.totus_register_external_document(uuid,integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.totus_save_closing(jsonb,jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.totus_save_sales_document(jsonb,jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.totus_storage_usage() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.totus_update_invoice_payment(uuid,jsonb) FROM PUBLIC, anon;
COMMIT;
-- Re-run Supabase Security Advisors: anon_security_definer_function_executable must be absent.
-- Note: authenticated SECURITY DEFINER warnings remain: review each user's authorization.
