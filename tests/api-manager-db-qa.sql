\set ON_ERROR_STOP on
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","email":"admin@example.invalid","role":"authenticated"}',false);
set role authenticated;
select public.totus_api_manager('save','{"name":"Ensayo privado","protocol":"http","endpoint":"https://example.com/api","auth_kind":"bearer","actor_email":"admin@example.invalid","daily_limit":2,"free_confirmed":true,"real_data_authorized":false}','fictional-secret-value') as created \gset
select (:'created'::jsonb->>'changed_id') as cid \gset
select public.qa_assert(position('fictional-secret-value' in :'created')=0,'secret is never returned');
select public.qa_assert(jsonb_array_length(:'created'::jsonb->'connections')=1,'created profile listed');
select public.qa_denied(format('select public.totus_api_manager(''activate'',%L)',jsonb_build_object('id',:'cid','expected_revision',1)),'prueba');
select public.qa_denied(format('select public.totus_api_manager(''disable'',%L)',jsonb_build_object('id',:'cid','expected_revision',9)),'ha cambiado');
select public.qa_denied(format('select public.totus_api_server(%L,1)',:'cid'),'permission denied');
select public.totus_api_manager('duplicate',jsonb_build_object('id',:'cid','expected_revision',1)) as copied \gset
select public.qa_assert(jsonb_array_length(:'copied'::jsonb->'connections')=2,'duplicate profile');
select public.qa_assert(not exists(select 1 from jsonb_array_elements(:'copied'::jsonb->'connections') x where x->>'id'<>:'cid' and ((x->>'configured')::boolean or (x->>'enabled')::boolean)),'duplicate starts without credential or activation');
reset role;
select public.qa_assert(public.totus_api_server(:'cid',1)->>'secret'='fictional-secret-value','server can read private credential');
select gen_random_uuid() as call1 \gset
select gen_random_uuid() as call2 \gset
select public.totus_api_call(:'cid',1,:'call1');
select public.totus_api_call(:'cid',1,:'call1','{"ok":true,"input_tokens":12,"output_tokens":1}');
select public.qa_denied(format('select public.totus_api_call(%L,1,%L)',:'cid',:'call1'),'ya fue iniciada');
select public.totus_api_call(:'cid',1,:'call2');
select public.qa_denied(format('select public.totus_api_call(%L,1,%L)',:'cid',gen_random_uuid()),'Límite');
set role authenticated;
select public.totus_api_manager('activate',jsonb_build_object('id',:'cid','expected_revision',1)) as activated \gset
select public.qa_assert((:'activated'::jsonb->'connections'->0->>'enabled')::boolean,'verified profile activated');
select public.qa_assert((:'activated'::jsonb->'connections'->0->>'calls_today')::integer=2,'local call counter');
select public.qa_assert((:'activated'::jsonb->'connections'->0->>'input_tokens')::integer=12,'observed token counter');
select public.totus_api_manager('disable',jsonb_build_object('id',:'cid','expected_revision',1));
select public.totus_api_manager('delete',jsonb_build_object('id',:'cid','expected_revision',2));
reset role;
select public.qa_assert(not exists(select 1 from vault.secrets where name='totus_api_'||:'cid'),'credential removed together with profile');
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","email":"staff@example.invalid","role":"authenticated"}',false);
set role authenticated;
select public.qa_denied('select public.totus_api_manager()','Solo administración');
reset role;
set role anon;
select public.qa_denied('select public.totus_api_manager()','permission denied');
reset role;
select 'API MANAGER DATABASE QA OK';
