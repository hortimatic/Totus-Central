begin;
create table private.totus_tpv_refunds (
 id uuid primary key,
 sale_id uuid not null references private.totus_tpv_operations(id),
 session_id uuid not null references private.totus_tpv_sessions(id),
 actor_id uuid not null references public.profiles(id),
 scope jsonb not null check(jsonb_typeof(scope)='object'),
 intent jsonb not null check(jsonb_typeof(intent)='object'),
 line_amounts jsonb not null check(jsonb_typeof(line_amounts)='array'),
 total_cents bigint not null check(total_cents between 0 and 100000000000),
 status text not null default 'ready' check(status in ('ready','dispatched','uncertain','confirmed','cancelled')),
 result jsonb check(jsonb_typeof(result)='object'),
 confirmation jsonb,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 check(status<>'confirmed' or result is not null)
);
create index totus_tpv_refund_sale on private.totus_tpv_refunds(sale_id,created_at);
create index totus_tpv_refund_session on private.totus_tpv_refunds(session_id,status);
create table private.totus_tpv_refund_payments (
 refund_id uuid not null references private.totus_tpv_refunds(id),
 method text not null check(method in ('cash','card','bizum','transfer')),
 session_id uuid not null references private.totus_tpv_sessions(id),
 amount_cents bigint not null check(amount_cents between 1 and 100000000000),
 recorded_at timestamptz not null default clock_timestamp(),primary key(refund_id,method)
);
alter table private.totus_tpv_refunds enable row level security;
alter table private.totus_tpv_refund_payments enable row level security;
create policy tpv_refund_server on private.totus_tpv_refunds to service_role using(true) with check(true);
create policy tpv_refund_payment_server on private.totus_tpv_refund_payments to service_role using(true) with check(true);
revoke all on private.totus_tpv_refunds,private.totus_tpv_refund_payments from public,anon,authenticated;
grant select,insert,update on private.totus_tpv_refunds to service_role;
grant select,insert on private.totus_tpv_refund_payments to service_role;

create or replace function private.totus_tpv_cash_summary(p_session uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 with amounts as (select s.*,
  s.opening_cents+coalesce((select sum(p.amount_cents) from private.totus_tpv_payment_events p where p.session_id=s.id and p.method='cash'),0)
  +coalesce((select sum(case when m.kind='cash-in' then m.amount_cents else -m.amount_cents end) from private.totus_tpv_cash_movements m where m.session_id=s.id),0)
  -coalesce((select sum(p.amount_cents) from private.totus_tpv_refund_payments p where p.session_id=s.id and p.method='cash'),0) expected,
  coalesce((select sum((p->>'amount_cents')::bigint) from private.totus_tpv_refunds r,
   lateral jsonb_array_elements(r.intent->'payments') p where r.session_id=s.id and r.status in ('dispatched','uncertain') and p->>'method'='cash'),0) reserved
  from private.totus_tpv_sessions s where s.id=p_session)
 select jsonb_build_object('sessionId',s.id,'status',s.status,'openingCents',s.opening_cents,
  'expectedCashCents',s.expected,'reservedCashCents',s.reserved,'availableCashCents',s.expected-s.reserved,
  'countedCents',s.counted_cents,'differenceCents',case when s.counted_cents is null then null else s.counted_cents-s.expected end,
  'unresolvedSales',(select count(*) from private.totus_tpv_operations where session_id=s.id and status in ('dispatched','uncertain')),
  'pendingRefunds',(select count(*) from private.totus_tpv_refunds where session_id=s.id and status in ('ready','dispatched','uncertain')),
  'closedAt',s.closed_at,'closingRequestId',s.closing_request_id,
  'payments',coalesce((select jsonb_object_agg(t.method,t.amount) from (
   select p.method,sum(p.amount_cents) amount from private.totus_tpv_payment_events p where p.session_id=s.id group by p.method)t),'{}'::jsonb),
  'refunds',coalesce((select jsonb_object_agg(t.method,t.amount) from (
   select p.method,sum(p.amount_cents) amount from private.totus_tpv_refund_payments p where p.session_id=s.id group by p.method)t),'{}'::jsonb))
 from amounts s
$$;
create or replace function private.totus_tpv_cash_can_close(p_session uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select not exists(select 1 from private.totus_tpv_operations where session_id=p_session and status in ('dispatched','uncertain'))
 and not exists(select 1 from private.totus_tpv_refunds where session_id=p_session and status in ('ready','dispatched','uncertain'))
$$;
create function public.totus_tpv_sale_for_return(p_scope jsonb,p_sale_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare sale private.totus_tpv_operations;
begin
 perform private.totus_tpv_authorize(p_scope,'sell');
 if not private.totus_module_can((select email from public.profiles where id=(p_scope->>'actorId')::uuid),'ventas','edit')
 then raise exception 'TPV_REFUND_FORBIDDEN';end if;
 select * into sale from private.totus_tpv_operations where id=p_sale_id and status='confirmed'
  and connection_id=(p_scope->>'connectionId')::uuid and store_id=(p_scope->>'storeId')::uuid
  and shop_id=(p_scope->>'shopId')::bigint and environment=p_scope->>'environment';
 if not found then raise exception 'TPV_REFUND_SALE_NOT_FOUND';end if;
 return private.totus_tpv_operation_json(sale)||jsonb_build_object('pendingRefund',(
  select jsonb_build_object('id',r.id,'status',r.status,'actorId',r.actor_id,'sessionId',r.session_id)
  from private.totus_tpv_refunds r where r.sale_id=sale.id and r.status in ('ready','dispatched','uncertain') limit 1));
end $$;
create function public.totus_tpv_refund_journal(p_action text,p_id uuid,p_scope jsonb,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r private.totus_tpv_refunds; source uuid; payment jsonb; cash_due bigint; won boolean:=false; available bigint;
begin
 if p_action not in ('prepare','get','claim','uncertain','confirm','cancel') or p_id is null or jsonb_typeof(p_data) is distinct from 'object'
 then raise exception 'TPV_REFUND_REQUEST_INVALID';end if;
 perform private.totus_tpv_authorize(p_scope,case when p_action in ('prepare','claim') then 'sell' else 'reconcile' end);
 if not private.totus_module_can((select email from public.profiles where id=(p_scope->>'actorId')::uuid),'ventas','edit')
 then raise exception 'TPV_REFUND_FORBIDDEN';end if;
 if p_action='prepare' then
  if jsonb_typeof(p_data->'intent') is distinct from 'object' or (p_data-array['intent','totalCents','lineAmounts'])<>'{}'::jsonb
   or (p_data->'intent')-array['sale_operation_id','state_fingerprint','items','payments','reason']<>'{}'::jsonb
   or (p_data->'intent' ? 'reason' and (jsonb_typeof(p_data->'intent'->'reason') is distinct from 'string'
    or length(p_data->'intent'->>'reason') not between 1 and 500 or (p_data->'intent'->>'reason')<>btrim(p_data->'intent'->>'reason')
    or (p_data->'intent'->>'reason') ~ '[[:cntrl:]]'))
   or length(p_data::text)>65536 or coalesce(p_data->>'totalCents','') !~ '^(0|[1-9][0-9]{0,11})$'
   or coalesce(p_data->'intent'->>'state_fingerprint','') !~ '^[a-f0-9]{64}$'
   or jsonb_typeof(p_data->'intent'->'items') is distinct from 'array' or jsonb_array_length(p_data->'intent'->'items') not between 1 and 200
   or jsonb_typeof(p_data->'intent'->'payments') is distinct from 'array' or jsonb_array_length(p_data->'intent'->'payments')>4
   or jsonb_typeof(p_data->'lineAmounts') is distinct from 'array'
   then raise exception 'TPV_REFUND_INTENT_INVALID';end if;
  source:=(p_data->'intent'->>'sale_operation_id')::uuid;
  perform public.totus_tpv_sale_for_return(p_scope,source);
  perform 1 from private.totus_tpv_operations where id=source for update;
  if exists(select 1 from private.totus_tpv_refunds where sale_id=source and id<>p_id and status in ('ready','dispatched','uncertain'))
   then raise exception 'TPV_REFUND_ALREADY_PENDING';end if;
  if exists(select 1 from jsonb_array_elements(p_data->'intent'->'payments') p
   where coalesce(p->>'method','') not in ('cash','card','bizum','transfer') or coalesce(p->>'amount_cents','') !~ '^[1-9][0-9]{0,11}$'
   or p-array['method','amount_cents']<>'{}'::jsonb)
   or (select count(distinct p->>'method') from jsonb_array_elements(p_data->'intent'->'payments') p)<>jsonb_array_length(p_data->'intent'->'payments')
   or (select coalesce(sum((p->>'amount_cents')::numeric),0) from jsonb_array_elements(p_data->'intent'->'payments') p)<>(p_data->>'totalCents')::numeric
   then raise exception 'TPV_REFUND_PAYMENT_INVALID';end if;
  insert into private.totus_tpv_refunds(id,sale_id,session_id,actor_id,scope,intent,line_amounts,total_cents)
   values(p_id,source,(p_scope->>'sessionId')::uuid,(p_scope->>'actorId')::uuid,p_scope,p_data->'intent',p_data->'lineAmounts',(p_data->>'totalCents')::bigint)
   on conflict(id) do nothing;
 end if;
 select * into r from private.totus_tpv_refunds where id=p_id for update;
 if not found then return null;end if;
 if r.scope<>p_scope or (p_action='prepare' and (r.intent is distinct from p_data->'intent' or r.line_amounts is distinct from p_data->'lineAmounts'
  or r.total_cents is distinct from (p_data->>'totalCents')::bigint))
 then raise exception 'TPV_REFUND_ALREADY_BOUND';end if;
 if p_action='cancel' then
  if r.status not in ('ready','cancelled') then raise exception 'TPV_REFUND_ALREADY_DISPATCHED';end if;
  update private.totus_tpv_refunds set status='cancelled',updated_at=clock_timestamp() where id=p_id returning * into r;
 elsif p_action='claim' and r.status='ready' then
  if p_data->'confirmation'->'accepted' is distinct from 'true'::jsonb or p_data->'confirmation'->>'operationId' is distinct from p_id::text
   or p_data->'confirmation'->>'currency' is distinct from p_scope->>'currency'
   or (p_data->'confirmation'->>'totalCents')::bigint is distinct from r.total_cents
   then raise exception 'TPV_REFUND_CONFIRMATION_REQUIRED';end if;
  perform 1 from private.totus_tpv_sessions where id=r.session_id and status='open' for update;
  if not found then raise exception 'TPV_CASH_SESSION_CLOSED';end if;
  select coalesce(sum((p->>'amount_cents')::bigint),0) into cash_due from jsonb_array_elements(r.intent->'payments') p where p->>'method'='cash';
  available:=(private.totus_tpv_cash_summary(r.session_id)->>'availableCashCents')::bigint;
  if cash_due>available then raise exception 'TPV_REFUND_CASH_INSUFFICIENT';end if;
  update private.totus_tpv_refunds set status='dispatched',confirmation=p_data->'confirmation',updated_at=clock_timestamp() where id=p_id returning * into r;
  won:=true;
 elsif p_action='confirm' then
  if r.status='ready' or p_data->'result'->'verified' is distinct from 'true'::jsonb
   or (p_data->'result'->>'total_cents')::bigint is distinct from r.total_cents
   or p_data->'result'->'refund_payments' is distinct from r.intent->'payments'
   or p_data->'result'->>'sale_operation_id' is distinct from r.sale_id::text
   then raise exception 'TPV_REFUND_READBACK_REQUIRED';end if;
  if r.status='confirmed' and r.result is distinct from p_data->'result' then raise exception 'TPV_REFUND_RESULT_CHANGED';end if;
  if r.status<>'confirmed' then
   foreach payment in array array(select value from jsonb_array_elements(r.intent->'payments')) loop
    insert into private.totus_tpv_refund_payments(refund_id,method,session_id,amount_cents)
     values(r.id,payment->>'method',r.session_id,(payment->>'amount_cents')::bigint);
   end loop;
   update private.totus_tpv_refunds set status='confirmed',result=p_data->'result',updated_at=clock_timestamp() where id=p_id returning * into r;
  end if;
 elsif p_action='uncertain' and r.status in ('dispatched','uncertain') then
  update private.totus_tpv_refunds set status='uncertain',updated_at=clock_timestamp() where id=p_id returning * into r;
 end if;
 return jsonb_build_object('id',r.id,'saleId',r.sale_id,'status',r.status,'scope',r.scope,'totalCents',r.total_cents,
  'intent',r.intent,'lineAmounts',r.line_amounts,'result',r.result,'won',won);
end $$;
revoke all on function public.totus_tpv_sale_for_return(jsonb,uuid),public.totus_tpv_refund_journal(text,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.totus_tpv_sale_for_return(jsonb,uuid),public.totus_tpv_refund_journal(text,uuid,jsonb,jsonb) to service_role;
commit;
