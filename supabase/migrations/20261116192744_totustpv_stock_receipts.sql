-- Immutable receiving manifests precede native writes. Individual commands
-- retain the existing single-dispatch journal and stable server-generated IDs.
begin;
create table private.totus_tpv_stock_receipts (
 id uuid primary key,
 scope jsonb not null check(jsonb_typeof(scope)='object'),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 lines jsonb not null check(jsonb_typeof(lines)='array' and jsonb_array_length(lines) between 1 and 200),
 status text not null default 'pending' check(status in ('pending','processing','verified','cancelled')),
 created_at timestamptz not null default clock_timestamp(),
 verified_at timestamptz
);
create index totus_tpv_stock_receipts_session on private.totus_tpv_stock_receipts((scope->>'sessionId'),created_at);
alter table private.totus_tpv_stock_receipts enable row level security;
create policy tpv_stock_receipts_server on private.totus_tpv_stock_receipts to service_role using(true) with check(true);
revoke all on private.totus_tpv_stock_receipts from public,anon,authenticated;
grant select,insert,update on private.totus_tpv_stock_receipts to service_role;

create function public.totus_tpv_stock_receipts(p_action text,p_id uuid,p_scope jsonb,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r private.totus_tpv_stock_receipts; entry jsonb; manifest jsonb:='[]'; details jsonb; pending bigint; output jsonb:='[]';
begin
 if p_action not in ('create','get','list','cancel','start') or jsonb_typeof(p_data) is distinct from 'object'
  then raise exception 'TPV_STOCK_RECEIPT_INVALID';end if;
 perform private.totus_tpv_authorize(p_scope,case when p_action in ('create','start') then 'sell' else 'reconcile' end);
 if not private.totus_module_can((select email from public.profiles where id=(p_scope->>'actorId')::uuid),'productos','edit')
  then raise exception 'TPV_STOCK_FORBIDDEN';end if;
 if p_action='create' then
  if p_id is null or p_data-array['reason','lines']<>'{}'::jsonb or length(p_data::text)>100000
   or jsonb_typeof(p_data->'reason') is distinct from 'string' or length(trim(p_data->>'reason')) not between 1 and 500
   or jsonb_typeof(p_data->'lines') is distinct from 'array' then raise exception 'TPV_STOCK_RECEIPT_INVALID';end if;
  if jsonb_array_length(p_data->'lines') not between 1 and 200 then raise exception 'TPV_STOCK_RECEIPT_INVALID';end if;
  for entry in select value from jsonb_array_elements(p_data->'lines') loop
   if jsonb_typeof(entry) is distinct from 'object' or entry-array['productId','attributeId','quantity','label']<>'{}'::jsonb
    or jsonb_typeof(entry->'productId') is distinct from 'number' or jsonb_typeof(entry->'attributeId') is distinct from 'number'
    or jsonb_typeof(entry->'quantity') is distinct from 'number'
    or coalesce(entry->>'productId','') !~ '^[1-9][0-9]{0,9}$' or (entry->>'productId')::bigint>2147483647
    or coalesce(entry->>'attributeId','') !~ '^(0|[1-9][0-9]{0,9})$' or (entry->>'attributeId')::bigint>2147483647
    or coalesce(entry->>'quantity','') !~ '^[1-9][0-9]{0,4}$' or (entry->>'quantity')::integer>10000
    or jsonb_typeof(entry->'label') is distinct from 'string' or length(entry->>'label') not between 1 and 300
    then raise exception 'TPV_STOCK_RECEIPT_INVALID';end if;
   manifest:=manifest||jsonb_build_array(entry||jsonb_build_object('operationId',gen_random_uuid()));
  end loop;
  if exists(select 1 from jsonb_array_elements(p_data->'lines') l group by l->>'productId',l->>'attributeId' having count(*)>1)
   then raise exception 'TPV_STOCK_RECEIPT_DUPLICATE_PRODUCT';end if;
  if not exists(select 1 from private.totus_tpv_stock_receipts where id=p_id) and
   (select count(*) from private.totus_tpv_stock_receipts where scope=p_scope and status in ('pending','processing'))>=20
   then raise exception 'TPV_STOCK_RECEIPT_PENDING_LIMIT';end if;
  insert into private.totus_tpv_stock_receipts(id,scope,payload,lines) values(p_id,p_scope,p_data,manifest) on conflict(id) do nothing;
 end if;
 for r in select * from private.totus_tpv_stock_receipts s where
  (p_action='list' and s.scope=p_scope or p_action<>'list' and s.id=p_id)
  order by (s.status in ('pending','processing')) desc,s.created_at desc limit 100 for update loop
  if r.scope is distinct from p_scope or p_action='create' and r.payload is distinct from p_data
   then raise exception 'TPV_STOCK_RECEIPT_ALREADY_BOUND';end if;
  if p_action='cancel' then
   if r.status not in ('pending','cancelled') or exists(select 1 from jsonb_array_elements(r.lines) l
    join private.totus_tpv_native_commands c on c.id=(l->>'operationId')::uuid)
    then raise exception 'TPV_STOCK_RECEIPT_STARTED';end if;
   update private.totus_tpv_stock_receipts set status='cancelled' where id=r.id returning * into r;
  end if;
  if p_action='start' and r.status='pending' then
   update private.totus_tpv_stock_receipts set status='processing' where id=r.id returning * into r;
  end if;
  select jsonb_agg(l||jsonb_build_object('status',coalesce(c.status,'pending'),'result',c.result) order by ordinal),
   count(*) filter(where c.status is distinct from 'verified') into details,pending
   from jsonb_array_elements(r.lines) with ordinality a(l,ordinal)
   left join private.totus_tpv_native_commands c on c.id=(l->>'operationId')::uuid and c.scope=r.scope
    and c.command='stock.receive' and c.payload=jsonb_build_object('product_id',(l->>'productId')::bigint,
     'attribute_id',(l->>'attributeId')::bigint,'quantity',(l->>'quantity')::integer,'reason',r.payload->>'reason');
  if pending=0 and r.status in ('pending','processing') then
   update private.totus_tpv_stock_receipts set status='verified',verified_at=clock_timestamp() where id=r.id returning * into r;
  end if;
  output:=output||jsonb_build_array(jsonb_build_object('id',r.id,'reason',r.payload->>'reason','lines',details,
   'status',r.status,'createdAt',r.created_at,'verifiedAt',r.verified_at));
 end loop;
 if p_action='list' then return output;end if;
 if jsonb_array_length(output)=0 then raise exception 'TPV_STOCK_RECEIPT_NOT_FOUND';end if;
 return output->0;
end $$;
revoke all on function public.totus_tpv_stock_receipts(text,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.totus_tpv_stock_receipts(text,uuid,jsonb,jsonb) to service_role;

-- A pending manifest must be completed before its cash session can be closed.
-- This also prevents concurrent close/receive from changing its bound scope.
create function private.totus_tpv_stock_before_close() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='closed' and old.status is distinct from new.status and exists(
  select 1 from private.totus_tpv_stock_receipts r where r.scope->>'sessionId'=old.id::text and r.status in ('pending','processing'))
 then raise exception 'TPV_STOCK_RECEIPT_PENDING';end if;
 return new;
end $$;
revoke all on function private.totus_tpv_stock_before_close() from public,anon,authenticated;
create trigger totus_tpv_stock_before_close before update on private.totus_tpv_sessions
 for each row execute function private.totus_tpv_stock_before_close();
commit;
