-- Connection profiles and private credentials. No accounting rows are changed.
begin;
create table if not exists private.totus_api_connections(
 id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 120),
 protocol text not null check(protocol in ('http','prestashop','github','cloudflare','openai_compatible','anthropic','gemini')),
 endpoint text not null default '',auth_kind text not null default 'bearer' check(auth_kind in ('none','bearer','basic','header')),
 auth_header text not null default '',model text not null default '',account_id text not null default '',
 actor_email text not null references public.team_members(email),daily_limit integer not null default 30 check(daily_limit between 1 and 200),
 free_confirmed boolean not null default false,real_data_authorized boolean not null default false,
 enabled boolean not null default false,revision bigint not null default 1,verified_revision bigint,verified_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists private.totus_api_calls(
 id uuid primary key,connection_id uuid not null references private.totus_api_connections(id) on delete cascade,
 revision bigint not null,created_at timestamptz not null default now(),finished_at timestamptz,
 ok boolean,input_tokens bigint,output_tokens bigint,
 check(input_tokens is null or input_tokens>=0),check(output_tokens is null or output_tokens>=0)
);
alter table private.totus_api_connections enable row level security;
alter table private.totus_api_calls enable row level security;
revoke all on private.totus_api_connections,private.totus_api_calls from public,anon,authenticated;
create index if not exists totus_api_calls_daily on private.totus_api_calls(connection_id,created_at);
alter table private.totus_ai_config add column if not exists connection_id uuid references private.totus_api_connections(id) on delete restrict;
create or replace function private.totus_api_admin() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(private.is_admin(),false) or not private.totus_module_can(lower(auth.jwt()->>'email'),'configuracion','edit') then raise exception 'Solo administración con permiso de Configuración puede gestionar conexiones.';end if;
end;$$;
revoke all on function private.totus_api_admin() from public,anon,authenticated;
create or replace function private.totus_api_manager(p_action text default 'list',p_data jsonb default '{}',p_secret text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.totus_api_connections;before_config jsonb;next_id uuid;secret_id uuid;dirty boolean;active_id uuid;result jsonb;
begin
 perform private.totus_api_admin();
 if p_action not in ('list','save','duplicate','disable','delete','activate') or jsonb_typeof(p_data)<>'object' then raise exception 'Acción de conexión no válida.';end if;
 perform pg_advisory_xact_lock(hashtextextended('totus_api_manager',0));
 select connection_id into active_id from private.totus_ai_config where id;
 if p_action<>'list' then
  if coalesce(p_data->>'id','')<>'' then
   select * into c from private.totus_api_connections where id=(p_data->>'id')::uuid for update;
   if not found then raise exception 'La conexión ya no existe.';end if;
   if c.revision is distinct from (p_data->>'expected_revision')::bigint then raise exception 'La conexión ha cambiado. Actualiza antes de continuar.';end if;
  elsif p_action<>'save' then raise exception 'Falta la conexión.';end if;
 end if;
 if p_action='save' then
  if exists(select 1 from jsonb_object_keys(p_data) k where k not in ('id','expected_revision','name','protocol','endpoint','auth_kind','auth_header','model','account_id','actor_email','daily_limit','free_confirmed','real_data_authorized')) then raise exception 'Campos de conexión no admitidos.';end if;
  before_config=to_jsonb(c)-array['name','updated_at','revision','enabled','verified_revision','verified_at','created_at'];
  c.id=coalesce(c.id,gen_random_uuid());c.name=btrim(p_data->>'name');c.protocol=p_data->>'protocol';c.endpoint=btrim(coalesce(p_data->>'endpoint',''));c.auth_kind=coalesce(p_data->>'auth_kind','bearer');c.auth_header=btrim(coalesce(p_data->>'auth_header',''));c.model=btrim(coalesce(p_data->>'model',''));c.account_id=btrim(coalesce(p_data->>'account_id',''));c.actor_email=lower(btrim(p_data->>'actor_email'));c.daily_limit=(p_data->>'daily_limit')::integer;c.free_confirmed=coalesce((p_data->>'free_confirmed')::boolean,false);c.real_data_authorized=coalesce((p_data->>'real_data_authorized')::boolean,false);
  if c.name is null or length(c.name) not between 1 and 120 or c.protocol not in ('http','prestashop','github','cloudflare','openai_compatible','anthropic','gemini') or c.auth_kind not in ('none','bearer','basic','header') or c.daily_limit is null or c.daily_limit not between 1 and 200 then raise exception 'Revisa el nombre, tipo y límite de la conexión.';end if;
  if not exists(select 1 from public.team_members where email=c.actor_email and active) then raise exception 'Elige un usuario activo para esta conexión.';end if;
  if length(c.endpoint)>2048 or (c.endpoint<>'' and (c.endpoint!~'^https://' or c.endpoint~'[[:space:]@#]')) then raise exception 'Usa una dirección HTTPS sin credenciales ni fragmentos.';end if;
  if c.auth_kind='header' and (c.auth_header!~'^[A-Za-z][A-Za-z0-9-]{0,63}$' or lower(c.auth_header) in ('host','content-length','connection','cookie','set-cookie','forwarded','x-forwarded-for')) then raise exception 'Nombre de cabecera no permitido.';end if;
  if c.protocol='cloudflare' and c.account_id!~'^[a-f0-9]{32}$' then raise exception 'Account ID de Cloudflare no válido.';end if;
  if c.protocol in ('cloudflare','openai_compatible','anthropic','gemini') and (length(c.model) not between 1 and 200 or c.model~'[[:space:]]') then raise exception 'Indica el identificador exacto del modelo.';end if;
  if c.protocol in ('http','prestashop','openai_compatible') and c.endpoint='' then raise exception 'Falta la dirección de la API.';end if;
  if p_secret is not null and (length(p_secret) not between 1 and 8192 or p_secret~'[\r\n]') then raise exception 'La clave contiene caracteres no válidos.';end if;
  dirty=before_config is distinct from (to_jsonb(c)-array['name','updated_at','revision','enabled','verified_revision','verified_at','created_at']) or p_secret is not null;
  c.revision=coalesce(c.revision,0)+1;c.updated_at=clock_timestamp();c.created_at=coalesce(c.created_at,now());
  if dirty then c.enabled=false;c.verified_revision=null;c.verified_at=null;else c.verified_revision=case when c.verified_revision is not null then c.revision end;end if;
  insert into private.totus_api_connections select c.* on conflict(id) do update set name=excluded.name,protocol=excluded.protocol,endpoint=excluded.endpoint,auth_kind=excluded.auth_kind,auth_header=excluded.auth_header,model=excluded.model,account_id=excluded.account_id,actor_email=excluded.actor_email,daily_limit=excluded.daily_limit,free_confirmed=excluded.free_confirmed,real_data_authorized=excluded.real_data_authorized,enabled=excluded.enabled,revision=excluded.revision,verified_revision=excluded.verified_revision,verified_at=excluded.verified_at,updated_at=excluded.updated_at;
  if p_secret is not null then
   select id into secret_id from vault.secrets where name='totus_api_'||c.id;
   if secret_id is null then perform vault.create_secret(p_secret,'totus_api_'||c.id,'Private connector credential; never returned to browser');else perform vault.update_secret(secret_id,p_secret);end if;
  end if;
 elsif p_action='duplicate' then
  next_id=gen_random_uuid();insert into private.totus_api_connections(id,name,protocol,endpoint,auth_kind,auth_header,model,account_id,actor_email,daily_limit,free_confirmed,real_data_authorized) values(next_id,left(c.name,110)||' · copia',c.protocol,c.endpoint,c.auth_kind,c.auth_header,c.model,c.account_id,c.actor_email,c.daily_limit,false,false);c.id=next_id;
 elsif p_action='disable' then
  update private.totus_api_connections set enabled=false,revision=revision+1,verified_revision=case when verified_revision=revision then revision+1 end,updated_at=clock_timestamp() where id=c.id;
 elsif p_action='delete' then
  if active_id=c.id then update private.totus_ai_config set connection_id=null,enabled=false,revision=revision+1,verified_revision=null where id;end if;
  delete from vault.secrets where name='totus_api_'||c.id;
  delete from private.totus_api_connections where id=c.id;
 elsif p_action='activate' then
  if c.verified_revision is distinct from c.revision or not c.free_confirmed then raise exception 'Guarda, confirma el plan gratuito y prueba la conexión antes de activarla.';end if;
  if not exists(select 1 from public.team_members where email=c.actor_email and active) then raise exception 'El usuario asignado está desactivado.';end if;
  if c.protocol='gemini' then raise exception 'Esta conexión de Gemini está limitada a pruebas ficticias.';end if;
  update private.totus_api_connections set enabled=true,updated_at=clock_timestamp() where id=c.id;
 end if;
 if p_action in ('save','disable') and active_id=c.id then update private.totus_ai_config set enabled=false,revision=revision+1,verified_revision=null where id;end if;
 if p_action<>'list' then insert into public.ops_audit_log(user_id,user_email,area,action,detail) values(auth.uid(),lower(auth.jwt()->>'email'),'administracion','api_'||p_action,jsonb_build_object('connection_id',c.id));end if;
 select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object('configured',exists(select 1 from vault.secrets where name='totus_api_'||x.id),'calls_today',(select count(*) from private.totus_api_calls a where a.connection_id=x.id and a.created_at>=date_trunc('day',now())),'input_tokens',(select sum(input_tokens) from private.totus_api_calls a where a.connection_id=x.id and a.created_at>=date_trunc('day',now())),'output_tokens',(select sum(output_tokens) from private.totus_api_calls a where a.connection_id=x.id and a.created_at>=date_trunc('day',now()))) order by x.created_at),'[]'::jsonb) into result from private.totus_api_connections x;
 return jsonb_build_object('connections',result,'changed_id',c.id,'active_ai_connection',active_id,'actors',(select coalesce(jsonb_agg(jsonb_build_object('email',email,'name',full_name,'role',role) order by full_name),'[]'::jsonb) from public.team_members where active));
end;$$;
create or replace function public.totus_api_manager(p_action text default 'list',p_data jsonb default '{}',p_secret text default null) returns jsonb language sql security invoker set search_path='' as $$select private.totus_api_manager(p_action,p_data,p_secret)$$;
revoke all on function private.totus_api_manager(text,jsonb,text),public.totus_api_manager(text,jsonb,text) from public,anon;
grant execute on function private.totus_api_manager(text,jsonb,text),public.totus_api_manager(text,jsonb,text) to authenticated;
create or replace function public.totus_api_server(p_id uuid,p_revision bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.totus_api_connections;secret text;
begin
 select * into strict c from private.totus_api_connections where id=p_id;
 if c.revision is distinct from p_revision then raise exception 'La conexión ha cambiado.';end if;
 if not exists(select 1 from public.team_members where email=c.actor_email and active) then raise exception 'Usuario de conexión no activo.';end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='totus_api_'||c.id;
 return to_jsonb(c)||jsonb_build_object('secret',secret);
end;$$;
revoke all on function public.totus_api_server(uuid,bigint) from public,anon,authenticated;
grant execute on function public.totus_api_server(uuid,bigint) to service_role;
create or replace function public.totus_api_call(p_id uuid,p_revision bigint,p_call uuid,p_result jsonb default null) returns void language plpgsql security definer set search_path='' as $$
declare c private.totus_api_connections;
begin
 select * into strict c from private.totus_api_connections where id=p_id for update;
 if c.revision is distinct from p_revision then raise exception 'La conexión ha cambiado durante la petición.';end if;
 if p_result is null then
  if exists(select 1 from private.totus_api_calls where id=p_call) then raise exception 'La petición ya fue iniciada. No se repetirá.';end if;
  if (select count(*) from private.totus_api_calls where connection_id=p_id and created_at>=date_trunc('day',now()))>=c.daily_limit then raise exception 'Límite diario local alcanzado.';end if;
  insert into private.totus_api_calls(id,connection_id,revision) values(p_call,p_id,p_revision);
 else
  update private.totus_api_calls set finished_at=now(),ok=coalesce((p_result->>'ok')::boolean,false),input_tokens=(p_result->>'input_tokens')::bigint,output_tokens=(p_result->>'output_tokens')::bigint where id=p_call and connection_id=p_id and revision=p_revision and finished_at is null;
  if not found then raise exception 'La petición no está pendiente.';end if;
  if coalesce((p_result->>'ok')::boolean,false) then update private.totus_api_connections set verified_revision=revision,verified_at=now() where id=p_id;end if;
 end if;
end;$$;
revoke all on function public.totus_api_call(uuid,bigint,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.totus_api_call(uuid,bigint,uuid,jsonb) to service_role;
commit;
