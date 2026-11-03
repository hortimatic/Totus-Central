\set ON_ERROR_STOP on
insert into cron.job_run_details values
 (1,'succeeded',now()-interval '31 days'),(2,'succeeded',now()-interval '29 days'),
 (3,'failed',now()-interval '91 days'),(4,'failed',now()-interval '89 days'),
 (5,'running',now()-interval '100 days'),(6,'running',null),(7,'unknown',now()-interval '100 days');
do $$begin
 if private.totus_prune_cron_history()<>2 then raise exception 'Retention count';end if;
 if (select count(*) from cron.job_run_details)<>5 then raise exception 'Active or recent runs removed';end if;
 if has_function_privilege('authenticated','private.totus_prune_cron_history()','execute') then raise exception 'Client can prune';end if;
 if (select count(*) from cron.job)<>1 then raise exception 'Duplicate retention schedule';end if;
 if exists(select 1 from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') and privilege_type in ('TRUNCATE','TRIGGER','REFERENCES')) then raise exception 'Structural grants remain';end if;
 if not has_table_privilege('authenticated','public.team_members','select') then raise exception 'Application select lost';end if;
 if (select permissive from pg_policies where policyname='totus_team_directory_privacy')<>'RESTRICTIVE' then raise exception 'Restrictive policy changed';end if;
end$$;
create table public.audit_future_table(id int);
do $$begin if has_table_privilege('authenticated','public.audit_future_table','truncate') then raise exception 'Future table can truncate';end if;end$$;
set role authenticated;
select set_config('request.jwt.claims','{"email":"own@example.test"}',false);
do $$begin
 if (select count(*) from public.team_members)<>1 then raise exception 'Directory isolation';end if;
 if (select count(*) from public.ops_user_permissions)<>1 then raise exception 'Permission isolation';end if;
end$$;
reset role;
insert into cron.job_run_details select 100+g,'succeeded',now()-interval '40 days' from generate_series(1,20001) g;
do $$begin
 if private.totus_prune_cron_history()<>20000 then raise exception 'Batch is not bounded';end if;
 if private.totus_prune_cron_history()<>1 then raise exception 'Next batch does not resume';end if;
end$$;
select 'Audit hardening contracts passed' as result;
