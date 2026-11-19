begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create table private.totus_tpv_return_policies(
 connection_id uuid not null,shop_id bigint not null,drawer_id uuid not null,
 allow_partial boolean not null default true,updated_by uuid not null,updated_at timestamptz not null default clock_timestamp(),
 primary key(connection_id,shop_id,drawer_id));
alter table private.totus_tpv_return_policies enable row level security;
create policy totus_tpv_return_policy_service_read on private.totus_tpv_return_policies for select to service_role using(true);
revoke all on private.totus_tpv_return_policies from public,anon,authenticated;
grant select on private.totus_tpv_return_policies to service_role;
create or replace function totus_tpv_internal.return_policy(p_connection uuid,p_shop bigint,p_drawer uuid,p_settings jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();result boolean;
begin
 if actor is null then raise exception 'TPV_AUTH_REQUIRED';end if;
 perform public.totus_tpv_workspace_preferences(p_connection,p_shop,p_drawer,null);
 if p_settings is not null then
  if not private.totus_can('ventas','edit') then raise exception 'TPV_RETURN_POLICY_FORBIDDEN';end if;
  if jsonb_typeof(p_settings) is distinct from 'object' or p_settings-array['allowPartial']<>'{}'::jsonb
   or jsonb_typeof(p_settings->'allowPartial') is distinct from 'boolean' then raise exception 'TPV_RETURN_POLICY_INVALID';end if;
  insert into private.totus_tpv_return_policies(connection_id,shop_id,drawer_id,allow_partial,updated_by)
   values(p_connection,p_shop,p_drawer,(p_settings->>'allowPartial')::boolean,actor)
   on conflict(connection_id,shop_id,drawer_id) do update set allow_partial=excluded.allow_partial,updated_by=actor,updated_at=clock_timestamp();
 end if;
 select allow_partial into result from private.totus_tpv_return_policies where connection_id=p_connection and shop_id=p_shop and drawer_id=p_drawer;
 return jsonb_build_object('allowPartial',coalesce(result,true));
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
declare result boolean;
begin
 perform private.totus_tpv_authorize(p_scope,'sell');
 select allow_partial into result from private.totus_tpv_return_policies where connection_id=(p_scope->>'connectionId')::uuid
  and shop_id=(p_scope->>'shopId')::bigint and drawer_id=(p_scope->>'drawerId')::uuid;
 return jsonb_build_object('allowPartial',coalesce(result,true));
end $$;
revoke all on function public.totus_tpv_return_policy_for_scope(jsonb) from public,anon,authenticated;
grant execute on function public.totus_tpv_return_policy_for_scope(jsonb) to service_role;
commit;
