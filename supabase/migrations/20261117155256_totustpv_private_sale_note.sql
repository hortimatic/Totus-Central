-- Private sale note: preserve all previous parking, stock and pricing rules.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table private.totus_tpv_workspace_preferences alter column line_options set default '{"allowPriceChanges":false,"requireSaleNote":false}'::jsonb;
update private.totus_tpv_workspace_preferences set line_options='{"requireSaleNote":false}'::jsonb||line_options where not line_options?'requireSaleNote';
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
   if (p_preferences->'lineOptions')-array['allowPriceChanges','requireSaleNote']<>'{}'::jsonb or exists(select 1 from jsonb_each(p_preferences->'lineOptions') e where jsonb_typeof(e.value) is distinct from 'boolean') then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
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
    coalesce(saved.line_options,'{"allowPriceChanges":false,"requireSaleNote":false}')||coalesce(p_preferences->'lineOptions','{}'),
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
  'cash',coalesce(saved.cash_options,cash_defaults),'search',coalesce(saved.search_options,search_defaults),'stockPolicy',coalesce(saved.stock_policy,'{"allowOutOfStock":false}'),'lineOptions',coalesce(saved.line_options,'{"allowPriceChanges":false,"requireSaleNote":false}'),'parking',coalesce(saved.parking_options,'{"enabled":true,"ttlDays":0}'),'catalogue',coalesce(saved.catalogue_options,catalogue_defaults));
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
  if jsonb_typeof(line)<>'object' or (line-array['productId','attributeId','qty','label','discount'])<>'{}'::jsonb
   or jsonb_typeof(line->'productId') is distinct from 'number' or jsonb_typeof(line->'attributeId') is distinct from 'number' or jsonb_typeof(line->'qty') is distinct from 'number'
   or coalesce(line->>'productId','') !~ '^[1-9][0-9]{0,9}$' or (line->>'productId')::bigint>2147483647
   or coalesce(line->>'attributeId','') !~ '^(0|[1-9][0-9]{0,9})$' or (line->>'attributeId')::bigint>2147483647
   or coalesce(line->>'qty','') !~ '^[1-9][0-9]{0,4}$' or (line->>'qty')::bigint>10000
   or (line ? 'label' and (jsonb_typeof(line->'label')<>'string' or length(line->>'label')>512 or line->>'label' ~ '[[:cntrl:]]'))
   then raise exception 'TPV_DRAFT_PAYLOAD_INVALID';end if;
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
 return jsonb_build_object('allowPriceChanges',coalesce((result->>'allowPriceChanges')::boolean,false) and private.totus_module_can((select email from public.profiles where id=actor),'ventas','edit'),'requireSaleNote',coalesce((result->>'requireSaleNote')::boolean,false));
end $$;
revoke all on function public.totus_tpv_line_options(jsonb) from public,anon,authenticated;
grant execute on function public.totus_tpv_line_options(jsonb) to service_role;


commit;
