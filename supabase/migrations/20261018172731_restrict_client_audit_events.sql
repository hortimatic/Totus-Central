-- Database-triggered audit events remain privileged and unaffected.
-- Browser-authored events must belong to the authenticated administrator.
alter policy ops_audit_insert on public.ops_audit_log
to authenticated
with check (
  private.is_admin()
  and user_id = (select auth.uid())
  and user_email = lower(coalesce((select auth.jwt())->>'email',''))
  and area = 'administracion'
  and action = 'unused_logos_removed'
);

