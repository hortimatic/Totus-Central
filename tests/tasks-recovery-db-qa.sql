\set ON_ERROR_STOP on
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}',false);
select public.totus_task_command('save','{"task":{"title":"Tarea con copia","description":"Prueba aislada","starts_on":"2026-10-25","repeat_kind":"daily","repeat_every":1,"weekdays":[],"checklist":[],"priority":"normal"}}');
select set_config('request.jwt.claims','{"role":"service_role"}',false);
select public.totus_export_recovery_snapshot() as task_snapshot \gset
select public.qa_assert((select count(*)=52 from jsonb_object_keys(:'task_snapshot'::jsonb->'database')),'all 52 tables exported');
select public.qa_assert((public.totus_verify_recovery_rows(:'task_snapshot'::jsonb->'database')->>'table_count')::integer=52,'task foreign keys rehearse');
insert into public.ops_recovery_jobs(id,status,checkpoint_path,before_revision,requested_by,requested_email)
 values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','prepared','verified-fixture-checkpoint',:'task_snapshot'::jsonb->>'revision','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','qa@example.invalid');
select public.totus_commit_recovery('dddddddd-dddd-4ddd-8ddd-dddddddddddd',:'task_snapshot'::jsonb->'database',:'task_snapshot'::jsonb) as restored \gset
select public.qa_assert(:'restored'::jsonb->>'ops_tasks'='1','task restored with events');
select jsonb_object_agg(key,value) as old49 from jsonb_each(:'task_snapshot'::jsonb->'database') where key not in ('ops_tasks','ops_task_occurrences','ops_task_events') \gset
select public.qa_assert((public.totus_verify_recovery_rows(:'old49'::jsonb)->'counts'->>'ops_tasks')::integer=0,'49-table copies normalize empty tasks');
select public.totus_export_recovery_snapshot() as before_old \gset
insert into public.ops_recovery_jobs(id,status,checkpoint_path,before_revision,requested_by,requested_email)
 values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','prepared','verified-fixture-checkpoint',:'before_old'::jsonb->>'revision','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','qa@example.invalid');
select public.totus_commit_recovery('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',:'old49'::jsonb,jsonb_set(:'task_snapshot'::jsonb,'{schema_hash}','"512d6a886f2d35281b96dc6e9217342e1985fcfa821a7ad80c6cc872525f22c3"'));
select public.qa_assert((select count(*)=0 from public.ops_tasks),'old copy restores safely with no invented tasks');
select 'TASK RECOVERY QA: 52-table real restore in disposable DB, events, FKs and 49-table compatibility OK';
