begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create table private.totus_tpv_operator_settings(
 connection_id uuid not null,shop_id bigint not null,drawer_id uuid not null,switch_enabled boolean not null default true,
 revision bigint not null check(revision>0),updated_by uuid not null references public.profiles(id),updated_at timestamptz not null default clock_timestamp(),
 primary key(connection_id,shop_id,drawer_id));
alter table private.totus_tpv_operator_settings enable row level security;
create policy tpv_operator_settings_service_read on private.totus_tpv_operator_settings for select to service_role using(true);
revoke all on private.totus_tpv_operator_settings from public,anon,authenticated;
grant select on private.totus_tpv_operator_settings to service_role;
create function totus_tpv_internal.operator_settings(p_connection uuid,p_shop bigint,p_drawer uuid,p_settings jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();saved private.totus_tpv_operator_settings;enabled boolean;rev bigint;
begin
 if actor is null then raise exception 'TPV_AUTH_REQUIRED';end if;
 perform public.totus_tpv_workspace_preferences(p_connection,p_shop,p_drawer,null);
 if p_settings is not null then
  if not private.totus_can('configuracion','edit') then raise exception 'TPV_OPERATOR_SETTINGS_FORBIDDEN';end if;
  if jsonb_typeof(p_settings) is distinct from 'object' or p_settings-array['switchEnabled','expectedRevision']<>'{}'::jsonb
   or jsonb_typeof(p_settings->'switchEnabled') is distinct from 'boolean' or jsonb_typeof(p_settings->'expectedRevision') is distinct from 'number'
   or coalesce(p_settings->>'expectedRevision','')!~'^(0|[1-9][0-9]{0,14})$' then raise exception 'TPV_OPERATOR_SETTINGS_INVALID';end if;
  perform pg_advisory_xact_lock(hashtextextended('tpv-operator-settings:'||p_connection::text||':'||p_shop::text||':'||p_drawer::text,0));
 end if;
 select * into saved from private.totus_tpv_operator_settings where connection_id=p_connection and shop_id=p_shop and drawer_id=p_drawer;
 enabled:=coalesce(saved.switch_enabled,true);rev:=coalesce(saved.revision,0);
 if p_settings is not null and enabled is distinct from (p_settings->>'switchEnabled')::boolean then
  if (p_settings->>'expectedRevision')::bigint<>rev then raise exception 'TPV_OPERATOR_SETTINGS_STALE';end if;
  enabled:=(p_settings->>'switchEnabled')::boolean;rev:=rev+1;
  insert into private.totus_tpv_operator_settings(connection_id,shop_id,drawer_id,switch_enabled,revision,updated_by) values(p_connection,p_shop,p_drawer,enabled,rev,actor)
  on conflict(connection_id,shop_id,drawer_id) do update set switch_enabled=excluded.switch_enabled,revision=excluded.revision,updated_by=actor,updated_at=clock_timestamp();
 end if;
 return jsonb_build_object('switchEnabled',enabled,'revision',rev);
end $$;
revoke all on function totus_tpv_internal.operator_settings(uuid,bigint,uuid,jsonb) from public,anon,service_role;
grant execute on function totus_tpv_internal.operator_settings(uuid,bigint,uuid,jsonb) to authenticated;
create function public.totus_tpv_operator_settings(p_connection uuid,p_shop bigint,p_drawer uuid,p_settings jsonb default null)
returns jsonb language sql security invoker set search_path='' as $$select totus_tpv_internal.operator_settings(p_connection,p_shop,p_drawer,p_settings);$$;
revoke all on function public.totus_tpv_operator_settings(uuid,bigint,uuid,jsonb) from public,anon,service_role;
grant execute on function public.totus_tpv_operator_settings(uuid,bigint,uuid,jsonb) to authenticated;
create or replace function totus_tpv_internal.operator_choices(p_connection uuid default null,p_shop bigint default null,p_drawer uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();ctx jsonb;items jsonb;enabled boolean;
begin
 if actor is null then raise exception 'TPV_AUTH_REQUIRED';end if;
 if ((p_connection is null and p_shop is null and p_drawer is null) or (p_connection is not null and p_shop>0 and p_drawer is not null)) is not true then raise exception 'TPV_OPERATOR_SCOPE_INVALID';end if;
 if not exists(select 1 from public.profiles p join public.team_members t on lower(t.email)=lower(p.email) and t.active where p.id=actor and p.active) then raise exception 'TPV_OPERATOR_CHOICES_FORBIDDEN';end if;
 ctx:=public.totus_tpv_context();
 if ctx->>'actorId' is distinct from actor::text then raise exception 'TPV_OPERATOR_CHOICES_FORBIDDEN';end if;
 if p_connection is not null and not exists(select 1 from jsonb_array_elements(ctx->'workstations') w where w->>'connectionId'=p_connection::text and w->>'shopId'=p_shop::text and w->>'drawerId'=p_drawer::text and w->>'canReconcile'='true') then raise exception 'TPV_OPERATOR_CHOICES_FORBIDDEN';end if;
 select not exists(select 1 from jsonb_array_elements(ctx->'workstations') w where w->>'canReconcile'='true' and (p_connection is null or w->>'connectionId'=p_connection::text and w->>'shopId'=p_shop::text and w->>'drawerId'=p_drawer::text)) or exists(select 1 from jsonb_array_elements(ctx->'workstations') w where w->>'canReconcile'='true'
  and (p_connection is null or w->>'connectionId'=p_connection::text and w->>'shopId'=p_shop::text and w->>'drawerId'=p_drawer::text)
  and not exists(select 1 from private.totus_tpv_operator_settings s where s.connection_id=(w->>'connectionId')::uuid and s.shop_id=(w->>'shopId')::bigint and s.drawer_id=(w->>'drawerId')::uuid and not s.switch_enabled)) into enabled;
 select coalesce(jsonb_agg(jsonb_build_object('operatorId',c.id,'name',c.name,'loginEmail',c.email) order by lower(c.name),c.id),'[]'::jsonb) into items from (
  select distinct p.id,coalesce(nullif(btrim(p.full_name),''),'Operador') name,lower(p.email) email
  from private.totus_tpv_assignments a join public.profiles p on p.id=a.actor_id and p.active
  where a.active and a.can_reconcile and a.environment='qa'
   and not exists(select 1 from private.totus_tpv_operator_settings s where s.connection_id=a.connection_id and s.shop_id=a.shop_id and s.drawer_id=a.drawer_id and not s.switch_enabled)
   and length(coalesce(p.email,'')) between 3 and 254 and p.email !~ '[[:space:][:cntrl:]]' and p.email like '%@%'
   and exists(select 1 from public.team_members t where lower(t.email)=lower(p.email) and t.active)
   and private.totus_module_can(p.email,'ventas','view') and private.totus_module_can(p.email,'cajas','view')
   and exists(select 1 from jsonb_array_elements(ctx->'workstations') w where w->>'connectionId'=a.connection_id::text and w->>'shopId'=a.shop_id::text and w->>'drawerId'=a.drawer_id::text and w->>'storeId'=a.store_id::text and w->>'websiteKey'=a.website_key
    and w->>'canReconcile'='true' and (p_connection is null or a.connection_id=p_connection and a.shop_id=p_shop and a.drawer_id=p_drawer))
  order by p.id limit 2001
 ) c;
 if jsonb_array_length(items)>2000 then raise exception 'TPV_OPERATOR_CHOICES_LIMIT';end if;
 return jsonb_build_object('actorId',actor,'items',items,'enabled',enabled);
end $$;

commit;
