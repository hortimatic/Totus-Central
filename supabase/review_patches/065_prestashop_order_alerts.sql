-- Opt-in server-side order alerts. Configuration and delivery ledger remain private.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create table private.totus_prestashop_automations(
 id uuid primary key default gen_random_uuid(),owner_id uuid references auth.users(id) on delete set null,
 name text not null check(length(name) between 3 and 100),stores text[] not null,
 recipe text not null default 'online_orders',min_count integer not null default 1 check(min_count between 0 and 1000000),period_days integer not null default 1 check(period_days between 1 and 365),daily_start time not null default '00:00',daily_end time not null default '23:59',
 online_modules jsonb not null,channel_id uuid not null references public.ops_chat_channels(id),
 frequency text not null default 'interval' check(frequency in ('interval','daily','weekly')),at_time time not null default '09:00',weekdays integer[] not null default array[1,2,3,4,5] check(cardinality(weekdays) between 1 and 7 and weekdays<@array[0,1,2,3,4,5,6]),
 interval_hours integer not null default 2 check(interval_hours in (1,2,3,4,6,8,12,24)),
 enabled boolean not null default false,revision bigint not null default 1,
 starts_at timestamptz not null default now(),next_run_at timestamptz not null default now(),
 last_success_at timestamptz,last_error text,deleted_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create function private.totus_prestashop_next_run(p_id uuid,p_after timestamptz default now()) returns timestamptz language plpgsql stable security definer set search_path='' as $$
declare a private.totus_prestashop_automations;day date;candidate timestamptz;i integer;
begin
 select * into strict a from private.totus_prestashop_automations where id=p_id;
 if a.frequency='interval' then return p_after+make_interval(hours=>a.interval_hours);end if;
 for i in 0..7 loop
  day=(p_after at time zone 'Europe/Madrid')::date+i;
  candidate=(day+a.at_time) at time zone 'Europe/Madrid';
  if candidate>p_after and(a.frequency='daily' or extract(dow from day)::integer=any(a.weekdays)) then return candidate;end if;
 end loop;
 raise exception 'No se pudo calcular la próxima ejecución.';
end $$;
revoke all on function private.totus_prestashop_next_run(uuid,timestamptz) from public,anon,authenticated;
create table private.totus_prestashop_jobs(
 id uuid primary key default gen_random_uuid(),automation_id uuid not null references private.totus_prestashop_automations(id),revision bigint not null,
 status text not null default 'pending' check(status in ('pending','working','done','partial','failed')),
 ticket_hash text not null,window_from timestamptz not null,window_to timestamptz not null,
 created_at timestamptz not null default now(),started_at timestamptz,finished_at timestamptz,
 expires_at timestamptz not null default now()+interval '3 minutes',result jsonb,last_error text
);
create unique index totus_prestashop_one_job on private.totus_prestashop_jobs(automation_id) where status in ('pending','working');
create index totus_prestashop_due on private.totus_prestashop_automations(next_run_at) where enabled and deleted_at is null;
create index totus_prestashop_job_history on private.totus_prestashop_jobs(automation_id,created_at desc);
create table private.totus_prestashop_deliveries(
 automation_id uuid not null references private.totus_prestashop_automations(id),store text not null,order_id text not null,
 message_id uuid not null references public.ops_chat_messages(id),created_at timestamptz not null default now(),
 primary key(automation_id,store,order_id)
);
alter table private.totus_prestashop_automations enable row level security;
alter table private.totus_prestashop_jobs enable row level security;
alter table private.totus_prestashop_deliveries enable row level security;
revoke all on private.totus_prestashop_automations,private.totus_prestashop_jobs,private.totus_prestashop_deliveries from public,anon,authenticated;
-- A system notice has an explicit identity and is not attributed to an AI or a human.
alter table public.ops_chat_messages drop constraint ops_chat_messages_author_kind_check;
alter table public.ops_chat_messages add constraint ops_chat_messages_author_kind_check check(author_kind in ('human','assistant','system'));
alter table public.ops_chat_messages drop constraint ops_chat_messages_check;
alter table public.ops_chat_messages add constraint ops_chat_messages_check check(
 (author_kind='human' and author_id is not null) or
 (author_kind='assistant' and author_id is null and author_email='chatgpt@totus.invalid') or
 (author_kind='system' and author_id is null and author_email='automatizaciones@totuscentral.invalid'));

create function private.totus_prestashop_rule_allowed(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.totus_prestashop_automations a join auth.users u on u.id=a.owner_id
 join public.team_members t on lower(t.email)=lower(u.email) and t.active
 join public.ops_chat_channels c on c.id=a.channel_id and not c.archived and c.deleted_at is null
 join public.ops_chat_members m on m.channel_id=c.id and m.email=lower(u.email)
 where a.id=p_id and a.enabled and a.deleted_at is null
 and(private.totus_module_can(u.email,'prestashop','create') or private.totus_module_can(u.email,'prestashop','edit')) and private.totus_module_can(u.email,'equipo','create'))
$$;
revoke all on function private.totus_prestashop_rule_allowed(uuid) from public,anon,authenticated;

create function public.totus_prestashop_automations(p_action text default 'list',p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor text;cfg private.totus_prestashop_automations;target uuid;shops text[];shop text;module text;operation text;
begin
 select lower(email) into actor from auth.users where id=auth.uid();
 if actor is null or not private.totus_module_can(actor,'prestashop','view') then raise exception 'No tienes acceso a PrestaShop.';end if;
 if octet_length(p_data::text)>100000 or jsonb_typeof(p_data) is distinct from 'object' then raise exception 'Configuración demasiado grande o no válida.';end if;
 if p_action not in ('list','save','toggle','remove','run') then raise exception 'Acción no permitida.';end if;
 if p_action<>'list' then
  target=nullif(p_data->>'id','')::uuid;
  if target is not null then
   select * into strict cfg from private.totus_prestashop_automations where id=target and deleted_at is null for update;
   if cfg.owner_id is distinct from auth.uid() and not exists(select 1 from public.team_members where email=actor and active and role='admin') then raise exception 'Esta automatización pertenece a otra cuenta.';end if;
   if cfg.revision is distinct from (p_data->>'revision')::bigint then raise exception 'La automatización ha cambiado. Actualiza antes de guardar.';end if;
  end if;
  operation=case when p_action='remove' then 'delete' when target is null then 'create' else 'edit' end;
  if not private.totus_module_can(actor,'prestashop',operation) then raise exception 'No tienes permiso para esta operación.';end if;
  if p_action='save' then
   if length(trim(coalesce(p_data->>'name','')))<3 or length(p_data->>'name')>100 or p_data->'sharing_confirmed' is distinct from 'true'::jsonb then raise exception 'Indica el nombre y confirma el canal de destino.';end if;
   if jsonb_typeof(p_data->'stores') is distinct from 'array' or jsonb_typeof(p_data->'online_modules') is distinct from 'object' then raise exception 'Faltan tiendas u orígenes online.';end if;
   shops=array(select distinct jsonb_array_elements_text(p_data->'stores'));
   if cardinality(shops) not between 1 and 2 or not shops<@array['hortimatic','newoldsmok'] then raise exception 'Tienda no permitida.';end if;
   if coalesce(p_data->>'recipe','') not in ('online_orders','sales_summary','missing_ean','attributes','category_stock','sales_window','variant_price','variant_stock','inactive_categories','suspicious_names','product_variant_ean','zero_price','duplicate_ean','variant_ean','duplicate_name','missing_reference','missing_weight','missing_image','duplicate_reference','product_count') then raise exception 'Consulta no disponible.';end if;
   if coalesce((p_data->>'min_count')::integer,-1) not between 0 and 1000000 or coalesce((p_data->>'period_days')::integer,0) not between 1 and 365 or coalesce(p_data->>'daily_start','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(p_data->>'daily_end','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Revisa umbral, periodo y horas.';end if;
   foreach shop in array shops loop
    if p_data->>'recipe'='online_orders' then
    if jsonb_typeof(p_data->'online_modules'->shop) is distinct from 'array' or jsonb_array_length(p_data->'online_modules'->shop) not between 1 and 50 then raise exception 'Confirma los orígenes online de cada tienda.';end if;
    for module in select jsonb_array_elements_text(p_data->'online_modules'->shop) loop if module!~'^[a-zA-Z0-9_-]{1,100}$' then raise exception 'Origen de pedido no válido.';end if;end loop;
    end if;
    if (select count(*) from private.totus_api_connections c where c.protocol='prestashop' and c.name=case shop when 'hortimatic' then 'PrestaShop · Hortimatic' else 'PrestaShop · NewOldSmok' end and c.enabled and c.real_data_authorized and c.verified_revision=c.revision)<>1 then raise exception 'Activa y verifica una conexión única para cada tienda.';end if;
   end loop;
   if not exists(select 1 from public.ops_chat_channels c join public.ops_chat_members m on m.channel_id=c.id and m.email=actor where c.id=(p_data->>'channel_id')::uuid and c.channel_kind='channel' and not c.archived and c.deleted_at is null) or not private.totus_module_can(actor,'equipo','create') then raise exception 'Elige un canal activo al que tengas acceso para enviar avisos.';end if;
   if coalesce((p_data->>'interval_hours')::integer,0) not in (1,2,3,4,6,8,12,24) or jsonb_typeof(p_data->'enabled') is distinct from 'boolean' then raise exception 'Intervalo o activación no válido.';end if;
   if target is null then
    insert into private.totus_prestashop_automations(owner_id,name,stores,online_modules,channel_id,interval_hours,enabled,next_run_at)
    values(auth.uid(),trim(p_data->>'name'),shops,p_data->'online_modules',(p_data->>'channel_id')::uuid,(p_data->>'interval_hours')::integer,(p_data->>'enabled')::boolean,now()+make_interval(hours=>(p_data->>'interval_hours')::integer)) returning id into target;
   else
    update private.totus_prestashop_automations set starts_at=now(),last_success_at=null,owner_id=auth.uid(),name=trim(p_data->>'name'),stores=shops,online_modules=p_data->'online_modules',channel_id=(p_data->>'channel_id')::uuid,interval_hours=(p_data->>'interval_hours')::integer,enabled=(p_data->>'enabled')::boolean,revision=revision+1,updated_at=now(),next_run_at=now()+make_interval(hours=>(p_data->>'interval_hours')::integer) where id=target;
   end if;
   if coalesce(p_data->>'frequency','') not in ('interval','daily','weekly') or coalesce(p_data->>'at_time','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or jsonb_typeof(p_data->'weekdays') is distinct from 'array' then raise exception 'Revisa el calendario de ejecución.';end if;
   update private.totus_prestashop_automations set frequency=p_data->>'frequency',at_time=(p_data->>'at_time')::time,weekdays=array(select distinct jsonb_array_elements_text(p_data->'weekdays')::integer),recipe=p_data->>'recipe',min_count=(p_data->>'min_count')::integer,period_days=(p_data->>'period_days')::integer,daily_start=(p_data->>'daily_start')::time,daily_end=(p_data->>'daily_end')::time where id=target;
   update private.totus_prestashop_automations set next_run_at=private.totus_prestashop_next_run(id) where id=target;
  elsif p_action='toggle' then
   update private.totus_prestashop_automations set starts_at=case when not enabled then now() else starts_at end,last_success_at=case when not enabled then null else last_success_at end,enabled=not enabled,revision=revision+1,updated_at=now(),next_run_at=private.totus_prestashop_next_run(id) where id=target;
  elsif p_action='remove' then
   update private.totus_prestashop_automations set enabled=false,deleted_at=now(),revision=revision+1,updated_at=now() where id=target;
  elsif p_action='run' then
   if not cfg.enabled then raise exception 'Activa la automatización antes de comprobar ahora.';end if;
   update private.totus_prestashop_automations set next_run_at=now() where id=target;
  end if;
 end if;
 return jsonb_build_object('changed_id',target,'rules',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from private.totus_prestashop_automations a where a.deleted_at is null and(a.owner_id=auth.uid() or exists(select 1 from public.team_members where email=actor and role='admin' and active))),'[]'::jsonb),
 'channels',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'group_name',c.group_name) order by c.group_name,c.name) from public.ops_chat_channels c join public.ops_chat_members m on m.channel_id=c.id and m.email=actor where c.channel_kind='channel' and not c.archived and c.deleted_at is null),'[]'::jsonb),
 'runs',coalesce((select jsonb_agg(x) from(select j.id,j.automation_id,j.status,j.created_at,j.finished_at,j.result,j.last_error from private.totus_prestashop_jobs j join private.totus_prestashop_automations a on a.id=j.automation_id where a.owner_id=auth.uid() or exists(select 1 from public.team_members where email=actor and role='admin' and active) order by j.created_at desc limit 100)x),'[]'::jsonb));
end $$;
revoke all on function public.totus_prestashop_automations(text,jsonb) from public,anon;
grant execute on function public.totus_prestashop_automations(text,jsonb) to authenticated;

create function private.totus_prestashop_dispatch() returns integer language plpgsql security definer set search_path='' as $$
declare a private.totus_prestashop_automations;j uuid;ticket text;count_jobs integer=0;
begin
 with expired as(update private.totus_prestashop_jobs set status='failed',finished_at=now(),last_error='La ejecución caducó; se reintentará sin duplicar avisos.' where status in ('pending','working') and expires_at<now() returning automation_id) update private.totus_prestashop_automations set last_error='Ejecución caducada; reintento pendiente.',next_run_at=least(next_run_at,now()+interval '5 minutes') where id in(select automation_id from expired);
 for a in select * from private.totus_prestashop_automations where enabled and deleted_at is null and next_run_at<=now() order by next_run_at for update skip locked limit 10 loop
  if exists(select 1 from private.totus_prestashop_jobs where automation_id=a.id and status in ('pending','working')) then continue;end if;
  if not private.totus_prestashop_rule_allowed(a.id) then update private.totus_prestashop_automations set last_error='Revisa los permisos del responsable y el acceso al canal.',next_run_at=now()+interval '2 hours' where id=a.id;continue;end if;
  ticket=encode(extensions.gen_random_bytes(32),'hex');
  insert into private.totus_prestashop_jobs(automation_id,revision,ticket_hash,window_from,window_to)
  values(a.id,a.revision,encode(extensions.digest(ticket,'sha256'),'hex'),greatest(a.starts_at,coalesce(a.last_success_at,a.starts_at)-interval '2 hours'),now()) returning id into j;
  perform net.http_post(url:='https://awmojepsasikxocoeqtu.supabase.co/functions/v1/totus-prestashop-alerts',headers:='{"Content-Type":"application/json"}'::jsonb,body:=jsonb_build_object('job',j,'ticket',ticket),timeout_milliseconds:=60000);
  update private.totus_prestashop_automations set next_run_at=private.totus_prestashop_next_run(a.id) where id=a.id;count_jobs=count_jobs+1;
 end loop;
 return count_jobs;
end $$;
revoke all on function private.totus_prestashop_dispatch() from public,anon,authenticated;

create function public.totus_prestashop_job_claim(p_job uuid,p_ticket text) returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.totus_prestashop_jobs;a private.totus_prestashop_automations;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Servicio no autorizado.';end if;
 select * into j from private.totus_prestashop_jobs where id=p_job for update;
 if not found or j.status<>'pending' or j.expires_at<now() or length(coalesce(p_ticket,''))<>64 or j.ticket_hash<>encode(extensions.digest(p_ticket,'sha256'),'hex') then raise exception 'Trabajo no autorizado o caducado.';end if;
 select * into strict a from private.totus_prestashop_automations where id=j.automation_id;
 if a.revision<>j.revision or not private.totus_prestashop_rule_allowed(a.id) then raise exception 'La configuración o los permisos han cambiado.';end if;
 update private.totus_prestashop_jobs set status='working',started_at=now(),ticket_hash='' where id=j.id;
 return jsonb_build_object('job',j.id,'rule',to_jsonb(a),'slot',a.revision||':'||to_char(coalesce(a.last_success_at,a.starts_at) at time zone 'UTC','YYYYMMDDHH24MISS'),'report_from',to_char((j.window_to at time zone 'Europe/Madrid')::date-(a.period_days-1),'YYYY-MM-DD')||' 00:00:00','from',to_char(j.window_from at time zone 'Europe/Madrid','YYYY-MM-DD HH24:MI:SS'),'to',to_char(j.window_to at time zone 'Europe/Madrid','YYYY-MM-DD HH24:MI:SS'),
 'connections',(select jsonb_agg(jsonb_build_object('id',c.id,'revision',c.revision,'name',c.name,'protocol',c.protocol)) from private.totus_api_connections c where c.protocol='prestashop' and c.enabled and c.real_data_authorized and c.verified_revision=c.revision and c.name in(select case s when 'hortimatic' then 'PrestaShop · Hortimatic' else 'PrestaShop · NewOldSmok' end from unnest(a.stores)s)),
 'seen',coalesce((select jsonb_agg(jsonb_build_object('store',d.store,'id',d.order_id)) from private.totus_prestashop_deliveries d where d.automation_id=a.id and d.created_at>=j.window_from),'[]'::jsonb));
end $$;

create function public.totus_prestashop_job_deliver(p_job uuid,p_store text,p_order text,p_body text) returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.totus_prestashop_jobs;a private.totus_prestashop_automations;msg uuid;actor text;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Servicio no autorizado.';end if;
 select * into strict j from private.totus_prestashop_jobs where id=p_job for update;
 select * into strict a from private.totus_prestashop_automations where id=j.automation_id;
 if j.status<>'working' or j.expires_at<now() or a.revision<>j.revision or not private.totus_prestashop_rule_allowed(a.id) then raise exception 'Ejecución o permiso no vigente.';end if;
 if not p_store=any(a.stores) or p_order!~'^(report:[0-9]{1,18}:[0-9]{14}|[0-9]{1,15})$' or length(p_body) not between 1 and 12000 then raise exception 'Aviso no válido.';end if;
 select message_id into msg from private.totus_prestashop_deliveries where automation_id=a.id and store=p_store and order_id=p_order;
 if found then return jsonb_build_object('duplicate',true,'message_id',msg);end if;
 insert into public.ops_chat_messages(channel_id,author_id,author_kind,author_email,client_id,body)
 values(a.channel_id,null,'system','automatizaciones@totuscentral.invalid',gen_random_uuid(),p_body) returning id into msg;
 insert into private.totus_prestashop_deliveries(automation_id,store,order_id,message_id) values(a.id,p_store,p_order,msg);
 select lower(email) into actor from auth.users where id=a.owner_id;
 insert into public.ops_chat_events(channel_id,actor_email,action,entity_id,detail) values(a.channel_id,actor,'prestashop_automation_notice',msg,jsonb_build_object('automation_id',a.id,'store',p_store,'order_id',p_order));
 return jsonb_build_object('duplicate',false,'message_id',msg);
end $$;

create function public.totus_prestashop_job_finish(p_job uuid,p_status text,p_result jsonb default '{}',p_error text default null) returns void language plpgsql security definer set search_path='' as $$
declare j private.totus_prestashop_jobs;
begin
 if coalesce(auth.role(),'')<>'service_role' or coalesce(p_status,'') not in ('done','partial','failed') or octet_length(p_result::text)>10000 then raise exception 'Finalización no autorizada.';end if;
 select * into strict j from private.totus_prestashop_jobs where id=p_job for update;
 if j.status<>'working' then raise exception 'La ejecución ya no está activa.';end if;
 update private.totus_prestashop_jobs set status=p_status,finished_at=now(),result=p_result,last_error=left(p_error,500) where id=j.id;
 update private.totus_prestashop_automations set last_success_at=case when p_status='done' then j.window_to else last_success_at end,last_error=case when p_status='done' then null else left(p_error,500) end,next_run_at=case when p_status in ('partial','failed') then now()+interval '5 minutes' else next_run_at end where id=j.automation_id and revision=j.revision;
end $$;
revoke all on function public.totus_prestashop_job_claim(uuid,text),public.totus_prestashop_job_deliver(uuid,text,text,text),public.totus_prestashop_job_finish(uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.totus_prestashop_job_claim(uuid,text),public.totus_prestashop_job_deliver(uuid,text,text,text),public.totus_prestashop_job_finish(uuid,text,jsonb,text) to service_role;
select cron.schedule('totus-prestashop-online-orders','* * * * *','select private.totus_prestashop_dispatch()');
commit;
