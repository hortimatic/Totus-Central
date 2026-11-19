begin;
set local lock_timeout='5s';
-- Read the invoices already issued by the selected native shop. No fiscal
-- records, series, revenue or cash movements are inserted by this bridge.
create function private.totus_tpv_billing_authorize(p_scope jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare email text;
begin
 select p.email into email from public.profiles p where p.id=(p_scope->>'actorId')::uuid and p.active;
 if email is null or private.totus_module_can(email,'facturacion','view') is not true then raise exception 'TPV_BILLING_FORBIDDEN';end if;
 if p_scope->>'environment' is distinct from 'qa' or (p_scope->>'connectionId')::uuid is distinct from 'b554f6cc-4df1-412b-b063-e1cbd82d9e66'::uuid
  or not exists(select 1 from private.totus_tpv_native_profiles p
   join private.totus_api_connections c on c.id=p.connection_id and c.revision=p.connection_revision
   join private.totus_websites w on w.key=p.website_key and w.connection_id=c.id
   join public.ops_stores s on s.id=p.store_id and s.active
   where p.connection_id=(p_scope->>'connectionId')::uuid and p.shop_id=(p_scope->>'shopId')::bigint
    and p.store_id=(p_scope->>'storeId')::uuid and p.connection_revision=(p_scope->>'connectionRevision')::bigint
    and p.environment='qa' and c.protocol='prestashop' and c.enabled and c.real_data_authorized and c.verified_revision=c.revision
    and w.status='active' and w.origin='https://preproduccion.hortimatic.com' and not w.include_in_totals
    and p.profile->>'verified'='true' and p.profile->>'configured'='true'
    and p.profile->>'native_version'='8.2.8' and p.profile->>'currency'=p_scope->>'currency')
 then raise exception 'TPV_BILLING_CONTEXT_STALE';end if;
end $$;
revoke all on function private.totus_tpv_billing_authorize(jsonb) from public,anon,authenticated;
grant execute on function private.totus_tpv_billing_authorize(jsonb) to service_role;

create function public.totus_tpv_billing_context() returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();result jsonb;
begin
 if actor is null or private.totus_can('facturacion','view') is not true or not exists(select 1 from public.profiles where id=actor and active)
 then raise exception 'TPV_BILLING_FORBIDDEN';end if;
 select coalesce(jsonb_agg(jsonb_build_object('connectionId',p.connection_id,'connectionRevision',c.revision,
  'shopId',p.shop_id,'storeId',s.id,'storeName',s.name,'websiteKey',w.key,'environment',p.environment,'nativeProfile',p.profile)
  order by s.name,p.shop_id),'[]'::jsonb) into result
 from private.totus_tpv_native_profiles p join private.totus_api_connections c on c.id=p.connection_id and c.revision=p.connection_revision
 join private.totus_websites w on w.key=p.website_key and w.connection_id=c.id
 join public.ops_stores s on s.id=p.store_id and s.active
 where p.connection_id='b554f6cc-4df1-412b-b063-e1cbd82d9e66'::uuid and p.environment='qa'
  and c.protocol='prestashop' and c.enabled and c.real_data_authorized and c.verified_revision=c.revision
  and w.status='active' and w.origin='https://preproduccion.hortimatic.com' and not w.include_in_totals
  and p.profile->>'verified'='true' and p.profile->>'configured'='true' and p.profile->>'native_version'='8.2.8';
 return jsonb_build_object('actorId',actor,'sources',result);
end $$;
revoke all on function public.totus_tpv_billing_context() from public,anon;
grant execute on function public.totus_tpv_billing_context() to authenticated;

create function public.totus_tpv_billing_read(p_scope jsonb,p_sale uuid default null,p_query jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;query_text text:='';page_limit integer:=30;cursor_time timestamptz;cursor_id uuid;has_more boolean;
begin
 perform private.totus_tpv_billing_authorize(p_scope);
 if jsonb_typeof(p_query) is distinct from 'object' or p_query-array['search','limit','cursor']<>'{}'::jsonb or length(p_query::text)>2000
 then raise exception 'TPV_BILLING_QUERY_INVALID';end if;
 if p_query?'search' then
  if jsonb_typeof(p_query->'search') is distinct from 'string' or length(p_query->>'search')>100 then raise exception 'TPV_BILLING_QUERY_INVALID';end if;
  query_text:=btrim(p_query->>'search');
 end if;
 if p_query?'limit' then
  if jsonb_typeof(p_query->'limit') is distinct from 'number' or (p_query->>'limit')!~'^[1-9][0-9]?$' then raise exception 'TPV_BILLING_QUERY_INVALID';end if;
  page_limit:=(p_query->>'limit')::integer;if page_limit>50 then raise exception 'TPV_BILLING_QUERY_INVALID';end if;
 end if;
 if p_query?'cursor' then
  if jsonb_typeof(p_query->'cursor') is distinct from 'object' or (p_query->'cursor')-array['createdAt','id']<>'{}'::jsonb
   or not ((p_query->'cursor') ?& array['createdAt','id']) then raise exception 'TPV_BILLING_QUERY_INVALID';end if;
  cursor_time:=(p_query->'cursor'->>'createdAt')::timestamptz;cursor_id:=(p_query->'cursor'->>'id')::uuid;
  if cursor_time is null or cursor_id is null then raise exception 'TPV_BILLING_QUERY_INVALID';end if;
 end if;
 select coalesce(jsonb_agg(t.entry order by t.created_at desc,t.id desc),'[]'::jsonb) into result from (
  select o.id,o.created_at,jsonb_build_object('id',o.id,'orderId',o.order_id,'createdAt',o.created_at,'currency',o.currency,
   'totalCents',(o.expected->>'totalCents')::bigint,'customerId',(o.expected->>'customerId')::bigint,
   'drawerName',d.name,'operatorName',coalesce(nullif(btrim(p.full_name),''),'Operador'),
   'refundCents',coalesce((select sum(r.total_cents) from private.totus_tpv_refunds r where r.sale_id=o.id and r.status='confirmed'),0),
   'refunds',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'totalCents',r.total_cents) order by r.created_at,r.id)
    from private.totus_tpv_refunds r where r.sale_id=o.id and r.status='confirmed'),'[]'::jsonb))
   ||case when p_sale is null then '{}'::jsonb else jsonb_build_object('sourceActorId',o.created_by,'expected',o.expected,
     'refundSources',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'actorId',r.actor_id))
      from private.totus_tpv_refunds r where r.sale_id=o.id and r.status='confirmed'),'[]'::jsonb)) end entry
  from private.totus_tpv_operations o join public.ops_cash_drawers d on d.id=o.drawer_id and d.store_id=o.store_id
  join public.profiles p on p.id=o.created_by
  where o.status='confirmed' and o.connection_id=(p_scope->>'connectionId')::uuid and o.shop_id=(p_scope->>'shopId')::bigint
   and o.store_id=(p_scope->>'storeId')::uuid and o.environment='qa' and o.currency=p_scope->>'currency'
   and (p_sale is null or o.id=p_sale) and (cursor_time is null or (o.created_at,o.id)<(cursor_time,cursor_id))
   and (query_text='' or position(lower(query_text) in lower(concat_ws(' ',o.order_id::text,o.id::text,d.name,p.full_name)))>0)
  order by o.created_at desc,o.id desc limit page_limit+1
 ) t;
 if p_sale is not null then
  if jsonb_array_length(result)<>1 then raise exception 'TPV_BILLING_SALE_NOT_FOUND';end if;return result->0;
 end if;
 has_more:=jsonb_array_length(result)>page_limit;
 select coalesce(jsonb_agg(value order by ordinal),'[]'::jsonb) into result
  from jsonb_array_elements(result) with ordinality as entries(value,ordinal) where ordinal<=page_limit;
 return jsonb_build_object('items',result,'hasMore',has_more,
  'cursor',case when has_more then jsonb_build_object('createdAt',result->(page_limit-1)->'createdAt','id',result->(page_limit-1)->'id') else null end);
end $$;
revoke all on function public.totus_tpv_billing_read(jsonb,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.totus_tpv_billing_read(jsonb,uuid,jsonb) to service_role;
commit;
