begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table private.totus_tpv_return_policies add column require_original_payment boolean not null default false;
create or replace function totus_tpv_internal.return_policy(p_connection uuid,p_shop bigint,p_drawer uuid,p_settings jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();result boolean;original boolean;
begin
 if actor is null then raise exception 'TPV_AUTH_REQUIRED';end if;
 perform public.totus_tpv_workspace_preferences(p_connection,p_shop,p_drawer,null);
 if p_settings is not null then
  if not private.totus_can('ventas','edit') then raise exception 'TPV_RETURN_POLICY_FORBIDDEN';end if;
  perform pg_advisory_xact_lock(hashtextextended('tpv-return-policy:'||p_connection::text||':'||p_shop::text||':'||p_drawer::text,0));
  if jsonb_typeof(p_settings) is distinct from 'object' or p_settings-array['allowPartial','requireOriginalPayment']<>'{}'::jsonb
   or jsonb_typeof(p_settings->'allowPartial') is distinct from 'boolean'
   or p_settings?'requireOriginalPayment' and jsonb_typeof(p_settings->'requireOriginalPayment') is distinct from 'boolean' then raise exception 'TPV_RETURN_POLICY_INVALID';end if;
  insert into private.totus_tpv_return_policies(connection_id,shop_id,drawer_id,allow_partial,require_original_payment,updated_by)
   values(p_connection,p_shop,p_drawer,(p_settings->>'allowPartial')::boolean,coalesce((p_settings->>'requireOriginalPayment')::boolean,(select require_original_payment from private.totus_tpv_return_policies where connection_id=p_connection and shop_id=p_shop and drawer_id=p_drawer),false),actor)
   on conflict(connection_id,shop_id,drawer_id) do update set allow_partial=excluded.allow_partial,require_original_payment=excluded.require_original_payment,updated_by=actor,updated_at=clock_timestamp();
 end if;
 select allow_partial,require_original_payment into result,original from private.totus_tpv_return_policies where connection_id=p_connection and shop_id=p_shop and drawer_id=p_drawer;
 return jsonb_build_object('allowPartial',coalesce(result,true),'requireOriginalPayment',coalesce(original,false));
end $$;
revoke all on function totus_tpv_internal.return_policy(uuid,bigint,uuid,jsonb) from public,anon;
grant execute on function totus_tpv_internal.return_policy(uuid,bigint,uuid,jsonb) to authenticated;
create or replace function public.totus_tpv_return_policy(p_connection uuid,p_shop bigint,p_drawer uuid,p_settings jsonb default null)
returns jsonb language sql security invoker set search_path='' as $$
 select totus_tpv_internal.return_policy(p_connection,p_shop,p_drawer,p_settings);
$$;
revoke all on function public.totus_tpv_return_policy(uuid,bigint,uuid,jsonb) from public,anon;
grant execute on function public.totus_tpv_return_policy(uuid,bigint,uuid,jsonb) to authenticated;
create or replace function public.totus_tpv_return_policy_for_scope(p_scope jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result boolean;original boolean;
begin
 perform private.totus_tpv_authorize(p_scope,'sell');
 select allow_partial,require_original_payment into result,original from private.totus_tpv_return_policies where connection_id=(p_scope->>'connectionId')::uuid
  and shop_id=(p_scope->>'shopId')::bigint and drawer_id=(p_scope->>'drawerId')::uuid;
 return jsonb_build_object('allowPartial',coalesce(result,true),'requireOriginalPayment',coalesce(original,false));
end $$;
revoke all on function public.totus_tpv_return_policy_for_scope(jsonb) from public,anon,authenticated;
grant execute on function public.totus_tpv_return_policy_for_scope(jsonb) to service_role;
commit;
