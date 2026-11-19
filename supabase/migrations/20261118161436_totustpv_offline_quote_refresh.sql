begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
-- Only the authenticated server may extend a freshly revalidated, unsent quote.
-- Prices, identity, cart and payment intent are never replaced here.
create function public.totus_tpv_refresh_quote(p_scope jsonb,p_operation_id uuid,p_revision bigint,p_expected jsonb,p_expires_at bigint) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r private.totus_tpv_operations; deadline timestamptz;
begin
 perform private.totus_tpv_authorize(p_scope,'sell');
 select * into r from private.totus_tpv_operations where id=p_operation_id for update;
 if not found then raise exception 'TPV_OPERATION_NOT_FOUND';end if;
 if r.connection_id is distinct from (p_scope->>'connectionId')::uuid
 or r.connection_revision is distinct from (p_scope->>'connectionRevision')::bigint
 or r.environment is distinct from p_scope->>'environment'
 or r.store_id is distinct from (p_scope->>'storeId')::uuid
 or r.shop_id is distinct from (p_scope->>'shopId')::bigint
 or r.drawer_id is distinct from (p_scope->>'drawerId')::uuid
 or r.session_id is distinct from (p_scope->>'sessionId')::uuid
 or r.created_by is distinct from (p_scope->>'actorId')::uuid
 or r.currency is distinct from p_scope->>'currency'
 then raise exception 'TPV_OPERATION_SCOPE_MISMATCH';end if;
 if r.status<>'ready' or r.order_id is not null or r.dispatch_token is not null or r.payments is not null
 then raise exception 'TPV_OPERATION_ALREADY_DISPATCHED';end if;
 if r.revision is distinct from p_revision or r.expected is distinct from p_expected
 then raise exception 'TPV_OPERATION_STALE';end if;
 deadline:=to_timestamp(p_expires_at::numeric/1000);
 if deadline is null or deadline<=clock_timestamp() or deadline>clock_timestamp()+interval '5 minutes'
 then raise exception 'TPV_QUOTE_EXPIRED';end if;
 update private.totus_tpv_operations set quote_expires_at=deadline,revision=revision+1,updated_at=clock_timestamp()
 where id=r.id returning * into r;
 return private.totus_tpv_operation_json(r);
end $$;
revoke all on function public.totus_tpv_refresh_quote(jsonb,uuid,bigint,jsonb,bigint) from public,anon,authenticated;
grant execute on function public.totus_tpv_refresh_quote(jsonb,uuid,bigint,jsonb,bigint) to service_role;
commit;
