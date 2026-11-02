\set ON_ERROR_STOP on
insert into auth.users(id,email,raw_app_meta_data) values('44444444-4444-4444-8444-444444444444','totus-ai@totuscentral.invalid','{"totus_ai":true}');
insert into team_members(email,role,active,full_name) values('totus-ai@totuscentral.invalid','admin',true,'Totus IA');
select public.totus_store_ai_identity('44444444-4444-4444-8444-444444444444',repeat('b',64));
select vault.create_secret(repeat('a',32),'totus_cloudflare_token');
update private.totus_ai_config set account_id=repeat('a',32),enabled=true,free_plan_confirmed=true,real_data_authorized=true,verified_revision=revision,verified_at=now(),calls_today=4,daily_limit=5;
\ir ../supabase/review_patches/045_api_agent_selection.sql
select public.qa_assert((select count(*)=1 from private.totus_api_connections),'current provider imported once');
select id as cid from private.totus_api_connections \gset
select public.qa_assert(public.totus_ai_server_config()->'connection'->>'secret'=repeat('a',32),'same server credential preserved');
select public.qa_assert(public.totus_ai_server_config()->'credentials'->>'email'='totus-ai@totuscentral.invalid','same own identity preserved');
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","email":"admin@example.invalid","role":"authenticated"}',false);
set role authenticated;
select public.totus_api_manager() as context \gset
select public.qa_assert((:'context'::jsonb->'connections'->0->>'calls_today')::integer=4,'daily counter preserved');
reset role;
select public.totus_api_call(:'cid',1,gen_random_uuid());
select public.qa_denied(format('select public.totus_api_call(%L,1,%L)',:'cid',gen_random_uuid()),'Límite');
\ir ../supabase/review_patches/045_api_agent_selection.sql
select public.qa_assert((select count(*)=1 from private.totus_api_connections),'replay does not duplicate current provider');
select 'CURRENT CLOUDFLARE PRESERVATION QA OK';
