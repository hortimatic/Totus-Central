-- Durable pre-sale tickets, scoped to an existing store/drawer. No catalogue
-- copies, stock reservations, money or native orders are created by parking.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create table private.totus_tpv_drafts (
 id uuid primary key,connection_id uuid not null references private.totus_api_connections(id),
 store_id uuid not null references public.ops_stores(id),drawer_id uuid not null references public.ops_cash_drawers(id),
 shop_id bigint not null check(shop_id>0),environment text not null check(environment='qa'),
 created_by uuid not null references public.profiles(id),claimed_by uuid references public.profiles(id),
 claimed_session uuid references private.totus_tpv_sessions(id),
 version bigint not null default 0 check(version>=0),status text not null default 'parked'
  check(status in ('parked','claimed','checkout','sold','archived')),
 label text not null default '' check(length(label)<=120),payload jsonb not null default '{}',
 checkout_id uuid,order_id bigint,created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp()
);
create unique index tpv_draft_checkout_unique on private.totus_tpv_drafts(checkout_id) where checkout_id is not null;
create index tpv_draft_drawer on private.totus_tpv_drafts(drawer_id,environment,updated_at desc,id desc);
create table private.totus_tpv_draft_requests (
 id uuid primary key,draft_id uuid not null references private.totus_tpv_drafts(id),
 actor_id uuid not null references public.profiles(id),action text not null,data jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table private.totus_tpv_drafts enable row level security;
alter table private.totus_tpv_draft_requests enable row level security;
create policy tpv_draft_server on private.totus_tpv_drafts to service_role using(true) with check(true);
create policy tpv_draft_request_server on private.totus_tpv_draft_requests to service_role using(true) with check(true);
revoke all on private.totus_tpv_drafts,private.totus_tpv_draft_requests from public,anon,authenticated;
grant select,insert,update on private.totus_tpv_drafts to service_role;
grant select,insert on private.totus_tpv_draft_requests to service_role;

create function private.totus_tpv_draft_payload(p jsonb) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare line jsonb; discount jsonb; seen text[]:='{}'; identity text; field text;
begin
 if jsonb_typeof(p) is distinct from 'object' or (p-array['lines','customerId','invoiceAddressId','deliveryAddressId','adjustment','coupon'])<>'{}'::jsonb
  or length(p::text)>60000 or jsonb_typeof(p->'lines') is distinct from 'array' or jsonb_array_length(p->'lines') not between 1 and 200
  then raise exception 'TPV_DRAFT_PAYLOAD_INVALID';end if;
 foreach field in array array['customerId','invoiceAddressId','deliveryAddressId'] loop
  if p ? field and (jsonb_typeof(p->field)<>'number' or coalesce(p->>field,'') !~ '^[1-9][0-9]{0,9}$' or (p->>field)::bigint>2147483647)
   then raise exception 'TPV_DRAFT_PAYLOAD_INVALID';end if;
 end loop;
 if (p ? 'customerId') is distinct from (p ? 'invoiceAddressId') or (p ? 'customerId') is distinct from (p ? 'deliveryAddressId')
  then raise exception 'TPV_DRAFT_PAYLOAD_INVALID';end if;
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
 for discount in select value->'discount' from jsonb_array_elements(p->'lines') where value ? 'discount'
  union all select p->'adjustment' where p ? 'adjustment' loop
  if jsonb_typeof(discount)<>'object' or (discount-array['kind','value'])<>'{}'::jsonb
   or jsonb_typeof(discount->'value') is distinct from 'number'
   or coalesce(discount->>'kind','') not in ('percent','amount') or coalesce(discount->>'value','') !~ '^[1-9][0-9]{0,11}$'
   or (discount->>'value')::bigint>100000000000 or (discount->>'kind'='percent' and (discount->>'value')::bigint>=10000)
   then raise exception 'TPV_DRAFT_PAYLOAD_INVALID';end if;
 end loop;
 return p;
end $$;

create function private.totus_tpv_draft_json(d private.totus_tpv_drafts,p_actor uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',d.id,'version',d.version,'status',d.status,'label',d.label,'payload',d.payload,
  'mine',coalesce(d.claimed_by=p_actor,false),'sessionId',d.claimed_session,'checkoutId',d.checkout_id,'orderId',d.order_id,'updatedAt',d.updated_at)
$$;
create function public.totus_tpv_drafts(p_action text,p_id uuid,p_request_id uuid,p_scope jsonb,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare d private.totus_tpv_drafts;r private.totus_tpv_draft_requests;actor uuid:=(p_scope->>'actorId')::uuid;
 current_session uuid:=(p_scope->>'sessionId')::uuid;payload jsonb;result jsonb;
begin
 if p_action is null or p_action not in ('list','get','park','claim','bind','release','archive') or p_request_id is null or jsonb_typeof(p_data)<>'object'
  then raise exception 'TPV_DRAFT_REQUEST_INVALID';end if;
 perform private.totus_tpv_authorize(p_scope,case when p_action in ('list','get') then 'reconcile' else 'sell' end);
 if p_action not in ('list','get') and coalesce(p_data->>'version','') !~ '^(0|[1-9][0-9]{0,11})$'
  then raise exception 'TPV_DRAFT_REQUEST_INVALID';end if;
 if p_action='list' then
  select coalesce(jsonb_agg(t.result order by t.updated_at desc,t.id desc),'[]') into result from (
   select x.id,x.updated_at,(private.totus_tpv_draft_json(x,actor)-'payload')||jsonb_build_object('lineCount',jsonb_array_length(x.payload->'lines')) result from private.totus_tpv_drafts x
   where x.connection_id=(p_scope->>'connectionId')::uuid and x.drawer_id=(p_scope->>'drawerId')::uuid
    and x.store_id=(p_scope->>'storeId')::uuid and x.shop_id=(p_scope->>'shopId')::bigint and x.environment=p_scope->>'environment'
    and x.status in ('parked','claimed','checkout') order by x.updated_at desc,x.id desc limit 100
  ) t;return result;
 end if;
 if p_id is null then raise exception 'TPV_DRAFT_REQUEST_INVALID';end if;
 if p_action='park' and coalesce((p_data->>'version')::bigint,-1)=0 then
  insert into private.totus_tpv_drafts(id,connection_id,store_id,drawer_id,shop_id,environment,created_by)
   values(p_id,(p_scope->>'connectionId')::uuid,(p_scope->>'storeId')::uuid,(p_scope->>'drawerId')::uuid,
    (p_scope->>'shopId')::bigint,p_scope->>'environment',actor) on conflict(id) do nothing;
 end if;
 select * into d from private.totus_tpv_drafts where id=p_id for update;
 if not found then raise exception 'TPV_DRAFT_NOT_FOUND';end if;
 if d.connection_id<>(p_scope->>'connectionId')::uuid or d.drawer_id<>(p_scope->>'drawerId')::uuid
  or d.store_id<>(p_scope->>'storeId')::uuid or d.shop_id<>(p_scope->>'shopId')::bigint or d.environment is distinct from p_scope->>'environment'
  then raise exception 'TPV_DRAFT_SCOPE_MISMATCH';end if;
 if p_action='get' then return private.totus_tpv_draft_json(d,actor);end if;
 select * into r from private.totus_tpv_draft_requests where id=p_request_id;
 if found then
  if r.draft_id<>p_id or r.actor_id<>actor or r.action<>p_action or r.data is distinct from p_data
   then raise exception 'TPV_DRAFT_REQUEST_ALREADY_BOUND';end if;
  return private.totus_tpv_draft_json(d,actor);
 end if;
 if coalesce(p_data->>'version','') !~ '^(0|[1-9][0-9]{0,11})$' or (p_data->>'version')::bigint<>d.version
  then raise exception 'TPV_DRAFT_STALE';end if;
 if p_action='claim' then
  if (p_data-array['version'])<>'{}'::jsonb or not (d.status='parked' or
   (d.status='claimed' and (d.claimed_by=actor or exists(select 1 from private.totus_tpv_sessions where id=d.claimed_session and status='closed'))) or
   (d.status='checkout' and exists(select 1 from private.totus_tpv_sessions where id=d.claimed_session and status='closed')
    and not exists(select 1 from private.totus_tpv_operations where id=d.checkout_id and status<>'ready')))
   then raise exception 'TPV_DRAFT_IN_USE';end if;
  d.status:='claimed';d.claimed_by:=actor;d.claimed_session:=current_session;d.checkout_id:=null;
 elsif p_action='park' then
  if (p_data-array['version','payload','label'])<>'{}'::jsonb or not(d.version=0 and d.created_by=actor or
   d.status='claimed' and d.claimed_by=actor and d.claimed_session=current_session)
   or jsonb_typeof(p_data->'label') is distinct from 'string' or length(btrim(p_data->>'label')) not between 1 and 120 or p_data->>'label' ~ '[[:cntrl:]]'
   then raise exception 'TPV_DRAFT_REQUEST_INVALID';end if;
  d.payload:=private.totus_tpv_draft_payload(p_data->'payload');d.label:=btrim(p_data->>'label');
  d.status:='parked';d.claimed_by:=null;d.claimed_session:=null;d.checkout_id:=null;
 elsif p_action='bind' then
  if (p_data-array['version','payload','checkoutId'])<>'{}'::jsonb or d.status<>'claimed' or d.claimed_by<>actor or d.claimed_session<>current_session
   or coalesce(p_data->>'checkoutId','') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then raise exception 'TPV_DRAFT_IN_USE';end if;
  d.payload:=private.totus_tpv_draft_payload(p_data->'payload');d.checkout_id:=(p_data->>'checkoutId')::uuid;d.status:='checkout';
 elsif p_action='release' then
  if (p_data-array['version'])<>'{}'::jsonb or d.status<>'checkout' or d.claimed_by<>actor or d.claimed_session<>current_session
   or exists(select 1 from private.totus_tpv_operations where id=d.checkout_id and status<>'ready') then raise exception 'TPV_DRAFT_IN_USE';end if;
  d.status:='claimed';d.checkout_id:=null;
 elsif p_action='archive' then
  if (p_data-array['version'])<>'{}'::jsonb or d.status not in ('parked','claimed')
   or (d.status='claimed' and d.claimed_by<>actor) or (d.created_by<>actor and d.claimed_by is distinct from actor and
    not private.totus_module_can((select email from public.profiles where id=actor),'ventas','edit'))
   then raise exception 'TPV_DRAFT_IN_USE';end if;d.status:='archived';
 end if;
 update private.totus_tpv_drafts set version=d.version+1,status=d.status,label=d.label,payload=d.payload,
  claimed_by=d.claimed_by,claimed_session=d.claimed_session,checkout_id=d.checkout_id,updated_at=clock_timestamp() where id=d.id returning * into d;
 insert into private.totus_tpv_draft_requests(id,draft_id,actor_id,action,data) values(p_request_id,d.id,actor,p_action,p_data);
 return private.totus_tpv_draft_json(d,actor);
end $$;

create function private.totus_tpv_draft_checkout_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.status='dispatched' and old.status='ready' and new.expected ? 'draftId' then
  perform 1 from private.totus_tpv_drafts d where d.id=(new.expected->>'draftId')::uuid and d.checkout_id=new.id and d.status='checkout'
   and d.version=(new.expected->>'draftVersion')::bigint and d.claimed_by=new.created_by and d.claimed_session=new.session_id
   and d.connection_id=new.connection_id and d.store_id=new.store_id and d.drawer_id=new.drawer_id and d.shop_id=new.shop_id
   and d.environment=new.environment for update;
  if not found then raise exception 'TPV_DRAFT_STALE';end if;
 end if;
 if new.status='confirmed' and old.status<>'confirmed' and new.expected ? 'draftId' then
  update private.totus_tpv_drafts set status='sold',order_id=new.order_id,version=version+1,updated_at=clock_timestamp()
   where id=(new.expected->>'draftId')::uuid and checkout_id=new.id and status='checkout';
  if not found then raise exception 'TPV_DRAFT_STALE';end if;
 end if;return new;
end $$;
create trigger tpv_draft_checkout_guard before update on private.totus_tpv_operations for each row
 execute function private.totus_tpv_draft_checkout_guard();
revoke all on function private.totus_tpv_draft_payload(jsonb),private.totus_tpv_draft_json(private.totus_tpv_drafts,uuid),
 public.totus_tpv_drafts(text,uuid,uuid,jsonb,jsonb),private.totus_tpv_draft_checkout_guard() from public,anon,authenticated;
grant execute on function private.totus_tpv_draft_payload(jsonb),private.totus_tpv_draft_json(private.totus_tpv_drafts,uuid),
 public.totus_tpv_drafts(text,uuid,uuid,jsonb,jsonb),private.totus_tpv_draft_checkout_guard() to service_role;
commit;
