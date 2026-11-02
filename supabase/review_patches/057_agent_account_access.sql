begin;
create or replace function public.totus_agent_managed_credentials(p_user uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u auth.users;c jsonb;
begin
 if auth.role()<>'service_role' then raise exception 'Servicio requerido';end if;
 select * into strict u from auth.users where id=p_user and deleted_at is null;
 select decrypted_secret::jsonb into c from vault.decrypted_secrets
 where name='totus_agent_credentials_'||p_user;
 if c is null and (u.raw_app_meta_data->>'totus_integration'='true' or u.raw_app_meta_data->>'totus_ai'='true' or u.raw_app_meta_data->>'totus_codex'='true') then
  select decrypted_secret::jsonb into c from vault.decrypted_secrets where name=case
   when u.raw_app_meta_data->>'totus_codex'='true' then 'totus_codex_credentials'
   when u.raw_app_meta_data->>'totus_ai'='true' then 'totus_ai_credentials'
   else 'totus_api_actor_'||p_user end;
 end if;
 if c is null or lower(c->>'email')<>lower(u.email) then raise exception 'Introduce la contraseña actual en el campo privado para vincular esta cuenta.';end if;
 return jsonb_build_object('email',u.email,'password',c->>'password');
end$$;
create or replace function public.totus_agent_bind_account(p_user uuid,p_password text,p_legacy_chatgpt boolean,p_admin uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u auth.users;owner_email text;k uuid;credentials text;
begin
 if auth.role()<>'service_role' then raise exception 'Servicio requerido';end if;
 select lower(a.email) into owner_email from auth.users a join public.team_members t on lower(t.email)=lower(a.email)
 where a.id=p_admin and a.deleted_at is null and t.active and t.role='admin' and t.deleted_at is null and t.purged_at is null;
 if owner_email is null then raise exception 'Administración activa requerida';end if;
 select * into strict u from auth.users where id=p_user and deleted_at is null;
 if p_admin=p_user then raise exception 'Utiliza una cuenta propia de IA';end if;
 if not exists(select 1 from public.team_members where lower(email)=lower(u.email) and active and deleted_at is null and purged_at is null)
 or coalesce(u.raw_app_meta_data->>'totus_agent','')<>'true' then raise exception 'Cuenta de IA no preparada';end if;
 if p_password is null or length(p_password)<1 or length(p_password)>1024 then raise exception 'Credencial no válida';end if;
 perform pg_advisory_xact_lock(hashtextextended('totus-agent-binding-'||p_user,0));
 credentials=jsonb_build_object('email',lower(u.email),'user_id',u.id,'password',p_password)::text;
 select id into k from vault.secrets where name='totus_agent_credentials_'||p_user;
 if k is null then perform vault.create_secret(credentials,'totus_agent_credentials_'||p_user,'Own authenticated IA account; never expose credentials');else perform vault.update_secret(k,credentials);end if;
 if p_legacy_chatgpt then
  select id into k from vault.secrets where name='totus_assistant_credentials';
  if k is null then perform vault.create_secret(credentials,'totus_assistant_credentials','Default account for the existing ChatGPT connector');else perform vault.update_secret(k,credentials);end if;
 end if;
 insert into public.team_user_audit_log(actor_email,target_email,action,status,detail)
 values(owner_email,lower(u.email),'agent_access_configured','ok','Sesión propia verificada; rol y permisos conservados.');
 return jsonb_build_object('configured',true,'email',lower(u.email),'user_id',u.id,'legacy_chatgpt',p_legacy_chatgpt,'message','Acceso de IA preparado con su cuenta y sus permisos.');
end$$;
create or replace function public.totus_agent_access_info(p_email text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid;configured boolean;legacy jsonb;
begin
 if auth.role()<>'service_role' then raise exception 'Servicio requerido';end if;
 select id into uid from auth.users where lower(email)=lower(btrim(p_email)) and deleted_at is null;
 select exists(select 1 from vault.secrets where name='totus_agent_credentials_'||uid) into configured;
 select decrypted_secret::jsonb into legacy from vault.decrypted_secrets where name='totus_assistant_credentials';
 return jsonb_build_object('configured',configured,'email',lower(btrim(p_email)),'user_id',uid,'legacy_chatgpt',coalesce(legacy->>'user_id'=uid::text,false));
end$$;
revoke all on function public.totus_agent_managed_credentials(uuid),public.totus_agent_bind_account(uuid,text,boolean,uuid),public.totus_agent_access_info(text) from public,anon,authenticated;
grant execute on function public.totus_agent_managed_credentials(uuid),public.totus_agent_bind_account(uuid,text,boolean,uuid),public.totus_agent_access_info(text) to service_role;

create or replace function private.totus_agent_submit(p_actor_email text,p_action text,p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare uid uuid;job uuid=gen_random_uuid();token text=encode(extensions.gen_random_bytes(32),'hex');request bigint;
begin
 if session_user<>'postgres' or current_user<>'postgres' or auth.uid() is not null then raise exception 'Conector administrativo requerido';end if;
 if p_action not in ('session_check','validate_expense','save_expense','attach_chat_file','expense_context','review_document','chat_read','chat_send','chat_direct','operation') then raise exception 'Acción no admitida';end if;
 if jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>131072 then raise exception 'Solicitud no válida o demasiado grande';end if;
 if p_action in ('save_expense','validate_expense') and nullif(p_payload#>>'{expense,request_id}','') is null then raise exception 'request_id obligatorio';end if;
 select u.id into uid from auth.users u join public.team_members t on lower(t.email)=lower(u.email)
 where lower(u.email)=lower(btrim(p_actor_email)) and u.deleted_at is null and t.active and t.deleted_at is null and t.purged_at is null;
 if uid is null then raise exception 'Cuenta propia de IA no activa';end if;
 if not exists(select 1 from vault.secrets where name='totus_agent_credentials_'||uid) then raise exception 'Vincula esta cuenta desde Administración → Usuarios → Acceso de IA.';end if;
 delete from vault.secrets where name like 'totus_assistant_job_%' and created_at<now()-interval '7 days';
 perform vault.create_secret(jsonb_build_object('actor','agent','actor_id',uid,'action','agent_'||p_action,'payload',p_payload,'token_hash',encode(extensions.digest(token,'sha256'),'hex'),'status','queued','expires_at',now()+interval '2 minutes')::text,'totus_assistant_job_'||job,'Short-lived own-account operation');
 select net.http_post(url:='https://awmojepsasikxocoeqtu.supabase.co/functions/v1/totus-assistant',headers:='{"Content-Type":"application/json"}'::jsonb,body:=jsonb_build_object('job',job,'ticket',token),timeout_milliseconds:=30000) into request;
 return jsonb_build_object('job_id',job,'http_request_id',request,'status','queued');
end$$;
revoke all on function private.totus_agent_submit(text,text,jsonb) from public,anon,authenticated,service_role;
create or replace function private.totus_assistant_submit(p_action text,p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare actor text;
begin
 if session_user<>'postgres' or current_user<>'postgres' or auth.uid() is not null then raise exception 'Conector administrativo requerido';end if;
 select decrypted_secret::jsonb->>'email' into actor from vault.decrypted_secrets where name='totus_assistant_credentials';
 if actor is null then raise exception 'Selecciona la cuenta ChatGPT en Administración → Usuarios → Acceso de IA y activa su compatibilidad con el conector ChatGPT.';end if;
 return private.totus_agent_submit(actor,p_action,p_payload);
end$$;
revoke all on function private.totus_assistant_submit(text,jsonb) from public,anon,authenticated,service_role;

create or replace function public.totus_assistant_claim(p_job uuid,p_ticket text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job_id uuid;data jsonb;credentials jsonb;credential_name text;
begin
 if length(coalesce(p_ticket,''))<>64 then raise exception 'Solicitud no autorizada';end if;
 perform pg_advisory_xact_lock(hashtextextended('totus_assistant_job_'||p_job,0));
 select id into job_id from vault.secrets where name='totus_assistant_job_'||p_job;
 select decrypted_secret::jsonb into data from vault.decrypted_secrets where id=job_id;
 if data is null or data->>'status'<>'queued' or (data->>'expires_at')::timestamptz<now() or data->>'token_hash'<>encode(extensions.digest(p_ticket,'sha256'),'hex') then raise exception 'Solicitud no autorizada o caducada';end if;
 if data->>'actor'='agent' then
  if data->>'action' not like 'agent_%' or coalesce(data->>'actor_id','')!~'^[a-f0-9-]{36}$' then raise exception 'Identidad y acción no coinciden';end if;
  credential_name='totus_agent_credentials_'||(data->>'actor_id');
 else
  if coalesce(data->>'actor','chatgpt') not in ('codex','chatgpt') then raise exception 'Identidad no admitida';end if;
  if (data->>'actor'='codex') is distinct from ((data->>'action') like 'codex_%') then
   if data->>'actor'='codex' or data->>'action' like 'codex_%' then raise exception 'Identidad y acción no coinciden';end if;
  end if;
  credential_name=case when data->>'actor'='codex' then 'totus_codex_credentials' else 'totus_assistant_credentials' end;
 end if;
 select decrypted_secret::jsonb into credentials from vault.decrypted_secrets where name=credential_name;
 if credentials is null or data->>'actor'='agent' and credentials->>'user_id' is distinct from data->>'actor_id' then raise exception 'Configuración no disponible o identidad cambiada';end if;
 perform vault.update_secret(job_id,(data||jsonb_build_object('status','running'))::text);
 return jsonb_build_object('action',data->>'action','payload',data->'payload','credentials',credentials);
end$$;
revoke all on function public.totus_assistant_claim(uuid,text) from public,anon,authenticated;
grant execute on function public.totus_assistant_claim(uuid,text) to service_role;

create or replace function private.totus_purge_agent_binding() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.purged_at is not null then
  delete from vault.secrets where name='totus_agent_credentials_'||new.purge_auth_id;
  delete from vault.secrets where name='totus_assistant_credentials' and id in(select id from vault.decrypted_secrets where name='totus_assistant_credentials' and lower(decrypted_secret::jsonb->>'email')=lower(new.email));
 end if;
 return new;
end$$;
revoke all on function private.totus_purge_agent_binding() from public,anon,authenticated;
create trigger totus_purge_agent_binding after update of purged_at on public.team_members for each row execute function private.totus_purge_agent_binding();

-- API-backed models and external assistants resolve the same per-user identity.
create or replace function public.totus_ai_job_config(p_job uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.totus_ai_jobs;c private.totus_ai_config;p private.totus_api_connections;uid uuid;cred jsonb;reader jsonb;
begin
 perform public.totus_ai_job_check(p_job);
 select * into j from private.totus_ai_jobs where id=p_job;
 if j.connection_id is null then return public.totus_ai_server_config();end if;
 select * into c from private.totus_ai_config where id;
 select * into p from private.totus_api_connections where id=j.connection_id;
 select id into uid from auth.users where lower(email)=j.actor_email and deleted_at is null and (raw_app_meta_data->>'totus_ai'='true' or raw_app_meta_data->>'totus_integration'='true' or raw_app_meta_data->>'totus_agent'='true');
 select decrypted_secret::jsonb into cred from vault.decrypted_secrets where name in ('totus_agent_credentials_'||uid,case when j.actor_email='totus-ai@totuscentral.invalid' then 'totus_ai_credentials' else 'totus_api_actor_'||uid end)
 order by (name='totus_agent_credentials_'||uid) desc limit 1;
 if uid is null or cred is null then raise exception 'Prepara el Acceso de IA de la cuenta asignada desde Usuarios.';end if;
 if c.reader_connection_id is not null then select public.totus_api_server(a.id,a.revision) into reader from private.totus_api_connections a where a.id=c.reader_connection_id and a.enabled and a.verified_revision=a.revision and a.free_confirmed and a.real_data_authorized;end if;
 return to_jsonb(c)||jsonb_build_object('credentials',cred,'actor_email',j.actor_email,'connection',public.totus_api_server(p.id,p.revision),'reader_connection',reader);
end$$;
revoke all on function public.totus_ai_job_config(uuid) from public,anon,authenticated;
grant execute on function public.totus_ai_job_config(uuid) to service_role;
do $adapt$
declare definition text;
begin
 select pg_get_functiondef('private.totus_api_manager(text,jsonb,text)'::regprocedure) into definition;
 definition=replace(definition,$old$s.name=case when u.email='totus-ai@totuscentral.invalid' then 'totus_ai_credentials' else 'totus_api_actor_'||u.id end$old$,$new$s.name in ('totus_agent_credentials_'||u.id,case when u.email='totus-ai@totuscentral.invalid' then 'totus_ai_credentials' else 'totus_api_actor_'||u.id end)$new$);
 definition=replace(definition,$old$u.raw_app_meta_data->>'totus_integration'='true')$old$,$new$u.raw_app_meta_data->>'totus_integration'='true' or u.raw_app_meta_data->>'totus_agent'='true')$new$);
 if position('totus_agent_credentials_' in definition)=0 then raise exception 'No se reconoció el contrato del gestor de APIs';end if;
 execute definition;
 select pg_get_functiondef('public.totus_ai_validate(text,jsonb,jsonb)'::regprocedure) into definition;
 definition=replace(definition,$old$coalesce(auth.jwt()#>>'{app_metadata,totus_integration}','')<>'true')$old$,$new$coalesce(auth.jwt()#>>'{app_metadata,totus_integration}','')<>'true' and coalesce(auth.jwt()#>>'{app_metadata,totus_agent}','')<>'true')$new$);
 if position('totus_agent' in definition)=0 then raise exception 'No se reconoció el contrato de validación';end if;
 execute definition;
end
$adapt$;
commit;
