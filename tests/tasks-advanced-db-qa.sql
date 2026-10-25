\set ON_ERROR_STOP on
begin;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
set role authenticated;
select public.totus_task_command('save','{"client_id":"aaaaaaaa-1111-4111-8111-111111111111","task":{"title":"Fin de mes","starts_on":"2026-01-31","repeat_kind":"monthly","repeat_every":1,"weekdays":[],"checklist":[],"priority":"normal"}}') as saved \gset
select public.totus_task_command('save','{"client_id":"aaaaaaaa-1111-4111-8111-111111111111","task":{"title":"Fin de mes","starts_on":"2026-01-31","repeat_kind":"monthly","repeat_every":1,"weekdays":[],"checklist":[],"priority":"normal"}}') as retry \gset
select public.qa_assert(:'saved'::jsonb->>'id'=:'retry'::jsonb->>'id','retry does not duplicate');
select public.totus_tasks_context('2026-02-01','2026-03-31') as ctx \gset
select value as monthly from jsonb_array_elements(:'ctx'::jsonb->'rows') where value->>'task_id'=:'saved'::jsonb->>'id' and value->>'scheduled_on'='2026-02-28' \gset
select public.totus_task_command('save',jsonb_build_object('task_id',:'monthly'::jsonb->>'task_id','task_version',:'monthly'::jsonb->>'task_version','scheduled_on','2026-02-28','scope','future','task','{"title":"Fin de mes ajustado","starts_on":"2026-02-28","repeat_kind":"monthly","repeat_every":1,"weekdays":[],"checklist":[],"priority":"normal"}'::jsonb)) as split \gset
select public.totus_tasks_context('2026-03-01','2026-03-31') as march \gset
select public.qa_assert(exists(select 1 from jsonb_array_elements(:'march'::jsonb->'rows') r where r->>'task_id'=:'split'::jsonb->>'id' and r->>'scheduled_on'='2026-03-31'),'split retains day 31');
select public.totus_tasks_context('2026-01-01','2026-01-31') as january \gset
select public.qa_assert(exists(select 1 from jsonb_array_elements(:'january'::jsonb->'rows') r where r->>'task_id'=:'saved'::jsonb->>'id' and r->>'title'='Fin de mes'),'prior schedule unchanged');
select public.totus_chat_command('create_channel','{"name":"Origen privado QA","is_private":true}') as channel \gset
select public.totus_chat_command('send',jsonb_build_object('channel_id',:'channel'::jsonb->>'id','body','Documento privado','client_id',gen_random_uuid())) as message \gset
select public.qa_denied(format('select public.totus_task_command(''save'',%L)',jsonb_build_object('source_message_id',:'message'::jsonb->>'id','task','{"title":"Privado","starts_on":"2026-10-25","repeat_kind":"once","repeat_every":1,"weekdays":[],"checklist":[],"priority":"normal","assigned_email":"other@example.invalid"}'::jsonb)),'responsable debe tener acceso');
select public.totus_task_command('save',jsonb_build_object('source_message_id',:'message'::jsonb->>'id','task','{"title":"Privado","starts_on":"2026-10-25","repeat_kind":"once","repeat_every":1,"weekdays":[],"checklist":[],"priority":"normal"}'::jsonb)) as linked \gset
select public.qa_assert(public.totus_task_from_message((:'message'::jsonb->>'id')::uuid)->>'task_id'=:'linked'::jsonb->>'id','message opens same task');
select public.totus_tasks_context('2026-10-25','2026-10-25') as today \gset
select value as linked_row from jsonb_array_elements(:'today'::jsonb->'rows') where value->>'task_id'=:'linked'::jsonb->>'id' \gset
select public.totus_task_command('occurrence',jsonb_build_object('task_id',:'linked'::jsonb->>'id','task_version',:'linked_row'::jsonb->>'task_version','scheduled_on','2026-10-25','state','done','checked','[]'::jsonb,'result','Realizado'));
select public.qa_assert((select task_state='done' from public.ops_chat_messages where id=(:'message'::jsonb->>'id')::uuid),'one-time completion reflected in chat');
select public.qa_assert(jsonb_array_length(public.totus_task_history((:'linked'::jsonb->>'id')::uuid))=2,'history readable');
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
select public.qa_denied(format('select public.totus_task_from_message(%L)',:'message'::jsonb->>'id'),'No tienes acceso');
select public.qa_denied('select public.totus_task_agent(''admin@example.invalid'',''context'',''{"from":"2026-10-01","to":"2026-10-31"}'')','permission denied');
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.qa_assert(jsonb_array_length(public.totus_task_agent('admin@example.invalid','context','{"from":"2026-10-25","to":"2026-10-25"}')->'rows')>0,'trusted connector reads with explicit delegation');
select public.qa_assert(coalesce(current_setting('totus.task_actor',true),'')='','delegation cleared after request');
select public.qa_denied('select public.totus_task_agent(''missing@example.invalid'',''context'',''{"from":"2026-10-01","to":"2026-10-31"}'')','no está activo');
rollback;
select 'TASK ADVANCED QA: duplicate retry, split series, monthly anchor, old history, private attachments, source linkage and audited completion OK';
