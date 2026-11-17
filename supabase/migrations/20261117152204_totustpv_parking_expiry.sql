-- Configurable parking/expiry. No native stock, order, money or document changes.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table private.totus_tpv_workspace_preferences add column parking_options jsonb not null default '{"enabled":true,"ttlDays":0}' check(jsonb_typeof(parking_options)='object');
alter table private.totus_tpv_drafts add column expires_at timestamptz check(expires_at is null or expires_at>=created_at);
create or replace function public.totus_tpv_workspace_preferences(p_connection uuid,p_shop bigint,p_drawer uuid,p_preferences jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); ctx jsonb; saved private.totus_tpv_workspace_preferences;
 receipt_defaults constant jsonb:='{"title":"Justificante de compra","footer":"","fontFamily":"arial","fontSize":11,"dateFormat":"native","showLogo":true,"showBarcode":false,"showUnitPrice":false,"showLineTax":false,"showOperator":false,"showWebsite":false,"showAfterSale":false,"printAfterSale":false,"showOrderReference":true,"numberLines":false,"showCustomer":false,"showCustomerPhone":false,"showCustomerEmail":false,"showAddressComment":false,"showDeliveryAddress":false,"showCustomerCompany":false,"showReferences":true,"showAddress":true,"showPhone":true,"showPayments":true,"showDiscounts":true,"showDate":true}';
 cash_defaults constant jsonb:='{"denominations":[50000,20000,10000,5000,2000,1000,500,200,100,50,20,10,5,2,1]}';
 search_defaults constant jsonb:='{"fields":["reference","ean13","upc","name"],"numericKeyboard":false}';
 catalogue_defaults constant jsonb:='{"hideUnavailable":false,"excludedCategories":[],"extraDetails":false}';
 customer_defaults constant jsonb:='{"enabled":false,"showPrices":true,"showCustomer":false,"color":"#1773c9","fontSize":23}';
begin
 if actor is null then raise exception 'TPV_AUTH_REQUIRED';end if;
 ctx:=public.totus_tpv_context();
 if ctx->>'actorId' is distinct from actor::text or not exists(
  select 1 from jsonb_array_elements(ctx->'workstations') w where w->>'connectionId'=p_connection::text
   and w->>'shopId'=p_shop::text and w->>'drawerId'=p_drawer::text and w->>'canReconcile'='true')
 then raise exception 'TPV_WORKSPACE_PREFERENCES_FORBIDDEN';end if;
 select * into saved from private.totus_tpv_workspace_preferences
  where actor_id=actor and connection_id=p_connection and shop_id=p_shop and drawer_id=p_drawer;
 if p_preferences is not null then
  if jsonb_typeof(p_preferences) is distinct from 'object' then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
  if exists(select 1 from jsonb_each(p_preferences) e where e.key in ('viewMode','sortField','sortDirection') and jsonb_typeof(e.value) is distinct from 'string'
   or e.key='initialCategoryId' and jsonb_typeof(e.value) not in ('number','string')) then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
  if jsonb_typeof(p_preferences) is distinct from 'object' or length(p_preferences::text)>4000
   or p_preferences-array['viewMode','initialCategoryId','columns','sortField','sortDirection','display','receipt','customerDisplay','cash','search','catalogue','stockPolicy','lineOptions','parking']<>'{}'::jsonb
   or coalesce(p_preferences->>'viewMode',saved.view_mode,'grid') not in ('grid','compact','list','table')
   or coalesce(p_preferences->>'initialCategoryId',saved.initial_category_id::text,'0') !~ '^(0|[1-9][0-9]{0,9})$'
   or coalesce(p_preferences->>'initialCategoryId',saved.initial_category_id::text,'0')::bigint>2147483647
   or coalesce(p_preferences->>'sortField',saved.sort_field,'name') not in ('name','reference','stock','id','cost','manufacturer','supplier','price')
   or coalesce(p_preferences->>'sortDirection',saved.sort_direction,'asc') not in ('asc','desc')
   then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
  if p_preferences?'columns' then
   if jsonb_typeof(p_preferences->'columns') is distinct from 'array' then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
   if jsonb_array_length(p_preferences->'columns') not between 1 and 11 or not (p_preferences->'columns'?'name')
    or exists(select 1 from jsonb_array_elements(p_preferences->'columns') c where jsonb_typeof(c) is distinct from 'string'
     or c#>>'{}' not in ('photo','name','reference','barcode','stock','price','netPrice','manufacturer','supplier','cost','id'))
    or (select count(distinct c) from jsonb_array_elements(p_preferences->'columns') c)<>jsonb_array_length(p_preferences->'columns')
    then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
  end if;
  if p_preferences?'display' then
   if jsonb_typeof(p_preferences->'display') is distinct from 'object' then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
   if (p_preferences->'display')-array['showPrices','showStock','showReferences','beepOnAdd','ticketNewestFirst','returnToStart','requireQuantity','layout','priceMode','variantOrder']<>'{}'::jsonb
    or exists(select 1 from jsonb_each(p_preferences->'display') e where e.key not in ('layout','priceMode','variantOrder') and jsonb_typeof(e.value) is distinct from 'boolean' or e.key='layout' and (jsonb_typeof(e.value) is distinct from 'string' or e.value#>>'{}' not in ('balanced','catalogue','ticket')) or e.key='priceMode' and (jsonb_typeof(e.value) is distinct from 'string' or e.value#>>'{}' not in ('gross','net')) or e.key='variantOrder' and (jsonb_typeof(e.value) is distinct from 'string' or e.value#>>'{}' not in ('name:asc','name:desc','stock:asc','stock:desc','price:asc','price:desc','reference:asc','reference:desc')))
    then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
  end if;
  if p_preferences?'parking' then
   if not exists(select 1 from jsonb_array_elements(ctx->'workstations') w where w->>'connectionId'=p_connection::text and w->>'shopId'=p_shop::text and w->>'drawerId'=p_drawer::text and w->>'canSell'='true')
    or not private.totus_module_can((select email from public.profiles where id=actor),'ventas','create')
    or not private.totus_module_can((select email from public.profiles where id=actor),'cajas','create') then raise exception 'TPV_PARKING_FORBIDDEN';end if;
   if jsonb_typeof(p_preferences->'parking') is distinct from 'object' then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
   if (p_preferences->'parking')-array['enabled','ttlDays']<>'{}'::jsonb or exists(select 1 from jsonb_each(p_preferences->'parking') e where e.key='enabled' and jsonb_typeof(e.value) is distinct from 'boolean' or e.key='ttlDays' and (jsonb_typeof(e.value) is distinct from 'number' or e.value::text not in ('0','1','7','15','30','90','365'))) then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
  end if;
  if p_preferences?'lineOptions' then
   if not private.totus_module_can((select email from public.profiles where id=actor),'ventas','edit') then raise exception 'TPV_PRICE_CHANGE_FORBIDDEN';end if;
   if jsonb_typeof(p_preferences->'lineOptions') is distinct from 'object' then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
   if (p_preferences->'lineOptions')-array['allowPriceChanges']<>'{}'::jsonb or exists(select 1 from jsonb_each(p_preferences->'lineOptions') e where jsonb_typeof(e.value) is distinct from 'boolean') then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
  end if;
  if p_preferences?'stockPolicy' then
   if not exists(select 1 from jsonb_array_elements(ctx->'workstations') w where w->>'connectionId'=p_connection::text and w->>'shopId'=p_shop::text and w->>'drawerId'=p_drawer::text and w->>'canSell'='true') then raise exception 'TPV_STOCK_POLICY_FORBIDDEN';end if;
   if jsonb_typeof(p_preferences->'stockPolicy') is distinct from 'object' then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
   if (p_preferences->'stockPolicy')-array['allowOutOfStock']<>'{}'::jsonb or exists(select 1 from jsonb_each(p_preferences->'stockPolicy') e where jsonb_typeof(e.value) is distinct from 'boolean') then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
  end if;
  if p_preferences?'customerDisplay' then
   if jsonb_typeof(p_preferences->'customerDisplay') is distinct from 'object' then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
   if (p_preferences->'customerDisplay')-array['enabled','showPrices','showCustomer','color','fontSize']<>'{}'::jsonb
    or exists(select 1 from jsonb_each(p_preferences->'customerDisplay') e where
     e.key in ('enabled','showPrices','showCustomer') and jsonb_typeof(e.value) is distinct from 'boolean'
     or e.key='color' and (jsonb_typeof(e.value) is distinct from 'string' or e.value#>>'{}' !~ '^#[a-fA-F0-9]{6}$')
     or e.key='fontSize' and (jsonb_typeof(e.value) is distinct from 'number' or e.value::text !~ '^(1[4-9]|[23][0-9]|40)$'))
    then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
  end if;
  if p_preferences?'cash' then
   if jsonb_typeof(p_preferences->'cash') is distinct from 'object' or (p_preferences->'cash')-array['denominations']<>'{}'::jsonb
   then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
   if p_preferences->'cash'?'denominations' then
    if jsonb_typeof(p_preferences->'cash'->'denominations') is distinct from 'array'
    then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
    if jsonb_array_length(p_preferences->'cash'->'denominations') not between 1 and 15
     or exists(select 1 from jsonb_array_elements(p_preferences->'cash'->'denominations') e
      where jsonb_typeof(e) is distinct from 'number' or e::text not in ('50000','20000','10000','5000','2000','1000','500','200','100','50','20','10','5','2','1'))
     or (select count(distinct e) from jsonb_array_elements(p_preferences->'cash'->'denominations') e)<>jsonb_array_length(p_preferences->'cash'->'denominations')
    then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
   end if;
  end if;
  if p_preferences?'search' then
   if jsonb_typeof(p_preferences->'search') is distinct from 'object' or (p_preferences->'search')-array['fields','numericKeyboard']<>'{}'::jsonb
    then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
   if p_preferences->'search'?'fields' then
    if jsonb_typeof(p_preferences->'search'->'fields') is distinct from 'array' then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
    if jsonb_array_length(p_preferences->'search'->'fields') not between 1 and 5
     or exists(select 1 from jsonb_array_elements(p_preferences->'search'->'fields') e where jsonb_typeof(e) is distinct from 'string' or e#>>'{}' not in ('reference','ean13','upc','isbn','name'))
     or (select count(distinct e) from jsonb_array_elements(p_preferences->'search'->'fields') e)<>jsonb_array_length(p_preferences->'search'->'fields')
     then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
   end if;
   if p_preferences->'search'?'numericKeyboard' and jsonb_typeof(p_preferences->'search'->'numericKeyboard') is distinct from 'boolean' then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
  end if;
  if p_preferences?'catalogue' then
   if jsonb_typeof(p_preferences->'catalogue') is distinct from 'object' or (p_preferences->'catalogue')-array['hideUnavailable','excludedCategories','extraDetails']<>'{}'::jsonb
    or exists(select 1 from jsonb_each(p_preferences->'catalogue') e where e.key in ('hideUnavailable','extraDetails') and jsonb_typeof(e.value) is distinct from 'boolean')
    then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
   if p_preferences->'catalogue'?'excludedCategories' then
    if jsonb_typeof(p_preferences->'catalogue'->'excludedCategories') is distinct from 'array' then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
    if jsonb_array_length(p_preferences->'catalogue'->'excludedCategories')>100
     or exists(select 1 from jsonb_array_elements(p_preferences->'catalogue'->'excludedCategories') e where case when jsonb_typeof(e)='number' and e::text ~ '^[1-9][0-9]{0,9}$' then (e::text)::numeric>2147483647 else true end)
     or (select count(distinct e) from jsonb_array_elements(p_preferences->'catalogue'->'excludedCategories') e)<>jsonb_array_length(p_preferences->'catalogue'->'excludedCategories')
     then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
   end if;
  end if;
  if p_preferences?'receipt' then
   if jsonb_typeof(p_preferences->'receipt') is distinct from 'object' then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
   if (p_preferences->'receipt')-array['title','footer','fontFamily','fontSize','dateFormat','showLogo','showBarcode','showUnitPrice','showLineTax','showOperator','showWebsite','showAfterSale','printAfterSale','showOrderReference','numberLines','showCustomer','showCustomerPhone','showCustomerEmail','showAddressComment','showDeliveryAddress','showCustomerCompany','showReferences','showAddress','showPhone','showPayments','showDiscounts','showDate']<>'{}'::jsonb
    or exists(select 1 from jsonb_each(p_preferences->'receipt') e where
      e.key in ('showLogo','showBarcode','showUnitPrice','showLineTax','showOperator','showWebsite','showAfterSale','printAfterSale','showOrderReference','numberLines','showCustomer','showCustomerPhone','showCustomerEmail','showAddressComment','showDeliveryAddress','showCustomerCompany','showReferences','showAddress','showPhone','showPayments','showDiscounts','showDate') and jsonb_typeof(e.value) is distinct from 'boolean'
      or e.key in ('title','footer','fontFamily','dateFormat') and jsonb_typeof(e.value) is distinct from 'string'
      or e.key='fontSize' and (jsonb_typeof(e.value) is distinct from 'number' or e.value::text !~ '^(1[0-6])$'))
    or (p_preferences->'receipt'?'title' and (length(btrim(p_preferences->'receipt'->>'title')) not between 1 and 80 or p_preferences->'receipt'->>'title' ~ '[[:cntrl:]]'))
    or (p_preferences->'receipt'?'footer' and (length(p_preferences->'receipt'->>'footer')>500 or translate(p_preferences->'receipt'->>'footer',E'\n\r\t','') ~ '[[:cntrl:]]'))
    or (p_preferences->'receipt'?'fontFamily' and p_preferences->'receipt'->>'fontFamily' not in ('arial','monospace'))
    or (p_preferences->'receipt'?'dateFormat' and p_preferences->'receipt'->>'dateFormat' not in ('native','short','long'))
    then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
  end if;
  insert into private.totus_tpv_workspace_preferences(actor_id,connection_id,shop_id,drawer_id,view_mode,initial_category_id,catalogue_columns,sort_field,sort_direction,display_options,receipt_options,customer_display_options,cash_options,search_options,catalogue_options,stock_policy,line_options,parking_options)
   values(actor,p_connection,p_shop,p_drawer,coalesce(p_preferences->>'viewMode',saved.view_mode,'grid'),
    coalesce(p_preferences->>'initialCategoryId',saved.initial_category_id::text,'0')::bigint,
    coalesce(p_preferences->'columns',saved.catalogue_columns,'["photo","name","reference","stock","price"]'),
    coalesce(p_preferences->>'sortField',saved.sort_field,'name'),coalesce(p_preferences->>'sortDirection',saved.sort_direction,'asc'),
    coalesce(saved.display_options,'{"showPrices":true,"showStock":true,"showReferences":true,"beepOnAdd":false,"ticketNewestFirst":false,"returnToStart":false,"requireQuantity":false,"layout":"balanced","priceMode":"gross","variantOrder":"name:asc"}')||coalesce(p_preferences->'display','{}'),
    coalesce(saved.receipt_options,receipt_defaults)||coalesce(p_preferences->'receipt','{}'),
    coalesce(saved.customer_display_options,customer_defaults)||coalesce(p_preferences->'customerDisplay','{}'),
    coalesce(saved.cash_options,cash_defaults)||coalesce(p_preferences->'cash','{}'),
    coalesce(saved.search_options,search_defaults)||coalesce(p_preferences->'search','{}'),
    coalesce(saved.catalogue_options,catalogue_defaults)||coalesce(p_preferences->'catalogue','{}'),
    coalesce(saved.stock_policy,'{"allowOutOfStock":false}')||coalesce(p_preferences->'stockPolicy','{}'),
    coalesce(saved.line_options,'{"allowPriceChanges":false}')||coalesce(p_preferences->'lineOptions','{}'),
    coalesce(saved.parking_options,'{"enabled":true,"ttlDays":0}')||coalesce(p_preferences->'parking','{}'))
   on conflict(actor_id,connection_id,shop_id,drawer_id) do update set view_mode=excluded.view_mode,
    initial_category_id=excluded.initial_category_id,catalogue_columns=excluded.catalogue_columns,
    sort_field=excluded.sort_field,sort_direction=excluded.sort_direction,display_options=excluded.display_options,receipt_options=excluded.receipt_options,customer_display_options=excluded.customer_display_options,cash_options=excluded.cash_options,search_options=excluded.search_options,catalogue_options=excluded.catalogue_options,stock_policy=excluded.stock_policy,line_options=excluded.line_options,parking_options=excluded.parking_options,updated_at=clock_timestamp();
  select * into saved from private.totus_tpv_workspace_preferences
   where actor_id=actor and connection_id=p_connection and shop_id=p_shop and drawer_id=p_drawer;
 end if;
 return jsonb_build_object('viewMode',coalesce(saved.view_mode,'grid'),'initialCategoryId',coalesce(saved.initial_category_id,0),
  'columns',coalesce(saved.catalogue_columns,'["photo","name","reference","stock","price"]'),
  'sortField',coalesce(saved.sort_field,'name'),'sortDirection',coalesce(saved.sort_direction,'asc'),
  'display',coalesce(saved.display_options,'{"showPrices":true,"showStock":true,"showReferences":true,"beepOnAdd":false,"ticketNewestFirst":false,"returnToStart":false,"requireQuantity":false,"layout":"balanced","priceMode":"gross","variantOrder":"name:asc"}'),
  'receipt',coalesce(saved.receipt_options,receipt_defaults),
  'customerDisplay',coalesce(saved.customer_display_options,customer_defaults),
  'cash',coalesce(saved.cash_options,cash_defaults),'search',coalesce(saved.search_options,search_defaults),'stockPolicy',coalesce(saved.stock_policy,'{"allowOutOfStock":false}'),'lineOptions',coalesce(saved.line_options,'{"allowPriceChanges":false}'),'parking',coalesce(saved.parking_options,'{"enabled":true,"ttlDays":0}'),'catalogue',coalesce(saved.catalogue_options,catalogue_defaults));
end $$;
revoke all on function public.totus_tpv_workspace_preferences(uuid,bigint,uuid,jsonb) from public,anon;
grant execute on function public.totus_tpv_workspace_preferences(uuid,bigint,uuid,jsonb) to authenticated;




-- Only the financial service may read this policy without presentation rights.
create function public.totus_tpv_parking_policy(p_scope jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.totus_tpv_check(p_scope,'sell');
 select parking_options into result from private.totus_tpv_workspace_preferences
  where actor_id=(p_scope->>'actorId')::uuid and connection_id=(p_scope->>'connectionId')::uuid and shop_id=(p_scope->>'shopId')::bigint and drawer_id=(p_scope->>'drawerId')::uuid;
 result:=coalesce(result,'{"enabled":true,"ttlDays":0}'::jsonb);
 if jsonb_typeof(result) is distinct from 'object' or result-array['enabled','ttlDays']<>'{}'::jsonb
  or jsonb_typeof(result->'enabled') is distinct from 'boolean' or jsonb_typeof(result->'ttlDays') is distinct from 'number'
  or result->>'ttlDays' not in ('0','1','7','15','30','90','365') then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
 return result;
end $$;
revoke all on function public.totus_tpv_parking_policy(jsonb) from public,anon,authenticated;
grant execute on function public.totus_tpv_parking_policy(jsonb) to service_role;

create or replace function private.totus_tpv_draft_json(d private.totus_tpv_drafts,p_actor uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',d.id,'version',d.version,'status',d.status,'label',d.label,'payload',d.payload,
  'mine',coalesce(d.claimed_by=p_actor,false),'sessionId',d.claimed_session,'checkoutId',d.checkout_id,'orderId',d.order_id,'updatedAt',d.updated_at,'expiresAt',d.expires_at,'expired',d.expires_at is not null and d.expires_at<=statement_timestamp() and d.status in ('parked','claimed','checkout'))
$$;

create or replace function public.totus_tpv_drafts(p_action text,p_id uuid,p_request_id uuid,p_scope jsonb,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare d private.totus_tpv_drafts;r private.totus_tpv_draft_requests;actor uuid:=(p_scope->>'actorId')::uuid;
 parking jsonb;ttl integer;current_session uuid:=(p_scope->>'sessionId')::uuid;payload jsonb;result jsonb;
begin
 if p_action is null or p_action not in ('list','get','park','claim','bind','release','archive') or p_request_id is null or jsonb_typeof(p_data)<>'object'
  then raise exception 'TPV_DRAFT_REQUEST_INVALID';end if;
 perform private.totus_tpv_authorize(p_scope,case when p_action in ('list','get') then 'reconcile' else 'sell' end);
 if p_action not in ('list','get') and coalesce(p_data->>'version','') !~ '^(0|[1-9][0-9]{0,11})$'
  then raise exception 'TPV_DRAFT_REQUEST_INVALID';end if;
 if p_action='list' then
  select coalesce(jsonb_agg(t.result order by t.updated_at desc,t.id desc),'[]') into result from (
   select x.id,x.updated_at,(private.totus_tpv_draft_json(x,actor)-'payload')||jsonb_build_object('lineCount',jsonb_array_length(x.payload->'lines')) result from private.totus_tpv_drafts x
   where x.connection_id=(p_scope->>'connectionId')::uuid and x.drawer_id=(p_scope->>'drawerId')::uuid
    and x.store_id=(p_scope->>'storeId')::uuid and x.shop_id=(p_scope->>'shopId')::bigint and x.environment=p_scope->>'environment'
    and x.status in ('parked','claimed','checkout') order by x.updated_at desc,x.id desc limit 100
  ) t;return result;
 end if;
 if p_id is null then raise exception 'TPV_DRAFT_REQUEST_INVALID';end if;
 if p_action='park' and coalesce((p_data->>'version')::bigint,-1)=0 then
  insert into private.totus_tpv_drafts(id,connection_id,store_id,drawer_id,shop_id,environment,created_by)
   values(p_id,(p_scope->>'connectionId')::uuid,(p_scope->>'storeId')::uuid,(p_scope->>'drawerId')::uuid,
    (p_scope->>'shopId')::bigint,p_scope->>'environment',actor) on conflict(id) do nothing;
 end if;
 select * into d from private.totus_tpv_drafts where id=p_id for update;
 if not found then raise exception 'TPV_DRAFT_NOT_FOUND';end if;
 if d.connection_id<>(p_scope->>'connectionId')::uuid or d.drawer_id<>(p_scope->>'drawerId')::uuid
  or d.store_id<>(p_scope->>'storeId')::uuid or d.shop_id<>(p_scope->>'shopId')::bigint or d.environment is distinct from p_scope->>'environment'
  then raise exception 'TPV_DRAFT_SCOPE_MISMATCH';end if;
 if p_action='get' then return private.totus_tpv_draft_json(d,actor);end if;
 select * into r from private.totus_tpv_draft_requests where id=p_request_id;
 if found then
  if r.draft_id<>p_id or r.actor_id<>actor or r.action<>p_action or r.data is distinct from p_data
   then raise exception 'TPV_DRAFT_REQUEST_ALREADY_BOUND';end if;
  return private.totus_tpv_draft_json(d,actor);
 end if;
 if coalesce(p_data->>'version','') !~ '^(0|[1-9][0-9]{0,11})$' or (p_data->>'version')::bigint<>d.version
  then raise exception 'TPV_DRAFT_STALE';end if;
 if p_action in ('claim','bind') and d.expires_at is not null and d.expires_at<=clock_timestamp() then raise exception 'TPV_DRAFT_EXPIRED';end if;
 if p_action='claim' then
  if (p_data-array['version'])<>'{}'::jsonb or not (d.status='parked' or
   (d.status='claimed' and (d.claimed_by=actor or exists(select 1 from private.totus_tpv_sessions where id=d.claimed_session and status='closed'))) or
   (d.status='checkout' and exists(select 1 from private.totus_tpv_sessions where id=d.claimed_session and status='closed')
    and not exists(select 1 from private.totus_tpv_operations where id=d.checkout_id and status<>'ready')))
   then raise exception 'TPV_DRAFT_IN_USE';end if;
  d.status:='claimed';d.claimed_by:=actor;d.claimed_session:=current_session;d.checkout_id:=null;
 elsif p_action='park' then
  parking:=public.totus_tpv_parking_policy(p_scope);
  if parking->>'enabled' is distinct from 'true' then raise exception 'TPV_PARKING_DISABLED';end if;
  ttl:=(parking->>'ttlDays')::integer;
  d.expires_at:=case when ttl=0 then null else clock_timestamp()+ttl*interval '24 hours' end;
  if (p_data-array['version','payload','label'])<>'{}'::jsonb or not(d.version=0 and d.created_by=actor or
   d.status='claimed' and d.claimed_by=actor and d.claimed_session=current_session)
   or jsonb_typeof(p_data->'label') is distinct from 'string' or length(btrim(p_data->>'label')) not between 1 and 120 or p_data->>'label' ~ '[[:cntrl:]]'
   then raise exception 'TPV_DRAFT_REQUEST_INVALID';end if;
  d.payload:=private.totus_tpv_draft_payload(p_data->'payload');d.label:=btrim(p_data->>'label');
  d.status:='parked';d.claimed_by:=null;d.claimed_session:=null;d.checkout_id:=null;
 elsif p_action='bind' then
  if (p_data-array['version','payload','checkoutId'])<>'{}'::jsonb or d.status<>'claimed' or d.claimed_by<>actor or d.claimed_session<>current_session
   or coalesce(p_data->>'checkoutId','') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then raise exception 'TPV_DRAFT_IN_USE';end if;
  d.payload:=private.totus_tpv_draft_payload(p_data->'payload');d.checkout_id:=(p_data->>'checkoutId')::uuid;d.status:='checkout';
 elsif p_action='release' then
  if (p_data-array['version'])<>'{}'::jsonb or d.status<>'checkout' or d.claimed_by<>actor or d.claimed_session<>current_session
   or exists(select 1 from private.totus_tpv_operations where id=d.checkout_id and status<>'ready') then raise exception 'TPV_DRAFT_IN_USE';end if;
  d.status:='claimed';d.checkout_id:=null;
 elsif p_action='archive' then
  if (p_data-array['version'])<>'{}'::jsonb or d.status not in ('parked','claimed')
   or (d.status='claimed' and d.claimed_by<>actor) or (d.created_by<>actor and d.claimed_by is distinct from actor and
    not private.totus_module_can((select email from public.profiles where id=actor),'ventas','edit'))
   then raise exception 'TPV_DRAFT_IN_USE';end if;d.status:='archived';
 end if;
 update private.totus_tpv_drafts set version=d.version+1,status=d.status,label=d.label,payload=d.payload,
  claimed_by=d.claimed_by,claimed_session=d.claimed_session,checkout_id=d.checkout_id,expires_at=d.expires_at,updated_at=clock_timestamp() where id=d.id returning * into d;
 insert into private.totus_tpv_draft_requests(id,draft_id,actor_id,action,data) values(p_request_id,d.id,actor,p_action,p_data);
 return private.totus_tpv_draft_json(d,actor);
end $$;


create or replace function private.totus_tpv_draft_checkout_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare draft private.totus_tpv_drafts;
begin
 if new.status='dispatched' and old.status='ready' and new.expected ? 'draftId' then
  select d.* into draft from private.totus_tpv_drafts d where d.id=(new.expected->>'draftId')::uuid and d.checkout_id=new.id and d.status='checkout'
   and d.version=(new.expected->>'draftVersion')::bigint and d.claimed_by=new.created_by and d.claimed_session=new.session_id
   and d.connection_id=new.connection_id and d.store_id=new.store_id and d.drawer_id=new.drawer_id and d.shop_id=new.shop_id
   and d.environment=new.environment for update;
  if not found then raise exception 'TPV_DRAFT_STALE';end if;
  if draft.expires_at is not null and draft.expires_at<=clock_timestamp() then raise exception 'TPV_DRAFT_EXPIRED';end if;
 end if;
 if new.status='confirmed' and old.status<>'confirmed' and new.expected ? 'draftId' then
  update private.totus_tpv_drafts set status='sold',order_id=new.order_id,version=version+1,updated_at=clock_timestamp()
   where id=(new.expected->>'draftId')::uuid and checkout_id=new.id and status='checkout';
  if not found then raise exception 'TPV_DRAFT_STALE';end if;
 end if;return new;
end $$;

commit;
