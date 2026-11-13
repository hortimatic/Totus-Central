-- Consume the stable registry in existing journals and automation validators.
-- Retain all caller checks, idempotency, fingerprints and durable history.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table private.totus_prestashop_existing_products drop constraint totus_prestashop_existing_products_store_check;
alter table private.totus_prestashop_existing_products add constraint totus_existing_products_website_fk foreign key(store) references private.totus_websites(key);
alter table private.totus_prestashop_product_create_requests drop constraint totus_prestashop_product_create_requests_store_check;
alter table private.totus_prestashop_product_create_requests add constraint totus_create_requests_website_fk foreign key(store) references private.totus_websites(key);

create function private.totus_website_matches(p_key text,p_connection uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.totus_websites w where w.key=p_key and w.connection_id=p_connection and w.status='active')
$$;
revoke all on function private.totus_website_matches(text,uuid) from public,anon,authenticated;

-- Exact, checked replacements of inspected current definitions. Any upstream
-- change aborts the transaction for review rather than patching different code.
do $$declare item record; definition text; f regprocedure;
begin
 for item in select * from (values
 ('private.totus_home_dashboard(text,jsonb,integer)',
  'item->''scope''->>''store'' not in (''all'',''hortimatic'',''newoldsmok'')','(item->''scope''->>''store''<>''all'' and not exists(select 1 from private.totus_websites w where w.key=item->''scope''->>''store''))'),
 ('public.totus_directory_operation(text,uuid,jsonb)',
  'x.name in (''PrestaShop · Hortimatic'',''PrestaShop · NewOldSmok'')','exists(select 1 from private.totus_websites w where w.connection_id=x.id and w.status=''active'')'),
 ('public.totus_prestashop_existing_product_step(text,uuid,text,jsonb)',
  'shop NOT IN (''hortimatic'',''newoldsmok'')','not private.totus_website_matches(shop,c)'),
 ('public.totus_prestashop_existing_product_step(text,uuid,text,jsonb)',
  'k.name=CASE shop WHEN ''hortimatic'' THEN ''PrestaShop · Hortimatic'' ELSE ''PrestaShop · NewOldSmok'' END','private.totus_website_matches(shop,k.id)'),
 ('public.totus_prestashop_product_create_journal(text,uuid,jsonb)',
  'v_store NOT IN (''hortimatic'',''newoldsmok'')','not private.totus_website_matches(v_store,v_connection)'),
 ('public.totus_prestashop_product_create_journal(text,uuid,jsonb)',
  'v_conn.name<>(CASE WHEN v_store=''hortimatic'' THEN ''PrestaShop · Hortimatic'' ELSE ''PrestaShop · NewOldSmok'' END)','not private.totus_website_matches(v_store,v_conn.id)'),
 ('public.totus_products_creation_metadata(text,text[])',
  'p_store not in (''hortimatic'',''newoldsmok'')','not exists(select 1 from private.totus_websites w where w.key=p_store)'),
 ('private.totus_validate_directory_layout(text,jsonb)',
  'p_layout->>''source'' not in (''local'',''hortimatic'',''newoldsmok'')','(p_layout->>''source''<>''local'' and not exists(select 1 from private.totus_websites w where w.key=p_layout->>''source'' and w.status<>''retired''))'),
 ('public.totus_header_online_orders(text,jsonb)',
  'x not in (''hortimatic'',''newoldsmok'')','not exists(select 1 from private.totus_websites w where w.key=x and w.status=''active'')'),
 ('public.totus_header_online_orders(text,jsonb)',
  '^(hortimatic|newoldsmok):[0-9]{1,15}$','^[a-z][a-z0-9_-]{1,63}:[0-9]{1,15}$'),
 ('public.totus_online_order_watch(jsonb)',
  'cardinality(shops) not between 1 and 2','cardinality(shops) not between 1 and 100'),
 ('public.totus_online_order_watch(jsonb)',
  'shops<@array[''hortimatic'',''newoldsmok'']','shops<@coalesce((select array_agg(key) from private.totus_websites where status=''active''),array[]::text[])'),
 ('public.totus_online_order_watch(jsonb)',
  'c.name=case shop when ''hortimatic'' then ''PrestaShop · Hortimatic'' else ''PrestaShop · NewOldSmok'' end','private.totus_website_matches(shop,c.id)'),
 ('public.totus_prestashop_automations(text,jsonb)',
  'cardinality(shops) not between 1 and 2','cardinality(shops) not between 1 and 100'),
 ('public.totus_prestashop_automations(text,jsonb)',
  'shops<@array[''hortimatic'',''newoldsmok'']','shops<@coalesce((select array_agg(key) from private.totus_websites where status=''active''),array[]::text[])'),
 ('public.totus_prestashop_automations(text,jsonb)',
  'c.name=case shop when ''hortimatic'' then ''PrestaShop · Hortimatic'' else ''PrestaShop · NewOldSmok'' end','private.totus_website_matches(shop,c.id)')
 ) replacements(signature,needle,replacement) loop
  f=item.signature::regprocedure;definition=pg_get_functiondef(f);
  if strpos(definition,item.needle)=0 then raise exception 'Unexpected definition: % / %',f,item.needle;end if;
  execute replace(definition,item.needle,item.replacement);
 end loop;
 f='public.totus_prestashop_job_claim(uuid,text)'::regprocedure;definition=pg_get_functiondef(f);
 if strpos(definition,'c.name in(select case s when ''hortimatic'' then ''PrestaShop · Hortimatic'' else ''PrestaShop · NewOldSmok'' end from unnest(a.stores)s)')=0 then raise exception 'Unexpected job claim';end if;
 definition=replace(definition,'c.name in(select case s when ''hortimatic'' then ''PrestaShop · Hortimatic'' else ''PrestaShop · NewOldSmok'' end from unnest(a.stores)s)',
 'exists(select 1 from private.totus_websites w where w.connection_id=c.id and w.key=any(a.stores) and w.status=''active'')');
 if strpos(definition,'''protocol'',c.protocol')=0 then raise exception 'Missing job profile';end if;
 definition=replace(definition,'''protocol'',c.protocol','''protocol'',c.protocol,''store_key'',(select w.key from private.totus_websites w where w.connection_id=c.id),''website_origin'',(select w.origin from private.totus_websites w where w.connection_id=c.id),''website_name'',(select w.name from private.totus_websites w where w.connection_id=c.id)');
 execute definition;
end $$;
commit;
