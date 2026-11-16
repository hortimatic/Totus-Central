-- Read-only historical access uses the current authorized till. It never
-- adopts an old cash session for a new sale, return or payment.
begin;
create function public.totus_tpv_orders(p_scope jsonb,p_order_id bigint default null,p_sale_id uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 perform private.totus_tpv_authorize(p_scope,'reconcile');
 if p_order_id is not null and p_order_id<=0 then raise exception 'TPV_ORDER_QUERY_INVALID';end if;
 select coalesce(jsonb_agg(t.entry order by t.created_at desc,t.id desc),'[]'::jsonb) into result from (
  select o.id,o.created_at,private.totus_tpv_operation_json(o)||jsonb_build_object(
   'createdAt',o.created_at,'drawerName',(select d.name from public.ops_cash_drawers d where d.id=o.drawer_id),
   'totalCents',(o.expected->>'totalCents')::bigint,
   'lines',o.expected->'lines','refunds',coalesce((select jsonb_agg(jsonb_build_object(
    'id',r.id,'status',r.status,'totalCents',r.total_cents,'actorId',r.actor_id) order by r.created_at,r.id)
    from private.totus_tpv_refunds r where r.sale_id=o.id),'[]'::jsonb)) entry
  from private.totus_tpv_operations o where o.status='confirmed'
   and o.connection_id=(p_scope->>'connectionId')::uuid and o.store_id=(p_scope->>'storeId')::uuid
   and o.shop_id=(p_scope->>'shopId')::bigint
   and o.currency=p_scope->>'currency' and o.environment=p_scope->>'environment'
   and (p_order_id is null or o.order_id=p_order_id) and (p_sale_id is null or o.id=p_sale_id)
  order by o.created_at desc,o.id desc limit 100
 ) t;
 return result;
end $$;
revoke all on function public.totus_tpv_orders(jsonb,bigint,uuid) from public,anon,authenticated;
grant execute on function public.totus_tpv_orders(jsonb,bigint,uuid) to service_role;
commit;
