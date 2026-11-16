-- Administrative review never retries a command or invents a sale/payment.
-- The server must verify the finished native failure and absence of orders;
-- the administrator separately checks that no external collection remains.
begin;
set local lock_timeout='5s';
alter table private.totus_tpv_operations
 add column resolved_by uuid references public.profiles(id),
 add column resolved_at timestamptz,
 add column resolution jsonb;
alter table private.totus_tpv_operations drop constraint totus_tpv_operations_status_check;
alter table private.totus_tpv_operations add constraint totus_tpv_operations_status_check
 check(status in ('ready','dispatched','uncertain','confirmed','cancelled'));
alter table private.totus_tpv_operations add constraint totus_tpv_cancelled_review_required
 check(status<>'cancelled' or (order_id is null and resolved_by is not null and resolved_at is not null
  and jsonb_typeof(resolution)='object' and resolution->>'ordersObserved'='0'
  and resolution->>'executionFinished'='true' and resolution->>'effectObserved'='false'));
create function public.totus_tpv_resolve_incident(p_scope jsonb,p_id uuid,p_reason text,p_settlement text,p_proof jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare r private.totus_tpv_operations; actor uuid:=(p_scope->>'actorId')::uuid;
begin
 perform private.totus_tpv_authorize(p_scope,'reconcile');
 if not exists(select 1 from public.profiles p join public.team_members t on lower(t.email)=lower(p.email)
  where p.id=actor and p.active and t.active and t.role='admin'
   and private.totus_module_can(p.email,'configuracion','edit')) then raise exception 'TPV_INCIDENT_ADMIN_REQUIRED';end if;
 if p_reason is null or length(btrim(p_reason))<10 or length(p_reason)>500 or p_reason~'[[:cntrl:]]'
  or p_settlement not in ('not-collected','returned-externally') or p_settlement is null
  then raise exception 'TPV_INCIDENT_REVIEW_INVALID';end if;
 select * into r from private.totus_tpv_operations where id=p_id for update;
 if not found or r.environment is distinct from 'qa' or r.connection_id::text is distinct from p_scope->>'connectionId'
  or r.store_id::text is distinct from p_scope->>'storeId' or r.shop_id::text is distinct from p_scope->>'shopId'
  or r.drawer_id::text is distinct from p_scope->>'drawerId' or r.session_id::text is distinct from p_scope->>'sessionId'
  or r.order_id is not null then raise exception 'TPV_INCIDENT_REVIEW_FORBIDDEN';end if;
 if r.status='cancelled' then
  if r.resolution->>'reviewReason' is distinct from btrim(p_reason) or r.resolution->>'settlementReview' is distinct from p_settlement
   then raise exception 'TPV_INCIDENT_REVIEW_CHANGED';end if;
  return jsonb_build_object('id',r.id,'status','cancelled','totalCents',r.expected->'totalCents','retryOrderForbidden',true);
 end if;
 if r.status<>'uncertain' or r.dispatched_by is null or exists(select 1 from private.totus_tpv_payment_events where operation_id=r.id)
  or exists(select 1 from private.totus_tpv_refunds where sale_id=r.id)
  then raise exception 'TPV_INCIDENT_REVIEW_FORBIDDEN';end if;
 if jsonb_typeof(p_proof) is distinct from 'object' or length(p_proof::text)>4096
  or p_proof->>'operationId' is distinct from r.id::text or p_proof->>'cartId' is distinct from r.cart_id::text
  or p_proof->>'executionFinished' is distinct from 'true' or p_proof->>'effectObserved' is distinct from 'false'
  or p_proof->>'ordersObserved' is distinct from '0' or p_proof->>'nativeCommand' is distinct from 'sale.commit'
  or coalesce(p_proof->>'nativeCode','') !~ '^TOTUS_[A-Z0-9_]{1,90}$'
  or coalesce(p_proof->>'checkedAt','') !~ '^[0-9]{13}$'
  or abs(extract(epoch from clock_timestamp())*1000-(p_proof->>'checkedAt')::bigint)>60000
  then raise exception 'TPV_INCIDENT_NATIVE_PROOF_REQUIRED';end if;
 update private.totus_tpv_operations set status='cancelled',resolved_by=actor,resolved_at=clock_timestamp(),
  resolution=p_proof||jsonb_build_object('reviewReason',btrim(p_reason),'settlementReview',p_settlement),
  last_reason='TPV_FAILED_SALE_REVIEWED',updated_at=clock_timestamp() where id=r.id;
 return jsonb_build_object('id',r.id,'status','cancelled','totalCents',r.expected->'totalCents','retryOrderForbidden',true);
end $$;
revoke all on function public.totus_tpv_resolve_incident(jsonb,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.totus_tpv_resolve_incident(jsonb,uuid,text,text,jsonb) to service_role;
commit;
