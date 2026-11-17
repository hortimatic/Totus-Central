begin;
alter table private.totus_tpv_workspace_preferences drop constraint totus_tpv_workspace_preferences_view_mode_check;
alter table private.totus_tpv_workspace_preferences add constraint totus_tpv_workspace_preferences_view_mode_check check(view_mode in ('grid','compact','list','table'));
alter table private.totus_tpv_workspace_preferences
 add column catalogue_columns jsonb not null default '["photo","name","reference","stock","price"]',
 add column display_options jsonb not null default '{"showPrices":true,"showStock":true,"showReferences":true,"beepOnAdd":false,"ticketNewestFirst":false}',
 add column receipt_options jsonb not null default '{"title":"Justificante de compra","footer":"","fontFamily":"arial","fontSize":11,"dateFormat":"native","showLogo":true,"showBarcode":false,"showUnitPrice":false,"showLineTax":false,"showAfterSale":false,"printAfterSale":false,"showOrderReference":true,"numberLines":false,"showCustomer":false,"showCustomerPhone":false,"showCustomerEmail":false,"showAddressComment":false,"showDeliveryAddress":false,"showCustomerCompany":false,"showReferences":true,"showAddress":true,"showPhone":true,"showPayments":true,"showDiscounts":true,"showDate":true}',
 add column sort_field text not null default 'name' check(sort_field in ('name','reference','stock','id','cost','manufacturer','supplier','price')),
 add column sort_direction text not null default 'asc' check(sort_direction in ('asc','desc'));
create or replace function public.totus_tpv_workspace_preferences(p_connection uuid,p_shop bigint,p_drawer uuid,p_preferences jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); ctx jsonb; saved private.totus_tpv_workspace_preferences;
 receipt_defaults constant jsonb:='{"title":"Justificante de compra","footer":"","fontFamily":"arial","fontSize":11,"dateFormat":"native","showLogo":true,"showBarcode":false,"showUnitPrice":false,"showLineTax":false,"showAfterSale":false,"printAfterSale":false,"showOrderReference":true,"numberLines":false,"showCustomer":false,"showCustomerPhone":false,"showCustomerEmail":false,"showAddressComment":false,"showDeliveryAddress":false,"showCustomerCompany":false,"showReferences":true,"showAddress":true,"showPhone":true,"showPayments":true,"showDiscounts":true,"showDate":true}';
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
   or p_preferences-array['viewMode','initialCategoryId','columns','sortField','sortDirection','display','receipt']<>'{}'::jsonb
   or coalesce(p_preferences->>'viewMode',saved.view_mode,'grid') not in ('grid','compact','list','table')
   or coalesce(p_preferences->>'initialCategoryId',saved.initial_category_id::text,'0') !~ '^(0|[1-9][0-9]{0,9})$'
   or coalesce(p_preferences->>'initialCategoryId',saved.initial_category_id::text,'0')::bigint>2147483647
   or coalesce(p_preferences->>'sortField',saved.sort_field,'name') not in ('name','reference','stock','id','cost','manufacturer','supplier','price')
   or coalesce(p_preferences->>'sortDirection',saved.sort_direction,'asc') not in ('asc','desc')
   then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
  if p_preferences?'columns' then
   if jsonb_typeof(p_preferences->'columns') is distinct from 'array' then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
   if jsonb_array_length(p_preferences->'columns') not between 1 and 10 or not (p_preferences->'columns'?'name')
    or exists(select 1 from jsonb_array_elements(p_preferences->'columns') c where jsonb_typeof(c) is distinct from 'string'
     or c#>>'{}' not in ('photo','name','reference','barcode','stock','price','manufacturer','supplier','cost','id'))
    or (select count(distinct c) from jsonb_array_elements(p_preferences->'columns') c)<>jsonb_array_length(p_preferences->'columns')
    then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
  end if;
  if p_preferences?'display' then
   if jsonb_typeof(p_preferences->'display') is distinct from 'object' then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
   if (p_preferences->'display')-array['showPrices','showStock','showReferences','beepOnAdd','ticketNewestFirst']<>'{}'::jsonb
    or exists(select 1 from jsonb_each(p_preferences->'display') e where jsonb_typeof(e.value) is distinct from 'boolean')
    then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
  end if;
  if p_preferences?'receipt' then
   if jsonb_typeof(p_preferences->'receipt') is distinct from 'object' then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
   if (p_preferences->'receipt')-array['title','footer','fontFamily','fontSize','dateFormat','showLogo','showBarcode','showUnitPrice','showLineTax','showAfterSale','printAfterSale','showOrderReference','numberLines','showCustomer','showCustomerPhone','showCustomerEmail','showAddressComment','showDeliveryAddress','showCustomerCompany','showReferences','showAddress','showPhone','showPayments','showDiscounts','showDate']<>'{}'::jsonb
    or exists(select 1 from jsonb_each(p_preferences->'receipt') e where
      e.key in ('showLogo','showBarcode','showUnitPrice','showLineTax','showAfterSale','printAfterSale','showOrderReference','numberLines','showCustomer','showCustomerPhone','showCustomerEmail','showAddressComment','showDeliveryAddress','showCustomerCompany','showReferences','showAddress','showPhone','showPayments','showDiscounts','showDate') and jsonb_typeof(e.value) is distinct from 'boolean'
      or e.key in ('title','footer','fontFamily','dateFormat') and jsonb_typeof(e.value) is distinct from 'string'
      or e.key='fontSize' and (jsonb_typeof(e.value) is distinct from 'number' or e.value::text !~ '^(1[0-6])$'))
    or (p_preferences->'receipt'?'title' and (length(btrim(p_preferences->'receipt'->>'title')) not between 1 and 80 or p_preferences->'receipt'->>'title' ~ '[[:cntrl:]]'))
    or (p_preferences->'receipt'?'footer' and (length(p_preferences->'receipt'->>'footer')>500 or translate(p_preferences->'receipt'->>'footer',E'\n\r\t','') ~ '[[:cntrl:]]'))
    or (p_preferences->'receipt'?'fontFamily' and p_preferences->'receipt'->>'fontFamily' not in ('arial','monospace'))
    or (p_preferences->'receipt'?'dateFormat' and p_preferences->'receipt'->>'dateFormat' not in ('native','short','long'))
    then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
  end if;
  insert into private.totus_tpv_workspace_preferences(actor_id,connection_id,shop_id,drawer_id,view_mode,initial_category_id,catalogue_columns,sort_field,sort_direction,display_options,receipt_options)
   values(actor,p_connection,p_shop,p_drawer,coalesce(p_preferences->>'viewMode',saved.view_mode,'grid'),
    coalesce(p_preferences->>'initialCategoryId',saved.initial_category_id::text,'0')::bigint,
    coalesce(p_preferences->'columns',saved.catalogue_columns,'["photo","name","reference","stock","price"]'),
    coalesce(p_preferences->>'sortField',saved.sort_field,'name'),coalesce(p_preferences->>'sortDirection',saved.sort_direction,'asc'),
    coalesce(saved.display_options,'{"showPrices":true,"showStock":true,"showReferences":true,"beepOnAdd":false,"ticketNewestFirst":false}')||coalesce(p_preferences->'display','{}'),
    coalesce(saved.receipt_options,receipt_defaults)||coalesce(p_preferences->'receipt','{}'))
   on conflict(actor_id,connection_id,shop_id,drawer_id) do update set view_mode=excluded.view_mode,
    initial_category_id=excluded.initial_category_id,catalogue_columns=excluded.catalogue_columns,
    sort_field=excluded.sort_field,sort_direction=excluded.sort_direction,display_options=excluded.display_options,receipt_options=excluded.receipt_options,updated_at=clock_timestamp();
  select * into saved from private.totus_tpv_workspace_preferences
   where actor_id=actor and connection_id=p_connection and shop_id=p_shop and drawer_id=p_drawer;
 end if;
 return jsonb_build_object('viewMode',coalesce(saved.view_mode,'grid'),'initialCategoryId',coalesce(saved.initial_category_id,0),
  'columns',coalesce(saved.catalogue_columns,'["photo","name","reference","stock","price"]'),
  'sortField',coalesce(saved.sort_field,'name'),'sortDirection',coalesce(saved.sort_direction,'asc'),
  'display',coalesce(saved.display_options,'{"showPrices":true,"showStock":true,"showReferences":true,"beepOnAdd":false,"ticketNewestFirst":false}'),
  'receipt',coalesce(saved.receipt_options,receipt_defaults));
end $$;
revoke all on function public.totus_tpv_workspace_preferences(uuid,bigint,uuid,jsonb) from public,anon;
grant execute on function public.totus_tpv_workspace_preferences(uuid,bigint,uuid,jsonb) to authenticated;
create or replace function public.totus_tpv_context() returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
 if actor is null or not private.totus_can('ventas','view') or not private.totus_can('cajas','view')
  or not exists(select 1 from public.profiles where id=actor and active) then raise exception 'TPV_VIEW_FORBIDDEN';end if;
 select coalesce(jsonb_agg(jsonb_build_object('connectionId',a.connection_id,'connectionRevision',c.revision,'websiteKey',a.website_key,
  'storeId',s.id,'storeName',s.name,'drawerId',d.id,'drawerName',d.name,'shopId',a.shop_id,'environment',a.environment,
  'canSell',a.can_sell,'canOpen',a.can_open,'canReconcile',a.can_reconcile,'nativeProfile',p.profile,'profileRevision',p.profile_revision,
  'canReadCosts',private.totus_module_can((select email from public.profiles where id=actor),'productos','view'),
  'session',(select jsonb_build_object('id',ss.id,'status',ss.status,'openingCents',ss.opening_cents,'currency',ss.currency)
   from private.totus_tpv_sessions ss where ss.connection_id=a.connection_id and ss.shop_id=a.shop_id and ss.drawer_id=a.drawer_id
    and ss.environment=a.environment and ss.status='open')) order by s.name,d.name),'[]'::jsonb) into result
 from private.totus_tpv_assignments a join private.totus_api_connections c on c.id=a.connection_id
 join private.totus_tpv_native_profiles p on p.connection_id=a.connection_id and p.shop_id=a.shop_id and p.connection_revision=c.revision
  and p.store_id=a.store_id and p.website_key=a.website_key
 join private.totus_websites w on w.key=a.website_key and w.connection_id=c.id and w.status='active'
 join public.ops_stores s on s.id=a.store_id and s.active join public.ops_cash_drawers d on d.id=a.drawer_id and d.store_id=s.id and d.active
 where a.actor_id=actor and a.active and a.environment='qa' and c.enabled and c.real_data_authorized and c.verified_revision=c.revision;
 return jsonb_build_object('actorId',actor,'workstations',result);
end $$;
revoke all on function public.totus_tpv_context() from public,anon;
grant execute on function public.totus_tpv_context() to authenticated;
commit;
