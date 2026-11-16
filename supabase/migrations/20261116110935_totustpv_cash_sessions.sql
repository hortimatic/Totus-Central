-- Persistent Central cash operations, independent of commercial daily closings.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table private.totus_tpv_sessions
 add column counted_cents bigint check(counted_cents between 0 and 100000000000),
 add column closing_request_id uuid unique,
 add column closed_by uuid references public.profiles(id),
 add column closing_note text check(length(closing_note)<=500);
create table private.totus_tpv_cash_movements (
 id uuid primary key,
 session_id uuid not null references private.totus_tpv_sessions(id),
 actor_id uuid not null references public.profiles(id),
 kind text not null check(kind in ('cash-in','cash-out')),
 amount_cents bigint not null check(amount_cents between 1 and 100000000000),
 reason text not null check(length(btrim(reason)) between 1 and 500),
 recorded_at timestamptz not null default clock_timestamp()
);
create index totus_tpv_cash_movement_session on private.totus_tpv_cash_movements(session_id,recorded_at);
alter table private.totus_tpv_cash_movements enable row level security;
create policy tpv_cash_movement_server on private.totus_tpv_cash_movements to service_role using(true) with check(true);
revoke all on private.totus_tpv_cash_movements from public,anon,authenticated;
grant select,insert on private.totus_tpv_cash_movements to service_role;

create function private.totus_tpv_cash_summary(p_session uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('sessionId',s.id,'status',s.status,'openingCents',s.opening_cents,
  'expectedCashCents',s.opening_cents+
   coalesce((select sum(p.amount_cents) from private.totus_tpv_payment_events p where p.session_id=s.id and p.method='cash'),0)+
   coalesce((select sum(case when m.kind='cash-in' then m.amount_cents else -m.amount_cents end)
    from private.totus_tpv_cash_movements m where m.session_id=s.id),0),
  'countedCents',s.counted_cents,'closedAt',s.closed_at,'closingRequestId',s.closing_request_id,
  'payments',coalesce((select jsonb_object_agg(t.method,t.amount) from (
   select p.method,sum(p.amount_cents) amount from private.totus_tpv_payment_events p where p.session_id=s.id group by p.method
  )t),'{}'::jsonb))
 from private.totus_tpv_sessions s where s.id=p_session
$$;

create function private.totus_tpv_cash_can_close(p_session uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select not exists(select 1 from private.totus_tpv_operations where session_id=p_session and status in ('dispatched','uncertain'))
$$;

create function public.totus_tpv_cash(p_action text,p_request_id uuid,p_scope jsonb,p_data jsonb default '{}') returns jsonb
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
 perform private.totus_tpv_authorize(p_scope,'sell');
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
commit;
