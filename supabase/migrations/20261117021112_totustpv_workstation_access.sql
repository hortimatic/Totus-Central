-- Existing assignments remain authoritative. Access changes never delete tills,
-- operators, sales, cash sessions or native data. No new browser table grants.
begin;
set local lock_timeout='5s';
alter table private.totus_tpv_assignments add column access_revision bigint not null default 1 check(access_revision>0);

create function private.totus_tpv_assignment_revision() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if row(new.website_key,new.store_id,new.can_sell,new.can_open,new.can_reconcile,new.active)
  is distinct from row(old.website_key,old.store_id,old.can_sell,old.can_open,old.can_reconcile,old.active)
 then new.access_revision:=old.access_revision+1;else new.access_revision:=old.access_revision;end if;
 return new;
end $$;
revoke all on function private.totus_tpv_assignment_revision() from public,anon,authenticated;
grant execute on function private.totus_tpv_assignment_revision() to service_role;
create trigger totus_tpv_assignment_revision before update on private.totus_tpv_assignments
 for each row execute function private.totus_tpv_assignment_revision();

create table private.totus_tpv_access_changes(
 id uuid primary key,manager_id uuid not null references public.profiles(id),
 connection_id uuid not null references private.totus_api_connections(id),
 operator_id uuid not null references public.profiles(id),drawer_id uuid not null references public.ops_cash_drawers(id),
 shop_id bigint not null check(shop_id>0),request_data jsonb not null,reply jsonb not null,
 recorded_at timestamptz not null default clock_timestamp()
);
alter table private.totus_tpv_access_changes enable row level security;
create policy tpv_access_changes_server on private.totus_tpv_access_changes to service_role using(true) with check(true);
revoke all on private.totus_tpv_access_changes from public,anon,authenticated;
grant select,insert on private.totus_tpv_access_changes to service_role;

create function private.totus_tpv_access_manager(p_actor uuid,p_connection uuid,p_revision bigint) returns void
language plpgsql security invoker set search_path='' as $$
declare manager public.profiles;
begin
 select * into manager from public.profiles where id=p_actor and active;
 if not found or not exists(select 1 from public.team_members t where lower(t.email)=lower(manager.email) and t.active and t.role='admin')
  or not private.totus_module_can(manager.email,'configuracion','edit') then raise exception 'TPV_CONFIGURATION_FORBIDDEN';end if;
 if p_connection is distinct from 'b554f6cc-4df1-412b-b063-e1cbd82d9e66'::uuid or not exists(
  select 1 from private.totus_api_connections c join private.totus_websites w on w.connection_id=c.id
  where c.id=p_connection and c.revision=p_revision and c.verified_revision=c.revision and c.enabled and c.real_data_authorized
   and c.protocol='prestashop' and w.status='active' and w.origin='https://preproduccion.hortimatic.com' and w.include_in_totals=false)
 then raise exception 'TPV_CONTEXT_STALE';end if;
end $$;
revoke all on function private.totus_tpv_access_manager(uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function private.totus_tpv_access_manager(uuid,uuid,bigint) to service_role;

create function public.totus_tpv_workstation_access(p_actor uuid,p_connection uuid,p_revision bigint) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 perform private.totus_tpv_access_manager(p_actor,p_connection,p_revision);
 if (select count(*) from private.totus_tpv_assignments where connection_id=p_connection and environment='qa')>2000
 then raise exception 'TPV_ACCESS_LIST_LIMIT';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'operatorId',a.actor_id,'operatorName',coalesce(nullif(btrim(p.full_name),''),'Operador'),'operatorActive',p.active,
  'storeId',a.store_id,'storeName',s.name,'drawerId',a.drawer_id,'drawerName',d.name,'drawerActive',d.active and s.active,
  'shopId',a.shop_id,'active',a.active,'revision',a.access_revision,
  'permissions',jsonb_build_object('sell',a.can_sell,'open',a.can_open,'reconcile',a.can_reconcile))
  order by s.name,d.name,p.full_name,a.actor_id),'[]'::jsonb) into result
 from private.totus_tpv_assignments a join public.profiles p on p.id=a.actor_id
 join public.ops_stores s on s.id=a.store_id join public.ops_cash_drawers d on d.id=a.drawer_id and d.store_id=s.id
 where a.connection_id=p_connection and a.environment='qa';
 return jsonb_build_object('connectionId',p_connection,'revision',p_revision,'items',result);
end $$;
revoke all on function public.totus_tpv_workstation_access(uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.totus_tpv_workstation_access(uuid,uuid,bigint) to service_role;

create function public.totus_tpv_update_workstation_access(p_actor uuid,p_connection uuid,p_revision bigint,p_request_id uuid,p_data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare existing private.totus_tpv_access_changes; assignment private.totus_tpv_assignments; previous jsonb; result jsonb;
 target_operator uuid; target_drawer uuid; shop bigint; expected bigint; permissions jsonb;
begin
 perform private.totus_tpv_access_manager(p_actor,p_connection,p_revision);
 if p_request_id is null or jsonb_typeof(p_data) is distinct from 'object' or length(p_data::text)>2000
  or p_data-array['operatorId','drawerId','shopId','expectedRevision','permissions','active']<>'{}'::jsonb
  or jsonb_typeof(p_data->'active') is distinct from 'boolean'
  or coalesce(p_data->>'operatorId','') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  or coalesce(p_data->>'drawerId','') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  or jsonb_typeof(p_data->'shopId') is distinct from 'number' or coalesce(p_data->>'shopId','') !~ '^[1-9][0-9]{0,9}$'
  or jsonb_typeof(p_data->'expectedRevision') is distinct from 'number' or coalesce(p_data->>'expectedRevision','') !~ '^[1-9][0-9]{0,14}$'
 then raise exception 'TPV_ACCESS_REQUEST_INVALID';end if;
 permissions:=p_data->'permissions';
 if jsonb_typeof(permissions) is distinct from 'object' or permissions-array['sell','open','reconcile']<>'{}'::jsonb
  or exists(select 1 from jsonb_each(permissions) e where jsonb_typeof(e.value) is distinct from 'boolean')
  or not(permissions?&array['sell','open','reconcile'])
  or (p_data->'active'='true'::jsonb and permissions->'reconcile' is distinct from 'true'::jsonb)
 then raise exception 'TPV_ACCESS_REQUEST_INVALID';end if;
 target_operator:=(p_data->>'operatorId')::uuid;target_drawer:=(p_data->>'drawerId')::uuid;
 shop:=(p_data->>'shopId')::bigint;expected:=(p_data->>'expectedRevision')::bigint;
 perform pg_advisory_xact_lock(hashtextextended('totus-tpv-access-request:'||p_request_id::text,0));
 select * into existing from private.totus_tpv_access_changes where id=p_request_id;
 if found then
  if existing.manager_id<>p_actor or existing.connection_id<>p_connection or existing.request_data is distinct from p_data
  then raise exception 'TPV_ACCESS_REQUEST_ALREADY_BOUND';end if;
  return existing.reply;
 end if;
 select * into assignment from private.totus_tpv_assignments
  where actor_id=target_operator and connection_id=p_connection and shop_id=shop and drawer_id=target_drawer and environment='qa' for update;
 if not found then raise exception 'TPV_ACCESS_ASSIGNMENT_NOT_FOUND';end if;
 if assignment.access_revision<>expected then raise exception 'TPV_ACCESS_CHANGED';end if;
 if p_data->'active'='true'::jsonb and not exists(
  select 1 from public.profiles p join public.ops_stores s on s.id=assignment.store_id and s.active
   join public.ops_cash_drawers d on d.id=assignment.drawer_id and d.store_id=s.id and d.active
   join private.totus_tpv_native_profiles n on n.connection_id=assignment.connection_id and n.shop_id=assignment.shop_id
    and n.store_id=s.id and n.website_key=assignment.website_key and n.connection_revision=p_revision
  where p.id=assignment.actor_id and p.active)
 then raise exception 'TPV_ACCESS_TARGET_INACTIVE';end if;
 previous:=jsonb_build_object('revision',assignment.access_revision,'active',assignment.active,
  'permissions',jsonb_build_object('sell',assignment.can_sell,'open',assignment.can_open,'reconcile',assignment.can_reconcile));
 update private.totus_tpv_assignments set can_sell=(permissions->>'sell')::boolean,can_open=(permissions->>'open')::boolean,
  can_reconcile=(permissions->>'reconcile')::boolean,active=(p_data->>'active')::boolean
  where actor_id=target_operator and connection_id=p_connection and shop_id=shop and drawer_id=target_drawer and environment='qa'
  returning * into assignment;
 result:=jsonb_build_object('connectionId',p_connection,'operatorId',target_operator,'drawerId',target_drawer,'shopId',shop,
  'revision',assignment.access_revision,'active',assignment.active,'permissions',permissions,'previous',previous);
 insert into private.totus_tpv_access_changes(id,manager_id,connection_id,operator_id,drawer_id,shop_id,request_data,reply)
  values(p_request_id,p_actor,p_connection,target_operator,target_drawer,shop,p_data,result);
 return result;
end $$;
revoke all on function public.totus_tpv_update_workstation_access(uuid,uuid,bigint,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.totus_tpv_update_workstation_access(uuid,uuid,bigint,uuid,jsonb) to service_role;
-- Summary and immutable replay stay readable; only a new cash write needs cash-management permission.
create or replace function public.totus_tpv_cash(p_action text,p_request_id uuid,p_scope jsonb,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s private.totus_tpv_sessions; m private.totus_tpv_cash_movements; balance bigint; amount bigint; actor uuid;
begin
 if p_action not in ('summary','movement','close') or p_request_id is null or jsonb_typeof(p_data)<>'object'
 then raise exception 'TPV_CASH_REQUEST_INVALID';end if;
 perform private.totus_tpv_authorize(p_scope,'reconcile');
 actor:=(p_scope->>'actorId')::uuid;
 select * into s from private.totus_tpv_sessions where id=(p_scope->>'sessionId')::uuid for update;
 if not found then raise exception 'TPV_CASH_SESSION_MISMATCH';end if;
 if p_action='summary' then return private.totus_tpv_cash_summary(s.id);end if;
 if p_action='close' and s.closing_request_id=p_request_id then
  if s.closed_by<>actor or s.counted_cents is distinct from (p_data->>'countedCents')::bigint
    or s.closing_note is distinct from (p_data->>'note') then raise exception 'TPV_CASH_REQUEST_ALREADY_BOUND';end if;
  return private.totus_tpv_cash_summary(s.id);
 end if;
 if p_action='movement' then
  select * into m from private.totus_tpv_cash_movements where id=p_request_id;
  if found then
   if m.session_id<>s.id or m.actor_id<>actor or m.kind is distinct from p_data->>'kind'
    or m.amount_cents is distinct from (p_data->>'amountCents')::bigint or m.reason is distinct from p_data->>'reason'
    then raise exception 'TPV_CASH_REQUEST_ALREADY_BOUND';end if;
   return private.totus_tpv_cash_summary(s.id);
  end if;
 end if;
 perform private.totus_tpv_authorize(p_scope,'open');
 if s.status<>'open' then raise exception 'TPV_CASH_SESSION_CLOSED';end if;
 balance:=coalesce((private.totus_tpv_cash_summary(s.id)->>'availableCashCents')::bigint,
  (private.totus_tpv_cash_summary(s.id)->>'expectedCashCents')::bigint);
 if p_action='movement' then
  if (p_data - array['kind','amountCents','reason'])<>'{}'::jsonb
   or coalesce(p_data->>'kind','') not in ('cash-in','cash-out') or coalesce(p_data->>'amountCents','') !~ '^[1-9][0-9]{0,11}$'
   or jsonb_typeof(p_data->'reason') is distinct from 'string' or length(btrim(p_data->>'reason')) not between 1 and 500
   then raise exception 'TPV_CASH_MOVEMENT_INVALID';end if;
  amount:=(p_data->>'amountCents')::bigint;
  if amount>100000000000 or (p_data->>'kind'='cash-out' and amount>balance)
   or (p_data->>'kind'='cash-in' and balance+amount>100000000000) then raise exception 'TPV_CASH_BALANCE_INVALID';end if;
  insert into private.totus_tpv_cash_movements(id,session_id,actor_id,kind,amount_cents,reason)
   values(p_request_id,s.id,actor,p_data->>'kind',amount,p_data->>'reason');
 else
  if (p_data - array['countedCents','note'])<>'{}'::jsonb or coalesce(p_data->>'countedCents','') !~ '^(0|[1-9][0-9]{0,11})$'
   or jsonb_typeof(p_data->'note') is distinct from 'string' or length(p_data->>'note')>500 then raise exception 'TPV_CASH_COUNT_INVALID';end if;
  amount:=(p_data->>'countedCents')::bigint;
  if amount>100000000000 then raise exception 'TPV_CASH_COUNT_INVALID';end if;
  if not private.totus_tpv_cash_can_close(s.id)
   then raise exception 'TPV_UNRESOLVED_SALES';end if;
  update private.totus_tpv_sessions set status='closed',closed_at=clock_timestamp(),counted_cents=amount,
   closed_by=actor,closing_request_id=p_request_id,closing_note=p_data->>'note' where id=s.id;
 end if;
 return private.totus_tpv_cash_summary(s.id);
end $$;
revoke all on function private.totus_tpv_cash_summary(uuid),private.totus_tpv_cash_can_close(uuid),public.totus_tpv_cash(text,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function private.totus_tpv_cash_summary(uuid),private.totus_tpv_cash_can_close(uuid),public.totus_tpv_cash(text,uuid,jsonb,jsonb) to service_role;
-- Narrow read checks the current assignment without borrowing or opening a cash session.
create or replace function private.totus_tpv_authorize(p_scope jsonb,p_action text) returns void
language plpgsql security invoker set search_path='' as $$
declare actor public.profiles; assignment private.totus_tpv_assignments; session private.totus_tpv_sessions;
begin
 if p_scope->>'environment' is distinct from 'qa' then raise exception 'TPV_ENVIRONMENT_FORBIDDEN';end if;
 if p_action not in ('sell','reconcile','open','read') then raise exception 'TPV_ACTION_INVALID';end if;
 select * into actor from public.profiles where id=(p_scope->>'actorId')::uuid and active;
 if not found then raise exception 'TPV_ACTOR_INACTIVE';end if;
 if not private.totus_module_can(actor.email,'ventas',case when p_action in ('reconcile','read') then 'view' else 'create' end)
  or not private.totus_module_can(actor.email,'cajas',case when p_action in ('reconcile','read') then 'view' else 'create' end)
  then raise exception 'TPV_SELL_FORBIDDEN';end if;
 select a.* into assignment from private.totus_tpv_assignments a
 join private.totus_api_connections c on c.id=a.connection_id
 join private.totus_websites w on w.key=a.website_key and w.connection_id=c.id
 join public.ops_stores s on s.id=a.store_id and s.active
 join public.ops_cash_drawers d on d.id=a.drawer_id and d.store_id=s.id and d.active
 where a.actor_id=actor.id and a.active and a.environment=p_scope->>'environment' and a.connection_id=(p_scope->>'connectionId')::uuid
  and a.shop_id=(p_scope->>'shopId')::bigint and a.store_id=(p_scope->>'storeId')::uuid
  and a.drawer_id=(p_scope->>'drawerId')::uuid and w.status='active'
  and (w.business_id=s.id or (w.business_id is null and w.include_in_totals=false
   and w.origin='https://preproduccion.hortimatic.com' and exists(select 1 from private.totus_tpv_native_profiles p
    where p.connection_id=c.id and p.shop_id=a.shop_id and p.store_id=s.id and p.website_key=w.key and p.connection_revision=c.revision)))
  and c.enabled and c.real_data_authorized and c.protocol='prestashop'
  and c.revision=(p_scope->>'connectionRevision')::bigint and c.verified_revision=c.revision;
 if not found then raise exception 'TPV_ASSIGNMENT_OR_CONNECTION_INVALID';end if;
 if (p_action='sell' and not assignment.can_sell) or (p_action in ('reconcile','read') and not assignment.can_reconcile)
  or (p_action='open' and not assignment.can_open) then raise exception 'TPV_ACTION_FORBIDDEN';end if;
 if p_action='read' and not exists(select 1 from private.totus_tpv_native_profiles n
  where n.connection_id=assignment.connection_id and n.shop_id=assignment.shop_id and n.connection_revision=(p_scope->>'connectionRevision')::bigint
   and n.store_id=assignment.store_id and n.website_key=assignment.website_key and n.profile->>'currency'=p_scope->>'currency')
 then raise exception 'TPV_ASSIGNMENT_OR_CONNECTION_INVALID';end if;
 if p_action not in ('open','read') then
  select * into session from private.totus_tpv_sessions where id=(p_scope->>'sessionId')::uuid for share;
  if not found or session.store_id<>assignment.store_id or session.connection_id<>assignment.connection_id
   or session.shop_id<>assignment.shop_id or session.drawer_id<>assignment.drawer_id
   or session.currency is distinct from p_scope->>'currency' or session.environment is distinct from p_scope->>'environment'
   or (p_action='sell' and session.status<>'open') then raise exception 'TPV_CASH_SESSION_MISMATCH';end if;
 end if;
end $$;

revoke all on function private.totus_tpv_authorize(jsonb,text) from public,anon,authenticated;
grant execute on function private.totus_tpv_authorize(jsonb,text) to service_role;
create or replace function public.totus_tpv_orders(p_scope jsonb,p_order_id bigint default null,p_sale_id uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 perform private.totus_tpv_authorize(p_scope,'read');
 if p_order_id is not null and p_order_id<=0 then raise exception 'TPV_ORDER_QUERY_INVALID';end if;
 select coalesce(jsonb_agg(t.entry order by t.created_at desc,t.id desc),'[]'::jsonb) into result from (
  select o.id,o.created_at,private.totus_tpv_operation_json(o)||jsonb_build_object(
   'operatorName',(select nullif(btrim(p.full_name),'') from public.profiles p where p.id=o.created_by),
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
