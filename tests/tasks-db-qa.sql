\set ON_ERROR_STOP on
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',false);
set role authenticated;
select public.totus_task_command('save','{"task":{"title":"Revisar almacén","description":"Sin reloj","starts_on":"2026-01-31","ends_on":null,"repeat_kind":"monthly","repeat_every":1,"weekdays":[],"checklist":["Contar","Revisar"],"priority":"normal","assigned_email":"staff@example.invalid","store_id":null}}') as task \gset
select (:'task'::jsonb->>'id') as task_id \gset
select public.totus_tasks_context('2026-02-01','2026-03-31') as ctx \gset
select public.qa_assert(jsonb_array_length(:'ctx'::jsonb->'rows')=2,'monthly last day and March 31');
select (:'ctx'::jsonb->'rows'->0->>'task_version') as task_version \gset
select public.qa_denied(format('select public.totus_task_command(''occurrence'',%L)',jsonb_build_object('task_id',:'task_id','task_version',:'task_version','scheduled_on','2026-02-28','state','done','checked',jsonb_build_array(0),'result','')),'Completa');
select public.totus_task_command('occurrence',jsonb_build_object('task_id',:'task_id','task_version',:'task_version','scheduled_on','2026-02-28','state','done','checked',jsonb_build_array(0,1),'result','Comprobado'));
select public.totus_tasks_context('2026-02-01','2026-03-31') as after_done \gset
select public.qa_assert(:'after_done'::jsonb->'rows'->0->>'state'='done' and :'after_done'::jsonb->'rows'->1->>'state'='pending','each occurrence independent');
select public.qa_denied(format('select public.totus_task_command(''occurrence'',%L)',jsonb_build_object('task_id',:'task_id','task_version',:'task_version','scheduled_on','2026-02-28','state','working','checked','[]'::jsonb)),'Otro usuario');
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',false);
select public.qa_assert(jsonb_array_length(public.totus_tasks_context('2026-02-01','2026-03-31')->'rows')=0,'unrelated staff cannot see tasks');
select public.qa_denied(format('select public.totus_task_command(''archive'',%L)',jsonb_build_object('task_id',:'task_id','task_version',:'task_version')),'No tienes acceso');
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',false);
select public.qa_assert(jsonb_array_length(public.totus_tasks_context('2026-02-01','2026-03-31')->'rows')=2,'assigned user sees task');
select public.qa_denied(format('select public.totus_task_command(''archive'',%L)',jsonb_build_object('task_id',:'task_id','task_version',:'task_version')),'No puedes archivar');
reset role;
select public.qa_assert((select count(*) from public.ops_task_events)=2,'mutations audited only on success');
set role anon;
select public.qa_denied('select public.totus_tasks_context(''2026-01-01'',''2026-01-31'')','permission denied');
reset role;
select 'TASK DATABASE QA: per-occurrence completion, permissions, concurrency, audit, anonymous denial OK';
