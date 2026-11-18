begin;
set local lock_timeout='5s';
-- Read-only module bridge. Existing payment/refund/cash journals remain the
-- sole monetary source; QA never inserts commercial or fiscal daily closings.
create function private.totus_tpv_central_cash_actor() returns uuid
language plpgsql stable security invoker set search_path='' as $$
declare actor uuid:=auth.uid();email text;
begin
 select p.email into email from public.profiles p where p.id=actor and p.active;
 if actor is null or email is null or private.totus_module_can(email,'cajas','view') is not true
 then raise exception 'TPV_CENTRAL_CASH_FORBIDDEN';end if;return actor;
end $$;
revoke all on function private.totus_tpv_central_cash_actor() from public,anon,authenticated;

create function private.totus_tpv_central_cash_source(p_selection jsonb) returns private.totus_tpv_native_profiles
language plpgsql stable security invoker set search_path='' as $$
declare source private.totus_tpv_native_profiles;
begin
 if jsonb_typeof(p_selection) is distinct from 'object' or length(p_selection::text)>2000 or
  p_selection-array['connectionId','connectionRevision','storeId','shopId','drawerId','sessionId']<>'{}'::jsonb
 then raise exception 'TPV_CENTRAL_CASH_QUERY_INVALID';end if;
 select p.* into source from private.totus_tpv_native_profiles p
 join private.totus_api_connections c on c.id=p.connection_id
 join public.ops_stores s on s.id=p.store_id
 where p.connection_id='b554f6cc-4df1-412b-b063-e1cbd82d9e66'::uuid
  and p.connection_id=(p_selection->>'connectionId')::uuid and c.revision=(p_selection->>'connectionRevision')::bigint
  and p.shop_id=(p_selection->>'shopId')::bigint and p.store_id=(p_selection->>'storeId')::uuid and p.environment='qa'
  -- These are Central's existing QA ledgers. A disabled/offline website or
  -- retired store does not revoke an authorized accountant's history access.
  and p.profile->>'currency' ~ '^[A-Z]{3}$';
 if not found then raise exception 'TPV_CENTRAL_CASH_CONTEXT_STALE';end if;
 if p_selection?'drawerId' and not exists(select 1 from public.ops_cash_drawers d where d.id=(p_selection->>'drawerId')::uuid and d.store_id=source.store_id)
 then raise exception 'TPV_CENTRAL_CASH_QUERY_INVALID';end if;return source;
end $$;
revoke all on function private.totus_tpv_central_cash_source(jsonb) from public,anon,authenticated;

create function public.totus_tpv_central_cash_context() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.totus_tpv_central_cash_actor();result jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object('connectionId',p.connection_id,'connectionRevision',c.revision,'shopId',p.shop_id,
  'storeId',s.id,'storeName',s.name,'storeActive',s.active,'currency',p.profile->>'currency','environment','qa',
  'drawers',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'active',d.active) order by d.name,d.id)
   from public.ops_cash_drawers d where d.store_id=s.id),'[]'::jsonb)) order by s.name,p.shop_id),'[]'::jsonb) into result
 from private.totus_tpv_native_profiles p join private.totus_api_connections c on c.id=p.connection_id
 join public.ops_stores s on s.id=p.store_id
 where p.connection_id='b554f6cc-4df1-412b-b063-e1cbd82d9e66'::uuid and p.environment='qa'
  and p.profile->>'currency' ~ '^[A-Z]{3}$';
 return jsonb_build_object('actorId',actor,'sources',result);
end $$;
revoke all on function public.totus_tpv_central_cash_context() from public,anon;
grant execute on function public.totus_tpv_central_cash_context() to authenticated;

create function private.totus_tpv_central_cash_page(entries jsonb,page_limit integer) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('items',coalesce((select jsonb_agg(value order by ordinal) from jsonb_array_elements(entries) with ordinality t(value,ordinal) where ordinal<=page_limit),'[]'::jsonb),
  'hasMore',jsonb_array_length(entries)>page_limit,'cursor',case when jsonb_array_length(entries)>page_limit then
   jsonb_build_object('recordedAt',entries->(page_limit-1)->'recordedAt','id',entries->(page_limit-1)->'id') else null end)
$$;
revoke all on function private.totus_tpv_central_cash_page(jsonb,integer) from public,anon,authenticated;

create function public.totus_tpv_central_cash_read(p_selection jsonb,p_section text default 'sessions',p_query jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.totus_tpv_central_cash_actor();source private.totus_tpv_native_profiles;
 session private.totus_tpv_sessions;result jsonb;page_limit integer:=20;search_text text:='';status_text text:='all';
 cursor_time timestamptz;cursor_id uuid;from_date date;to_date date;drawer uuid;
begin
 source:=private.totus_tpv_central_cash_source(p_selection);drawer:=(p_selection->>'drawerId')::uuid;
 if p_section is null or p_section not in ('sessions','session','sales','refunds','movements') or
  jsonb_typeof(p_query) is distinct from 'object' or length(p_query::text)>2000 or p_query-array['search','status','from','to','limit','cursor']<>'{}'::jsonb
 then raise exception 'TPV_CENTRAL_CASH_QUERY_INVALID';end if;
 if p_query?'search' then
  if jsonb_typeof(p_query->'search') is distinct from 'string' or length(p_query->>'search')>100 then raise exception 'TPV_CENTRAL_CASH_QUERY_INVALID';end if;
  search_text:=btrim(p_query->>'search');
 end if;
 if p_query?'status' then
  status_text:=p_query->>'status';if status_text is null or status_text not in ('all','open','closed') or p_section<>'sessions' and status_text<>'all'
  then raise exception 'TPV_CENTRAL_CASH_QUERY_INVALID';end if;
 end if;
 if p_query?'from' then
  if jsonb_typeof(p_query->'from') is distinct from 'string' or (p_query->>'from')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'TPV_CENTRAL_CASH_QUERY_INVALID';end if;
  from_date:=(p_query->>'from')::date;
 end if;
 if p_query?'to' then
  if jsonb_typeof(p_query->'to') is distinct from 'string' or (p_query->>'to')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'TPV_CENTRAL_CASH_QUERY_INVALID';end if;
  to_date:=(p_query->>'to')::date;
 end if;
 if from_date>to_date then raise exception 'TPV_CENTRAL_CASH_QUERY_INVALID';end if;
 if p_query?'limit' then
  if jsonb_typeof(p_query->'limit') is distinct from 'number' or (p_query->>'limit')!~'^[1-9][0-9]?$' then raise exception 'TPV_CENTRAL_CASH_QUERY_INVALID';end if;
  page_limit:=(p_query->>'limit')::integer;if page_limit>50 then raise exception 'TPV_CENTRAL_CASH_QUERY_INVALID';end if;
 end if;
 if p_query?'cursor' then
  if jsonb_typeof(p_query->'cursor') is distinct from 'object' or (p_query->'cursor')-array['recordedAt','id']<>'{}'::jsonb
   or not ((p_query->'cursor') ?& array['recordedAt','id']) then raise exception 'TPV_CENTRAL_CASH_QUERY_INVALID';end if;
  cursor_time:=(p_query->'cursor'->>'recordedAt')::timestamptz;cursor_id:=(p_query->'cursor'->>'id')::uuid;
  if cursor_time is null or cursor_id is null or not isfinite(cursor_time) then raise exception 'TPV_CENTRAL_CASH_QUERY_INVALID';end if;
 end if;
 if p_section='sessions' then
  if p_selection?'sessionId' then raise exception 'TPV_CENTRAL_CASH_QUERY_INVALID';end if;
  select coalesce(jsonb_agg(t.entry order by t.opened_at desc,t.id desc),'[]'::jsonb) into result from (
   select s.id,s.opened_at,(private.totus_tpv_cash_summary(s.id)-'closingRequestId')||jsonb_build_object('id',s.id,'recordedAt',s.opened_at,
    'openedAt',s.opened_at,'drawerName',d.name,'openedByName',coalesce(nullif(btrim(p.full_name),''),'Operador'),
    'currency',s.currency,'environment','qa','storeName',(select name from public.ops_stores where id=s.store_id)) entry
   from private.totus_tpv_sessions s join public.ops_cash_drawers d on d.id=s.drawer_id and d.store_id=s.store_id
   join public.profiles p on p.id=s.opened_by
   where s.connection_id=source.connection_id and s.shop_id=source.shop_id and s.store_id=source.store_id
    and s.environment='qa' and s.currency=source.profile->>'currency' and (drawer is null or s.drawer_id=drawer)
    and (status_text='all' or s.status=status_text) and (cursor_time is null or (s.opened_at,s.id)<(cursor_time,cursor_id))
    and (from_date is null or (s.opened_at at time zone 'Europe/Madrid')::date>=from_date)
    and (to_date is null or (s.opened_at at time zone 'Europe/Madrid')::date<=to_date)
    and (search_text='' or position(lower(search_text) in lower(concat_ws(' ',d.name,p.full_name)))>0)
   order by s.opened_at desc,s.id desc limit page_limit+1
  ) t;return private.totus_tpv_central_cash_page(result,page_limit);
 end if;
 select * into session from private.totus_tpv_sessions s where s.id=(p_selection->>'sessionId')::uuid
  and s.connection_id=source.connection_id and s.shop_id=source.shop_id and s.store_id=source.store_id
  and s.environment='qa' and s.currency=source.profile->>'currency' and (drawer is null or s.drawer_id=drawer);
 if not found then raise exception 'TPV_CENTRAL_CASH_SESSION_NOT_FOUND';end if;
 if p_section='session' then
  if p_query<>'{}'::jsonb then raise exception 'TPV_CENTRAL_CASH_QUERY_INVALID';end if;
  return (private.totus_tpv_cash_summary(session.id)-'closingRequestId')||jsonb_build_object('id',session.id,'openedAt',session.opened_at,
   'currency',session.currency,'environment','qa','storeName',(select name from public.ops_stores where id=session.store_id),
   'drawerName',(select name from public.ops_cash_drawers where id=session.drawer_id),'note',session.closing_note,
   'openedByName',(select coalesce(nullif(btrim(full_name),''),'Operador') from public.profiles where id=session.opened_by),
   'closedByName',(select coalesce(nullif(btrim(full_name),''),'Operador') from public.profiles where id=session.closed_by),
   'cashInCents',coalesce((select sum(amount_cents) from private.totus_tpv_cash_movements where session_id=session.id and kind='cash-in'),0),
   'cashOutCents',coalesce((select sum(amount_cents) from private.totus_tpv_cash_movements where session_id=session.id and kind='cash-out'),0),
   'orderCount',(select count(*) from private.totus_tpv_operations where session_id=session.id and status='confirmed'),
   'refundCount',(select count(*) from private.totus_tpv_refunds where session_id=session.id and status='confirmed'),
   'movementCount',(select count(*) from private.totus_tpv_cash_movements where session_id=session.id));
 end if;
 if p_section='sales' then
  select coalesce(jsonb_agg(t.entry order by t.created_at desc,t.id desc),'[]'::jsonb) into result from (
   select o.id,o.created_at,jsonb_build_object('id',o.id,'saleId',o.id,'orderId',o.order_id,'status',o.status,
    'recordedAt',o.created_at,'totalCents',(o.expected->>'totalCents')::bigint,
    'actorName',(select coalesce(nullif(btrim(full_name),''),'Operador') from public.profiles where id=o.created_by)) entry
   from private.totus_tpv_operations o where o.session_id=session.id
    and (from_date is null or (o.created_at at time zone 'Europe/Madrid')::date>=from_date)
    and (to_date is null or (o.created_at at time zone 'Europe/Madrid')::date<=to_date)
    and (cursor_time is null or (o.created_at,o.id)<(cursor_time,cursor_id))
    and (search_text='' or position(lower(search_text) in lower(coalesce(o.order_id::text,'')))>0)
   order by o.created_at desc,o.id desc limit page_limit+1
  ) t;
 elsif p_section='refunds' then
  select coalesce(jsonb_agg(t.entry order by t.created_at desc,t.id desc),'[]'::jsonb) into result from (
   select r.id,r.created_at,jsonb_build_object('id',r.id,'saleId',r.sale_id,'orderId',o.order_id,'status',r.status,
    'recordedAt',r.created_at,'totalCents',r.total_cents,
    'actorName',(select coalesce(nullif(btrim(full_name),''),'Operador') from public.profiles where id=r.actor_id)) entry
   from private.totus_tpv_refunds r join private.totus_tpv_operations o on o.id=r.sale_id where r.session_id=session.id
    and (from_date is null or (r.created_at at time zone 'Europe/Madrid')::date>=from_date)
    and (to_date is null or (r.created_at at time zone 'Europe/Madrid')::date<=to_date)
    and (cursor_time is null or (r.created_at,r.id)<(cursor_time,cursor_id))
    and (search_text='' or position(lower(search_text) in lower(coalesce(o.order_id::text,'')))>0)
   order by r.created_at desc,r.id desc limit page_limit+1
  ) t;
 else
  select coalesce(jsonb_agg(t.entry order by t.recorded_at desc,t.id desc),'[]'::jsonb) into result from (
   select m.id,m.recorded_at,jsonb_build_object('id',m.id,'recordedAt',m.recorded_at,'kind',m.kind,'amountCents',m.amount_cents,'reason',m.reason,
    'actorName',(select coalesce(nullif(btrim(full_name),''),'Operador') from public.profiles where id=m.actor_id)) entry
   from private.totus_tpv_cash_movements m where m.session_id=session.id
    and (from_date is null or (m.recorded_at at time zone 'Europe/Madrid')::date>=from_date)
    and (to_date is null or (m.recorded_at at time zone 'Europe/Madrid')::date<=to_date)
    and (cursor_time is null or (m.recorded_at,m.id)<(cursor_time,cursor_id))
    and (search_text='' or position(lower(search_text) in lower(m.reason))>0)
   order by m.recorded_at desc,m.id desc limit page_limit+1
  ) t;
 end if;
 return private.totus_tpv_central_cash_page(result,page_limit);
end $$;
revoke all on function public.totus_tpv_central_cash_read(jsonb,text,jsonb) from public,anon;
grant execute on function public.totus_tpv_central_cash_read(jsonb,text,jsonb) to authenticated;
commit;
