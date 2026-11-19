begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table private.totus_tpv_operator_settings add column require_at_checkout boolean not null default false;
create or replace function totus_tpv_internal.operator_settings(p_connection uuid,p_shop bigint,p_drawer uuid,p_settings jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();saved private.totus_tpv_operator_settings;enabled boolean;rev bigint;required boolean;desired boolean;
begin
 if actor is null then raise exception 'TPV_AUTH_REQUIRED';end if;
 perform public.totus_tpv_workspace_preferences(p_connection,p_shop,p_drawer,null);
 if p_settings is not null then
  if not private.totus_can('configuracion','edit') then raise exception 'TPV_OPERATOR_SETTINGS_FORBIDDEN';end if;
  if jsonb_typeof(p_settings) is distinct from 'object' or p_settings-array['switchEnabled','expectedRevision','requireAtCheckout']<>'{}'::jsonb
   or jsonb_typeof(p_settings->'switchEnabled') is distinct from 'boolean' or jsonb_typeof(p_settings->'expectedRevision') is distinct from 'number'
   or coalesce(p_settings->>'expectedRevision','')!~'^(0|[1-9][0-9]{0,14})$' or (p_settings?'requireAtCheckout' and jsonb_typeof(p_settings->'requireAtCheckout') is distinct from 'boolean') then raise exception 'TPV_OPERATOR_SETTINGS_INVALID';end if;
  perform pg_advisory_xact_lock(hashtextextended('tpv-operator-settings:'||p_connection::text||':'||p_shop::text||':'||p_drawer::text,0));
 end if;
 select * into saved from private.totus_tpv_operator_settings where connection_id=p_connection and shop_id=p_shop and drawer_id=p_drawer;
 enabled:=coalesce(saved.switch_enabled,true);rev:=coalesce(saved.revision,0);required:=coalesce(saved.require_at_checkout,false);desired:=coalesce((p_settings->>'requireAtCheckout')::boolean,required);
 if p_settings is not null and (enabled is distinct from (p_settings->>'switchEnabled')::boolean or required is distinct from desired) then
  if (p_settings->>'expectedRevision')::bigint<>rev then raise exception 'TPV_OPERATOR_SETTINGS_STALE';end if;
  enabled:=(p_settings->>'switchEnabled')::boolean;required:=desired;rev:=rev+1;
  insert into private.totus_tpv_operator_settings(connection_id,shop_id,drawer_id,switch_enabled,require_at_checkout,revision,updated_by) values(p_connection,p_shop,p_drawer,enabled,required,rev,actor)
  on conflict(connection_id,shop_id,drawer_id) do update set switch_enabled=excluded.switch_enabled,require_at_checkout=excluded.require_at_checkout,revision=excluded.revision,updated_by=actor,updated_at=clock_timestamp();
 end if;
 return jsonb_build_object('switchEnabled',enabled,'revision',rev,'requireAtCheckout',required);
end $$;

-- Preserve the old journal contract while checking the current rule in the same
-- transaction that wins the unique native dispatch. Nothing can acknowledge a
-- different actor or change an existing financial operation's identity.
create table private.totus_tpv_operator_acknowledgements(
 operation_id uuid primary key references private.totus_tpv_operations(id),
 actor_id uuid not null references public.profiles(id),
 settings_revision bigint not null,total_cents bigint not null,
 acknowledged_at timestamptz not null default clock_timestamp());
alter table private.totus_tpv_operator_acknowledgements enable row level security;
revoke all on private.totus_tpv_operator_acknowledgements from public,anon,authenticated,service_role;
grant select on private.totus_tpv_operator_acknowledgements to service_role;
create policy tpv_operator_ack_service_read on private.totus_tpv_operator_acknowledgements for select to service_role using(true);
alter function public.totus_tpv_journal(text,uuid,jsonb,jsonb) set schema totus_tpv_internal;
alter function totus_tpv_internal.totus_tpv_journal(text,uuid,jsonb,jsonb) rename to journal_before_operator_ack;
revoke all on function totus_tpv_internal.journal_before_operator_ack(text,uuid,jsonb,jsonb) from public,anon,authenticated,service_role;
create function totus_tpv_internal.journal_with_operator_ack(p_action text,p_operation_id uuid,p_scope jsonb,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;r private.totus_tpv_operations;settings private.totus_tpv_operator_settings;ack jsonb:=p_data->'operatorAcknowledgement';
begin
 if p_action='claim' then
  perform private.totus_tpv_authorize(p_scope,'sell');
  perform pg_advisory_xact_lock(hashtextextended('tpv-operator-settings:'||(p_scope->>'connectionId')::uuid::text||':'||(p_scope->>'shopId')::bigint::text||':'||(p_scope->>'drawerId')::uuid::text,0));
  select * into r from private.totus_tpv_operations where id=p_operation_id for update;
  if found and r.status='ready' then
   select * into settings from private.totus_tpv_operator_settings where connection_id=(p_scope->>'connectionId')::uuid and shop_id=(p_scope->>'shopId')::bigint and drawer_id=(p_scope->>'drawerId')::uuid;
   if ack is not null and (jsonb_typeof(ack) is distinct from 'object' or ack-array['actorId','accepted']<>'{}'::jsonb or ack->'accepted' is distinct from 'true'::jsonb or ack->>'actorId' is distinct from p_scope->>'actorId' or ack->>'actorId' is distinct from r.created_by::text) then raise exception 'TPV_CHECKOUT_OPERATOR_INVALID';end if;
   if coalesce(settings.require_at_checkout,false) and ack is null then raise exception 'TPV_CHECKOUT_OPERATOR_REQUIRED';end if;
  end if;
 end if;
 result:=totus_tpv_internal.journal_before_operator_ack(p_action,p_operation_id,p_scope,p_data-'operatorAcknowledgement');
 if p_action='claim' and result->'won'='true'::jsonb and ack is not null then
  insert into private.totus_tpv_operator_acknowledgements(operation_id,actor_id,settings_revision,total_cents) values(p_operation_id,r.created_by,coalesce(settings.revision,0),(r.expected->>'totalCents')::bigint);
 end if;
 return result;
end $$;
revoke all on function totus_tpv_internal.journal_with_operator_ack(text,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function totus_tpv_internal.journal_with_operator_ack(text,uuid,jsonb,jsonb) to service_role;
create function public.totus_tpv_journal(p_action text,p_operation_id uuid,p_scope jsonb,p_data jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$select totus_tpv_internal.journal_with_operator_ack(p_action,p_operation_id,p_scope,p_data);$$;
revoke all on function public.totus_tpv_journal(text,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.totus_tpv_journal(text,uuid,jsonb,jsonb) to service_role;
-- Extend the immutable offline envelope without changing old sealed tickets.
alter function private.totus_tpv_validate_offline_ticket(jsonb) rename to totus_tpv_validate_offline_ticket_before_operator_ack;
revoke all on function private.totus_tpv_validate_offline_ticket_before_operator_ack(jsonb) from public,anon,authenticated;
grant execute on function private.totus_tpv_validate_offline_ticket_before_operator_ack(jsonb) to service_role;
create function private.totus_tpv_validate_offline_ticket(t jsonb) returns void language plpgsql immutable security invoker set search_path='' as $$
declare ack jsonb:=t->'operatorAcknowledgement';
begin
 if t?'operatorAcknowledgement' and (jsonb_typeof(ack) is distinct from 'object' or ack-array['actorId','accepted']<>'{}'::jsonb or ack->'accepted' is distinct from 'true'::jsonb or jsonb_typeof(ack->'actorId') is distinct from 'string' or coalesce(ack->>'actorId','')!~'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$') then raise exception 'TPV_CHECKOUT_OPERATOR_INVALID';end if;
 perform private.totus_tpv_validate_offline_ticket_before_operator_ack(t-'operatorAcknowledgement');
end $$;
revoke all on function private.totus_tpv_validate_offline_ticket(jsonb) from public,anon,authenticated;
grant execute on function private.totus_tpv_validate_offline_ticket(jsonb) to service_role;
-- Operator attribution is not a commercial discount or modifier. Preserve the
-- exact sealed ticket, but exclude attribution from the commercial comparison.
create or replace function public.totus_tpv_offline_inbox(p_action text,p_id uuid,p_scope jsonb,p_data jsonb default '{}') returns jsonb
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
  modifiers:=r.ticket-'currency'-'totalCents'-'lines'-'payments'-'customerId'-'addressId'-'catalogueRevision'-'cashSessionId'-'commercial'-'note'-'operatorAcknowledgement';
  select jsonb_agg((l-'qty'-'unitCents'-'name')||jsonb_build_object('attributeId',coalesce(l->'attributeId','0'::jsonb))) into modified_lines from jsonb_array_elements(r.ticket->'lines') l where l?'discount' or l?'displayName';
  if modified_lines is not null then modifiers:=modifiers||jsonb_build_object('lines',modified_lines);end if;
  if coalesce(sale.expected->'saleModifiers','{}'::jsonb)<>modifiers then raise exception 'TPV_OFFLINE_CHECKOUT_MISMATCH';end if;
  update private.totus_tpv_offline_inbox set checkout_id=p_id where id=p_id returning * into r;
 end if;
 return jsonb_build_object('id',r.id,'deviceId',r.device_id,'ticket',r.ticket,'status','received','checkoutId',r.checkout_id,'receivedAt',r.received_at);
end $$;
commit;
