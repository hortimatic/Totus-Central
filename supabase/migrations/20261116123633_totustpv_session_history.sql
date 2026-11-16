-- Bounded operational history; no public table grants or customer contact data.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create function public.totus_tpv_history(p_scope jsonb,p_before timestamptz default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 perform private.totus_tpv_authorize(p_scope,'reconcile');
 select coalesce(jsonb_agg(t.entry order by t.created_at desc,t.id desc),'[]'::jsonb) into result from (
  select o.id,o.created_at,jsonb_build_object('id',o.id,'status',o.status,'orderId',o.order_id,
   'createdAt',o.created_at,'totalCents',(o.expected->>'totalCents')::bigint,'currency',o.currency,
   'lines',o.expected->'lines','payments',coalesce(o.payments,'[]'::jsonb),
   'refunds',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'status',r.status,'totalCents',r.total_cents)
    order by r.created_at,r.id) from private.totus_tpv_refunds r where r.sale_id=o.id),'[]'::jsonb)) entry
  from private.totus_tpv_operations o where o.session_id=(p_scope->>'sessionId')::uuid
   and o.connection_id=(p_scope->>'connectionId')::uuid and o.store_id=(p_scope->>'storeId')::uuid
   and o.drawer_id=(p_scope->>'drawerId')::uuid and o.shop_id=(p_scope->>'shopId')::bigint
   and o.environment=p_scope->>'environment' and (p_before is null or o.created_at<p_before)
  order by o.created_at desc,o.id desc limit 100
 ) t;
 return result;
end $$;
revoke all on function public.totus_tpv_history(jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.totus_tpv_history(jsonb,timestamptz) to service_role;
commit;
