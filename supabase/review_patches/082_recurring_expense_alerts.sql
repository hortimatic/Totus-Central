-- Expense forecast notifications reuse the authenticated scheduler, channels and delivery ledger.
begin;
create or replace function private.totus_prestashop_rule_allowed(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.totus_prestashop_automations a join auth.users u on u.id=a.owner_id
 join public.team_members t on lower(t.email)=lower(u.email) and t.active
 join public.ops_chat_channels c on c.id=a.channel_id and not c.archived and c.deleted_at is null
 join public.ops_chat_members m on m.channel_id=c.id and m.email=lower(u.email)
 where a.id=p_id and a.enabled and a.deleted_at is null
 and(private.totus_module_can(u.email,'automatizaciones','create') or private.totus_module_can(u.email,'automatizaciones','edit')) and private.totus_module_can(u.email,'equipo','create') and (a.recipe='reminder' or (a.recipe='expense_due' and private.totus_module_can(u.email,'gastos','view')) or (a.recipe not in ('reminder','expense_due') and private.totus_module_can(u.email,'prestashop','view'))))
$$;
create or replace function public.totus_prestashop_automations(p_action text default 'list',p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor text;cfg private.totus_prestashop_automations;target uuid;shops text[];shop text;module text;operation text;
begin
 select lower(email) into actor from auth.users where id=auth.uid();
 if actor is null or not private.totus_module_can(actor,'automatizaciones','view') then raise exception 'No tienes acceso a Automatizaciones.';end if;
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
  if not private.totus_module_can(actor,'automatizaciones',operation) then raise exception 'No tienes permiso para esta operación.';end if;
  if p_action='save' then
   if length(trim(coalesce(p_data->>'name','')))<3 or length(p_data->>'name')>100 or p_data->'sharing_confirmed' is distinct from 'true'::jsonb then raise exception 'Indica el nombre y confirma el canal de destino.';end if;
   if jsonb_typeof(p_data->'stores') is distinct from 'array' or jsonb_typeof(p_data->'online_modules') is distinct from 'object' then raise exception 'Faltan tiendas u orígenes online.';end if;
   shops=array(select distinct jsonb_array_elements_text(p_data->'stores'));
   if (case when p_data->>'recipe' in ('reminder','expense_due') then cardinality(shops)<>0 else cardinality(shops) not between 1 and 2 end) or not shops<@array['hortimatic','newoldsmok'] then raise exception 'Tienda no permitida.';end if;
   if coalesce(p_data->>'recipe','') not in ('expense_due','reminder','online_orders','sales_summary','missing_ean','attributes','category_stock','sales_window','variant_price','variant_stock','inactive_categories','suspicious_names','product_variant_ean','zero_price','duplicate_ean','variant_ean','duplicate_name','missing_reference','missing_weight','missing_image','duplicate_reference','product_count') then raise exception 'Consulta no disponible.';end if;
   if coalesce((p_data->>'min_count')::integer,-1) not between 0 and 1000000 or coalesce((p_data->>'period_days')::integer,0) not between 1 and 365 or coalesce(p_data->>'daily_start','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(p_data->>'daily_end','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Revisa umbral, periodo y horas.';end if;
   if p_data->>'recipe'='reminder' then
    if length(trim(coalesce(p_data->>'message','')))<3 or length(p_data->>'message')>4000 then raise exception 'Escribe un aviso de entre 3 y 4000 caracteres.';end if;
   elsif p_data->>'recipe'='expense_due' then if not private.totus_module_can(actor,'gastos','view') then raise exception 'Necesitas permiso de Gastos para esta regla.';end if;
   elsif not private.totus_module_can(actor,'prestashop','view') then raise exception 'Necesitas permiso de consulta de PrestaShop para esta regla.';end if;
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
   update private.totus_prestashop_automations set message=case when p_data->>'recipe'='reminder' then trim(p_data->>'message') else '' end,frequency=p_data->>'frequency',at_time=(p_data->>'at_time')::time,weekdays=array(select distinct jsonb_array_elements_text(p_data->'weekdays')::integer),recipe=p_data->>'recipe',min_count=(p_data->>'min_count')::integer,period_days=(p_data->>'period_days')::integer,daily_start=(p_data->>'daily_start')::time,daily_end=(p_data->>'daily_end')::time where id=target;
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
 insert into public.ops_chat_messages(channel_id,author_id,author_kind,author_email,client_id,body)
 values(a.channel_id,null,'system','automatizaciones@totuscentral.invalid',gen_random_uuid(),p_body) returning id into msg;
 insert into private.totus_prestashop_deliveries(automation_id,store,order_id,message_id) values(a.id,p_store,p_order,msg);
 select lower(email) into actor from auth.users where id=a.owner_id;
 insert into public.ops_chat_events(channel_id,actor_email,action,entity_id,detail) values(a.channel_id,actor,case when a.recipe in ('reminder','expense_due') then 'general_automation_notice' else 'prestashop_automation_notice' end,msg,jsonb_build_object('automation_id',a.id,'store',p_store,'order_id',p_order));
 return jsonb_build_object('duplicate',false,'message_id',msg);
end $$;
create or replace function public.totus_recurring_expenses_for_job(p_job uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j private.totus_prestashop_jobs;a private.totus_prestashop_automations;result jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Servicio no autorizado.';end if;
 select * into strict j from private.totus_prestashop_jobs where id=p_job;
 select * into strict a from private.totus_prestashop_automations where id=j.automation_id;
 if a.recipe<>'expense_due' or j.status<>'working' or j.expires_at<now() or a.revision<>j.revision or not private.totus_prestashop_rule_allowed(a.id) then raise exception 'Ejecución o permiso no vigente.';end if;
 if (select count(*) from public.ops_recurring_expenses where active)>10000 then raise exception 'Demasiadas previsiones para completar el aviso.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'first_on',r.first_on,'last_on',r.last_on,'frequency',r.frequency,'notice_days',r.notice_days,'amount_cents',r.amount_cents,'active',r.active,'history',r.history,'store_name',t.name)),'[]') into result from public.ops_recurring_expenses r left join public.ops_stores t on t.id=r.store_id where r.active;
 return jsonb_build_object('today',(now() at time zone 'Europe/Madrid')::date,'rows',result);
end $$;
revoke all on function public.totus_recurring_expenses_for_job(uuid) from public,anon,authenticated;
grant execute on function public.totus_recurring_expenses_for_job(uuid) to service_role;
commit;
