\set ON_ERROR_STOP on
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',false);
set role authenticated;
select public.totus_task_command('save','{"task":{"title":"Removal QA","starts_on":"2026-11-02","repeat_kind":"once","repeat_every":1,"weekdays":[],"checklist":[],"priority":"normal"}}') as task \gset
select (:'task'::jsonb->>'id') as tid \gset
select public.totus_tasks_context('2026-11-01','2026-11-30') as ctx \gset
select (x->>'task_version') as version from jsonb_array_elements(:'ctx'::jsonb->'rows') x where x->>'task_id'=:'tid' \gset
select public.qa_denied(format('select public.totus_task_remove(%L,%L)',:'tid','2000-01-01'),'ha cambiado');
select public.totus_task_remove(:'tid',:'version');
select public.qa_assert(not exists(select 1 from jsonb_array_elements(public.totus_tasks_context('2026-11-01','2026-11-30')->'rows') x where x->>'task_id'=:'tid'),'removed task absent from calendar');
select public.totus_tasks_context('2026-11-01','2026-11-30') as trash \gset
select (x->>'task_version') as deleted_version from jsonb_array_elements(:'trash'::jsonb->'deleted_tasks') x where x->>'task_id'=:'tid' \gset
select public.totus_task_remove(:'tid',:'deleted_version',true);
select public.qa_assert(exists(select 1 from jsonb_array_elements(public.totus_tasks_context('2026-11-01','2026-11-30')->'rows') x where x->>'task_id'=:'tid'),'restored active task visible');
reset role;
select public.qa_assert((select count(*)=2 from ops_task_events where task_id=:'tid' and action in('delete','restore_deleted')),'removal and restoration audited');
set role anon;
select public.qa_denied(format('select public.totus_task_remove(%L,%L)',:'tid',:'version'),'permission denied');
reset role;
select 'TASK REMOVAL QA OK';
