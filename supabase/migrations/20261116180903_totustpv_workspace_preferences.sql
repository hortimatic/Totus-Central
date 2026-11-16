-- Presentation settings live in Central, per operator and assigned cash drawer.
-- No catalogue, customer or financial records are copied into this table.
begin;
create table private.totus_tpv_workspace_preferences (
 actor_id uuid not null references public.profiles(id),
 connection_id uuid not null references private.totus_api_connections(id),
 shop_id bigint not null check(shop_id>0),
 drawer_id uuid not null references public.ops_cash_drawers(id),
 view_mode text not null default 'grid' check(view_mode in ('grid','compact','list')),
 initial_category_id bigint not null default 0 check(initial_category_id between 0 and 2147483647),
 updated_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,connection_id,shop_id,drawer_id)
);
alter table private.totus_tpv_workspace_preferences enable row level security;
revoke all on private.totus_tpv_workspace_preferences from public,anon,authenticated;
create function public.totus_tpv_workspace_preferences(p_connection uuid,p_shop bigint,p_drawer uuid,p_preferences jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); ctx jsonb; saved private.totus_tpv_workspace_preferences;
begin
 if actor is null then raise exception 'TPV_AUTH_REQUIRED';end if;
 ctx:=public.totus_tpv_context();
 if ctx->>'actorId' is distinct from actor::text or not exists(
  select 1 from jsonb_array_elements(ctx->'workstations') w where w->>'connectionId'=p_connection::text
   and w->>'shopId'=p_shop::text and w->>'drawerId'=p_drawer::text and w->>'canReconcile'='true')
 then raise exception 'TPV_WORKSPACE_PREFERENCES_FORBIDDEN';end if;
 if p_preferences is not null then
  if jsonb_typeof(p_preferences) is distinct from 'object' or length(p_preferences::text)>2000
   or p_preferences-array['viewMode','initialCategoryId']<>'{}'::jsonb
   or coalesce(p_preferences->>'viewMode','') not in ('grid','compact','list')
   or coalesce(p_preferences->>'initialCategoryId','') !~ '^(0|[1-9][0-9]{0,9})$'
   or (p_preferences->>'initialCategoryId')::bigint>2147483647
   then raise exception 'TPV_WORKSPACE_PREFERENCES_INVALID';end if;
  insert into private.totus_tpv_workspace_preferences(actor_id,connection_id,shop_id,drawer_id,view_mode,initial_category_id)
   values(actor,p_connection,p_shop,p_drawer,p_preferences->>'viewMode',(p_preferences->>'initialCategoryId')::bigint)
   on conflict(actor_id,connection_id,shop_id,drawer_id) do update
   set view_mode=excluded.view_mode,initial_category_id=excluded.initial_category_id,updated_at=clock_timestamp();
 end if;
 select * into saved from private.totus_tpv_workspace_preferences
  where actor_id=actor and connection_id=p_connection and shop_id=p_shop and drawer_id=p_drawer;
 return jsonb_build_object('viewMode',coalesce(saved.view_mode,'grid'),'initialCategoryId',coalesce(saved.initial_category_id,0));
end $$;
revoke all on function public.totus_tpv_workspace_preferences(uuid,bigint,uuid,jsonb) from public,anon;
grant execute on function public.totus_tpv_workspace_preferences(uuid,bigint,uuid,jsonb) to authenticated;
commit;
