\set ON_ERROR_STOP on
begin;
insert into public.ops_stores values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','Tienda ficticia A'),('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','Tienda ficticia B');
set role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111"}',true);
select public.totus_chat_command('create_channel','{"name":"QA tienda","group_name":"Equipo","store_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"}') as created \gset
select (:'created'::jsonb->>'id') as channel_id \gset
select public.qa_assert(:'created'::jsonb->>'store_id'='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','Creation keeps the selected store');
select public.totus_chat_command('channel_update',jsonb_build_object('channel_id',:'channel_id','name','QA tienda','group_name','Equipo','update_store',true,'store_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2')) as changed \gset
select public.qa_assert(:'changed'::jsonb->>'store_id'='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','Edition persists selected store');
select public.totus_chat_command('channel_update',jsonb_build_object('channel_id',:'channel_id','name','QA renamed','group_name','Equipo')) as preserved \gset
select public.qa_assert(:'preserved'::jsonb->>'store_id'='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','Older clients cannot clear an omitted store');
select public.totus_chat_command('channel_update',jsonb_build_object('channel_id',:'channel_id','name','QA legacy','group_name','Equipo','store_id',null)) as legacy \gset
select public.qa_assert(:'legacy'::jsonb->>'store_id'='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','Older forms sending null cannot clear the store without an explicit intent');
select public.qa_denied(format('select public.totus_chat_command(%L,%L::jsonb)','channel_update',jsonb_build_object('channel_id',:'channel_id','name','QA','group_name','Equipo','update_store',true,'store_id','ffffffff-ffff-4fff-8fff-ffffffffffff')),'foreign key');
select public.totus_chat_command('channel_update',jsonb_build_object('channel_id',:'channel_id','name','QA general','group_name','Equipo','update_store',true,'store_id','')) as general \gset
select public.qa_assert(:'general'::jsonb->>'store_id' is null,'Explicit general channel clears attribution');
reset role;
rollback;
select 'CHAT STORE QA: create, edit, omitted-field compatibility, invalid reference and general channel OK';
