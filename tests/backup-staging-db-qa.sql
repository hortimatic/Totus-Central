begin;
alter table public.ops_backup_work add column lease_until timestamptz,add column updated_at timestamptz not null default now();
create function public.totus_export_recovery_snapshot() returns jsonb language sql as $$select jsonb_build_object('database',jsonb_build_object('fixture_payload',repeat('x',1048576)),'revision',repeat('a',64),'identities','[]'::jsonb,'storage','{}'::jsonb)$$;
\i supabase/review_patches/026_backup_snapshot_staging.sql
\i supabase/review_patches/027_backup_capture_deadline.sql
select public.qa_assert((select proconfig @> array['statement_timeout=30s','lock_timeout=5s'] from pg_proc where oid='public.totus_backup_capture_snapshot(uuid,uuid)'::regprocedure),'bounded capture deadline without extending lock wait');
select public.qa_assert((select not coalesce(proconfig @> array['statement_timeout=30s'],false) from pg_proc where oid='public.totus_backup_prepare_work(uuid,text,jsonb,jsonb)'::regprocedure),'ordinary preparation deadline unchanged');
select public.qa_assert(not has_function_privilege('authenticated','public.totus_backup_capture_snapshot(uuid,uuid)','execute'),'no browser snapshot access');
select public.qa_assert(not has_function_privilege('anon','public.totus_backup_capture_snapshot(uuid,uuid)','execute'),'no anonymous snapshot access');
insert into public.ops_backup_runs(id,status) values('44444444-4444-4444-8444-444444444444','running');
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
select public.qa_denied($q$select public.totus_backup_capture_snapshot('44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555')$q$,'Solo el servidor');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.qa_assert(public.totus_backup_capture_snapshot('44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555')->>'revision'=repeat('a',64),'capture is retained on server');
select public.qa_assert((select length(snapshot->'database'->>'fixture_payload')=1048576 from public.ops_backup_work),'full database captured');
select public.qa_assert(public.totus_backup_capture_snapshot('44444444-4444-4444-8444-444444444444','66666666-6666-4666-8666-666666666666') is null,'other capture cannot steal lease');
update public.ops_backup_work set lease_until=now()-interval '1 second';
select public.qa_assert(public.totus_backup_capture_snapshot('44444444-4444-4444-8444-444444444444','66666666-6666-4666-8666-666666666666')->>'revision'=repeat('a',64),'lost response reuses snapshot');
select public.qa_denied($q$select public.totus_backup_prepare_work('44444444-4444-4444-8444-444444444444','a.totusbackup',jsonb_build_object('path','a.totusbackup','manifest',jsonb_build_object('revision',repeat('a',64))),jsonb_build_object('revision',repeat('a',64),'project_ref','qa-project','source_revision',repeat('c',40),'capture_id','55555555-5555-4555-8555-555555555555'))$q$,'caducado');
select public.totus_backup_prepare_work('44444444-4444-4444-8444-444444444444','a.totusbackup',jsonb_build_object('path','a.totusbackup','stage','documents','cursor',0,'manifest',jsonb_build_object('revision',repeat('a',64))),jsonb_build_object('revision',repeat('a',64),'project_ref','qa-project','source_revision',repeat('c',40),'capture_id','66666666-6666-4666-8666-666666666666'));
select public.qa_assert((select length(snapshot->'database'->>'fixture_payload')=1048576 and snapshot->>'source_revision'=repeat('c',40) and lease_until is null from public.ops_backup_work),'metadata cannot replace captured database');
update public.ops_backup_work set state=state||'{"cursor":7}';
select public.totus_backup_prepare_work('44444444-4444-4444-8444-444444444444','a.totusbackup',jsonb_build_object('path','a.totusbackup','manifest',jsonb_build_object('revision',repeat('a',64))),jsonb_build_object('revision',repeat('a',64),'project_ref','qa-project','source_revision',repeat('c',40)));
select public.qa_assert((select (state->>'cursor')::int=7 from public.ops_backup_work),'retry cannot rewind progress');
select public.qa_assert(public.totus_backup_capture_snapshot('44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555') is null,'ready job cannot be recaptured');
rollback;
