begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
-- Receipt of an offline intention is not a financial confirmation.
create table private.totus_tpv_offline_inbox (
 id uuid primary key, actor_id uuid not null references public.profiles(id),
 connection_id uuid not null, store_id uuid not null, shop_id bigint not null,
 drawer_id uuid not null, session_id uuid not null, device_id uuid not null,
 currency text not null check(currency='EUR'), environment text not null check(environment='qa'),
 ticket jsonb not null check(jsonb_typeof(ticket)='object' and octet_length(ticket::text)<=250000),
 checkout_id uuid unique references private.totus_tpv_operations(id) check(checkout_id=id),
 received_at timestamptz not null default clock_timestamp()
);
create index totus_tpv_offline_inbox_scope on private.totus_tpv_offline_inbox(actor_id,connection_id,drawer_id,received_at);
alter table private.totus_tpv_offline_inbox enable row level security;
revoke all on private.totus_tpv_offline_inbox from public,anon,authenticated;
grant select,insert,update on private.totus_tpv_offline_inbox to service_role;
create policy totus_tpv_offline_service on private.totus_tpv_offline_inbox to service_role using(true) with check(true);
create function private.totus_tpv_validate_offline_commercial(c jsonb,t jsonb) returns void
language plpgsql immutable security invoker set search_path='' as $$
declare line jsonb;k text;gross numeric:=0;
 topkeys text[]:=array['currency','totalCents','totalTaxExclCents','discountCents','shippingCents','customerId','invoiceAddressId','deliveryAddressId','nativeRoundMode','nativeRoundType','lines'];
 linekeys text[]:=array['productId','attributeId','qty','unitTaxInclMicros','unitTaxExclMicros','lineTaxInclCents','lineTaxExclCents'];
begin
 if jsonb_typeof(c) is distinct from 'object' or not(c?&topkeys) or c-topkeys<>'{}'::jsonb or c->>'currency' is distinct from 'EUR'
  or jsonb_typeof(c->'lines') is distinct from 'array' then raise exception 'TPV_OFFLINE_COMMERCIAL_INVALID';end if;
 foreach k in array topkeys loop
  if k not in ('currency','lines') then
   if jsonb_typeof(c->k) is distinct from 'number' or coalesce(c->>k,'')!~'^[0-9]{1,16}$' then raise exception 'TPV_OFFLINE_COMMERCIAL_INVALID';end if;
   if (c->>k)::numeric>9007199254740991 then raise exception 'TPV_OFFLINE_COMMERCIAL_INVALID';end if;
  end if;
 end loop;
 if (t?'customerId' and t->>'customerId' is distinct from c->>'customerId') or (t?'addressId' and t->>'addressId' is distinct from c->>'invoiceAddressId') then raise exception 'TPV_OFFLINE_COMMERCIAL_INVALID';end if;
 if c->>'totalCents' is distinct from t->>'totalCents' or (c->>'totalTaxExclCents')::numeric>(c->>'totalCents')::numeric
  or (c->>'customerId')::numeric<1 or (c->>'invoiceAddressId')::numeric<1 or (c->>'deliveryAddressId')::numeric<1
  or (c->>'nativeRoundMode')::int not between 0 and 5 or (c->>'nativeRoundType')::int not between 1 and 3
  or jsonb_array_length(c->'lines')<>jsonb_array_length(t->'lines') then raise exception 'TPV_OFFLINE_COMMERCIAL_INVALID';end if;
 if (c->>'nativeRoundType')::int=3 then linekeys:=linekeys||array['lineTaxInclMicros','lineTaxExclMicros'];end if;
 for line in select value from jsonb_array_elements(c->'lines') loop
  if jsonb_typeof(line) is distinct from 'object' or not(line?&linekeys) or line-linekeys<>'{}'::jsonb then raise exception 'TPV_OFFLINE_COMMERCIAL_INVALID';end if;
  foreach k in array linekeys loop
   if jsonb_typeof(line->k) is distinct from 'number' or coalesce(line->>k,'')!~'^[0-9]{1,16}$' then raise exception 'TPV_OFFLINE_COMMERCIAL_INVALID';end if;
   if (line->>k)::numeric>9007199254740991 then raise exception 'TPV_OFFLINE_COMMERCIAL_INVALID';end if;
  end loop;
  if (line->>'productId')::numeric<1 or (line->>'qty')::numeric not between 1 and 10000
   or (line->>'unitTaxExclMicros')::numeric>(line->>'unitTaxInclMicros')::numeric
   or (line->>'lineTaxExclCents')::numeric>(line->>'lineTaxInclCents')::numeric
   or not exists(select 1 from jsonb_array_elements(t->'lines') parent where parent->>'productId'=line->>'productId' and coalesce(parent->>'attributeId','0')=line->>'attributeId' and parent->>'qty'=line->>'qty') then raise exception 'TPV_OFFLINE_COMMERCIAL_INVALID';end if;
  if (c->>'nativeRoundType')::int=3 and ((line->>'lineTaxExclMicros')::numeric>(line->>'lineTaxInclMicros')::numeric or (line->>'lineTaxInclMicros')::numeric>1000000000000000) then raise exception 'TPV_OFFLINE_COMMERCIAL_INVALID';end if;
  gross:=gross+(line->>'lineTaxInclCents')::numeric;
 end loop;
 if exists(select 1 from jsonb_array_elements(c->'lines') l group by l->>'productId',l->>'attributeId' having count(*)>1)
  or gross+(c->>'shippingCents')::numeric-(c->>'discountCents')::numeric<>(c->>'totalCents')::numeric then raise exception 'TPV_OFFLINE_COMMERCIAL_INVALID';end if;
end $$;
revoke all on function private.totus_tpv_validate_offline_commercial(jsonb,jsonb) from public,anon,authenticated;
grant execute on function private.totus_tpv_validate_offline_commercial(jsonb,jsonb) to service_role;
create function private.totus_tpv_validate_offline_ticket(t jsonb) returns void
language plpgsql immutable security invoker set search_path='' as $$
declare line jsonb;payment jsonb;sum_paid bigint:=0;
begin
 if jsonb_typeof(t) is distinct from 'object' or t-array['currency','totalCents','lines','payments','customerId','addressId','catalogueRevision','cashSessionId','commercial','note','adjustment','coupon']<>'{}'::jsonb
 or t->>'currency' is distinct from 'EUR' or jsonb_typeof(t->'totalCents') is distinct from 'number' or coalesce(t->>'totalCents','')!~'^[0-9]{1,11}$'
 or jsonb_typeof(t->'lines') is distinct from 'array' or jsonb_typeof(t->'payments') is distinct from 'array'
 then raise exception 'TPV_OFFLINE_TICKET_INVALID';end if;
 if t?'customerId' and (jsonb_typeof(t->'customerId') is distinct from 'number' or coalesce(t->>'customerId','')!~'^[1-9][0-9]{0,9}$') then raise exception 'TPV_OFFLINE_TICKET_INVALID';end if;
 if t?'addressId' and (jsonb_typeof(t->'addressId') is distinct from 'number' or coalesce(t->>'addressId','')!~'^[1-9][0-9]{0,9}$') then raise exception 'TPV_OFFLINE_TICKET_INVALID';end if;
 if t?'catalogueRevision' and (jsonb_typeof(t->'catalogueRevision') is distinct from 'string' or coalesce(t->>'catalogueRevision','')!~'^[a-f0-9]{64}$') then raise exception 'TPV_OFFLINE_TICKET_INVALID';end if;
 if t?'cashSessionId' and (jsonb_typeof(t->'cashSessionId') is distinct from 'string' or coalesce(t->>'cashSessionId','')!~'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$') then raise exception 'TPV_OFFLINE_TICKET_INVALID';end if;
 if jsonb_array_length(t->'lines') not between 1 and 200 or jsonb_array_length(t->'payments') not between 1 and 4 then raise exception 'TPV_OFFLINE_TICKET_INVALID';end if;
 for line in select value from jsonb_array_elements(t->'lines') loop
  if jsonb_typeof(line) is distinct from 'object' or line-array['productId','attributeId','qty','unitCents','name','discount','displayName']<>'{}'::jsonb
   or jsonb_typeof(line->'productId') is distinct from 'number' or coalesce(line->>'productId','')!~'^[1-9][0-9]{0,9}$'
   or jsonb_typeof(line->'qty') is distinct from 'number' or coalesce(line->>'qty','')!~'^[1-9][0-9]{0,4}$'
  then raise exception 'TPV_OFFLINE_TICKET_INVALID';end if;
  if (line->>'qty')::bigint>10000 then raise exception 'TPV_OFFLINE_TICKET_INVALID';end if;
  if line?'attributeId' and (jsonb_typeof(line->'attributeId') is distinct from 'number' or coalesce(line->>'attributeId','')!~'^[0-9]{1,10}$') then raise exception 'TPV_OFFLINE_TICKET_INVALID';end if;
  if line?'unitCents' and (jsonb_typeof(line->'unitCents') is distinct from 'number' or coalesce(line->>'unitCents','')!~'^[0-9]{1,11}$') then raise exception 'TPV_OFFLINE_TICKET_INVALID';end if;
  if line?'name' and (jsonb_typeof(line->'name') is distinct from 'string' or length(line->>'name')>512) then raise exception 'TPV_OFFLINE_TICKET_INVALID';end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(t->'lines') l group by l->>'productId',coalesce(l->>'attributeId','0') having count(*)>1) then raise exception 'TPV_OFFLINE_TICKET_INVALID';end if;
 for payment in select value from jsonb_array_elements(t->'payments') loop
  if jsonb_typeof(payment) is distinct from 'object' or payment-array['method','amountCents','receivedCents','reference']<>'{}'::jsonb
   or coalesce(payment->>'method','') not in ('cash','card','bizum','transfer') or jsonb_typeof(payment->'amountCents') is distinct from 'number'
   or coalesce(payment->>'amountCents','')!~'^[1-9][0-9]{0,10}$' then raise exception 'TPV_OFFLINE_TICKET_INVALID';end if;
  if payment?'receivedCents' then
   if payment->>'method'<>'cash' or jsonb_typeof(payment->'receivedCents') is distinct from 'number' or coalesce(payment->>'receivedCents','')!~'^[0-9]{1,11}$' then raise exception 'TPV_OFFLINE_TICKET_INVALID';end if;
   if (payment->>'receivedCents')::bigint<(payment->>'amountCents')::bigint then raise exception 'TPV_OFFLINE_TICKET_INVALID';end if;
  end if;
  if payment?'reference' and (payment->>'method'='cash' or jsonb_typeof(payment->'reference') is distinct from 'string' or private.totus_tpv_valid_payment_reference(payment->>'reference') is not true) then raise exception 'TPV_OFFLINE_TICKET_INVALID';end if;
  sum_paid:=sum_paid+(payment->>'amountCents')::bigint;
 end loop;
 if t?'note' and (jsonb_typeof(t->'note') is distinct from 'string' or length(t->>'note') not between 1 and 500 or t->>'note' is distinct from btrim(t->>'note',E' \t\n') or t->>'note' ~ '[<>]' or regexp_replace(t->>'note',E'[\n\t]','','g') ~ '[[:cntrl:]]') then raise exception 'TPV_OFFLINE_TICKET_INVALID';end if;
 if t?'coupon' and (jsonb_typeof(t->'coupon') is distinct from 'string' or t->>'coupon' !~ '^[A-Za-z0-9_-]{1,64}$') then raise exception 'TPV_OFFLINE_TICKET_INVALID';end if;
 perform private.totus_tpv_draft_payload(jsonb_build_object('lines',(select jsonb_agg((l-'unitCents'-'name')||jsonb_build_object('attributeId',coalesce(l->'attributeId','0'::jsonb))) from jsonb_array_elements(t->'lines') l))||(t-'currency'-'totalCents'-'lines'-'payments'-'customerId'-'addressId'-'catalogueRevision'-'cashSessionId'-'commercial'-'note'));
 if t?'commercial' then perform private.totus_tpv_validate_offline_commercial(t->'commercial',t);end if;
 if sum_paid<>(t->>'totalCents')::bigint or exists(select 1 from jsonb_array_elements(t->'payments') p group by p->>'method' having count(*)>1) then raise exception 'TPV_OFFLINE_TICKET_INVALID';end if;
end $$;
revoke all on function private.totus_tpv_validate_offline_ticket(jsonb) from public,anon,authenticated;
grant execute on function private.totus_tpv_validate_offline_ticket(jsonb) to service_role;
create function public.totus_tpv_offline_inbox(p_action text,p_id uuid,p_scope jsonb,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r private.totus_tpv_offline_inbox; device uuid; sale private.totus_tpv_operations; modifiers jsonb; modified_lines jsonb;
begin
 if p_action not in ('receive','get','bind') or p_id is null or jsonb_typeof(p_data) is distinct from 'object' then raise exception 'TPV_OFFLINE_REQUEST_INVALID';end if;
 perform private.totus_tpv_authorize(p_scope,'reconcile');
 if p_scope->>'currency' is distinct from 'EUR' then raise exception 'TPV_OFFLINE_CURRENCY_INVALID';end if;
 if p_action='receive' then
  if p_data-array['deviceId','ticket']<>'{}'::jsonb or jsonb_typeof(p_data->'ticket') is distinct from 'object'
   or octet_length((p_data->'ticket')::text)>250000 or jsonb_typeof(p_data->'deviceId') is distinct from 'string'
  then raise exception 'TPV_OFFLINE_REQUEST_INVALID';end if;
  perform private.totus_tpv_validate_offline_ticket(p_data->'ticket');
  if p_data->'ticket'?'cashSessionId' and p_data#>>'{ticket,cashSessionId}' is distinct from p_scope->>'sessionId' then raise exception 'TPV_OFFLINE_SCOPE_MISMATCH';end if;
  device:=(p_data->>'deviceId')::uuid;
  if device is null then raise exception 'TPV_OFFLINE_REQUEST_INVALID';end if;
  insert into private.totus_tpv_offline_inbox(id,actor_id,connection_id,store_id,shop_id,drawer_id,session_id,device_id,currency,environment,ticket)
  values(p_id,(p_scope->>'actorId')::uuid,(p_scope->>'connectionId')::uuid,(p_scope->>'storeId')::uuid,(p_scope->>'shopId')::bigint,
   (p_scope->>'drawerId')::uuid,(p_scope->>'sessionId')::uuid,device,'EUR',p_scope->>'environment',p_data->'ticket') on conflict(id) do nothing;
 elsif p_data<>'{}'::jsonb then raise exception 'TPV_OFFLINE_REQUEST_INVALID';end if;
 select * into r from private.totus_tpv_offline_inbox where id=p_id for update;
 if not found then return null;end if;
 if r.actor_id is distinct from (p_scope->>'actorId')::uuid or r.connection_id is distinct from (p_scope->>'connectionId')::uuid
  or r.store_id is distinct from (p_scope->>'storeId')::uuid or r.shop_id is distinct from (p_scope->>'shopId')::bigint
  or r.drawer_id is distinct from (p_scope->>'drawerId')::uuid or r.session_id is distinct from (p_scope->>'sessionId')::uuid
  or r.environment is distinct from p_scope->>'environment' then raise exception 'TPV_OFFLINE_SCOPE_MISMATCH';end if;
 if p_action='receive' and (r.device_id is distinct from device or r.ticket is distinct from p_data->'ticket') then raise exception 'TPV_OFFLINE_INTENT_CHANGED';end if;
 if p_action='bind' then
  perform private.totus_tpv_authorize(p_scope,'sell');
  select * into sale from private.totus_tpv_operations where id=p_id for share;
  if not found or sale.created_by<>r.actor_id or sale.connection_id<>r.connection_id or sale.store_id<>r.store_id or sale.shop_id<>r.shop_id
   or sale.drawer_id<>r.drawer_id or sale.session_id<>r.session_id or sale.environment<>r.environment or sale.currency<>r.currency
   or sale.expected->>'totalCents' is distinct from r.ticket->>'totalCents'
  then raise exception 'TPV_OFFLINE_CHECKOUT_MISMATCH';end if;
  if exists(select 1 from jsonb_array_elements(r.ticket->'lines') l where not exists(select 1 from jsonb_array_elements(sale.expected->'lines') n
   where n->>'productId'=l->>'productId' and coalesce(n->>'attributeId','0')=coalesce(l->>'attributeId','0') and n->>'qty'=l->>'qty'))
   or jsonb_array_length(sale.expected->'lines')<>jsonb_array_length(r.ticket->'lines') then raise exception 'TPV_OFFLINE_CHECKOUT_MISMATCH';end if;
  if r.ticket?'commercial' and not(sale.expected @> (r.ticket->'commercial')) then raise exception 'TPV_OFFLINE_CHECKOUT_MISMATCH';end if;
  if sale.expected->>'saleNoteHash' is distinct from (case when r.ticket?'note' then encode(sha256(convert_to(r.ticket->>'note','UTF8')),'hex') else null end) then raise exception 'TPV_OFFLINE_CHECKOUT_MISMATCH';end if;
  modifiers:=r.ticket-'currency'-'totalCents'-'lines'-'payments'-'customerId'-'addressId'-'catalogueRevision'-'cashSessionId'-'commercial'-'note';
  select jsonb_agg((l-'qty'-'unitCents'-'name')||jsonb_build_object('attributeId',coalesce(l->'attributeId','0'::jsonb))) into modified_lines from jsonb_array_elements(r.ticket->'lines') l where l?'discount' or l?'displayName';
  if modified_lines is not null then modifiers:=modifiers||jsonb_build_object('lines',modified_lines);end if;
  if coalesce(sale.expected->'saleModifiers','{}'::jsonb)<>modifiers then raise exception 'TPV_OFFLINE_CHECKOUT_MISMATCH';end if;
  update private.totus_tpv_offline_inbox set checkout_id=p_id where id=p_id returning * into r;
 end if;
 return jsonb_build_object('id',r.id,'deviceId',r.device_id,'ticket',r.ticket,'status','received','checkoutId',r.checkout_id,'receivedAt',r.received_at);
end $$;
revoke all on function public.totus_tpv_offline_inbox(text,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.totus_tpv_offline_inbox(text,uuid,jsonb,jsonb) to service_role;
commit;
