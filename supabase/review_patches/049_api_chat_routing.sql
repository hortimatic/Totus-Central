begin;
alter table private.totus_ai_jobs add column if not exists connection_id uuid;
alter table private.totus_ai_jobs add column if not exists connection_revision bigint;
alter table private.totus_ai_jobs add column if not exists actor_email text;
create or replace function public.totus_ai_request(p_message uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.ops_chat_messages;c public.ops_chat_channels;j private.totus_ai_jobs; ticket text; request bigint; target private.totus_api_connections; matches integer;
begin
 if auth.uid() is null or not private.is_team_member() or not private.totus_module_can(lower(auth.jwt()->>'email'),'equipo','create') then raise exception 'No tienes permiso para solicitar una operación desde Chat.';end if;
 select * into m from public.ops_chat_messages where id=p_message and deleted_at is null;
 if not found then raise exception 'Mensaje no disponible.';end if;
 select * into c from public.ops_chat_channels where id=m.channel_id and not archived and deleted_at is null;
 if not found or not exists(select 1 from public.ops_chat_members where channel_id=c.id and email=lower(auth.jwt()->>'email')) then raise exception 'No tienes acceso al canal.';end if;
 select count(*) into matches from private.totus_api_connections p where position('@{'||p.actor_email||'}' in m.body)>0;
 if matches>1 then raise exception 'Menciona una sola IA por petición.';end if;
 if matches=1 then select * into target from private.totus_api_connections p where position('@{'||p.actor_email||'}' in m.body)>0;
 elsif to_jsonb(c)->>'channel_kind'='direct' then
  select count(*) into matches from private.totus_api_connections p join public.ops_chat_members cm on cm.email=p.actor_email and cm.channel_id=c.id;
  if matches>1 then raise exception 'Hay varias IA en este chat directo; menciona a la que debe responder.';end if;
  select p.* into target from private.totus_api_connections p join public.ops_chat_members cm on cm.email=p.actor_email and cm.channel_id=c.id;
 end if;
 if target.id is null then select p.* into target from private.totus_api_connections p join private.totus_ai_config a on a.connection_id=p.id where a.id;end if;
 if target.id is null or target.protocol not in ('cloudflare','openai_compatible','anthropic') or not target.enabled or not target.free_confirmed or not target.real_data_authorized or target.verified_revision is distinct from target.revision then raise exception 'La IA destinataria debe estar configurada, probada y activada en APIs.';end if;
 if not exists(select 1 from public.ops_chat_members where channel_id=c.id and email=target.actor_email) then raise exception 'Invita al usuario de esta IA al canal antes de pedirle trabajo.';end if;
 if exists(select 1 from auth.users u where lower(u.email)=m.author_email and (u.raw_app_meta_data->>'totus_ai'='true' or u.raw_app_meta_data->>'totus_integration'='true')) then raise exception 'No se solicita trabajo sobre una respuesta de IA.';end if;
 if (select count(*) from public.ops_chat_files where message_id=m.id and deleted_at is null and status='ready' and verified_at is not null)<>m.expected_files then raise exception 'Espera a que terminen de verificarse todos los adjuntos.';end if;
 ticket=encode(extensions.gen_random_bytes(32),'hex');
 insert into private.totus_ai_jobs(message_id,requested_by,requested_email,source_hash,ticket_hash,config_revision,connection_id,connection_revision,actor_email)
 values(m.id,auth.uid(),lower(auth.jwt()->>'email'),private.totus_ai_source_hash(m.id),encode(extensions.digest(ticket,'sha256'),'hex'),(select revision from private.totus_ai_config where id),target.id,target.revision,target.actor_email)
 on conflict(message_id) do nothing returning * into j;
 if not found then select * into j from private.totus_ai_jobs where message_id=m.id;return jsonb_build_object('id',j.id,'status',j.status,'error',j.last_error);end if;
 select net.http_post(url:='https://awmojepsasikxocoeqtu.supabase.co/functions/v1/totus-ai',headers:='{"Content-Type":"application/json"}'::jsonb,body:=jsonb_build_object('job',j.id,'ticket',ticket),timeout_milliseconds:=60000) into request;
 return jsonb_build_object('id',j.id,'status',j.status);
end $$;
create or replace function public.totus_ai_job_check(p_job uuid,p_module text default null,p_operation text default 'view',p_reserve boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare j private.totus_ai_jobs;m public.ops_chat_messages;c private.totus_ai_config;p private.totus_api_connections;actor text;
begin
 select * into j from private.totus_ai_jobs where id=p_job;
 if not found or j.status<>'working' or j.started_at<now()-interval '2 minutes' then raise exception 'El trabajo ya no está activo.';end if;
 if j.source_hash is distinct from private.totus_ai_source_hash(j.message_id) then raise exception 'El mensaje o sus adjuntos cambiaron. Se ha detenido el trabajo.';end if;
 actor=coalesce(j.actor_email,private.totus_api_ai_actor());
 select * into m from public.ops_chat_messages where id=j.message_id and deleted_at is null;
 if not found or not exists(select 1 from public.ops_chat_channels where id=m.channel_id and not archived and deleted_at is null) then raise exception 'Canal o mensaje no disponible.';end if;
 if not exists(select 1 from auth.users where id=j.requested_by and lower(email)=j.requested_email) or not exists(select 1 from public.team_members where email=j.requested_email and active) or not exists(select 1 from public.team_members where email=actor and active) then raise exception 'El solicitante o la IA ya no tiene acceso.';end if;
 if not exists(select 1 from public.ops_chat_members where channel_id=m.channel_id and email=j.requested_email) or not exists(select 1 from public.ops_chat_members where channel_id=m.channel_id and email=actor) then raise exception 'Se retiró el acceso al canal.';end if;
 if p_module is not null and not private.totus_module_can(j.requested_email,p_module,p_operation) then raise exception 'El solicitante no tiene permiso para esa operación.';end if;
 if p_module in ('gastos','cajas') and p_operation<>'view' and not exists(select 1 from public.team_members where email=j.requested_email and active and role in ('admin','gerente')) then raise exception 'Solo administración o gerencia puede guardar gastos y cierres.';end if;

 if p_module is not null and not private.totus_module_can(actor,p_module,p_operation) then raise exception 'El usuario de esta IA no tiene permiso para esa operación.';end if;
 if j.connection_id is not null then
  select * into p from private.totus_api_connections where id=j.connection_id;
  if not found or not p.enabled or not p.free_confirmed or not p.real_data_authorized or p.revision is distinct from j.connection_revision or p.verified_revision is distinct from p.revision or p.actor_email is distinct from actor then raise exception 'La conexión destinataria cambió o se desactivó.';end if;
 else
 select * into c from private.totus_ai_config where id for update;
 if not c.enabled or not c.free_plan_confirmed or not c.real_data_authorized or c.verified_revision is distinct from c.revision or c.revision<>j.config_revision then raise exception 'La conexión se ha desactivado o modificado.';end if;
 if p_reserve then
  if c.usage_day<>current_date then c.usage_day=current_date;c.calls_today=0;end if;
  if c.calls_today>=c.daily_limit then raise exception 'Límite diario de IA alcanzado. No se utilizará ningún servicio de pago.';end if;
  update private.totus_ai_config set usage_day=c.usage_day,calls_today=c.calls_today+1 where id;
 end if;
 end if;
end $$;

create or replace function public.totus_ai_job_config(p_job uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.totus_ai_jobs;c private.totus_ai_config;p private.totus_api_connections;uid uuid;cred jsonb;reader jsonb;
begin
 perform public.totus_ai_job_check(p_job);
 select * into j from private.totus_ai_jobs where id=p_job;
 if j.connection_id is null then return public.totus_ai_server_config();end if;
 select * into c from private.totus_ai_config where id;
 select * into p from private.totus_api_connections where id=j.connection_id;
 select id into uid from auth.users where lower(email)=j.actor_email and (raw_app_meta_data->>'totus_ai'='true' or raw_app_meta_data->>'totus_integration'='true');
 select decrypted_secret::jsonb into cred from vault.decrypted_secrets where name=case when j.actor_email='totus-ai@totuscentral.invalid' then 'totus_ai_credentials' else 'totus_api_actor_'||uid end;
 if uid is null or cred is null then raise exception 'Falta preparar la cuenta técnica propia de esta conexión.';end if;
 if c.reader_connection_id is not null then select public.totus_api_server(a.id,a.revision) into reader from private.totus_api_connections a where a.id=c.reader_connection_id and a.enabled and a.verified_revision=a.revision and a.free_confirmed and a.real_data_authorized;end if;
 return to_jsonb(c)||jsonb_build_object('credentials',cred,'actor_email',j.actor_email,'connection',public.totus_api_server(p.id,p.revision),'reader_connection',reader);
end $$;
revoke all on function public.totus_ai_job_config(uuid) from public,anon,authenticated;
grant execute on function public.totus_ai_job_config(uuid) to service_role;

commit;
