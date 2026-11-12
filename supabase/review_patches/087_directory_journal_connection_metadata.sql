-- The service journal validates connection metadata with SECURITY INVOKER.
-- Grant only the columns used by that check; do not expose secrets or browser access.
begin;
grant select(protocol)
 on private.totus_api_connections to service_role;
commit;
