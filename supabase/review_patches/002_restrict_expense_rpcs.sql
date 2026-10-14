-- Totus Central staging: 002 hardening expense RPCs (2026-10-14)
-- Executed and verified on isolated staging DB only. Production must not be changed without explicit authorization.
-- Both functions retain private.totus_is_manager() internal authorization.
REVOKE EXECUTE ON FUNCTION public.totus_save_expense(jsonb,jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.totus_delete_expense(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.totus_save_expense(jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.totus_delete_expense(uuid,text) TO authenticated;
-- Read-only verification:
-- SELECT p.proname, has_function_privilege('anon',p.oid,'EXECUTE') AS anon_exec,
--        has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_exec
-- FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
-- WHERE n.nspname='public' AND p.proname IN ('totus_save_expense','totus_delete_expense');
-- Expected: false / true for each.
-- Rollback, only if expressly authorized:
-- GRANT EXECUTE ON FUNCTION public.totus_save_expense(jsonb,jsonb) TO PUBLIC, anon;
-- GRANT EXECUTE ON FUNCTION public.totus_delete_expense(uuid,text) TO PUBLIC, anon;
