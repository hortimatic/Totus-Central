begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
-- References become part of the immutable claimed allocation, not bank proof.
create function private.totus_tpv_valid_payment_reference(v text) returns boolean
language plpgsql immutable strict set search_path='' as $$
declare digits text;total integer:=0;n integer;i integer;twice boolean:=false;
begin
 if length(v) not between 1 and 64 or btrim(v)<>v or v ~ '[[:cntrl:]]' or v !~ '^[A-Za-z0-9][A-Za-z0-9 ._:/-]{0,63}$' then return false;end if;
 digits:=regexp_replace(v,'[^0-9]','','g');
 if length(digits) between 13 and 19 then
  for i in reverse length(digits)..1 loop
   n:=substring(digits from i for 1)::integer;
   if twice then n:=n*2;if n>9 then n:=n-9;end if;end if;
   total:=total+n;twice:=not twice;
  end loop;
  if total%10=0 then return false;end if;
 end if;
 return true;
end $$;
revoke all on function private.totus_tpv_valid_payment_reference(text) from public,anon,authenticated;
grant execute on function private.totus_tpv_valid_payment_reference(text) to service_role;

create or replace function public.totus_tpv_journal(p_action text,p_operation_id uuid,p_scope jsonb,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r private.totus_tpv_operations; payment jsonb; allocation_total bigint:=0; amount bigint;
 expected_total bigint; token uuid; action text; reference_mode text; opened private.totus_tpv_sessions;
begin
 if p_action not in ('get','open','prepare','claim','remember','uncertain','confirm')
 or p_operation_id is null or jsonb_typeof(p_scope) is distinct from 'object'
 or jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>(case when p_action in ('prepare','claim') and p_data->'expected'->'hasLineNameOverrides'='true'::jsonb then 1048576 else 65536 end)
 then raise exception 'TPV_REQUEST_INVALID';end if;
 action:=case when p_action in ('get','remember','uncertain','confirm') then 'reconcile'
              when p_action='open' then 'open' else 'sell' end;
 perform private.totus_tpv_authorize(p_scope,action);
 if p_action='prepare' and p_data->'expected'->'hasLineNameOverrides'='true'::jsonb and public.totus_tpv_line_options(p_scope)->'allowNameChanges' is distinct from 'true'::jsonb then raise exception 'TPV_LINE_NAME_FORBIDDEN';end if;
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
   or exists(select 1 from jsonb_object_keys(payment) k where k not in ('id','method','status','amountCents','receivedCents','reference'))
   or (payment->>'amountCents')::numeric<>trunc((payment->>'amountCents')::numeric)
   then raise exception 'TPV_PAYMENT_INVALID';end if;
   amount:=(payment->>'amountCents')::bigint;
   if amount is null or amount not between 1 and 100000000000 then raise exception 'TPV_PAYMENT_INVALID';end if;
   if payment->>'method'='cash' then
    if payment->>'receivedCents' is null or (payment->>'receivedCents')::numeric<>trunc((payment->>'receivedCents')::numeric)
     or (payment->>'receivedCents')::bigint not between amount and 100000000000
    then raise exception 'TPV_CASH_INSUFFICIENT';end if;
   elsif payment ? 'receivedCents' then raise exception 'TPV_NONCASH_CHANGE';end if;
   if payment->>'method'='cash' and payment?'reference' then raise exception 'TPV_CASH_REFERENCE_FORBIDDEN';end if;
   if payment?'reference' and r.expected->'supportsPaymentReferences' is distinct from 'true'::jsonb then raise exception 'TPV_NATIVE_PAYMENT_REFERENCE_UNAVAILABLE';end if;
   if payment?'reference' and (jsonb_typeof(payment->'reference') is distinct from 'string' or private.totus_tpv_valid_payment_reference(payment->>'reference') is not true)
   then raise exception 'TPV_PAYMENT_REFERENCE_INVALID';end if;
   reference_mode:=coalesce(r.expected#>>array['operatorPaymentPolicy','referencePolicy',payment->>'method'],'hidden');
   if reference_mode not in ('hidden','optional','required') then raise exception 'TPV_PAYMENT_POLICY_STALE';end if;
   if reference_mode='hidden' and payment?'reference' then raise exception 'TPV_PAYMENT_REFERENCE_FORBIDDEN';end if;
   if reference_mode='required' and not(payment?'reference') then raise exception 'TPV_PAYMENT_REFERENCE_REQUIRED';end if;
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


commit;
