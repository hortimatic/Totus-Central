-- PostgREST reads a function-level deadline before invoking the RPC.
-- service_role otherwise inherits authenticator's eight-second deadline.
-- Scope this to capture only: never extend the deadline for ordinary writes.
-- The existing five-second lock timeout, server-only ACL and lease remain intact.
alter function public.totus_backup_capture_snapshot(uuid,uuid) set statement_timeout to '30s';
notify pgrst, 'reload schema';
