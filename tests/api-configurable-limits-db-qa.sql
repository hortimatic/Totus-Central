\set ON_ERROR_STOP on
begin;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","email":"admin@example.invalid","role":"authenticated"}',true);
set local role authenticated;
select public.totus_api_manager('save','{"name":"Límite configurable ficticio","protocol":"http","endpoint":"https://example.com/api","auth_kind":"none","actor_email":"admin@example.invalid","daily_limit":201,"free_confirmed":true,"real_data_authorized":false}') as profile \gset
select (:'profile'::jsonb->>'changed_id') as cid \gset
select public.qa_assert(exists(select 1 from jsonb_array_elements(:'profile'::jsonb->'connections') c where c->>'id'=:'cid' and (c->>'daily_limit')::integer=201),'201 accepted without changing credentials');
select public.totus_api_manager('save',jsonb_build_object('id',:'cid','expected_revision',1,'name','Límite configurable ficticio','protocol','http','endpoint','https://example.com/api','auth_kind','none','actor_email','admin@example.invalid','daily_limit',1000,'max_output_tokens',1024,'free_confirmed',true,'real_data_authorized',false)) as higher \gset
select public.qa_assert(exists(select 1 from jsonb_array_elements(:'higher'::jsonb->'connections') c where c->>'id'=:'cid' and (c->>'daily_limit')::integer=1000 and (c->>'calls_today')::integer=0),'1000 accepted and counter not fabricated');
select public.qa_denied(format('select public.totus_api_manager(''save'',%L)',jsonb_build_object('id',:'cid','expected_revision',2,'name','Inválido','protocol','http','endpoint','https://example.com/api','auth_kind','none','actor_email','admin@example.invalid','daily_limit',0)),'límite');
select public.qa_assert(exists(select 1 from jsonb_array_elements(:'higher'::jsonb->'connections') c where c->>'id'=:'cid' and (c->>'max_output_tokens')::integer=1024),'configured output budget persisted');
select public.totus_api_manager('duplicate',jsonb_build_object('id',:'cid','expected_revision',2)) as copied \gset
select public.qa_assert(exists(select 1 from jsonb_array_elements(:'copied'::jsonb->'connections') c where c->>'id'<>:'cid' and c->>'name' like 'Límite configurable ficticio%' and (c->>'max_output_tokens')::integer=1024),'duplicate preserves output budget without credentials');
reset role;
update private.totus_ai_config set daily_limit=1000;
select public.qa_assert((select daily_limit=1000 from private.totus_ai_config where id),'default provider configuration accepts the same budget');
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","email":"staff@example.invalid","role":"authenticated"}',true);
set local role authenticated;
select public.qa_denied('select public.totus_api_manager()','Solo administración');
rollback;
select 'CONFIGURABLE API LIMITS QA OK';
