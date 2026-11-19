-- Read the conserved copy with the existing billing scope, without a cash session.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create function public.totus_tpv_billing_signature(p_scope jsonb,p_sale uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare sale jsonb;r private.totus_tpv_signatures;
begin
 if p_sale is null then raise exception 'TPV_BILLING_QUERY_INVALID';end if;
 sale:=public.totus_tpv_billing_read(p_scope,p_sale,'{}'::jsonb);
 if sale->>'id' is distinct from p_sale::text then raise exception 'TPV_BILLING_SALE_NOT_FOUND';end if;
 select * into r from private.totus_tpv_signatures where operation_id=p_sale and status='signed'
  and connection_id=(p_scope->>'connectionId')::uuid and shop_id=(p_scope->>'shopId')::bigint
  and store_id=(p_scope->>'storeId')::uuid and order_id=(sale->>'orderId')::bigint;
 if not found then return null;end if;
 return jsonb_build_object('operationId',r.operation_id,'orderId',r.order_id,'status',r.status,
  'original',jsonb_build_object('sha256',r.original_data->>'sha256'),'signed',r.signed_data,
  'actorName',r.actor_name,'signedAt',r.signed_at);
end $$;
revoke all on function public.totus_tpv_billing_signature(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.totus_tpv_billing_signature(jsonb,uuid) to service_role;
commit;
