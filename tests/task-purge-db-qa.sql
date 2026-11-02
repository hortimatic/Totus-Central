\set ON_ERROR_STOP on
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',false);
set role authenticated;
select public.totus_task_command('save','{"task":{"title":"Permanent removal QA","starts_on":"2026-11-02","repeat_kind":"once","repeat_every":1,"weekdays":[],"checklist":[],"priority":"normal"}}') as task \gset
select (:'task'::jsonb->>'id') as tid \gset
select public.totus_tasks_context('2026-11-01','2026-11-30') as ctx \gset
select (x->>'task_version') as version from jsonb_array_elements(:'ctx'::jsonb->'rows') x where x->>'task_id'=:'tid' \gset
select public.qa_denied(format('select public.totus_task_purge(%L,%L,%L)',:'tid',:'version','ELIMINAR TAREA'),'primero');
select public.totus_task_remove(:'tid',:'version');
select public.totus_tasks_context('2026-11-01','2026-11-30') as trash \gset
select (x->>'task_version') as deleted_version from jsonb_array_elements(:'trash'::jsonb->'deleted_tasks') x where x->>'task_id'=:'tid' \gset
select public.qa_denied(format('select public.totus_task_purge(%L,%L,%L)',:'tid',:'deleted_version','wrong'),'confirmar');
select public.qa_denied(format('select public.totus_task_purge(%L,%L,%L)',:'tid','2000-01-01','ELIMINAR TAREA'),'ha cambiado');
reset role;
select count(*) as message_count from public.ops_chat_messages \gset
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',false);
set role authenticated;
select public.qa_denied(format('select public.totus_task_purge(%L,%L,%L)',:'tid',:'deleted_version','ELIMINAR TAREA'),'gestionar');
reset role;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',false);
set role authenticated;
select public.totus_task_purge(:'tid',:'deleted_version','ELIMINAR TAREA');
select public.qa_assert(not exists(select 1 from jsonb_array_elements(public.totus_tasks_context('2026-11-01','2026-11-30')->'deleted_tasks') x where x->>'task_id'=:'tid'),'absent from deleted tasks');
reset role;
select public.qa_assert(not exists(select 1 from public.ops_tasks where id=:'tid'),'task physically removed');
select public.qa_assert(not exists(select 1 from public.ops_task_events where task_id=:'tid'),'task events physically removed');
select public.qa_assert(not exists(select 1 from public.ops_task_occurrences where task_id=:'tid'),'occurrences physically removed');
select public.qa_assert(exists(select 1 from public.ops_audit_log where action='task_purged' and detail->>'task_id'=:'tid'),'purge audited separately');
select public.qa_assert((select count(*) from public.ops_chat_messages)=:'message_count'::integer,'source messages untouched');
set role anon;
select public.qa_denied(format('select public.totus_task_purge(%L,%L,%L)',:'tid',:'deleted_version','ELIMINAR TAREA'),'permission denied');
reset role;
select 'TASK PERMANENT REMOVAL QA OK';
