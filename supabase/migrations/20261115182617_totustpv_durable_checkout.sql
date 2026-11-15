-- Original Totus Central TPV persistence. No POSTPV or PrestaShop mutation.
-- Server-only journal: browsers cannot set paid/confirmed or dispatch claims.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create table private.totus_tpv_assignments (
 environment text not null default 'qa' check(environment in ('qa','production')),
 actor_id uuid not null references public.profiles(id),
 connection_id uuid not null references private.totus_api_connections(id),
 website_key text not null references private.totus_websites(key),
 store_id uuid not null references public.ops_stores(id),
 shop_id bigint not null check(shop_id>0),
 drawer_id uuid not null references public.ops_cash_drawers(id),
 can_sell boolean not null default false,
 can_reconcile boolean not null default false,
 can_open boolean not null default false,
 active boolean not null default true,
 primary key(actor_id,connection_id,shop_id,drawer_id,environment)
);
create table private.totus_tpv_sessions (
 environment text not null default 'qa' check(environment in ('qa','production')),
 id uuid primary key,
 connection_id uuid not null references private.totus_api_connections(id),
 store_id uuid not null references public.ops_stores(id),
 shop_id bigint not null check(shop_id>0),
 drawer_id uuid not null references public.ops_cash_drawers(id),
 currency text not null check(currency ~ '^[A-Z]{3}$'),
 opened_by uuid not null references public.profiles(id),
 opening_cents bigint not null check(opening_cents between 0 and 100000000000),
 status text not null default 'open' check(status in ('open','closed')),
 opened_at timestamptz not null default clock_timestamp(),
 closed_at timestamptz,
 closing_id uuid references public.ops_daily_closings(id),
 check(environment='production' or closing_id is null),
 check((status='open' and closed_at is null) or (status='closed' and closed_at is not null))
);
create unique index totus_tpv_one_open_drawer on private.totus_tpv_sessions(drawer_id,environment) where status='open';
create table private.totus_tpv_operations (
 environment text not null default 'qa' check(environment in ('qa','production')),
 id uuid primary key,
 connection_id uuid not null references private.totus_api_connections(id),
 connection_revision bigint not null check(connection_revision>0),
 store_id uuid not null references public.ops_stores(id),
 shop_id bigint not null check(shop_id>0),
 drawer_id uuid not null references public.ops_cash_drawers(id),
 session_id uuid not null references private.totus_tpv_sessions(id),
 created_by uuid not null references public.profiles(id),
 dispatched_by uuid references public.profiles(id),
 currency text not null check(currency ~ '^[A-Z]{3}$'),
 cart_id bigint not null check(cart_id>0),
 order_id bigint check(order_id>0),
 revision bigint not null default 1 check(revision>0),
 status text not null default 'ready' check(status in ('ready','dispatched','uncertain','confirmed')),
 expected jsonb not null check(jsonb_typeof(expected)='object'),
 quote_expires_at timestamptz not null,
 payments jsonb check(jsonb_typeof(payments)='array'),
 dispatch_token uuid,
 last_reason text,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 confirmed_at timestamptz,
 unique(connection_id,shop_id,cart_id),
 unique(connection_id,shop_id,order_id),
 check((status='ready' and dispatch_token is null and payments is null) or
       (status<>'ready' and dispatch_token is not null and payments is not null)),
 check(status<>'confirmed' or (order_id is not null and confirmed_at is not null))
);
create index totus_tpv_unresolved on private.totus_tpv_operations(session_id,created_at)
 where status in ('dispatched','uncertain');
create table private.totus_tpv_payment_events (
 operation_id uuid not null references private.totus_tpv_operations(id),
 allocation_id text not null check(allocation_id ~ '^[a-zA-Z0-9_-]{1,100}$'),
 session_id uuid not null references private.totus_tpv_sessions(id),
 method text not null check(method in ('cash','card','bizum','transfer','voucher','cheque')),
 amount_cents bigint not null check(amount_cents between 1 and 100000000000),
 received_cents bigint check(received_cents between 0 and 100000000000),
 currency text not null check(currency ~ '^[A-Z]{3}$'),
 recorded_at timestamptz not null default clock_timestamp(),
 primary key(operation_id,allocation_id),
 check((method='cash' and received_cents>=amount_cents) or (method<>'cash' and received_cents is null))
);
create index totus_tpv_payment_session on private.totus_tpv_payment_events(session_id,method);

-- Scope is supplied only after the Edge handler verified the actual Central
-- user. Re-read current membership, assignment and all physical relationships.
create function private.totus_tpv_authorize(p_scope jsonb,p_action text) returns void
language plpgsql security invoker set search_path='' as $$
declare actor public.profiles; assignment private.totus_tpv_assignments; session private.totus_tpv_sessions;
begin
 -- This release is QA-only. Production activation requires a separate release,
 -- not a caller flag or changing the hostname of an existing test operation.
 if p_scope->>'environment' is distinct from 'qa' then raise exception 'TPV_ENVIRONMENT_FORBIDDEN';end if;
 if p_action not in ('sell','reconcile','open') then raise exception 'TPV_ACTION_INVALID';end if;
 select * into actor from public.profiles where id=(p_scope->>'actorId')::uuid and active;
 if not found then raise exception 'TPV_ACTOR_INACTIVE';end if;
 if not private.totus_module_can(actor.email,'ventas',case when p_action='reconcile' then 'view' else 'create' end)
 or not private.totus_module_can(actor.email,'cajas',case when p_action='reconcile' then 'view' else 'create' end)
 then raise exception 'TPV_SELL_FORBIDDEN';end if;
 select a.* into assignment from private.totus_tpv_assignments a
 join private.totus_api_connections c on c.id=a.connection_id
 join private.totus_websites w on w.key=a.website_key and w.connection_id=c.id
 join public.ops_stores s on s.id=a.store_id and s.active
 join public.ops_cash_drawers d on d.id=a.drawer_id and d.store_id=s.id and d.active
 where a.actor_id=actor.id and a.active and a.environment=p_scope->>'environment' and a.connection_id=(p_scope->>'connectionId')::uuid
 and a.shop_id=(p_scope->>'shopId')::bigint and a.store_id=(p_scope->>'storeId')::uuid
 and a.drawer_id=(p_scope->>'drawerId')::uuid and w.business_id=s.id and w.status='active'
 and c.enabled and c.real_data_authorized and c.protocol='prestashop'
 and c.revision=(p_scope->>'connectionRevision')::bigint and c.verified_revision=c.revision;
 if not found then raise exception 'TPV_ASSIGNMENT_OR_CONNECTION_INVALID';end if;
 if (p_action='sell' and not assignment.can_sell) or (p_action='reconcile' and not assignment.can_reconcile)
 or (p_action='open' and not assignment.can_open) then raise exception 'TPV_ACTION_FORBIDDEN';end if;
 if p_action<>'open' then
  select * into session from private.totus_tpv_sessions where id=(p_scope->>'sessionId')::uuid for share;
  if not found or session.store_id<>assignment.store_id or session.connection_id<>assignment.connection_id
  or session.shop_id<>assignment.shop_id or session.drawer_id<>assignment.drawer_id
  or session.currency is distinct from p_scope->>'currency'
  or session.environment is distinct from p_scope->>'environment'
  or (p_action='sell' and session.status<>'open') then raise exception 'TPV_CASH_SESSION_MISMATCH';end if;
 end if;
end $$;

create function private.totus_tpv_operation_json(r private.totus_tpv_operations) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',r.id,'revision',r.revision,'status',r.status,'orderId',r.order_id,
 'quoteExpiresAt',floor(extract(epoch from r.quote_expires_at)*1000)::bigint,'expected',r.expected,'payments',r.payments,
 'scope',jsonb_build_object('connectionId',r.connection_id,'connectionRevision',r.connection_revision,
 'storeId',r.store_id,'shopId',r.shop_id,'drawerId',r.drawer_id,'sessionId',r.session_id,
 'currency',r.currency,'actorId',r.created_by,'environment',r.environment))
$$;

create function public.totus_tpv_journal(p_action text,p_operation_id uuid,p_scope jsonb,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r private.totus_tpv_operations; payment jsonb; allocation_total bigint:=0; amount bigint;
 expected_total bigint; token uuid; action text; opened private.totus_tpv_sessions;
begin
 if p_action not in ('get','open','prepare','claim','remember','uncertain','confirm')
 or p_operation_id is null or jsonb_typeof(p_scope) is distinct from 'object'
 or jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>65536
 then raise exception 'TPV_REQUEST_INVALID';end if;
 action:=case when p_action in ('get','remember','uncertain','confirm') then 'reconcile'
              when p_action='open' then 'open' else 'sell' end;
 perform private.totus_tpv_authorize(p_scope,action);
 if p_action='open' then
  if (p_data->>'openingCents')::numeric <> trunc((p_data->>'openingCents')::numeric)
   or coalesce(p_scope->>'currency','') !~ '^[A-Z]{3}$' then raise exception 'TPV_OPENING_INVALID';end if;
  insert into private.totus_tpv_sessions(id,environment,connection_id,store_id,shop_id,drawer_id,currency,opened_by,opening_cents)
  values(p_operation_id,p_scope->>'environment',(p_scope->>'connectionId')::uuid,(p_scope->>'storeId')::uuid,
   (p_scope->>'shopId')::bigint,(p_scope->>'drawerId')::uuid,p_scope->>'currency',
   (p_scope->>'actorId')::uuid,(p_data->>'openingCents')::bigint)
   on conflict(id) do nothing;
  select * into opened from private.totus_tpv_sessions where id=p_operation_id;
  if opened.connection_id is distinct from (p_scope->>'connectionId')::uuid
   or opened.environment is distinct from p_scope->>'environment'
   or opened.store_id is distinct from (p_scope->>'storeId')::uuid
   or opened.shop_id is distinct from (p_scope->>'shopId')::bigint
   or opened.drawer_id is distinct from (p_scope->>'drawerId')::uuid
   or opened.currency is distinct from p_scope->>'currency'
   or opened.opened_by is distinct from (p_scope->>'actorId')::uuid
   or opened.opening_cents is distinct from (p_data->>'openingCents')::bigint
   then raise exception 'TPV_SESSION_ID_ALREADY_BOUND';end if;
  return jsonb_build_object('id',p_operation_id,'status',opened.status);
 end if;
 if p_action='prepare' then
  if jsonb_typeof(p_data->'expected') is distinct from 'object'
   or p_data->'expected'->>'storeId' is distinct from p_scope->>'storeId'
   or p_data->'expected'->>'shopId' is distinct from p_scope->>'shopId'
   or p_data->'expected'->>'currency' is distinct from p_scope->>'currency'
   or (p_data->>'quoteExpiresAt')::numeric/1000<=extract(epoch from clock_timestamp())
  then raise exception 'TPV_PREPARED_SALE_INVALID';end if;
  insert into private.totus_tpv_operations(id,environment,connection_id,connection_revision,store_id,shop_id,drawer_id,
    session_id,created_by,currency,cart_id,expected,quote_expires_at)
  values(p_operation_id,p_scope->>'environment',(p_scope->>'connectionId')::uuid,(p_scope->>'connectionRevision')::bigint,
   (p_scope->>'storeId')::uuid,(p_scope->>'shopId')::bigint,(p_scope->>'drawerId')::uuid,
   (p_scope->>'sessionId')::uuid,(p_scope->>'actorId')::uuid,p_scope->>'currency',
   (p_data->'expected'->>'cartId')::bigint,p_data->'expected',
   to_timestamp((p_data->>'quoteExpiresAt')::numeric/1000)) returning * into r;
  return private.totus_tpv_operation_json(r);
 end if;
 select * into r from private.totus_tpv_operations where id=p_operation_id for update;
 if not found then
  if p_action='get' then return null;end if;
  raise exception 'TPV_OPERATION_NOT_FOUND';
 end if;
 if r.connection_id<>(p_scope->>'connectionId')::uuid or r.store_id<>(p_scope->>'storeId')::uuid
 or r.environment is distinct from p_scope->>'environment'
 or r.shop_id<>(p_scope->>'shopId')::bigint or r.drawer_id<>(p_scope->>'drawerId')::uuid
 or r.session_id<>(p_scope->>'sessionId')::uuid or r.currency<>p_scope->>'currency'
 then raise exception 'TPV_OPERATION_SCOPE_MISMATCH';end if;
 -- Credential rotation never creates another identity for this cart or order.
 -- The server must separately validate the current revision before recovery.
 if p_action='get' then return private.totus_tpv_operation_json(r);end if;
 if r.revision is distinct from (p_data->>'revision')::bigint then raise exception 'TPV_OPERATION_STALE';end if;
 if p_action='claim' then
  if r.connection_revision<>(p_scope->>'connectionRevision')::bigint then raise exception 'TPV_CONTEXT_STALE';end if;
  if r.status<>'ready' then return jsonb_build_object('won',false,'record',private.totus_tpv_operation_json(r));end if;
  if r.quote_expires_at<=clock_timestamp() or r.expected is distinct from p_data->'expected'
   or jsonb_typeof(p_data->'payments') is distinct from 'array' or jsonb_array_length(p_data->'payments') not between 1 and 20
  then raise exception 'TPV_QUOTE_OR_PAYMENT_INVALID';end if;
  expected_total:=(r.expected->>'totalCents')::bigint;
  if expected_total is null or expected_total not between 1 and 100000000000 then raise exception 'TPV_TOTAL_INVALID';end if;
  for payment in select value from jsonb_array_elements(p_data->'payments') loop
   if coalesce(payment->>'id','') !~ '^[a-zA-Z0-9_-]{1,100}$'
   or coalesce(payment->>'method','') not in ('cash','card','bizum','transfer','voucher','cheque')
   or payment->>'status' is distinct from 'settled'
   or exists(select 1 from jsonb_object_keys(payment) k where k not in ('id','method','status','amountCents','receivedCents'))
   or (payment->>'amountCents')::numeric<>trunc((payment->>'amountCents')::numeric)
   then raise exception 'TPV_PAYMENT_INVALID';end if;
   amount:=(payment->>'amountCents')::bigint;
   if amount is null or amount not between 1 and 100000000000 then raise exception 'TPV_PAYMENT_INVALID';end if;
   if payment->>'method'='cash' then
    if payment->>'receivedCents' is null or (payment->>'receivedCents')::numeric<>trunc((payment->>'receivedCents')::numeric)
     or (payment->>'receivedCents')::bigint not between amount and 100000000000
    then raise exception 'TPV_CASH_INSUFFICIENT';end if;
   elsif payment ? 'receivedCents' then raise exception 'TPV_NONCASH_CHANGE';end if;
   allocation_total:=allocation_total+amount;
  end loop;
  if allocation_total<>expected_total or exists(select 1 from jsonb_array_elements(p_data->'payments') p group by p->>'id' having count(*)>1)
  then raise exception 'TPV_PAYMENT_TOTAL_OR_DUPLICATE';end if;
  token:=pg_catalog.gen_random_uuid();
  update private.totus_tpv_operations set status='dispatched',dispatch_token=token,
   dispatched_by=(p_scope->>'actorId')::uuid,payments=p_data->'payments',updated_at=clock_timestamp()
   where id=r.id returning * into r;
  return jsonb_build_object('won',true,'token',token);
 end if;
 if r.status='confirmed' then
  if p_data->>'orderId' is not null and r.order_id<>(p_data->>'orderId')::bigint
  then raise exception 'TPV_REMOTE_ORDER_MISMATCH';end if;
  return private.totus_tpv_operation_json(r);
 end if;
 if r.status not in ('dispatched','uncertain') then raise exception 'TPV_NOT_DISPATCHED';end if;
 if p_data->>'token' is not null and r.dispatch_token<>(p_data->>'token')::uuid then raise exception 'TPV_CLAIM_MISMATCH';end if;
 if p_data->>'orderId' is not null then
  if (p_data->>'orderId')::bigint<1 or (r.order_id is not null and r.order_id<>(p_data->>'orderId')::bigint)
   then raise exception 'TPV_REMOTE_ORDER_MISMATCH';end if;
  r.order_id:=(p_data->>'orderId')::bigint;
 end if;
 if p_action='remember' and r.order_id is null then raise exception 'TPV_REMOTE_ORDER_ID_MISSING';end if;
 if p_action='confirm' then
  if r.order_id is null or p_data->'verification'->>'status' is distinct from 'confirmed'
    or p_data->'verification'->>'readbackVerified' is distinct from 'true'
    or p_data->'verification'->>'orderId' is distinct from r.order_id::text
   then raise exception 'TPV_READBACK_REQUIRED';end if;
  insert into private.totus_tpv_payment_events(operation_id,allocation_id,session_id,method,amount_cents,received_cents,currency)
   select r.id,p->>'id',r.session_id,p->>'method',(p->>'amountCents')::bigint,
     case when p->>'method'='cash' then (p->>'receivedCents')::bigint else null end,r.currency
   from jsonb_array_elements(r.payments) p;
  r.status:='confirmed';r.confirmed_at:=clock_timestamp();r.last_reason:=null;
 elsif p_action='uncertain' then
  if coalesce(p_data->>'reason','') !~ '^TPV_[A-Z0-9_]{1,90}$' then raise exception 'TPV_REASON_INVALID';end if;
  r.status:='uncertain';r.last_reason:=p_data->>'reason';
 elsif p_action<>'remember' then raise exception 'TPV_ACTION_INVALID';end if;
 update private.totus_tpv_operations set order_id=r.order_id,status=r.status,confirmed_at=r.confirmed_at,
  last_reason=r.last_reason,updated_at=clock_timestamp() where id=r.id;
 return private.totus_tpv_operation_json(r);
end $$;

alter table private.totus_tpv_assignments enable row level security;
alter table private.totus_tpv_sessions enable row level security;
alter table private.totus_tpv_operations enable row level security;
alter table private.totus_tpv_payment_events enable row level security;
create policy tpv_assignment_server on private.totus_tpv_assignments to service_role using(true) with check(true);
create policy tpv_session_server on private.totus_tpv_sessions to service_role using(true) with check(true);
create policy tpv_operation_server on private.totus_tpv_operations to service_role using(true) with check(true);
create policy tpv_payment_server on private.totus_tpv_payment_events to service_role using(true) with check(true);
revoke all on private.totus_tpv_assignments,private.totus_tpv_sessions,private.totus_tpv_operations,private.totus_tpv_payment_events from public,anon,authenticated;
revoke all on function private.totus_tpv_authorize(jsonb,text),private.totus_tpv_operation_json(private.totus_tpv_operations),public.totus_tpv_journal(text,uuid,jsonb,jsonb) from public,anon,authenticated;
grant usage on schema private to service_role;
grant select on private.totus_tpv_assignments,private.totus_websites,
 public.profiles,public.ops_stores,public.ops_cash_drawers to service_role;
grant select(id,revision,enabled,real_data_authorized,protocol,verified_revision)
 on private.totus_api_connections to service_role;
grant select,insert,update on private.totus_tpv_sessions,private.totus_tpv_operations to service_role;
grant select,insert on private.totus_tpv_payment_events to service_role;
grant execute on function private.totus_tpv_authorize(jsonb,text),private.totus_tpv_operation_json(private.totus_tpv_operations),public.totus_tpv_journal(text,uuid,jsonb,jsonb) to service_role;
commit;
