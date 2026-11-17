-- Names belong to this sale only. Catalogue and native prices remain unchanged.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table private.totus_tpv_workspace_preferences alter column line_options set default '{"allowPriceChanges":false,"requireSaleNote":false,"allowNameChanges":false}'::jsonb;
update private.totus_tpv_workspace_preferences set line_options='{"allowNameChanges":false}'::jsonb||line_options where not line_options?'allowNameChanges';
create or replace function public.totus_tpv_workspace_preferences(p_connection uuid,p_shop bigint,p_drawer uuid,p_preferences jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); ctx jsonb; saved private.totus_tpv_workspace_preferences;
 receipt_defaults constant jsonb:='{"title":"Justificante de compra","footer":"","fontFamily":"arial","fontSize":11,"dateFormat":"native","showLogo":true,"showBarcode":false,"showUnitPrice":false,"showLineTax":false,"showOperator":false,"showWebsite":false,"showAfterSale":false,"printAfterSale":false,"showOrderReference":true,"numberLines":false,"showCustomer":false,"showCustomerPhone":false,"showCustomerEmail":false,"showAddressComment":false,"showDeliveryAddress":false,"showCustomerCompany":false,"showReferences":true,"showAddress":true,"showPhone":true,"showPayments":true,"showDiscounts":true,"showDate":true,"showOriginalPrice":false,"showLineDiscount":false,"includeLineDiscountsInTotal":false}';
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
   if (p_preferences->'lineOptions')-array['allowPriceChanges','requireSaleNote','allowNameChanges']<>'{}'::jsonb or exists(select 1 from jsonb_each(p_preferences->'lineOptions') e where jsonb_typeof(e.value) is distinct from 'boolean') then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
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
   if (p_preferences->'receipt')-array['title','footer','fontFamily','fontSize','dateFormat','showLogo','showBarcode','showUnitPrice','showLineTax','showOperator','showWebsite','showAfterSale','printAfterSale','showOrderReference','numberLines','showCustomer','showCustomerPhone','showCustomerEmail','showAddressComment','showDeliveryAddress','showCustomerCompany','showReferences','showAddress','showPhone','showPayments','showDiscounts','showDate','showOriginalPrice','showLineDiscount','includeLineDiscountsInTotal']<>'{}'::jsonb
    or exists(select 1 from jsonb_each(p_preferences->'receipt') e where
      e.key in ('showLogo','showBarcode','showUnitPrice','showLineTax','showOperator','showWebsite','showAfterSale','printAfterSale','showOrderReference','numberLines','showCustomer','showCustomerPhone','showCustomerEmail','showAddressComment','showDeliveryAddress','showCustomerCompany','showReferences','showAddress','showPhone','showPayments','showDiscounts','showDate','showOriginalPrice','showLineDiscount','includeLineDiscountsInTotal') and jsonb_typeof(e.value) is distinct from 'boolean'
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
    coalesce(saved.line_options,'{"allowPriceChanges":false,"requireSaleNote":false,"allowNameChanges":false}')||coalesce(p_preferences->'lineOptions','{}'),
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
  'cash',coalesce(saved.cash_options,cash_defaults),'search',coalesce(saved.search_options,search_defaults),'stockPolicy',coalesce(saved.stock_policy,'{"allowOutOfStock":false}'),'lineOptions',coalesce(saved.line_options,'{"allowPriceChanges":false,"requireSaleNote":false,"allowNameChanges":false}'),'parking',coalesce(saved.parking_options,'{"enabled":true,"ttlDays":0}'),'catalogue',coalesce(saved.catalogue_options,catalogue_defaults));
end $$;
revoke all on function public.totus_tpv_workspace_preferences(uuid,bigint,uuid,jsonb) from public,anon;
grant execute on function public.totus_tpv_workspace_preferences(uuid,bigint,uuid,jsonb) to authenticated;







create or replace function private.totus_tpv_draft_payload(p jsonb) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare line jsonb; discount jsonb; seen text[]:='{}'; identity text; field text;
begin
 if jsonb_typeof(p) is distinct from 'object' or (p-array['lines','customerId','invoiceAddressId','deliveryAddressId','adjustment','coupon','note'])<>'{}'::jsonb
  or length(p::text)>60000 or jsonb_typeof(p->'lines') is distinct from 'array' or jsonb_array_length(p->'lines') not between 1 and 200
  then raise exception 'TPV_DRAFT_PAYLOAD_INVALID';end if;
 foreach field in array array['customerId','invoiceAddressId','deliveryAddressId'] loop
  if p ? field and (jsonb_typeof(p->field)<>'number' or coalesce(p->>field,'') !~ '^[1-9][0-9]{0,9}$' or (p->>field)::bigint>2147483647)
   then raise exception 'TPV_DRAFT_PAYLOAD_INVALID';end if;
 end loop;
 if (p ? 'customerId') is distinct from (p ? 'invoiceAddressId') or (p ? 'customerId') is distinct from (p ? 'deliveryAddressId')
  then raise exception 'TPV_DRAFT_PAYLOAD_INVALID';end if;
 if p ? 'note' and (jsonb_typeof(p->'note') is distinct from 'string' or length(p->>'note') not between 1 and 500 or p->>'note' ~ '[<>]' or regexp_replace(p->>'note',E'[\n\t]','','g') ~ '[[:cntrl:]]') then raise exception 'TPV_DRAFT_PAYLOAD_INVALID';end if;
 if p ? 'coupon' and (jsonb_typeof(p->'coupon')<>'string' or length(p->>'coupon') not between 1 and 100 or p->>'coupon' ~ '[[:cntrl:]]')
  then raise exception 'TPV_DRAFT_PAYLOAD_INVALID';end if;
 for line in select value from jsonb_array_elements(p->'lines') loop
  if jsonb_typeof(line)<>'object' or (line-array['productId','attributeId','qty','label','discount','displayName','originalLabel'])<>'{}'::jsonb
   or jsonb_typeof(line->'productId') is distinct from 'number' or jsonb_typeof(line->'attributeId') is distinct from 'number' or jsonb_typeof(line->'qty') is distinct from 'number'
   or coalesce(line->>'productId','') !~ '^[1-9][0-9]{0,9}$' or (line->>'productId')::bigint>2147483647
   or coalesce(line->>'attributeId','') !~ '^(0|[1-9][0-9]{0,9})$' or (line->>'attributeId')::bigint>2147483647
   or coalesce(line->>'qty','') !~ '^[1-9][0-9]{0,4}$' or (line->>'qty')::bigint>10000
   or (line ? 'label' and (jsonb_typeof(line->'label')<>'string' or length(line->>'label')>512 or line->>'label' ~ '[[:cntrl:]]'))
   then raise exception 'TPV_DRAFT_PAYLOAD_INVALID';end if;
  if line?'displayName' and (jsonb_typeof(line->'displayName') is distinct from 'string' or length(line->>'displayName') not between 1 and 255 or btrim(line->>'displayName')<>line->>'displayName' or line->>'displayName' ~ '[[:cntrl:]<>={}]') then raise exception 'TPV_DRAFT_PAYLOAD_INVALID';end if;
  if line?'originalLabel' and (jsonb_typeof(line->'originalLabel') is distinct from 'string' or length(line->>'originalLabel') not between 1 and 512 or line->>'originalLabel' ~ '[[:cntrl:]]') then raise exception 'TPV_DRAFT_PAYLOAD_INVALID';end if;
  identity:=(line->>'productId')||':'||(line->>'attributeId');
  if identity=any(seen) then raise exception 'TPV_DRAFT_PAYLOAD_INVALID';end if;seen:=array_append(seen,identity);
 end loop;
 if p->'adjustment'->>'kind'='price' then raise exception 'TPV_DRAFT_PAYLOAD_INVALID';end if;
 for discount in select value->'discount' from jsonb_array_elements(p->'lines') where value ? 'discount'
  union all select p->'adjustment' where p ? 'adjustment' loop
  if jsonb_typeof(discount)<>'object' or (discount-array['kind','value'])<>'{}'::jsonb
   or jsonb_typeof(discount->'value') is distinct from 'number'
   or coalesce(discount->>'kind','') not in ('percent','amount','price') or coalesce(discount->>'value','') !~ '^[1-9][0-9]{0,11}$'
   or (discount->>'kind'='price' and (discount->>'value')::bigint>999999999) or (discount->>'value')::bigint>100000000000 or (discount->>'kind'='percent' and (discount->>'value')::bigint>=10000)
   then raise exception 'TPV_DRAFT_PAYLOAD_INVALID';end if;
 end loop;
 return p;
end $$;




create or replace function public.totus_tpv_line_options(p_scope jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;actor uuid:=(p_scope->>'actorId')::uuid;
begin
 perform public.totus_tpv_check(p_scope,'sell');
 select line_options into result from private.totus_tpv_workspace_preferences where actor_id=actor and connection_id=(p_scope->>'connectionId')::uuid and shop_id=(p_scope->>'shopId')::bigint and drawer_id=(p_scope->>'drawerId')::uuid;
 return jsonb_build_object('allowPriceChanges',coalesce((result->>'allowPriceChanges')::boolean,false) and private.totus_module_can((select email from public.profiles where id=actor),'ventas','edit'),'allowNameChanges',coalesce((result->>'allowNameChanges')::boolean,false) and private.totus_module_can((select email from public.profiles where id=actor),'ventas','edit'),'requireSaleNote',coalesce((result->>'requireSaleNote')::boolean,false));
end $$;
revoke all on function public.totus_tpv_line_options(jsonb) from public,anon,authenticated;
grant execute on function public.totus_tpv_line_options(jsonb) to service_role;



create or replace function public.totus_tpv_native_command(p_action text,p_id uuid,p_scope jsonb,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r private.totus_tpv_native_commands; won boolean:=false; command_name text;
begin
 if p_action not in ('claim','get','complete','uncertain') or p_id is null or jsonb_typeof(p_data) is distinct from 'object'
  then raise exception 'TPV_NATIVE_REQUEST_INVALID';end if;
 select * into r from private.totus_tpv_native_commands where id=p_id;
 command_name:=case when p_action='claim' then p_data->>'command' else r.command end;
 if command_name='setup.qa' then
  if p_scope->>'environment' is distinct from 'qa' or p_scope->>'connectionId' is distinct from 'b554f6cc-4df1-412b-b063-e1cbd82d9e66'
   or not exists(select 1 from public.profiles actor join public.team_members t on lower(t.email)=lower(actor.email)
    where actor.id=(p_scope->>'actorId')::uuid and actor.active and t.active and t.role='admin'
     and private.totus_module_can(actor.email,'configuracion','edit'))
   or not exists(select 1 from private.totus_api_connections c join private.totus_websites w on w.connection_id=c.id
    join public.ops_stores s on s.id=(p_scope->>'storeId')::uuid and s.active
    join public.ops_cash_drawers d on d.id=(p_scope->>'drawerId')::uuid and d.store_id=s.id and d.active
    where c.id=(p_scope->>'connectionId')::uuid and c.revision=(p_scope->>'connectionRevision')::bigint
     and c.verified_revision=c.revision and c.enabled and c.real_data_authorized and c.protocol='prestashop'
     and w.status='active' and w.origin='https://preproduccion.hortimatic.com' and w.include_in_totals=false
     and (w.business_id is null or w.business_id=s.id)) then raise exception 'TPV_CONFIGURATION_FORBIDDEN';end if;
 else
  perform private.totus_tpv_authorize(p_scope,case when p_action='claim' then 'sell' else 'reconcile' end);
 end if;
 if p_action='claim' then
  if coalesce(p_data->>'command','') not in ('setup.qa','cart.prepare','cart.quote','stock.receive')
   or jsonb_typeof(p_data->'payload') is distinct from 'object' or length(p_data::text)>65536
   or (p_data-array['command','payload'])<>'{}'::jsonb then raise exception 'TPV_NATIVE_REQUEST_INVALID';end if;
  if p_data->>'command'='stock.receive' and not private.totus_module_can(
    (select email from public.profiles where id=(p_scope->>'actorId')::uuid),'productos','edit')
   then raise exception 'TPV_STOCK_FORBIDDEN';end if;
  if p_data->>'command'='cart.prepare' and ((p_data->'payload') ? 'adjustment' or (p_data->'payload') ? 'coupon'
   or exists(select 1 from jsonb_array_elements(p_data->'payload'->'lines') l where l ? 'discount' or l ? 'display_name'))
   and not private.totus_module_can((select email from public.profiles where id=(p_scope->>'actorId')::uuid),'ventas','edit')
   then raise exception 'TPV_DISCOUNT_FORBIDDEN';end if;
  if p_data->>'command'='cart.prepare' and exists(select 1 from jsonb_array_elements(p_data->'payload'->'lines') l where l?'display_name') and public.totus_tpv_line_options(p_scope)->'allowNameChanges' is distinct from 'true'::jsonb then raise exception 'TPV_LINE_NAME_FORBIDDEN';end if;
  insert into private.totus_tpv_native_commands(id,scope,command,payload)
   values(p_id,p_scope,p_data->>'command',p_data->'payload') on conflict(id) do nothing;
  won:=found;
 end if;
 select * into r from private.totus_tpv_native_commands where id=p_id for update;
 if not found then return null;end if;
 if r.scope<>p_scope or (p_action='claim' and (r.command is distinct from p_data->>'command' or r.payload is distinct from p_data->'payload'))
  then raise exception 'TPV_NATIVE_REQUEST_ALREADY_BOUND';end if;
 if p_action='complete' then
  if jsonb_typeof(p_data->'result') is distinct from 'object' or p_data->'result'->'verified' is distinct from 'true'::jsonb
   or p_data->'result'->>'native_reference' is null or length(p_data::text)>262144 then raise exception 'TPV_NATIVE_READBACK_REQUIRED';end if;
  if r.status='verified' and r.result is distinct from p_data->'result' then raise exception 'TPV_NATIVE_RESULT_CHANGED';end if;
  update private.totus_tpv_native_commands set status='verified',result=p_data->'result',reason=null,updated_at=clock_timestamp() where id=p_id returning * into r;
 elsif p_action='uncertain' and r.status<>'verified' then
  update private.totus_tpv_native_commands set status='uncertain',reason='TPV_NATIVE_RESULT_UNCERTAIN',updated_at=clock_timestamp() where id=p_id returning * into r;
 end if;
 return jsonb_build_object('id',r.id,'scope',r.scope,'command',r.command,'payload',r.payload,'status',r.status,'result',r.result,'won',won);
end $$;

create function private.totus_tpv_ticket_options_dispatch_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare options jsonb;scope jsonb;
begin
 if old.status='ready' and new.status='dispatched' then
  scope:=jsonb_build_object('actorId',coalesce(new.dispatched_by,new.created_by),'connectionId',new.connection_id,'connectionRevision',new.connection_revision,'storeId',new.store_id,'shopId',new.shop_id,'drawerId',new.drawer_id,'sessionId',new.session_id,'currency',new.currency,'environment',new.environment);
  options:=public.totus_tpv_line_options(scope);
  if new.expected->'hasPriceOverride'='true'::jsonb and options->'allowPriceChanges' is distinct from 'true'::jsonb then raise exception 'TPV_PRICE_CHANGE_FORBIDDEN';end if;
  if new.expected->'hasLineNameOverrides'='true'::jsonb and options->'allowNameChanges' is distinct from 'true'::jsonb then raise exception 'TPV_LINE_NAME_FORBIDDEN';end if;
  if options->'requireSaleNote'='true'::jsonb and new.expected->'hasSaleNote' is distinct from 'true'::jsonb then raise exception 'TPV_SALE_NOTE_REQUIRED';end if;
 end if;return new;
end $$;
create trigger tpv_ticket_options_dispatch_guard before update on private.totus_tpv_operations for each row execute function private.totus_tpv_ticket_options_dispatch_guard();
revoke all on function private.totus_tpv_ticket_options_dispatch_guard() from public,anon,authenticated;
grant execute on function private.totus_tpv_ticket_options_dispatch_guard() to service_role;

create or replace function public.totus_tpv_journal(p_action text,p_operation_id uuid,p_scope jsonb,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r private.totus_tpv_operations; payment jsonb; allocation_total bigint:=0; amount bigint;
 expected_total bigint; token uuid; action text; opened private.totus_tpv_sessions;
begin
 if p_action not in ('get','open','prepare','claim','remember','uncertain','confirm')
 or p_operation_id is null or jsonb_typeof(p_scope) is distinct from 'object'
 or jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>(case when p_action in ('prepare','claim') and p_data->'expected'->'hasLineNameOverrides'='true'::jsonb then 1048576 else 65536 end)
 then raise exception 'TPV_REQUEST_INVALID';end if;
 action:=case when p_action in ('get','remember','uncertain','confirm') then 'reconcile'
              when p_action='open' then 'open' else 'sell' end;
 perform private.totus_tpv_authorize(p_scope,action);
 if p_action='prepare' and p_data->'expected'->'hasLineNameOverrides'='true'::jsonb and public.totus_tpv_line_options(p_scope)->'allowNameChanges' is distinct from 'true'::jsonb then raise exception 'TPV_LINE_NAME_FORBIDDEN';end if;
 if p_action='open' then
  if (p_data->>'openingCents')::numeric <> trunc((p_data->>'openingCents')::numeric)
   or coalesce(p_scope->>'currency','') !~ '^[A-Z]{3}$' then raise exception 'TPV_OPENING_INVALID';end if;
  insert into private.totus_tpv_sessions(id,environment,connection_id,store_id,shop_id,drawer_id,currency,opened_by,opening_cents)
  values(p_operation_id,p_scope->>'environment',(p_scope->>'connectionId')::uuid,(p_scope->>'storeId')::uuid,
   (p_scope->>'shopId')::bigint,(p_scope->>'drawerId')::uuid,p_scope->>'currency',
   (p_scope->>'actorId')::uuid,(p_data->>'openingCents')::bigint)
   on conflict(id) do nothing;
  select * into opened from private.totus_tpv_sessions where id=p_operation_id;
  if opened.connection_id is distinct from (p_scope->>'connectionId')::uuid
   or opened.environment is distinct from p_scope->>'environment'
   or opened.store_id is distinct from (p_scope->>'storeId')::uuid
   or opened.shop_id is distinct from (p_scope->>'shopId')::bigint
   or opened.drawer_id is distinct from (p_scope->>'drawerId')::uuid
   or opened.currency is distinct from p_scope->>'currency'
   or opened.opened_by is distinct from (p_scope->>'actorId')::uuid
   or opened.opening_cents is distinct from (p_data->>'openingCents')::bigint
   then raise exception 'TPV_SESSION_ID_ALREADY_BOUND';end if;
  return jsonb_build_object('id',p_operation_id,'status',opened.status);
 end if;
 if p_action='prepare' then
  if jsonb_typeof(p_data->'expected') is distinct from 'object'
   or p_data->'expected'->>'storeId' is distinct from p_scope->>'storeId'
   or p_data->'expected'->>'shopId' is distinct from p_scope->>'shopId'
   or p_data->'expected'->>'currency' is distinct from p_scope->>'currency'
   or (p_data->>'quoteExpiresAt')::numeric/1000<=extract(epoch from clock_timestamp())
  then raise exception 'TPV_PREPARED_SALE_INVALID';end if;
  insert into private.totus_tpv_operations(id,environment,connection_id,connection_revision,store_id,shop_id,drawer_id,
    session_id,created_by,currency,cart_id,expected,quote_expires_at)
  values(p_operation_id,p_scope->>'environment',(p_scope->>'connectionId')::uuid,(p_scope->>'connectionRevision')::bigint,
   (p_scope->>'storeId')::uuid,(p_scope->>'shopId')::bigint,(p_scope->>'drawerId')::uuid,
   (p_scope->>'sessionId')::uuid,(p_scope->>'actorId')::uuid,p_scope->>'currency',
   (p_data->'expected'->>'cartId')::bigint,p_data->'expected',
   to_timestamp((p_data->>'quoteExpiresAt')::numeric/1000)) returning * into r;
  return private.totus_tpv_operation_json(r);
 end if;
 select * into r from private.totus_tpv_operations where id=p_operation_id for update;
 if not found then
  if p_action='get' then return null;end if;
  raise exception 'TPV_OPERATION_NOT_FOUND';
 end if;
 if r.connection_id<>(p_scope->>'connectionId')::uuid or r.store_id<>(p_scope->>'storeId')::uuid
 or r.environment is distinct from p_scope->>'environment'
 or r.shop_id<>(p_scope->>'shopId')::bigint or r.drawer_id<>(p_scope->>'drawerId')::uuid
 or r.session_id<>(p_scope->>'sessionId')::uuid or r.currency<>p_scope->>'currency'
 then raise exception 'TPV_OPERATION_SCOPE_MISMATCH';end if;
 -- Credential rotation never creates another identity for this cart or order.
 -- The server must separately validate the current revision before recovery.
 if p_action='get' then return private.totus_tpv_operation_json(r);end if;
 if r.revision is distinct from (p_data->>'revision')::bigint then raise exception 'TPV_OPERATION_STALE';end if;
 if p_action='claim' then
  if r.connection_revision<>(p_scope->>'connectionRevision')::bigint then raise exception 'TPV_CONTEXT_STALE';end if;
  if r.status<>'ready' then return jsonb_build_object('won',false,'record',private.totus_tpv_operation_json(r));end if;
  if r.quote_expires_at<=clock_timestamp() or r.expected is distinct from p_data->'expected'
   or jsonb_typeof(p_data->'payments') is distinct from 'array' or jsonb_array_length(p_data->'payments') not between 1 and 20
  then raise exception 'TPV_QUOTE_OR_PAYMENT_INVALID';end if;
  expected_total:=(r.expected->>'totalCents')::bigint;
  if expected_total is null or expected_total not between 1 and 100000000000 then raise exception 'TPV_TOTAL_INVALID';end if;
  for payment in select value from jsonb_array_elements(p_data->'payments') loop
   if coalesce(payment->>'id','') !~ '^[a-zA-Z0-9_-]{1,100}$'
   or coalesce(payment->>'method','') not in ('cash','card','bizum','transfer','voucher','cheque')
   or payment->>'status' is distinct from 'settled'
   or exists(select 1 from jsonb_object_keys(payment) k where k not in ('id','method','status','amountCents','receivedCents'))
   or (payment->>'amountCents')::numeric<>trunc((payment->>'amountCents')::numeric)
   then raise exception 'TPV_PAYMENT_INVALID';end if;
   amount:=(payment->>'amountCents')::bigint;
   if amount is null or amount not between 1 and 100000000000 then raise exception 'TPV_PAYMENT_INVALID';end if;
   if payment->>'method'='cash' then
    if payment->>'receivedCents' is null or (payment->>'receivedCents')::numeric<>trunc((payment->>'receivedCents')::numeric)
     or (payment->>'receivedCents')::bigint not between amount and 100000000000
    then raise exception 'TPV_CASH_INSUFFICIENT';end if;
   elsif payment ? 'receivedCents' then raise exception 'TPV_NONCASH_CHANGE';end if;
   allocation_total:=allocation_total+amount;
  end loop;
  if allocation_total<>expected_total or exists(select 1 from jsonb_array_elements(p_data->'payments') p group by p->>'id' having count(*)>1)
  then raise exception 'TPV_PAYMENT_TOTAL_OR_DUPLICATE';end if;
  token:=pg_catalog.gen_random_uuid();
  update private.totus_tpv_operations set status='dispatched',dispatch_token=token,
   dispatched_by=(p_scope->>'actorId')::uuid,payments=p_data->'payments',updated_at=clock_timestamp()
   where id=r.id returning * into r;
  return jsonb_build_object('won',true,'token',token);
 end if;
 if r.status='confirmed' then
  if p_data->>'orderId' is not null and r.order_id<>(p_data->>'orderId')::bigint
  then raise exception 'TPV_REMOTE_ORDER_MISMATCH';end if;
  return private.totus_tpv_operation_json(r);
 end if;
 if r.status not in ('dispatched','uncertain') then raise exception 'TPV_NOT_DISPATCHED';end if;
 if p_data->>'token' is not null and r.dispatch_token<>(p_data->>'token')::uuid then raise exception 'TPV_CLAIM_MISMATCH';end if;
 if p_data->>'orderId' is not null then
  if (p_data->>'orderId')::bigint<1 or (r.order_id is not null and r.order_id<>(p_data->>'orderId')::bigint)
   then raise exception 'TPV_REMOTE_ORDER_MISMATCH';end if;
  r.order_id:=(p_data->>'orderId')::bigint;
 end if;
 if p_action='remember' and r.order_id is null then raise exception 'TPV_REMOTE_ORDER_ID_MISSING';end if;
 if p_action='confirm' then
  if r.order_id is null or p_data->'verification'->>'status' is distinct from 'confirmed'
    or p_data->'verification'->>'readbackVerified' is distinct from 'true'
    or p_data->'verification'->>'orderId' is distinct from r.order_id::text
   then raise exception 'TPV_READBACK_REQUIRED';end if;
  insert into private.totus_tpv_payment_events(operation_id,allocation_id,session_id,method,amount_cents,received_cents,currency)
   select r.id,p->>'id',r.session_id,p->>'method',(p->>'amountCents')::bigint,
     case when p->>'method'='cash' then (p->>'receivedCents')::bigint else null end,r.currency
   from jsonb_array_elements(r.payments) p;
  r.status:='confirmed';r.confirmed_at:=clock_timestamp();r.last_reason:=null;
 elsif p_action='uncertain' then
  if coalesce(p_data->>'reason','') !~ '^TPV_[A-Z0-9_]{1,90}$' then raise exception 'TPV_REASON_INVALID';end if;
  r.status:='uncertain';r.last_reason:=p_data->>'reason';
 elsif p_action<>'remember' then raise exception 'TPV_ACTION_INVALID';end if;
 update private.totus_tpv_operations set order_id=r.order_id,status=r.status,confirmed_at=r.confirmed_at,
  last_reason=r.last_reason,updated_at=clock_timestamp() where id=r.id;
 return private.totus_tpv_operation_json(r);
end $$;

commit;
