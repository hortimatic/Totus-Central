\set ON_ERROR_STOP on
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","email":"admin@example.invalid","role":"authenticated"}',false);
set role authenticated;
select public.totus_api_manager('save','{"name":"PrestaShop sin usuario","protocol":"prestashop","endpoint":"https://hortimatic.com/api/","auth_kind":"basic","actor_email":"","daily_limit":100,"free_confirmed":true,"real_data_authorized":true}','fixture-only') as service \gset
select (:'service'::jsonb->>'changed_id') as service_id \gset
select public.qa_assert(exists(select 1 from jsonb_array_elements(:'service'::jsonb->'connections') c where c->>'id'=:'service_id' and c->>'actor_email' is null),'PrestaShop has no chat actor');
select public.qa_denied('select public.totus_api_manager(''save'',''{"name":"IA sin usuario","protocol":"openai_compatible","endpoint":"https://example.com/v1","model":"fixture","auth_kind":"bearer","actor_email":"","daily_limit":100}'')','usuario activo');
reset role;
select public.qa_assert(public.totus_api_server(:'service_id',1)->>'secret'='fixture-only','Server credential works without account');
select public.qa_assert(not has_function_privilege('authenticated','public.totus_api_server(uuid,bigint)','EXECUTE'),'Service credentials remain server only');
update private.totus_api_connections set verified_revision=revision where id=:'service_id'::uuid;
set role authenticated;
select public.totus_api_manager('activate',jsonb_build_object('id',:'service_id','expected_revision',1)) as activated \gset
select public.qa_assert(exists(select 1 from jsonb_array_elements(:'activated'::jsonb->'connections') c where c->>'id'=:'service_id' and (c->>'enabled')::boolean),'Service can activate without an artificial user');
reset role;
