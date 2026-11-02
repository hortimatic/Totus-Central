begin;
insert into auth.users(id,email,raw_app_meta_data) values
 ('aaaaaaaa-1000-4000-8000-000000000001','agent-a@example.invalid','{"totus_agent":true,"totus_assistant":true}'),
 ('aaaaaaaa-1000-4000-8000-000000000002','agent-b@example.invalid','{"totus_agent":true,"totus_integration":true}');
insert into public.team_members(email,full_name,role,active) values
 ('agent-a@example.invalid','First IA','gerente',true),('agent-b@example.invalid','Second IA','gerente',true);
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
select public.qa_denied('select public.totus_agent_access_info(''agent-a@example.invalid'')','Servicio');
select public.qa_assert(not has_function_privilege('authenticated','public.totus_agent_managed_credentials(uuid)','execute'),'credentials are not callable from the browser');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.qa_assert(not (public.totus_agent_bind_account('aaaaaaaa-1000-4000-8000-000000000001','fictitious-password-a',true,'11111111-1111-4111-8111-111111111111') ? 'password'),'binding returns no password');
select public.qa_assert((public.totus_agent_access_info('agent-a@example.invalid')->>'configured')::boolean,'first identity is linked');
select public.qa_assert((public.totus_agent_access_info('agent-a@example.invalid')->>'legacy_chatgpt')::boolean,'legacy ChatGPT path uses explicitly selected account');
select public.totus_agent_bind_account('aaaaaaaa-1000-4000-8000-000000000001','fictitious-password-a',false,'11111111-1111-4111-8111-111111111111');
select public.qa_assert(not (public.totus_agent_access_info('agent-a@example.invalid')->>'legacy_chatgpt')::boolean,'unchecking compatibility revokes only this alias');
select public.qa_assert((public.totus_agent_access_info('agent-a@example.invalid')->>'configured')::boolean,'own generic access remains linked');
select public.totus_agent_bind_account('aaaaaaaa-1000-4000-8000-000000000001','fictitious-password-a',true,'11111111-1111-4111-8111-111111111111');
select public.qa_assert((select role='gerente' from public.team_members where email='agent-a@example.invalid'),'binding never promotes role');
select vault.create_secret('{"email":"agent-b@example.invalid","password":"fictitious-managed-password"}','totus_api_actor_aaaaaaaa-1000-4000-8000-000000000002');
select public.qa_assert(public.totus_agent_managed_credentials('aaaaaaaa-1000-4000-8000-000000000002')->>'email'='agent-b@example.invalid','managed credential is bound to its own user');
select public.totus_agent_bind_account('aaaaaaaa-1000-4000-8000-000000000002','fictitious-managed-password',false,'11111111-1111-4111-8111-111111111111');
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","email":"admin@example.invalid","role":"authenticated"}',true);
select public.qa_assert(jsonb_path_exists(public.totus_api_manager(), '$.** ? (@.email == "agent-a@example.invalid" && @.technical_ready == true)'),'API manager accepts linked manual identity for future provider assignment');
select public.qa_assert(not (public.totus_api_manager()::text like '%fictitious-password-a%'),'API context never exposes credentials');
select set_config('request.jwt.claims','',true);
do $test$
declare queued jsonb;ticket text;claimed jsonb;
begin
 queued=private.totus_agent_submit('agent-a@example.invalid','session_check');
 select body->>'ticket' into ticket from public.qa_net where body->>'job'=queued->>'job_id';
 claimed=public.totus_assistant_claim((queued->>'job_id')::uuid,ticket);
 perform public.qa_assert(claimed->>'action'='agent_session_check','shared worker receives normalized agent action');
 perform public.qa_assert(claimed#>>'{credentials,user_id}'='aaaaaaaa-1000-4000-8000-000000000001','queue is pinned to the exact Auth UUID');
 perform public.qa_assert(claimed#>>'{credentials,email}'='agent-a@example.invalid','no fixed email substitution');
 begin
  perform public.totus_assistant_claim((queued->>'job_id')::uuid,ticket);
  raise exception 'replayed ticket accepted';
 exception when others then
  if sqlerrm='replayed ticket accepted' then raise;end if;
 end;
 queued=private.totus_assistant_submit('session_check');
 perform public.qa_assert(queued->>'status'='queued','existing ChatGPT connector delegates to the generic own-account queue');
end
$test$;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","email":"admin@example.invalid","role":"authenticated"}',true);
select public.totus_retire_user('agent-a@example.invalid');
select public.totus_prepare_user_purge('agent-a@example.invalid');
update auth.users set email=null,deleted_at=now() where id='aaaaaaaa-1000-4000-8000-000000000001';
select public.totus_finish_user_purge('agent-a@example.invalid');
select public.qa_assert(not exists(select 1 from vault.secrets where name in ('totus_agent_credentials_aaaaaaaa-1000-4000-8000-000000000001','totus_assistant_credentials')),'purge clears per-user and legacy binding');
select public.qa_assert(exists(select 1 from vault.secrets where name='totus_agent_credentials_aaaaaaaa-1000-4000-8000-000000000002'),'other IA binding remains intact');
select set_config('request.jwt.claims','',true);
select public.qa_denied('select private.totus_agent_submit(''agent-a@example.invalid'',''session_check'')','no activa');
rollback;
select 'AGENT ACCESS DB QA OK';
