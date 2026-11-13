-- Header alerts are a destination of their own, never a mandatory chat channel.
begin;
alter table private.totus_prestashop_automations add column if not exists delivery_mode text not null default 'chat' check(delivery_mode in ('chat','header'));
alter table private.totus_prestashop_automations add column if not exists interval_minutes integer not null default 2 check(interval_minutes in (1,2,5,10,30,60,120));
alter table private.totus_prestashop_automations add column if not exists offline_modules jsonb not null default '{}'::jsonb;
alter table private.totus_prestashop_deliveries add column if not exists body text check(length(body)<=12000);
create unique index if not exists totus_one_header_watch on private.totus_prestashop_automations(delivery_mode) where delivery_mode='header' and deleted_at is null;

create or replace function private.totus_prestashop_pause_orphan() returns trigger language plpgsql set search_path='' as $$
begin
 if new.owner_id is null or (new.delivery_mode='chat' and new.channel_id is null) then
  new.enabled=false;
  new.last_error=case when new.owner_id is null then 'Regla pausada: su responsable ha sido eliminado.' else 'Regla pausada: su canal ha sido eliminado.' end;
  if old.owner_id is distinct from new.owner_id or old.channel_id is distinct from new.channel_id then new.revision=old.revision+1;end if;
  new.updated_at=now();
 end if;
 return new;
end $$;

create or replace function private.totus_prestashop_rule_allowed(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.totus_prestashop_automations a join auth.users u on u.id=a.owner_id
 join public.team_members t on lower(t.email)=lower(u.email) and t.active
 where a.id=p_id and a.enabled and a.deleted_at is null
 and (private.totus_module_can(u.email,'automatizaciones','create') or private.totus_module_can(u.email,'automatizaciones','edit'))
 and case when a.delivery_mode='header' then a.recipe='online_orders' and t.role='admin' and private.totus_module_can(u.email,'ventas','view') and private.totus_module_can(u.email,'prestashop','view')
 else private.totus_module_can(u.email,'equipo','create') and exists(select 1 from public.ops_chat_channels c join public.ops_chat_members m on m.channel_id=c.id and m.email=lower(u.email) where c.id=a.channel_id and not c.archived and c.deleted_at is null)
 and (a.recipe='reminder' or (a.recipe='expense_due' and private.totus_module_can(u.email,'gastos','view')) or (a.recipe not in ('reminder','expense_due') and private.totus_module_can(u.email,'prestashop','view'))) end)
$$;
revoke all on function private.totus_prestashop_rule_allowed(uuid),private.totus_prestashop_pause_orphan() from public,anon,authenticated;

do $$declare definition text;marker text;begin
 definition=pg_get_functiondef('private.totus_prestashop_next_run(uuid,timestamptz)'::regprocedure);
 if strpos(definition,'a.delivery_mode')=0 then
  marker='if a.frequency=''interval'' then';
  if strpos(definition,marker)=0 then raise exception 'Unknown automation schedule';end if;
  execute replace(definition,marker,'if a.delivery_mode=''header'' then return p_after+make_interval(mins=>a.interval_minutes);end if; '||marker);
 end if;
end $$;

create or replace function public.totus_prestashop_job_deliver(p_job uuid,p_store text,p_order text,p_body text) returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.totus_prestashop_jobs;a private.totus_prestashop_automations;msg uuid;actor text;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Servicio no autorizado.';end if;
 select * into strict j from private.totus_prestashop_jobs where id=p_job for update;
 select * into strict a from private.totus_prestashop_automations where id=j.automation_id;
 if j.status<>'working' or j.expires_at<now() or a.revision<>j.revision or not private.totus_prestashop_rule_allowed(a.id) then raise exception 'Ejecución o permiso no vigente.';end if;
 if (a.recipe in ('reminder','expense_due') and p_store is distinct from 'general') or (a.recipe not in ('reminder','expense_due') and not p_store=any(a.stores)) or p_order!~'^(report:[0-9]{1,18}:[0-9]{14}|[0-9]{1,15})$' or length(p_body) not between 1 and 12000 then raise exception 'Aviso no válido.';end if;
 select message_id into msg from private.totus_prestashop_deliveries where automation_id=a.id and store=p_store and order_id=p_order;
 if found then return jsonb_build_object('duplicate',true,'message_id',msg);end if;
 if a.delivery_mode='header' then
  if p_order!~'^[0-9]{1,15}$' then raise exception 'Pedido no válido.';end if;
  insert into private.totus_prestashop_deliveries(automation_id,store,order_id,body) values(a.id,p_store,p_order,p_body);
  return jsonb_build_object('duplicate',false,'destination','header');
 end if;
 insert into public.ops_chat_messages(channel_id,author_id,author_kind,author_email,client_id,body)
 values(a.channel_id,null,'system','automatizaciones@totuscentral.invalid',gen_random_uuid(),p_body) returning id into msg;
 insert into private.totus_prestashop_deliveries(automation_id,store,order_id,message_id) values(a.id,p_store,p_order,msg);
 select lower(email) into actor from auth.users where id=a.owner_id;
 insert into public.ops_chat_events(channel_id,actor_email,action,entity_id,detail) values(a.channel_id,actor,case when a.recipe in ('reminder','expense_due') then 'general_automation_notice' else 'prestashop_automation_notice' end,msg,jsonb_build_object('automation_id',a.id,'store',p_store,'order_id',p_order));
 return jsonb_build_object('duplicate',false,'message_id',msg);
end $$;
revoke all on function public.totus_prestashop_job_deliver(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.totus_prestashop_job_deliver(uuid,text,text,text) to service_role;

create or replace function public.totus_online_order_watch(p_data jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid=auth.uid();actor text;cfg private.totus_prestashop_automations;shop text;v text;shops text[];target uuid;admin boolean;
begin
 if uid is null or not private.is_team_member() or not private.totus_can('ventas','view') then raise exception 'No tienes acceso a Ventas.';end if;
 select lower(email) into actor from auth.users where id=uid;
 select exists(select 1 from public.team_members where lower(email)=actor and active and role='admin') and (private.totus_can('automatizaciones','create') or private.totus_can('automatizaciones','edit')) and private.totus_can('prestashop','view') into admin;
 if p_data is not null then
  if not admin then raise exception 'Solo administración configura los avisos comunes.';end if;
  if jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>20000 or p_data-array['enabled','stores','offline_modules','interval_minutes','run_now']<>'{}'::jsonb or jsonb_typeof(p_data->'enabled') is distinct from 'boolean' or jsonb_typeof(p_data->'stores') is distinct from 'array' or jsonb_typeof(p_data->'offline_modules') is distinct from 'object' or coalesce((p_data->>'interval_minutes')::integer,0) not in (1,2,5,10,30,60,120) then raise exception 'Configuración de avisos no válida.';end if;
  shops=array(select distinct jsonb_array_elements_text(p_data->'stores'));
  if cardinality(shops) not between 1 and 2 or not shops<@array['hortimatic','newoldsmok'] then raise exception 'Elige las tiendas.';end if;
  foreach shop in array shops loop
   if jsonb_typeof(p_data->'offline_modules'->shop) is distinct from 'array' or jsonb_array_length(p_data->'offline_modules'->shop) not between 1 and 50 then raise exception 'Indica los orígenes web de cada tienda.';end if;
   for v in select jsonb_array_elements_text(p_data->'offline_modules'->shop) loop if v!~'^[a-zA-Z0-9_-]{1,100}$' then raise exception 'Origen no válido.';end if;end loop;
   if (select count(*) from private.totus_api_connections c where c.protocol='prestashop' and c.name=case shop when 'hortimatic' then 'PrestaShop · Hortimatic' else 'PrestaShop · NewOldSmok' end and c.enabled and c.real_data_authorized and c.verified_revision=c.revision)<>1 then raise exception 'Verifica la conexión de %.',shop;end if;
  end loop;
  perform pg_advisory_xact_lock(76113088);
  select * into cfg from private.totus_prestashop_automations where delivery_mode='header' and deleted_at is null for update;
  if found then
   update private.totus_prestashop_automations set owner_id=uid,stores=shops,offline_modules=p_data->'offline_modules',enabled=(p_data->>'enabled')::boolean,interval_minutes=(p_data->>'interval_minutes')::integer,revision=revision+1,updated_at=now(),last_error=null,starts_at=case when not cfg.enabled then now() else starts_at end,last_success_at=case when not cfg.enabled then null else last_success_at end,next_run_at=now() where id=cfg.id returning id into target;
  else
   insert into private.totus_prestashop_automations(owner_id,name,stores,online_modules,offline_modules,channel_id,delivery_mode,enabled,interval_minutes,next_run_at) values(uid,'Pedidos online · campana',shops,'{}',p_data->'offline_modules',null,'header',(p_data->>'enabled')::boolean,(p_data->>'interval_minutes')::integer,now()) returning id into target;
  end if;
  perform private.totus_audit('automatizaciones','actualizar',target,jsonb_build_object('destino','campana','tiendas',shops,'intervalo_minutos',p_data->'interval_minutes','activa',p_data->'enabled'));
 end if;
 select * into cfg from private.totus_prestashop_automations where delivery_mode='header' and deleted_at is null;
 return jsonb_build_object('can_configure',admin,'watch',case when cfg.id is null then null else jsonb_build_object('id',cfg.id,'enabled',cfg.enabled,'stores',cfg.stores,'offline_modules',cfg.offline_modules,'interval_minutes',cfg.interval_minutes,'next_run_at',cfg.next_run_at,'last_success_at',cfg.last_success_at,'last_error',cfg.last_error) end);
end $$;
revoke all on function public.totus_online_order_watch(jsonb) from public,anon;
grant execute on function public.totus_online_order_watch(jsonb) to authenticated;

-- Keep personal read/seen preferences and chat-channel privacy. Header-only
-- notices are shared with active users who have the explicit Ventas permission.
do $$declare definition text;marker text;begin
 definition=pg_get_functiondef('public.totus_header_online_orders(text,jsonb)'::regprocedure);
 if strpos(definition,'a.delivery_mode')=0 then
  definition=replace(definition,'and private.totus_chat_member(a.channel_id);','and (a.delivery_mode=''header'' or private.totus_chat_member(a.channel_id));');
  definition=replace(definition,'m.body,d.created_at','case when a.delivery_mode=''header'' then d.body else m.body end as body,d.created_at');
  definition=replace(definition,'join public.ops_chat_messages m','left join public.ops_chat_messages m');
  marker='and m.deleted_at is null and private.totus_chat_member(m.channel_id)';
  if strpos(definition,marker)=0 then raise exception 'Unknown header feed';end if;
  definition=replace(definition,marker,'and ((a.delivery_mode=''header'' and d.body is not null) or (a.delivery_mode=''chat'' and m.deleted_at is null and private.totus_chat_member(m.channel_id)))');
  execute definition;
 end if;
end $$;
commit;
