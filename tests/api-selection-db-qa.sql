\set ON_ERROR_STOP on
create table if not exists public.ops_roles(code text primary key,name text,sort_order integer default 0);
insert into public.ops_roles values('admin','Administración',0),('encargado','Encargado',1) on conflict do nothing;
select gen_random_uuid() as request_id \gset
select public.totus_api_prepare_actor(:'request_id','11111111-1111-4111-8111-111111111111','IA de ensayo','admin',repeat('a',64)) as prepared \gset
select (:'prepared'::jsonb->'credentials'->>'email') as actor_email \gset
select public.qa_assert(length(:'prepared'::jsonb->'credentials'->>'password')=64,'technical credential prepared privately');
select public.qa_denied(format('select public.totus_api_finish_actor(%L,%L)',:'request_id','11111111-1111-4111-8111-111111111111'),'todavía no');
select gen_random_uuid() as actor_id \gset
insert into auth.users(id,email,raw_app_meta_data) values(:'actor_id',:'actor_email',jsonb_build_object('totus_integration',true,'totus_provision_id',:'request_id'));
select public.totus_api_finish_actor(:'request_id','11111111-1111-4111-8111-111111111111') as completed \gset
select public.qa_assert(:'completed'::jsonb->>'email'=:'actor_email','own technical identity created');
select public.totus_api_prepare_actor(:'request_id','11111111-1111-4111-8111-111111111111','IA de ensayo','admin',repeat('b',64)) as replay \gset
select public.qa_assert((:'replay'::jsonb->>'complete')::boolean and not (:'replay'::jsonb ? 'credentials'),'retry returns completed identity without a password');
select public.qa_assert(not exists(select 1 from vault.secrets where name='totus_api_provision_'||:'request_id'),'temporary credential removed after completion');
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","email":"admin@example.invalid","role":"authenticated"}',false);
set role authenticated;
select public.totus_api_manager('save',jsonb_build_object('name','IA propia','protocol','cloudflare','account_id',repeat('a',32),'model','fixture-model','auth_kind','bearer','actor_email',:'actor_email','daily_limit',30,'free_confirmed',true,'real_data_authorized',true,'allow_cloudflare_reader',true),'fictional-key') as created \gset
select (:'created'::jsonb->>'changed_id') as cid \gset
select public.qa_denied(format('select public.totus_api_prepare_actor(%L,%L,%L,%L,%L)',gen_random_uuid(),'11111111-1111-4111-8111-111111111111','No autorizado','admin',repeat('x',64)),'permission denied');
reset role;
select gen_random_uuid() as call_id \gset
select public.totus_api_call(:'cid',1,:'call_id');select public.totus_api_call(:'cid',1,:'call_id','{"ok":true}');
set role authenticated;
select public.totus_api_manager('use_ai',jsonb_build_object('id',:'cid','expected_revision',1)) as selected \gset
select public.qa_assert(:'selected'::jsonb->>'active_ai_connection'=:'cid','provider associated with own identity');
select public.totus_api_manager('use_reader',jsonb_build_object('id',:'cid','expected_revision',1));
reset role;
select public.qa_assert(private.totus_api_ai_actor()=:'actor_email','queue authorization uses assigned identity');
select public.qa_assert(public.totus_ai_server_config()->>'actor_email'=:'actor_email' and public.totus_ai_server_config()->'connection'->>'id'=:'cid','runtime uses selected provider');
select public.qa_assert(public.totus_ai_server_config()->'reader_connection'->>'id'=:'cid','reader is explicit and verified');
select public.qa_denied(format('select public.totus_api_prepare_actor(%L,%L,%L,%L,%L)',gen_random_uuid(),'22222222-2222-4222-8222-222222222222','Prohibido','admin',repeat('x',64)),'no autorizada');
select public.qa_assert((select count(*)=0 from ops_expenses) and (select count(*)=0 from ops_daily_closings),'identity and provider changes do not create accounting data');
select 'API SELECTION AND TECHNICAL IDENTITY QA OK';
