-- Independent automation permissions and custom server reminders. Existing rules and delivery history are retained.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table public.ops_user_permissions drop constraint ops_user_permissions_module_check;
alter table public.ops_user_permissions add constraint ops_user_permissions_module_check check(module in ('inicio','pricing','cajas','gastos','facturacion','documentos','fiscalidad','informes','administracion','equipo','tareas','configuracion','prestashop','automatizaciones'));
alter table public.ops_role_permissions drop constraint ops_role_permissions_module_check;
alter table public.ops_role_permissions add constraint ops_role_permissions_module_check check(module in ('inicio','pricing','cajas','gastos','facturacion','documentos','fiscalidad','informes','administracion','equipo','tareas','configuracion','prestashop','automatizaciones'));
create or replace function private.totus_module_can(p_email text,p_module text,p_action text) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select case when tm.role='admin' then true
 when tm.role not in ('gerente','encargado') and p_module='administracion' then false
 else coalesce(
 case p_action when 'view' then usr.can_view when 'create' then usr.can_create when 'edit' then usr.can_edit when 'delete' then usr.can_delete when 'export' then usr.can_export else false end,
 case p_action when 'view' then rp.can_view when 'create' then rp.can_create when 'edit' then rp.can_edit when 'delete' then rp.can_delete when 'export' then rp.can_export else false end,
 case when p_module in ('prestashop','automatizaciones') then false when p_module='configuracion' then p_action='view' when p_module in ('equipo','tareas') then true
 when tm.role='gerente' then ((p_module<>'administracion' or p_action='view') and not(p_module='fiscalidad' and p_action='delete'))
 when tm.role='encargado' then (p_module<>'administracion' and (p_action='view' or(p_module='documentos' and p_action in ('create','edit')))) else false end)
 and coalesce(usr.can_view,rp.can_view,case when p_module in ('prestashop','automatizaciones') then false when p_module='configuracion' then true when p_module in ('equipo','tareas') then true when tm.role='gerente' then true when tm.role='encargado' then p_module<>'administracion' else false end) end
 from public.team_members tm join public.ops_roles r on r.code=tm.role
 left join public.ops_user_permissions usr on lower(usr.email)=lower(tm.email) and usr.module=p_module
 left join public.ops_role_permissions rp on rp.role=tm.role and rp.module=p_module
 where lower(tm.email)=lower(coalesce(p_email,'')) and tm.active limit 1),false)
 and p_module in ('inicio','pricing','cajas','gastos','facturacion','documentos','fiscalidad','informes','administracion','equipo','tareas','configuracion','prestashop','automatizaciones')
 and p_action in ('view','create','edit','delete','export')
$$;
revoke all on function private.totus_module_can(text,text,text) from public,anon,authenticated;

-- Preserve each existing explicit grant; non-admin defaults remain denied.
insert into public.ops_user_permissions(email,module,can_view,can_create,can_edit,can_delete,can_export)
select email,'automatizaciones',can_view,can_create,can_edit,can_delete,can_export from public.ops_user_permissions where module='prestashop'
on conflict(email,module) do nothing;
insert into public.ops_role_permissions(role,module,can_view,can_create,can_edit,can_delete,can_export)
select role,'automatizaciones',can_view,can_create,can_edit,can_delete,can_export from public.ops_role_permissions where module='prestashop'
on conflict(role,module) do nothing;
alter table private.totus_prestashop_automations add column if not exists message text not null default '' check(length(message)<=4000);
create or replace function private.totus_prestashop_rule_allowed(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.totus_prestashop_automations a join auth.users u on u.id=a.owner_id
 join public.team_members t on lower(t.email)=lower(u.email) and t.active
 join public.ops_chat_channels c on c.id=a.channel_id and not c.archived and c.deleted_at is null
 join public.ops_chat_members m on m.channel_id=c.id and m.email=lower(u.email)
 where a.id=p_id and a.enabled and a.deleted_at is null
 and(private.totus_module_can(u.email,'automatizaciones','create') or private.totus_module_can(u.email,'automatizaciones','edit')) and private.totus_module_can(u.email,'equipo','create') and (a.recipe='reminder' or private.totus_module_can(u.email,'prestashop','view')))
$$;
revoke all on function private.totus_prestashop_rule_allowed(uuid) from public,anon,authenticated;

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
   if (case when p_data->>'recipe'='reminder' then cardinality(shops)<>0 else cardinality(shops) not between 1 and 2 end) or not shops<@array['hortimatic','newoldsmok'] then raise exception 'Tienda no permitida.';end if;
   if coalesce(p_data->>'recipe','') not in ('reminder','online_orders','sales_summary','missing_ean','attributes','category_stock','sales_window','variant_price','variant_stock','inactive_categories','suspicious_names','product_variant_ean','zero_price','duplicate_ean','variant_ean','duplicate_name','missing_reference','missing_weight','missing_image','duplicate_reference','product_count') then raise exception 'Consulta no disponible.';end if;
   if coalesce((p_data->>'min_count')::integer,-1) not between 0 and 1000000 or coalesce((p_data->>'period_days')::integer,0) not between 1 and 365 or coalesce(p_data->>'daily_start','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(p_data->>'daily_end','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Revisa umbral, periodo y horas.';end if;
   if p_data->>'recipe'='reminder' then
    if length(trim(coalesce(p_data->>'message','')))<3 or length(p_data->>'message')>4000 then raise exception 'Escribe un aviso de entre 3 y 4000 caracteres.';end if;
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
revoke all on function public.totus_prestashop_automations(text,jsonb) from public,anon;
grant execute on function public.totus_prestashop_automations(text,jsonb) to authenticated;

create or replace function public.totus_prestashop_job_deliver(p_job uuid,p_store text,p_order text,p_body text) returns jsonb language plpgsql security definer set search_path='' as $$
declare j private.totus_prestashop_jobs;a private.totus_prestashop_automations;msg uuid;actor text;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Servicio no autorizado.';end if;
 select * into strict j from private.totus_prestashop_jobs where id=p_job for update;
 select * into strict a from private.totus_prestashop_automations where id=j.automation_id;
 if j.status<>'working' or j.expires_at<now() or a.revision<>j.revision or not private.totus_prestashop_rule_allowed(a.id) then raise exception 'Ejecución o permiso no vigente.';end if;
 if (a.recipe='reminder' and p_store is distinct from 'general') or (a.recipe<>'reminder' and not p_store=any(a.stores)) or p_order!~'^(report:[0-9]{1,18}:[0-9]{14}|[0-9]{1,15})$' or length(p_body) not between 1 and 12000 then raise exception 'Aviso no válido.';end if;
 select message_id into msg from private.totus_prestashop_deliveries where automation_id=a.id and store=p_store and order_id=p_order;
 if found then return jsonb_build_object('duplicate',true,'message_id',msg);end if;
 insert into public.ops_chat_messages(channel_id,author_id,author_kind,author_email,client_id,body)
 values(a.channel_id,null,'system','automatizaciones@totuscentral.invalid',gen_random_uuid(),p_body) returning id into msg;
 insert into private.totus_prestashop_deliveries(automation_id,store,order_id,message_id) values(a.id,p_store,p_order,msg);
 select lower(email) into actor from auth.users where id=a.owner_id;
 insert into public.ops_chat_events(channel_id,actor_email,action,entity_id,detail) values(a.channel_id,actor,case when a.recipe='reminder' then 'general_automation_notice' else 'prestashop_automation_notice' end,msg,jsonb_build_object('automation_id',a.id,'store',p_store,'order_id',p_order));
 return jsonb_build_object('duplicate',false,'message_id',msg);
end $$;


create or replace function private.totus_validate_appearance(p_section text,p_config jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare schema jsonb='{"interfaz":{"navigationMode":{"type":"select","options":["expanded","compact"]},"startModule":{"type":"select","options":["inicio","pricing","cajas","gastos","facturacion","cotejos","tareas","equipo","documentos","fiscalidad","informes","administracion","configuracion","clientes","proveedores","marcas","prestashop","automatizaciones"]},"brandName":{"type":"text","max":32},"brandSubtitle":{"type":"text","max":90},"logoMode":{"type":"select","options":["tf","hortimatic","newoldsmok","uploaded"]},"customLogoData":{"type":"image","max":350000},"logoHeight":{"type":"range","min":28,"max":64},"backgroundMode":{"type":"select","options":["color","image"]},"customBackgroundData":{"type":"image","max":350000},"backgroundDim":{"type":"range","min":0,"max":90},"theme":{"type":"select","options":["light","dark"]},"primary":{"type":"color"},"secondary":{"type":"color"},"accent":{"type":"color"},"bg":{"type":"color"},"surface":{"type":"color"},"card":{"type":"color"},"text":{"type":"color"},"muted":{"type":"color"},"density":{"type":"select","options":["compact","comfortable","wide"]},"shadow":{"type":"select","options":["none","soft","strong"]},"sidebarWidth":{"type":"range","min":240,"max":330},"topbarHeight":{"type":"range","min":56,"max":88},"fontSize":{"type":"range","min":13,"max":16},"pagePad":{"type":"range","min":12,"max":36},"gap":{"type":"range","min":8,"max":28},"radius":{"type":"range","min":8,"max":28},"buttonRadius":{"type":"range","min":6,"max":24},"cardPadding":{"type":"range","min":12,"max":24},"tableRowHeight":{"type":"range","min":34,"max":52},"borderStrength":{"type":"range","min":6,"max":24},"borderColor":{"type":"color"},"borderWidth":{"type":"range","min":0,"max":3},"glowColor":{"type":"color"},"cardGlow":{"type":"range","min":0,"max":24},"buttonGlow":{"type":"range","min":0,"max":24},"hoverEffect":{"type":"select","options":["none","lift","glow"]},"buttonFinish":{"type":"select","options":["flat","gradient","gloss"]},"buttonStyle":{"type":"select","options":["rounded","soft"]},"navigationBackground":{"type":"color"},"navigationText":{"type":"color"},"navigationSectionText":{"type":"color"},"navigationActive":{"type":"color"},"navigationOrder":{"type":"text","max":500},"navigationCollapsed":{"type":"text","max":100}},"login":{"loginBrandName":{"type":"text","max":36},"loginSubtitle":{"type":"text","max":86},"loginFont":{"type":"select","options":["system","rounded","serif","mono"]},"loginLogoMode":{"type":"select","options":["mark","text","uploaded"]},"loginLogoFrame":{"type":"select","options":["none","soft"]},"loginLogoWidth":{"type":"range","min":48,"max":100},"loginLogoHeight":{"type":"range","min":42,"max":110},"loginAlign":{"type":"select","options":["left","center"]},"customLogoData":{"type":"image","max":350000},"loginCardPreset":{"type":"select","options":["solid","transparent","glass","dark","light"]},"loginCardColor":{"type":"color"},"loginCardOpacity":{"type":"range","min":45,"max":100},"loginCardRadius":{"type":"range","min":10,"max":34},"loginCardShadow":{"type":"select","options":["none","soft","strong"]},"loginButtonMode":{"type":"select","options":["gradient","solid","outline"]},"loginButtonColor":{"type":"color"},"loginTextColor":{"type":"color"},"loginBorderColor":{"type":"color"},"loginCardWidth":{"type":"range","min":360,"max":520},"loginCardPadding":{"type":"range","min":18,"max":36},"loginBackground":{"type":"select","options":["dark-gradient","light-clean","totus-corporate","tech-soft","gold-night","uploaded"]},"loginBorderWidth":{"type":"range","min":0,"max":3},"loginGlowColor":{"type":"color"},"loginCardGlow":{"type":"range","min":0,"max":24},"loginButtonGlow":{"type":"range","min":0,"max":24},"loginBackgroundDim":{"type":"range","min":0,"max":80},"customBackgroundData":{"type":"image","max":350000},"loginHelpText":{"type":"text","max":180},"loginRecoveryText":{"type":"text","max":80}}}'::jsonb; pair record; rule jsonb;
begin
 if p_section is null or not schema?p_section then raise exception 'Sección no válida.';end if;
 if p_config is null or jsonb_typeof(p_config)<>'object' or octet_length(p_config::text)>760000 then raise exception 'Configuración no válida.';end if;
 for pair in select * from jsonb_each(p_config) loop
  rule=schema->p_section->pair.key;
  if rule is null then raise exception 'Campo de apariencia no válido: %',pair.key;end if;
  if rule->>'type'='range' then
   if jsonb_typeof(pair.value)<>'number' then raise exception 'Valor numérico no válido.';end if;
   if (pair.value#>>'{}')::numeric not between (rule->>'min')::numeric and (rule->>'max')::numeric then raise exception 'Valor fuera de rango.';end if;
  else
   if jsonb_typeof(pair.value)<>'string' then raise exception 'Texto no válido.';end if;
   if rule->>'type'='color' and (pair.value#>>'{}') !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Color no válido.';end if;
   if rule->>'type'='select' and not (rule->'options')?(pair.value#>>'{}') then raise exception 'Opción no válida.';end if;
   if rule->>'type'='text' and length(pair.value#>>'{}')>(rule->>'max')::integer then raise exception 'Texto demasiado largo.';end if;
   if rule->>'type'='image' and (length(pair.value#>>'{}')>350000 or ((pair.value#>>'{}')<>'' and (pair.value#>>'{}') !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$')) then raise exception 'Imagen no válida.';end if;
  end if;
 end loop;
 if p_section='interfaz' and ((p_config->>'logoMode'='uploaded' and coalesce(p_config->>'customLogoData','')='') or (p_config->>'backgroundMode'='image' and coalesce(p_config->>'customBackgroundData','')='')) then raise exception 'Selecciona la imagen de marca.';end if;
 if p_section='login' and ((p_config->>'loginLogoMode'='uploaded' and coalesce(p_config->>'customLogoData','')='') or (p_config->>'loginBackground'='uploaded' and coalesce(p_config->>'customBackgroundData','')='')) then raise exception 'Selecciona la imagen de marca.';end if;

end $$;
revoke all on function private.totus_validate_appearance(text,jsonb) from public,anon,authenticated;

commit;
