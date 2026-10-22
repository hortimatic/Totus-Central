revoke update on public.ops_roles from public,anon,authenticated;
grant update(name,description) on public.ops_roles to authenticated;
alter policy totus_role_catalog_update on public.ops_roles using (private.is_admin() and code<>'admin') with check (private.is_admin() and code<>'admin');
-- Only labels can be updated by application users. The existing trigger also
-- prevents changes to role codes and system identities; deletion stays protected.
