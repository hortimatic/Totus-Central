-- Fictitious database only. The second provider must not be captured by the global default.
alter table public.ops_chat_channels add column if not exists channel_kind text default 'channel';
select id as target_id,actor_email as target_actor from private.totus_api_connections where name='IA propia' \gset
update private.totus_api_connections set enabled=true where id=:'target_id';
insert into private.totus_api_connections(name,protocol,auth_kind,actor_email,daily_limit,enabled,free_confirmed,real_data_authorized,revision,verified_revision) values('Default distinto','cloudflare','bearer','admin@example.invalid',30,true,true,true,1,1) returning id as default_id \gset
update private.totus_ai_config set connection_id=:'default_id',connection_revision=1 where id;
insert into public.ops_chat_channels(channel_kind) values('direct') returning id as channel_id \gset
insert into public.ops_chat_members values(:'channel_id','admin@example.invalid'),(:'channel_id',:'target_actor');
insert into public.ops_chat_messages(channel_id,author_email,body) values(:'channel_id','admin@example.invalid','Solicitud ficticia') returning id as message_id \gset
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","email":"admin@example.invalid"}',false);
set role authenticated;
select public.totus_ai_request(:'message_id') as requested \gset
reset role;
select public.qa_assert((select connection_id=:'target_id' and actor_email=:'target_actor' from private.totus_ai_jobs where message_id=:'message_id'),'direct chat routes to its own provider, not global default');
select body->>'ticket' as ticket from public.qa_net order by ctid desc limit 1 \gset
select public.totus_ai_claim((:'requested'::jsonb->>'id')::uuid,:'ticket');
select public.qa_assert(public.totus_ai_job_config((:'requested'::jsonb->>'id')::uuid)->>'actor_email'=:'target_actor','runtime credentials belong to recipient');
select public.totus_ai_job_check((:'requested'::jsonb->>'id')::uuid,'gastos','view',true);
update private.totus_api_connections set enabled=false where id=:'target_id';
select public.qa_denied(format('select public.totus_ai_job_check(%L)',:'requested'::jsonb->>'id'),'desactivó');
update private.totus_api_connections set enabled=true where id=:'target_id';
delete from public.ops_chat_members where channel_id=:'channel_id' and email=:'target_actor';
select public.qa_denied(format('select public.totus_ai_job_check(%L)',:'requested'::jsonb->>'id'),'acceso');
insert into public.ops_chat_members values(:'channel_id',:'target_actor');
update public.ops_chat_channels set channel_kind='channel' where id=:'channel_id';
insert into public.ops_chat_messages(channel_id,author_email,body) values(:'channel_id','admin@example.invalid','@{'||:'target_actor'||'} petición ficticia') returning id as mentioned_message \gset
set role authenticated;
select public.totus_ai_request(:'mentioned_message');
reset role;
select public.qa_assert((select connection_id=:'target_id' from private.totus_ai_jobs where message_id=:'mentioned_message'),'mention routes without changing the default');
select 'API CHAT ROUTING QA OK';
