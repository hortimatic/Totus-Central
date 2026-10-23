-- The server-only rehearsal validates every table and FK in temporary tables.
-- Scope a bounded timeout to this RPC; keep caller roles and live recovery unchanged.
alter function public.totus_verify_recovery_rows(jsonb) set statement_timeout to '60s';
notify pgrst, 'reload schema';
