-- TOTUS CENTRAL · STAGING · hardening 001
-- Applied and verified on staging Supabase on 2026-10-14.
-- Do NOT execute against production without explicit approval, backup, and smoke test.
-- Purpose: anonymous users must not execute the destructive restore RPC.
-- This function internally checks private.totus_is_admin(), which remains required.
REVOKE EXECUTE ON FUNCTION public.totus_restore_backup(jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.totus_restore_backup(jsonb,text) TO authenticated;

-- Read-only verification (expected: false, true):
-- SELECT has_function_privilege('anon','public.totus_restore_backup(jsonb,text)','EXECUTE') AS anon_exec,
--        has_function_privilege('authenticated','public.totus_restore_backup(jsonb,text)','EXECUTE') AS authenticated_exec;

-- Rollback (staging ONLY if explicitly needed):
-- GRANT EXECUTE ON FUNCTION public.totus_restore_backup(jsonb,text) TO PUBLIC, anon;
