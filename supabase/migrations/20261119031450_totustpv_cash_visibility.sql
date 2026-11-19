begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
grant usage on schema totus_tpv_internal to service_role;
create table private.totus_tpv_cash_visibility(
 connection_id uuid not null,shop_id bigint not null,drawer_id uuid not null,
 hide_summary boolean not null default false,updated_by uuid not null references public.profiles(id),updated_at timestamptz not null default clock_timestamp(),
 primary key(connection_id,shop_id,drawer_id));
alter table private.totus_tpv_cash_visibility enable row level security;
create policy tpv_cash_visibility_service_read on private.totus_tpv_cash_visibility for select to service_role using(true);
revoke all on private.totus_tpv_cash_visibility from public,anon,authenticated;
grant select on private.totus_tpv_cash_visibility to service_role;
create function private.totus_tpv_cash_visible(p_scope jsonb) returns boolean language sql stable security definer set search_path='' as $$
 select not coalesce((select hide_summary from private.totus_tpv_cash_visibility where connection_id=(p_scope->>'connectionId')::uuid and shop_id=(p_scope->>'shopId')::bigint and drawer_id=(p_scope->>'drawerId')::uuid),false)
 or exists(select 1 from public.profiles p where p.id=(p_scope->>'actorId')::uuid and p.active and private.totus_module_can(p.email,'configuracion','edit'));
$$;
create function private.totus_tpv_cash_projection(p_scope jsonb,p_value jsonb) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if p_value is null or private.totus_tpv_cash_visible(p_scope) then return p_value;end if;
 select coalesce(jsonb_object_agg(e.key,e.value),'{}'::jsonb) into result from jsonb_each(p_value) e
 where e.key=any(array['sessionId','status','closedAt','closingRequestId','currency','environment','storeName','drawerName','openedAt','openedByName','closedByName','generatedAt','unresolvedSales','pendingSales','pendingRefunds']);
 return result||jsonb_build_object('cashSummaryHidden',true);
end $$;
revoke all on function private.totus_tpv_cash_visible(jsonb),private.totus_tpv_cash_projection(jsonb,jsonb) from public,anon,authenticated;
grant execute on function private.totus_tpv_cash_visible(jsonb),private.totus_tpv_cash_projection(jsonb,jsonb) to service_role;
-- Preserve the current ledger and all of its validation/idempotency contracts.
alter function public.totus_tpv_cash(text,uuid,jsonb,jsonb) set schema totus_tpv_internal;
alter function totus_tpv_internal.totus_tpv_cash(text,uuid,jsonb,jsonb) rename to cash_unredacted_v1;
revoke all on function totus_tpv_internal.cash_unredacted_v1(text,uuid,jsonb,jsonb) from public,anon,authenticated;
create function public.totus_tpv_cash(p_action text,p_request_id uuid,p_scope jsonb,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$
 select private.totus_tpv_cash_projection(p_scope,totus_tpv_internal.cash_unredacted_v1(p_action,p_request_id,p_scope,p_data));
$$;
revoke all on function public.totus_tpv_cash(text,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.totus_tpv_cash(text,uuid,jsonb,jsonb) to service_role;
alter function public.totus_tpv_cash_reports(jsonb,uuid) set schema totus_tpv_internal;
alter function totus_tpv_internal.totus_tpv_cash_reports(jsonb,uuid) rename to cash_reports_unredacted_v1;
revoke all on function totus_tpv_internal.cash_reports_unredacted_v1(jsonb,uuid) from public,anon,authenticated;
create function public.totus_tpv_cash_reports(p_scope jsonb,p_session_id uuid default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 select coalesce(jsonb_agg(private.totus_tpv_cash_projection(p_scope,v.value) order by v.ordinality),'[]'::jsonb) into result
 from jsonb_array_elements(totus_tpv_internal.cash_reports_unredacted_v1(p_scope,p_session_id)) with ordinality v;
 return result;
end $$;
revoke all on function public.totus_tpv_cash_reports(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.totus_tpv_cash_reports(jsonb,uuid) to service_role;
-- The authenticated context must not leak an opening float either.
alter function public.totus_tpv_context() set schema totus_tpv_internal;
alter function totus_tpv_internal.totus_tpv_context() rename to context_unredacted_v1;
revoke all on function totus_tpv_internal.context_unredacted_v1() from public,anon,authenticated,service_role;
create function totus_tpv_internal.context_cash_visibility() returns jsonb language plpgsql security definer set search_path='' as $$
declare ctx jsonb;stations jsonb;
begin
 ctx:=totus_tpv_internal.context_unredacted_v1();
 select coalesce(jsonb_agg(case when private.totus_tpv_cash_visible(w.value||jsonb_build_object('actorId',auth.uid())) then w.value
  else case when jsonb_typeof(w.value->'session')='object' then jsonb_set(w.value,'{session}',(w.value->'session')-'openingCents'||jsonb_build_object('cashSummaryHidden',true)) else w.value end end order by w.ordinality),'[]'::jsonb)
 into stations from jsonb_array_elements(ctx->'workstations') with ordinality w;
 return jsonb_set(ctx,'{workstations}',stations);
end $$;
revoke all on function totus_tpv_internal.context_cash_visibility() from public,anon,service_role;
grant execute on function totus_tpv_internal.context_cash_visibility() to authenticated;
create function public.totus_tpv_context() returns jsonb language sql security invoker set search_path='' as $$select totus_tpv_internal.context_cash_visibility();$$;
revoke all on function public.totus_tpv_context() from public,anon,service_role;
grant execute on function public.totus_tpv_context() to authenticated;
create function totus_tpv_internal.cash_visibility(p_connection uuid,p_shop bigint,p_drawer uuid,p_settings jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();hidden boolean;
begin
 if actor is null then raise exception 'TPV_AUTH_REQUIRED';end if;
 perform public.totus_tpv_workspace_preferences(p_connection,p_shop,p_drawer,null);
 if p_settings is not null then
  if not private.totus_can('configuracion','edit') then raise exception 'TPV_CASH_VISIBILITY_FORBIDDEN';end if;
  if jsonb_typeof(p_settings) is distinct from 'object' or p_settings-array['hideSummary']<>'{}'::jsonb or jsonb_typeof(p_settings->'hideSummary') is distinct from 'boolean' then raise exception 'TPV_CASH_VISIBILITY_INVALID';end if;
  insert into private.totus_tpv_cash_visibility(connection_id,shop_id,drawer_id,hide_summary,updated_by) values(p_connection,p_shop,p_drawer,(p_settings->>'hideSummary')::boolean,actor)
  on conflict(connection_id,shop_id,drawer_id) do update set hide_summary=excluded.hide_summary,updated_by=actor,updated_at=clock_timestamp();
 end if;
 select hide_summary into hidden from private.totus_tpv_cash_visibility where connection_id=p_connection and shop_id=p_shop and drawer_id=p_drawer;
 return jsonb_build_object('hideSummary',coalesce(hidden,false));
end $$;
revoke all on function totus_tpv_internal.cash_visibility(uuid,bigint,uuid,jsonb) from public,anon,service_role;
grant execute on function totus_tpv_internal.cash_visibility(uuid,bigint,uuid,jsonb) to authenticated;
create function public.totus_tpv_cash_visibility(p_connection uuid,p_shop bigint,p_drawer uuid,p_settings jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select totus_tpv_internal.cash_visibility(p_connection,p_shop,p_drawer,p_settings);$$;
revoke all on function public.totus_tpv_cash_visibility(uuid,bigint,uuid,jsonb) from public,anon,service_role;
grant execute on function public.totus_tpv_cash_visibility(uuid,bigint,uuid,jsonb) to authenticated;
commit;
