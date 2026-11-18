begin;
set local lock_timeout='5s';
-- A cashier report must stay in the drawer whose reconciliation access was
-- authorized, including when a foreign session ID is requested explicitly.
create or replace function public.totus_tpv_cash_reports(p_scope jsonb,p_session_id uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare sample uuid; result jsonb;
begin
 -- Authorization uses a server-selected historical session of the assigned
 -- drawer. Reports therefore never require opening a new cash session.
 select s.id into sample from private.totus_tpv_sessions s
 where s.connection_id=(p_scope->>'connectionId')::uuid and s.store_id=(p_scope->>'storeId')::uuid
  and s.shop_id=(p_scope->>'shopId')::bigint and s.drawer_id=(p_scope->>'drawerId')::uuid
  and s.environment=p_scope->>'environment' and s.currency=p_scope->>'currency'
 order by s.opened_at desc,s.id desc limit 1;
 if sample is null then
  -- No financial records can be returned. The authenticated handler has
  -- already checked the current assignment; this RPC is service-only.
  return '[]'::jsonb;
 end if;
 perform private.totus_tpv_authorize(jsonb_set(p_scope,'{sessionId}',to_jsonb(sample)),'reconcile');
 select coalesce(jsonb_agg(t.entry order by t.opened_at desc,t.id desc),'[]'::jsonb) into result from (
  select s.id,s.opened_at,private.totus_tpv_cash_summary(s.id)||jsonb_build_object(
   'storeName',(select name from public.ops_stores where id=s.store_id),
   'drawerName',(select name from public.ops_cash_drawers where id=s.drawer_id),
   'openedAt',s.opened_at,'openedBy',s.opened_by,'closedBy',s.closed_by,'note',s.closing_note,
   'openedByName',(select coalesce(to_jsonb(p)->>'full_name','Operador') from public.profiles p where p.id=s.opened_by),
   'closedByName',(select coalesce(to_jsonb(p)->>'full_name','Operador') from public.profiles p where p.id=s.closed_by),
   'currency',s.currency,'environment',s.environment,'generatedAt',clock_timestamp(),
   'orderCount',(select count(*) from private.totus_tpv_operations o where o.session_id=s.id and o.status='confirmed'),
   'refundCount',(select count(*) from private.totus_tpv_refunds r where r.session_id=s.id and r.status='confirmed'),
   'movementCount',(select count(*) from private.totus_tpv_cash_movements m where m.session_id=s.id),
   'movements',case when p_session_id is null then '[]'::jsonb else coalesce((select jsonb_agg(m.entry order by m.recorded_at,m.id) from (
    select m.id,m.recorded_at,jsonb_build_object('id',m.id,'kind',m.kind,'amountCents',m.amount_cents,
     'reason',m.reason,'actorId',m.actor_id,'recordedAt',m.recorded_at) entry
    from private.totus_tpv_cash_movements m where m.session_id=s.id order by m.recorded_at desc,m.id desc limit 200
   ) m),'[]'::jsonb) end) entry
  from private.totus_tpv_sessions s where s.connection_id=(p_scope->>'connectionId')::uuid
   and s.store_id=(p_scope->>'storeId')::uuid and s.shop_id=(p_scope->>'shopId')::bigint
   and s.environment=p_scope->>'environment' and s.currency=p_scope->>'currency'
   and s.drawer_id=(p_scope->>'drawerId')::uuid
   and (p_session_id is null or s.id=p_session_id)
  order by s.opened_at desc,s.id desc limit 30
 ) t;
 return result;
end $$;
revoke all on function public.totus_tpv_cash_reports(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.totus_tpv_cash_reports(jsonb,uuid) to service_role;
commit;
