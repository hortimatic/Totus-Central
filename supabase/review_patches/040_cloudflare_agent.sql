-- Cloud-only AI configuration and transient work queue. Business records remain in
-- their existing tables and can only be changed through their authenticated RPCs.
begin;
create or replace function public.totus_store_ai_identity(p_user uuid,p_password text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if length(coalesce(p_password,'')) not between 64 and 72 then raise exception 'Credencial técnica no válida';end if;
 if not exists(select 1 from auth.users u join public.team_members t on lower(t.email)=lower(u.email) where u.id=p_user and u.email='totus-ai@totuscentral.invalid' and u.raw_app_meta_data->>'totus_ai'='true' and t.role='admin') then raise exception 'Identidad de Totus IA requerida';end if;
 perform pg_advisory_xact_lock(hashtextextended('totus_ai_identity',0));
 if exists(select 1 from vault.secrets where name='totus_ai_credentials') then raise exception 'La identidad ya tiene credencial';end if;
 perform vault.create_secret(jsonb_build_object('email','totus-ai@totuscentral.invalid','password',p_password)::text,'totus_ai_credentials','Own Auth identity for cloud agent; never disclose');
end $$;
revoke all on function public.totus_store_ai_identity(uuid,text) from public,anon,authenticated;
grant execute on function public.totus_store_ai_identity(uuid,text) to service_role;
do $$declare definition text;begin
 select pg_get_functiondef('private.totus_codex_submit(text,jsonb)'::regprocedure) into definition;
 if position('''setup_totus_ai''' in definition)=0 then
  if position('''setup_gemini'')' in definition)=0 then raise exception 'Conector inesperado';end if;
  execute replace(definition,'''setup_gemini'')','''setup_gemini'',''setup_totus_ai'')');
 end if;
end $$;
create table if not exists private.totus_ai_config(
 id boolean primary key default true check(id), account_id text not null default '',
 enabled boolean not null default false, free_plan_confirmed boolean not null default false,
 real_data_authorized boolean not null default false, daily_limit integer not null default 30 check(daily_limit between 1 and 200),
 revision bigint not null default 0, verified_revision bigint, verified_at timestamptz,
 usage_day date not null default current_date, calls_today integer not null default 0,
 input_tokens bigint not null default 0,output_tokens bigint not null default 0
);
insert into private.totus_ai_config(id) values(true) on conflict do nothing;
create table if not exists private.totus_ai_jobs(
 id uuid primary key default gen_random_uuid(), message_id uuid not null unique references public.ops_chat_messages(id),
 requested_by uuid not null, requested_email text not null, source_hash text not null,config_revision bigint not null,
 ticket_hash text not null, status text not null default 'pending' check(status in ('pending','working','completed','failed','cancelled')),
 created_at timestamptz not null default now(),started_at timestamptz,finished_at timestamptz,
 reply_id uuid,last_error text not null default '',actions jsonb not null default '{}'::jsonb
);
alter table private.totus_ai_config enable row level security;
alter table private.totus_ai_jobs enable row level security;
revoke all on private.totus_ai_config,private.totus_ai_jobs from public,anon,authenticated;

create or replace function private.totus_ai_source_hash(p_message uuid)
returns text language sql security definer set search_path='' as $$
 select encode(extensions.digest(concat_ws('|',m.id::text,m.body,m.edited_at::text,m.deleted_at::text,m.expected_files::text,
  coalesce((select string_agg(concat_ws(':',f.id,f.sha256,f.status,f.deleted_at::text),'|' order by f.id) from public.ops_chat_files f where f.message_id=m.id),'')),'sha256'),'hex')
 from public.ops_chat_messages m where m.id=p_message
$$;
revoke all on function private.totus_ai_source_hash(uuid) from public,anon,authenticated;

create or replace function public.totus_ai_settings(p_config jsonb default null,p_token text default null,p_forget boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.totus_ai_config; secret_id uuid; changed boolean=false; configured boolean;
begin
 if auth.uid() is null or not coalesce(private.is_admin(),false) or not private.totus_module_can(lower(auth.jwt()->>'email'),'configuracion','edit') then raise exception 'Solo administración puede configurar la IA.';end if;
 select * into c from private.totus_ai_config where id for update;
 select id into secret_id from vault.secrets where name='totus_cloudflare_token';
 if p_forget then
  if secret_id is not null then perform vault.update_secret(secret_id,'');end if;
  c.enabled=false;c.verified_revision=null;changed=true;
 end if;
 if p_token is not null and p_token<>'' then
  if length(p_token)<20 or length(p_token)>200 or p_token~'[[:space:]]' then raise exception 'Token no válido.';end if;
  if secret_id is null then perform vault.create_secret(p_token,'totus_cloudflare_token','Workers AI only; never returned to clients');
  else perform vault.update_secret(secret_id,p_token);end if;
  c.enabled=false;c.verified_revision=null;changed=true;
 end if;
 if p_config is not null then
  if jsonb_typeof(p_config)<>'object' or exists(select 1 from jsonb_object_keys(p_config) k where k not in ('account_id','enabled','daily_limit','free_plan_confirmed','real_data_authorized','expected_revision')) then raise exception 'Configuración no válida.';end if;
  if (p_config->>'expected_revision')::bigint is distinct from c.revision then raise exception 'La configuración cambió. Actualiza antes de guardar.';end if;
  if coalesce(p_config->>'account_id','')!~'^[a-f0-9]{32}$' then raise exception 'Identificador de cuenta no válido.';end if;
  if c.account_id<>p_config->>'account_id' then c.verified_revision=null;c.enabled=false;end if;
  c.account_id=p_config->>'account_id';c.daily_limit=(p_config->>'daily_limit')::integer;
  if c.daily_limit not between 1 and 200 then raise exception 'Límite diario entre 1 y 200.';end if;
  c.free_plan_confirmed=coalesce((p_config->>'free_plan_confirmed')::boolean,false);
  c.real_data_authorized=coalesce((p_config->>'real_data_authorized')::boolean,false);
  if coalesce((p_config->>'enabled')::boolean,false) and (not c.free_plan_confirmed or not c.real_data_authorized or c.verified_revision is null) then raise exception 'Guarda y prueba la conexión y confirma el plan gratuito y el tratamiento de datos antes de activar.';end if;
  c.enabled=coalesce((p_config->>'enabled')::boolean,false);changed=true;
 end if;
 if changed then
  c.revision=c.revision+1;
  if c.verified_revision is not null then c.verified_revision=c.revision;end if;
  update private.totus_ai_config set account_id=c.account_id,enabled=c.enabled,free_plan_confirmed=c.free_plan_confirmed,real_data_authorized=c.real_data_authorized,daily_limit=c.daily_limit,revision=c.revision,verified_revision=c.verified_revision where id;
  insert into public.ops_audit_log(user_id,user_email,area,action,detail) values(auth.uid(),lower(auth.jwt()->>'email'),'administracion','ia_configuracion',jsonb_build_object('revision',c.revision,'enabled',c.enabled));
 end if;
 select exists(select 1 from vault.decrypted_secrets where name='totus_cloudflare_token' and length(decrypted_secret)>0) into configured;
 return jsonb_build_object('account_id',c.account_id,'enabled',c.enabled,'configured',configured,'daily_limit',c.daily_limit,'free_plan_confirmed',c.free_plan_confirmed,'real_data_authorized',c.real_data_authorized,'revision',c.revision,'verified',c.verified_revision=c.revision,'calls_today',case when c.usage_day=current_date then c.calls_today else 0 end,'input_tokens',c.input_tokens,'output_tokens',c.output_tokens,'model','@cf/mistralai/mistral-small-3.1-24b-instruct');
end $$;
revoke all on function public.totus_ai_settings(jsonb,text,boolean) from public,anon;
grant execute on function public.totus_ai_settings(jsonb,text,boolean) to authenticated;

create or replace function public.totus_ai_server_config()
returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.totus_ai_config; token text; cred jsonb;
begin
 select * into c from private.totus_ai_config where id;
 select decrypted_secret into token from vault.decrypted_secrets where name='totus_cloudflare_token';
 select decrypted_secret::jsonb into cred from vault.decrypted_secrets where name='totus_ai_credentials';
 return to_jsonb(c)||jsonb_build_object('token',token,'credentials',cred);
end $$;
revoke all on function public.totus_ai_server_config() from public,anon,authenticated;
grant execute on function public.totus_ai_server_config() to service_role;

create or replace function public.totus_ai_verify_connection(p_revision bigint,p_ok boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 update private.totus_ai_config set verified_revision=case when p_ok then revision else null end,verified_at=case when p_ok then now() else null end where id and revision=p_revision;
 if not found then raise exception 'La configuración cambió durante la prueba.';end if;
end $$;
revoke all on function public.totus_ai_verify_connection(bigint,boolean) from public,anon,authenticated;
grant execute on function public.totus_ai_verify_connection(bigint,boolean) to service_role;

create or replace function public.totus_ai_test_reserve(p_revision bigint)
returns void language plpgsql security definer set search_path='' as $$
declare c private.totus_ai_config;
begin
 select * into c from private.totus_ai_config where id for update;
 if c.revision<>p_revision or not c.free_plan_confirmed then raise exception 'Configuración modificada o plan gratuito sin confirmar.';end if;
 if c.usage_day<>current_date then c.usage_day=current_date;c.calls_today=0;end if;
 if c.calls_today>=c.daily_limit then raise exception 'Límite diario alcanzado.';end if;
 update private.totus_ai_config set usage_day=c.usage_day,calls_today=c.calls_today+1 where id;
end $$;
revoke all on function public.totus_ai_test_reserve(bigint) from public,anon,authenticated;
grant execute on function public.totus_ai_test_reserve(bigint) to service_role;

create or replace function public.totus_ai_request(p_message uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.ops_chat_messages;c public.ops_chat_channels;j private.totus_ai_jobs; ticket text; request bigint;
begin
 if auth.uid() is null or not private.is_team_member() or not private.totus_module_can(lower(auth.jwt()->>'email'),'equipo','create') then raise exception 'No tienes permiso para solicitar una operación desde Chat.';end if;
 select * into m from public.ops_chat_messages where id=p_message and deleted_at is null;
 if not found then raise exception 'Mensaje no disponible.';end if;
 select * into c from public.ops_chat_channels where id=m.channel_id and not archived and deleted_at is null;
 if not found or not exists(select 1 from public.ops_chat_members where channel_id=c.id and email=lower(auth.jwt()->>'email')) then raise exception 'No tienes acceso al canal.';end if;
 if not exists(select 1 from public.ops_chat_members where channel_id=c.id and email='totus-ai@totuscentral.invalid') then raise exception 'Invita a Totus IA al canal antes de solicitar la tarea.';end if;
 if m.author_email='totus-ai@totuscentral.invalid' then raise exception 'No se solicita trabajo sobre una respuesta de IA.';end if;
 if not exists(select 1 from private.totus_ai_config where id and enabled and free_plan_confirmed and real_data_authorized and verified_revision=revision) then raise exception 'Activa y comprueba Cloudflare en Configuración → APIs y conexiones.';end if;
 if (select count(*) from public.ops_chat_files where message_id=m.id and deleted_at is null and status='ready' and verified_at is not null)<>m.expected_files then raise exception 'Espera a que terminen de verificarse todos los adjuntos.';end if;
 ticket=encode(extensions.gen_random_bytes(32),'hex');
 insert into private.totus_ai_jobs(message_id,requested_by,requested_email,source_hash,ticket_hash,config_revision)
 values(m.id,auth.uid(),lower(auth.jwt()->>'email'),private.totus_ai_source_hash(m.id),encode(extensions.digest(ticket,'sha256'),'hex'),(select revision from private.totus_ai_config where id))
 on conflict(message_id) do nothing returning * into j;
 if not found then select * into j from private.totus_ai_jobs where message_id=m.id;return jsonb_build_object('id',j.id,'status',j.status,'error',j.last_error);end if;
 select net.http_post(url:='https://awmojepsasikxocoeqtu.supabase.co/functions/v1/totus-ai',headers:='{"Content-Type":"application/json"}'::jsonb,body:=jsonb_build_object('job',j.id,'ticket',ticket),timeout_milliseconds:=60000) into request;
 return jsonb_build_object('id',j.id,'status',j.status);
end $$;
revoke all on function public.totus_ai_request(uuid) from public,anon;
grant execute on function public.totus_ai_request(uuid) to authenticated;

create or replace function public.totus_ai_claim(p_job uuid,p_ticket text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.totus_ai_jobs;m public.ops_chat_messages;
begin
 select * into j from private.totus_ai_jobs where id=p_job for update;
 if not found or j.status<>'pending' or j.created_at<now()-interval '2 minutes' or length(coalesce(p_ticket,''))<>64 or j.ticket_hash<>encode(extensions.digest(p_ticket,'sha256'),'hex') then raise exception 'Trabajo no autorizado o caducado.';end if;
 if j.source_hash is distinct from private.totus_ai_source_hash(j.message_id) then raise exception 'El mensaje o sus adjuntos cambiaron.';end if;
 update private.totus_ai_jobs set status='working',started_at=now(),ticket_hash='' where id=j.id;
 select * into m from public.ops_chat_messages where id=j.message_id;
 return to_jsonb(j)||jsonb_build_object('source',to_jsonb(m));
end $$;
revoke all on function public.totus_ai_claim(uuid,text) from public,anon,authenticated;
grant execute on function public.totus_ai_claim(uuid,text) to service_role;

create or replace function public.totus_ai_job_check(p_job uuid,p_module text default null,p_operation text default 'view',p_reserve boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare j private.totus_ai_jobs;m public.ops_chat_messages;c private.totus_ai_config;
begin
 select * into j from private.totus_ai_jobs where id=p_job;
 if not found or j.status<>'working' or j.started_at<now()-interval '2 minutes' then raise exception 'El trabajo ya no está activo.';end if;
 if j.source_hash is distinct from private.totus_ai_source_hash(j.message_id) then raise exception 'El mensaje o sus adjuntos cambiaron. Se ha detenido el trabajo.';end if;
 select * into m from public.ops_chat_messages where id=j.message_id and deleted_at is null;
 if not found or not exists(select 1 from public.ops_chat_channels where id=m.channel_id and not archived and deleted_at is null) then raise exception 'Canal o mensaje no disponible.';end if;
 if not exists(select 1 from auth.users where id=j.requested_by and lower(email)=j.requested_email) or not exists(select 1 from public.team_members where email=j.requested_email and active) or not exists(select 1 from public.team_members where email='totus-ai@totuscentral.invalid' and active) then raise exception 'El solicitante o la IA ya no tiene acceso.';end if;
 if not exists(select 1 from public.ops_chat_members where channel_id=m.channel_id and email=j.requested_email) or not exists(select 1 from public.ops_chat_members where channel_id=m.channel_id and email='totus-ai@totuscentral.invalid') then raise exception 'Se retiró el acceso al canal.';end if;
 if p_module is not null and not private.totus_module_can(j.requested_email,p_module,p_operation) then raise exception 'El solicitante no tiene permiso para esa operación.';end if;
 if p_module in ('gastos','cajas') and p_operation<>'view' and not exists(select 1 from public.team_members where email=j.requested_email and active and role in ('admin','gerente')) then raise exception 'Solo administración o gerencia puede guardar gastos y cierres.';end if;
 select * into c from private.totus_ai_config where id for update;
 if not c.enabled or not c.free_plan_confirmed or not c.real_data_authorized or c.verified_revision is distinct from c.revision or c.revision<>j.config_revision then raise exception 'La conexión se ha desactivado o modificado.';end if;
 if p_reserve then
  if c.usage_day<>current_date then c.usage_day=current_date;c.calls_today=0;end if;
  if c.calls_today>=c.daily_limit then raise exception 'Límite diario de IA alcanzado. No se utilizará ningún servicio de pago.';end if;
  update private.totus_ai_config set usage_day=c.usage_day,calls_today=c.calls_today+1 where id;
 end if;
end $$;
revoke all on function public.totus_ai_job_check(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.totus_ai_job_check(uuid,text,text,boolean) to service_role;

create or replace function public.totus_ai_action(p_job uuid,p_hash text,p_result jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actions jsonb;previous jsonb;
begin
 perform public.totus_ai_job_check(p_job);
 if p_hash!~'^[a-f0-9]{64}$' then raise exception 'Identificador de acción no válido.';end if;
 select j.actions into actions from private.totus_ai_jobs j where id=p_job for update;
 previous=actions->p_hash;
 if p_result is not null then
  if previous->>'status'<>'started' or octet_length(p_result::text)>150000 then raise exception 'Acción no iniciada o resultado demasiado grande.';end if;
  update private.totus_ai_jobs set actions=jsonb_set(actions,array[p_hash],jsonb_build_object('status','done','result',p_result),true) where id=p_job;
  return p_result;
 end if;
 if previous->>'status'='done' then return previous->'result';end if;
 if previous is not null then raise exception 'Resultado de guardado incierto. Comprueba los registros antes de repetir.';end if;
 update private.totus_ai_jobs set actions=jsonb_set(actions,array[p_hash],jsonb_build_object('status','started'),true) where id=p_job;
 return null;
end $$;
revoke all on function public.totus_ai_action(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.totus_ai_action(uuid,text,jsonb) to service_role;

create or replace function public.totus_ai_validate(p_kind text,p_record jsonb,p_rows jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare saved uuid; outcome jsonb; detail_text text;
begin
 if auth.uid() is null or coalesce(auth.jwt()#>>'{app_metadata,totus_ai}','')<>'true' or not private.is_manager() then raise exception 'Sesión propia de Totus IA requerida.';end if;
 if octet_length(coalesce(p_record,'{}')::text)+octet_length(coalesce(p_rows,'[]')::text)>150000 then raise exception 'Solicitud demasiado grande.';end if;
 begin
  if p_kind='expense' then
   saved=public.totus_save_expense(p_record,p_rows);
   select jsonb_build_object('record',to_jsonb(e),'rows',(select jsonb_agg(to_jsonb(l)) from public.ops_expense_lines l where l.expense_id=saved)) into outcome from public.ops_expenses e where id=saved;
  elsif p_kind='closing' then
   saved=public.totus_save_closing(p_record,p_rows);
   select jsonb_build_object('record',to_jsonb(c),'rows',(select jsonb_agg(to_jsonb(d)) from public.ops_daily_closing_drawers d where d.closing_id=saved)) into outcome from public.ops_daily_closings c where id=saved;
  else raise exception 'Tipo de validación no permitido.';end if;
  raise exception using errcode='PT002',message='Simulación revertida',detail=outcome::text;
 exception when sqlstate 'PT002' then get stacked diagnostics detail_text=pg_exception_detail;return detail_text::jsonb;
 end;
end $$;
revoke all on function public.totus_ai_validate(text,jsonb,jsonb) from public,anon;
grant execute on function public.totus_ai_validate(text,jsonb,jsonb) to authenticated;

create or replace function public.totus_ai_job_finish(p_job uuid,p_reply uuid default null,p_error text default null)
returns void language plpgsql security definer set search_path='' as $$
declare j private.totus_ai_jobs;
begin
 update private.totus_ai_jobs set status=case when p_error is null then 'completed' else 'failed' end,finished_at=now(),reply_id=p_reply,last_error=left(coalesce(p_error,''),500) where id=p_job and status='working' returning * into j;
 if not found then raise exception 'Trabajo ya cerrado.';end if;
 insert into public.ops_audit_log(user_id,user_email,area,action,detail)
 select p.id,p.email,'equipo','ia_trabajo',jsonb_build_object('job',j.id,'source_message',j.message_id,'requested_by',j.requested_by,'status',j.status,'reply_id',p_reply) from public.profiles p where p.email='totus-ai@totuscentral.invalid';
end $$;
revoke all on function public.totus_ai_job_finish(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.totus_ai_job_finish(uuid,uuid,text) to service_role;
commit;
