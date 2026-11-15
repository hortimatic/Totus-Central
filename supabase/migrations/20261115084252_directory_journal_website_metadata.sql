-- Directory publication is SECURITY INVOKER and already reads restricted
-- connection metadata. Registry validation also needs these two public facts.
-- Do not grant table-wide access, credentials, or browser access.
begin;
grant select(connection_id,status) on private.totus_websites to service_role;
commit;
