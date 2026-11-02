begin;
alter table private.totus_api_connections add column if not exists allow_cloudflare_reader boolean not null default false;
alter table private.totus_api_connections add column if not exists baseline_day date;
alter table private.totus_api_connections add column if not exists baseline_calls integer not null default 0 check(baseline_calls>=0);
alter table private.totus_ai_config add column if not exists connection_revision bigint;
alter table private.totus_ai_config add column if not exists reader_connection_id uuid references private.totus_api_connections(id) on delete set null;
-- Preserve the current Cloudflare connection and its actual daily counter.
do $$declare c private.totus_ai_config;profile uuid;secret text;begin
 select * into c from private.totus_ai_config where id for update;
 select decrypted_secret into secret from vault.decrypted_secrets where name='totus_cloudflare_token';
 if c.connection_id is null and c.account_id~'^[a-f0-9]{32}$' and length(secret)>0 and not exists(select 1 from private.totus_api_connections) then
  insert into private.totus_api_connections(name,protocol,auth_kind,model,account_id,actor_email,daily_limit,free_confirmed,real_data_authorized,enabled,revision,verified_revision,verified_at,allow_cloudflare_reader,baseline_day,baseline_calls)
  values('Totus IA · Cloudflare','cloudflare','bearer','@cf/mistralai/mistral-small-3.1-24b-instruct',c.account_id,'totus-ai@totuscentral.invalid',c.daily_limit,c.free_plan_confirmed,c.real_data_authorized,c.enabled,1,case when c.verified_revision=c.revision then 1 end,c.verified_at,true,c.usage_day,c.calls_today) returning id into profile;
  perform vault.create_secret(secret,'totus_api_'||profile,'Existing Cloudflare credential, moved to managed profile');
  update private.totus_ai_config set connection_id=profile,connection_revision=1,reader_connection_id=profile where id;
 end if;
end$$;
create or replace function private.totus_api_ai_actor() returns text language sql stable security definer set search_path='' as $$select coalesce((select a.actor_email from private.totus_ai_config c join private.totus_api_connections a on a.id=c.connection_id where c.id),'totus-ai@totuscentral.invalid')$$;
revoke all on function private.totus_api_ai_actor() from public,anon,authenticated;
-- Adapt only the fixed identity references; retain the original authorization and queue checks.
do $$declare name text;definition text;begin
 foreach name in array array['public.totus_ai_request(uuid)','public.totus_ai_job_check(uuid,text,text,boolean)'] loop
  select pg_get_functiondef(name::regprocedure) into definition;
  if position('private.totus_api_ai_actor()' in definition)=0 then
   if position('''totus-ai@totuscentral.invalid''' in definition)=0 then raise exception 'Unexpected AI identity definition';end if;
   definition=replace(definition,'''totus-ai@totuscentral.invalid''','private.totus_api_ai_actor()');
   definition=replace(definition,'Activa y comprueba Cloudflare en Configuración → APIs y conexiones.','Activa y comprueba el proveedor de Totus IA en Configuración → APIs.');
   execute definition;
  end if;
 end loop;
end$$;
create or replace function public.totus_api_store_actor(p_user uuid,p_password text) returns void language plpgsql security definer set search_path='' as $$
declare actor_email text;begin
 if length(coalesce(p_password,'')) not between 64 and 72 then raise exception 'Credencial técnica no válida.';end if;
 select u.email into actor_email from auth.users u join public.team_members t on lower(t.email)=lower(u.email) where u.id=p_user and t.active and u.raw_app_meta_data->>'totus_integration'='true' and u.email~'^integration-[a-f0-9-]+@totuscentral\.invalid$';
 if actor_email is null then raise exception 'La cuenta no es una identidad técnica de conexión.';end if;
 if exists(select 1 from vault.secrets where name='totus_api_actor_'||p_user) then raise exception 'La identidad ya está preparada.';end if;
 perform vault.create_secret(jsonb_build_object('email',actor_email,'password',p_password)::text,'totus_api_actor_'||p_user,'Own Auth identity; never return to client');
end;$$;
revoke all on function public.totus_api_store_actor(uuid,text) from public,anon,authenticated;
grant execute on function public.totus_api_store_actor(uuid,text) to service_role;
-- The management RPC remains the single place where administrators change profiles.
do $$declare definition text;begin
 select pg_get_functiondef('private.totus_api_manager(text,jsonb,text)'::regprocedure) into definition;
 if position('''use_ai''' in definition)=0 then
  definition=replace(definition,'''delete'',''activate'')','''delete'',''activate'',''use_ai'',''use_reader'')');
  definition=replace(definition,'''real_data_authorized''))','''real_data_authorized'',''allow_cloudflare_reader''))');
  definition=replace(definition,'c.real_data_authorized=coalesce((p_data->>''real_data_authorized'')::boolean,false);','c.real_data_authorized=coalesce((p_data->>''real_data_authorized'')::boolean,false);c.allow_cloudflare_reader=coalesce((p_data->>''allow_cloudflare_reader'')::boolean,false);');
  definition=replace(definition,'updated_at=excluded.updated_at;','updated_at=excluded.updated_at,allow_cloudflare_reader=excluded.allow_cloudflare_reader;');
  definition=replace(definition,' elsif p_action=''activate'' then',' elsif p_action in (''activate'',''use_ai'',''use_reader'') then');
  definition=replace(definition,'  update private.totus_api_connections set enabled=true,updated_at=clock_timestamp() where id=c.id;', $code$
  if p_action='use_reader' then
   if c.protocol<>'cloudflare' or not c.real_data_authorized then raise exception 'El lector requiere Cloudflare y autorización para documentos.';end if;
   update private.totus_ai_config set reader_connection_id=c.id,revision=revision+1,verified_revision=case when verified_revision=revision then revision+1 end where id;
  end if;
  if p_action='use_ai' then
   if c.protocol not in ('cloudflare','openai_compatible','anthropic') or not c.real_data_authorized then raise exception 'Confirma el tratamiento de datos y utiliza un proveedor compatible con las acciones de IA.';end if;
   if not exists(select 1 from auth.users u join vault.secrets s on s.name=case when u.email='totus-ai@totuscentral.invalid' then 'totus_ai_credentials' else 'totus_api_actor_'||u.id end where lower(u.email)=c.actor_email and (u.raw_app_meta_data->>'totus_ai'='true' or u.raw_app_meta_data->>'totus_integration'='true')) then raise exception 'Crea o elige un usuario técnico preparado para las conexiones; no se utilizan contraseñas de usuarios humanos.';end if;
   update private.totus_ai_config set connection_id=c.id,connection_revision=c.revision,enabled=true,free_plan_confirmed=c.free_confirmed,real_data_authorized=c.real_data_authorized,daily_limit=c.daily_limit,revision=revision+1,verified_revision=revision+1,usage_day=current_date,calls_today=0 where id;
   active_id=c.id;
  end if;
  update private.totus_api_connections set enabled=true,updated_at=clock_timestamp() where id=c.id;
$code$);
  definition=replace(definition,'''calls_today'',(select count(*)','''calls_today'',(case when x.baseline_day=current_date then x.baseline_calls else 0 end)+(select count(*)');
  definition=replace(definition,'''active_ai_connection'',active_id','''active_ai_connection'',active_id,''reader_connection'',(select reader_connection_id from private.totus_ai_config where id)');
  execute definition;
 end if;
end$$;
-- Baseline calls count towards the same local limit after migration.
do $$declare definition text;begin
 select pg_get_functiondef('public.totus_api_call(uuid,bigint,uuid,jsonb)'::regprocedure) into definition;
 if position('c.baseline_day' in definition)=0 then definition=replace(definition,'if (select count(*)','if (case when c.baseline_day=current_date then c.baseline_calls else 0 end)+(select count(*)');execute definition;end if;
end$$;
create or replace function public.totus_ai_server_config() returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.totus_ai_config;p private.totus_api_connections;token text;cred jsonb;actor text;uid uuid;profile jsonb;reader jsonb;
begin
 select * into c from private.totus_ai_config where id;
 select decrypted_secret into token from vault.decrypted_secrets where name='totus_cloudflare_token';
 actor=private.totus_api_ai_actor();select id into uid from auth.users where lower(email)=actor;
 select decrypted_secret::jsonb into cred from vault.decrypted_secrets where name=case when actor='totus-ai@totuscentral.invalid' then 'totus_ai_credentials' else 'totus_api_actor_'||uid end;
 if c.connection_id is not null then
  select * into p from private.totus_api_connections where id=c.connection_id;
  if p.id is null or not p.enabled or p.revision is distinct from c.connection_revision or p.verified_revision is distinct from p.revision then raise exception 'El proveedor seleccionado cambió o fue desactivado. Vuelve a seleccionarlo desde APIs.';end if;
  profile=public.totus_api_server(p.id,p.revision);
 end if;
 if c.reader_connection_id is not null then select public.totus_api_server(a.id,a.revision) into reader from private.totus_api_connections a where a.id=c.reader_connection_id and a.enabled and a.verified_revision=a.revision and a.free_confirmed and a.real_data_authorized;end if;
 return to_jsonb(c)||jsonb_build_object('token',token,'credentials',cred,'actor_email',actor,'connection',profile,'reader_connection',reader);
end;$$;
revoke all on function public.totus_ai_server_config() from public,anon,authenticated;
grant execute on function public.totus_ai_server_config() to service_role;
commit;
