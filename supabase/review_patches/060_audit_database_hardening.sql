-- Audit F-04/F-06/F-07. No business records, credentials or application logs are deleted.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

-- Data API clients need row-level DML, never structural table privileges.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from anon, authenticated;

create index if not exists totus_ai_config_connection_idx on private.totus_ai_config(connection_id);
create index if not exists totus_ai_config_reader_connection_idx on private.totus_ai_config(reader_connection_id);
create index if not exists totus_api_connections_actor_idx on private.totus_api_connections(actor_email);
create index if not exists ops_income_adjustments_creator_idx on public.ops_income_adjustments(created_by);
create index if not exists ops_tasks_deleted_by_idx on public.ops_tasks(deleted_by);
create index if not exists team_members_role_idx on public.team_members(role);

-- Same predicates, roles and permissive/restrictive mode; JWT is evaluated once per statement.
alter policy perms_select on public.ops_user_permissions using (
 private.is_admin() or (private.is_team_member() and lower(email)=lower(coalesce((select auth.jwt())->>'email','')))
);
alter policy totus_team_directory_privacy on public.team_members using (
 private.is_manager() or lower(email)=lower(coalesce((select auth.jwt())->>'email',''))
);

-- Only pg_cron execution metadata. Retain 30 days of successes and 90 of failures.
-- Never remove active/unknown-status runs, business Log events or backup metadata.
create or replace function private.totus_prune_cron_history()
returns bigint language sql security invoker set search_path=''
as $function$
 with expired as (
  select runid from cron.job_run_details
  where end_time is not null and (
   (status='succeeded' and end_time < now()-interval '30 days') or
   (status='failed' and end_time < now()-interval '90 days')
  )
  order by end_time,runid limit 20000 for update skip locked
 ), removed as (
  delete from cron.job_run_details d using expired e where d.runid=e.runid returning d.runid
 ) select count(*) from removed;
$function$;
revoke all on function private.totus_prune_cron_history() from public,anon,authenticated,service_role;
select cron.schedule('totus-cron-history-retention','41 3 * * *','select private.totus_prune_cron_history()');
commit;
