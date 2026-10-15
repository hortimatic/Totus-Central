-- Totus Central - staging only - 2026-10-15
-- Applied as migration unify_staging_team_role_checks_20261015.
-- Prevents manager and team RPCs failing when auth account/team_members exists
-- but an optional profiles row is absent (team-admin did not provision profiles).
-- Reuses the same membership/role helpers already used by RLS.
CREATE OR REPLACE FUNCTION private.totus_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public,private'
AS $$ SELECT private.is_admin(); $$;
CREATE OR REPLACE FUNCTION private.totus_is_manager()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public,private'
AS $$ SELECT private.is_manager(); $$;
CREATE OR REPLACE FUNCTION private.totus_is_team_member()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public,private'
AS $$ SELECT private.is_team_member(); $$;
REVOKE ALL ON FUNCTION private.totus_is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.totus_is_manager() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.totus_is_team_member() FROM PUBLIC;
-- Verified by pg_get_functiondef and has_function_privilege('anon',...)=false.
-- Not a configurable permissions matrix; that remains a separate critical feature.
