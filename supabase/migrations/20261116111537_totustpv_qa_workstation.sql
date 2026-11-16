-- QA workstation configuration. Never reassign the website's business or add
-- QA amounts to commercial closings. Native profiles are supplied by the server
-- after authenticated HTTPS readback, never directly by a browser.
begin;
set local lock_timeout='5s';
create table private.totus_tpv_native_profiles (
 connection_id uuid not null references private.totus_api_connections(id),
 shop_id bigint not null check(shop_id>0),
 connection_revision bigint not null check(connection_revision>0),
 profile_revision bigint not null default 1 check(profile_revision>0),
 installation_id uuid not null,
 store_id uuid not null references public.ops_stores(id),
 website_key text not null references private.totus_websites(key),
 environment text not null default 'qa' check(environment='qa'),
 profile jsonb not null check(jsonb_typeof(profile)='object'),
 configured_by uuid not null references public.profiles(id),
 updated_at timestamptz not null default clock_timestamp(),
 primary key(connection_id,shop_id)
);
alter table private.totus_tpv_native_profiles enable row level security;
create policy tpv_native_profile_server on private.totus_tpv_native_profiles to service_role using(true) with check(true);
revoke all on private.totus_tpv_native_profiles from public,anon,authenticated;
grant select,insert,update on private.totus_tpv_native_profiles to service_role;
grant insert,update on private.totus_tpv_assignments to service_role;

create function public.totus_tpv_configure(p_actor uuid,p_operator uuid,p_connection uuid,p_revision bigint,
 p_store uuid,p_drawer uuid,p_website text,p_native jsonb,p_permissions jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare operator public.profiles; old private.totus_tpv_native_profiles; shop bigint; actor public.profiles;
begin
 select * into actor from public.profiles where id=p_actor and active;
 if not found or not exists(select 1 from public.team_members t where lower(t.email)=lower(actor.email) and t.active and t.role='admin')
  or not private.totus_module_can(actor.email,'configuracion','edit') then raise exception 'TPV_CONFIGURATION_FORBIDDEN';end if;
 select * into operator from public.profiles where id=p_operator and active;
 if not found then raise exception 'TPV_ACTOR_INACTIVE';end if;
 if length(p_native::text)>8192 or (p_native-array['verified','configured','protocol','environment','native_version','installation_id',
  'shop_id','currency_id','currency','language_id','carrier_id','paid_state_id','preparing_state_id','counter_customer_id',
  'counter_address_id','payment_labels','commands'])<>'{}'::jsonb
  or p_connection<>'b554f6cc-4df1-412b-b063-e1cbd82d9e66'::uuid or p_native->>'environment' is distinct from 'qa'
  or p_native->>'native_version' is distinct from '8.2.8' or p_native->'verified' is distinct from 'true'::jsonb
  or p_native->'configured' is distinct from 'true'::jsonb or p_native->'protocol' is distinct from '1'::jsonb
  or coalesce(p_native->>'installation_id','') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  then raise exception 'TPV_NATIVE_PROFILE_INVALID';end if;
 foreach shop in array array[(p_native->>'shop_id')::bigint,(p_native->>'currency_id')::bigint,
  (p_native->>'language_id')::bigint,(p_native->>'carrier_id')::bigint,(p_native->>'paid_state_id')::bigint,(p_native->>'preparing_state_id')::bigint,
  (p_native->>'counter_customer_id')::bigint,(p_native->>'counter_address_id')::bigint] loop
  if shop is null or shop<=0 then raise exception 'TPV_NATIVE_PROFILE_INVALID';end if;
 end loop;
 shop:=(p_native->>'shop_id')::bigint;
 if coalesce(p_native->>'currency','') !~ '^[A-Z]{3}$' or jsonb_typeof(p_native->'payment_labels') is distinct from 'object'
  or ((p_native->'payment_labels')-array['cash','card','bizum','transfer'])<>'{}'::jsonb
  or exists(select 1 from jsonb_each(p_native->'payment_labels') x where jsonb_typeof(x.value)<>'string'
   or length(x.value#>>'{}') not between 1 and 70 or (x.value#>>'{}')<>btrim(x.value#>>'{}') or (x.value#>>'{}') ~ '[[:cntrl:]]')
  or (select count(distinct value) from jsonb_each(p_native->'payment_labels'))<>(select count(*) from jsonb_each(p_native->'payment_labels'))
  or jsonb_typeof(p_native->'payment_labels'->'cash') is distinct from 'string'
  or jsonb_typeof(p_native->'payment_labels'->'card') is distinct from 'string'
  or length(coalesce(p_native->'payment_labels'->>'cash','')) not between 1 and 70
  or length(coalesce(p_native->'payment_labels'->>'card','')) not between 1 and 70
  or p_native->'payment_labels'->>'cash'=p_native->'payment_labels'->>'card'
  then raise exception 'TPV_NATIVE_PROFILE_INVALID';end if;
 if jsonb_typeof(p_permissions) is distinct from 'object' or (p_permissions-array['sell','open','reconcile'])<>'{}'::jsonb
  or exists(select 1 from jsonb_each(p_permissions) e where jsonb_typeof(e.value)<>'boolean')
  then raise exception 'TPV_ASSIGNMENT_INVALID';end if;
 perform 1 from private.totus_api_connections c join private.totus_websites w on w.connection_id=c.id
  join public.ops_stores s on s.id=p_store and s.active
  join public.ops_cash_drawers d on d.id=p_drawer and d.store_id=s.id and d.active
  where c.id=p_connection and c.revision=p_revision and c.verified_revision=c.revision and c.enabled and c.real_data_authorized
   and c.protocol='prestashop' and w.key=p_website and w.status='active'
   and w.origin='https://preproduccion.hortimatic.com' and w.include_in_totals=false
   and (w.business_id is null or w.business_id=s.id);
 if not found then raise exception 'TPV_QA_WORKSTATION_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended('totus-tpv-profile:'||p_connection::text||':'||shop::text,0));
 select * into old from private.totus_tpv_native_profiles where connection_id=p_connection and shop_id=shop for update;
 if found and (old.installation_id<>(p_native->>'installation_id')::uuid or old.store_id<>p_store)
  and exists(select 1 from private.totus_tpv_sessions where connection_id=p_connection and shop_id=shop)
  then raise exception 'TPV_NATIVE_IDENTITY_ALREADY_BOUND';end if;
 -- Assigning another cashier must never silently disable an established
 -- store payment method. This wizard adds capabilities; removal requires a
 -- separate explicit configuration operation and revision review.
 if old.profile is not null then
  p_native:=jsonb_set(p_native,'{payment_labels}',(old.profile->'payment_labels')||(p_native->'payment_labels'));
 end if;
 insert into private.totus_tpv_native_profiles(connection_id,shop_id,connection_revision,installation_id,store_id,website_key,profile,configured_by)
  values(p_connection,shop,p_revision,(p_native->>'installation_id')::uuid,p_store,p_website,p_native,p_actor)
  on conflict(connection_id,shop_id) do update set connection_revision=excluded.connection_revision,installation_id=excluded.installation_id,
   store_id=excluded.store_id,website_key=excluded.website_key,profile=excluded.profile,configured_by=p_actor,updated_at=clock_timestamp(),
   profile_revision=case when private.totus_tpv_native_profiles.profile is distinct from excluded.profile
    then private.totus_tpv_native_profiles.profile_revision+1 else private.totus_tpv_native_profiles.profile_revision end;
 insert into private.totus_tpv_assignments(actor_id,connection_id,website_key,store_id,shop_id,drawer_id,can_sell,can_open,can_reconcile)
  values(p_operator,p_connection,p_website,p_store,shop,p_drawer,coalesce((p_permissions->>'sell')::boolean,false),
   coalesce((p_permissions->>'open')::boolean,false),coalesce((p_permissions->>'reconcile')::boolean,false))
  on conflict(actor_id,connection_id,shop_id,drawer_id,environment) do update set website_key=excluded.website_key,store_id=excluded.store_id,
   can_sell=excluded.can_sell,can_open=excluded.can_open,can_reconcile=excluded.can_reconcile,active=true;
 return jsonb_build_object('configured',true,'environment','qa','connectionId',p_connection,'shopId',shop,'drawerId',p_drawer,'operatorId',p_operator);
end $$;
revoke all on function public.totus_tpv_configure(uuid,uuid,uuid,bigint,uuid,uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant select on public.team_members to service_role;
grant execute on function public.totus_tpv_configure(uuid,uuid,uuid,bigint,uuid,uuid,text,jsonb,jsonb) to service_role;

create or replace function private.totus_tpv_authorize(p_scope jsonb,p_action text) returns void
language plpgsql security invoker set search_path='' as $$
declare actor public.profiles; assignment private.totus_tpv_assignments; session private.totus_tpv_sessions;
begin
 if p_scope->>'environment' is distinct from 'qa' then raise exception 'TPV_ENVIRONMENT_FORBIDDEN';end if;
 if p_action not in ('sell','reconcile','open') then raise exception 'TPV_ACTION_INVALID';end if;
 select * into actor from public.profiles where id=(p_scope->>'actorId')::uuid and active;
 if not found then raise exception 'TPV_ACTOR_INACTIVE';end if;
 if not private.totus_module_can(actor.email,'ventas',case when p_action='reconcile' then 'view' else 'create' end)
  or not private.totus_module_can(actor.email,'cajas',case when p_action='reconcile' then 'view' else 'create' end)
  then raise exception 'TPV_SELL_FORBIDDEN';end if;
 select a.* into assignment from private.totus_tpv_assignments a
 join private.totus_api_connections c on c.id=a.connection_id
 join private.totus_websites w on w.key=a.website_key and w.connection_id=c.id
 join public.ops_stores s on s.id=a.store_id and s.active
 join public.ops_cash_drawers d on d.id=a.drawer_id and d.store_id=s.id and d.active
 where a.actor_id=actor.id and a.active and a.environment=p_scope->>'environment' and a.connection_id=(p_scope->>'connectionId')::uuid
  and a.shop_id=(p_scope->>'shopId')::bigint and a.store_id=(p_scope->>'storeId')::uuid
  and a.drawer_id=(p_scope->>'drawerId')::uuid and w.status='active'
  and (w.business_id=s.id or (w.business_id is null and w.include_in_totals=false
   and w.origin='https://preproduccion.hortimatic.com' and exists(select 1 from private.totus_tpv_native_profiles p
    where p.connection_id=c.id and p.shop_id=a.shop_id and p.store_id=s.id and p.website_key=w.key and p.connection_revision=c.revision)))
  and c.enabled and c.real_data_authorized and c.protocol='prestashop'
  and c.revision=(p_scope->>'connectionRevision')::bigint and c.verified_revision=c.revision;
 if not found then raise exception 'TPV_ASSIGNMENT_OR_CONNECTION_INVALID';end if;
 if (p_action='sell' and not assignment.can_sell) or (p_action='reconcile' and not assignment.can_reconcile)
  or (p_action='open' and not assignment.can_open) then raise exception 'TPV_ACTION_FORBIDDEN';end if;
 if p_action<>'open' then
  select * into session from private.totus_tpv_sessions where id=(p_scope->>'sessionId')::uuid for share;
  if not found or session.store_id<>assignment.store_id or session.connection_id<>assignment.connection_id
   or session.shop_id<>assignment.shop_id or session.drawer_id<>assignment.drawer_id
   or session.currency is distinct from p_scope->>'currency' or session.environment is distinct from p_scope->>'environment'
   or (p_action='sell' and session.status<>'open') then raise exception 'TPV_CASH_SESSION_MISMATCH';end if;
 end if;
end $$;

-- Narrow authenticated metadata read. The definer is required for private
-- assignments; every row is filtered by auth.uid and current module permissions.
create function public.totus_tpv_context() returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result jsonb;
begin
 if actor is null or not private.totus_can('ventas','view') or not private.totus_can('cajas','view')
  or not exists(select 1 from public.profiles where id=actor and active) then raise exception 'TPV_VIEW_FORBIDDEN';end if;
 select coalesce(jsonb_agg(jsonb_build_object('connectionId',a.connection_id,'connectionRevision',c.revision,'websiteKey',a.website_key,
  'storeId',s.id,'storeName',s.name,'drawerId',d.id,'drawerName',d.name,'shopId',a.shop_id,'environment',a.environment,
  'canSell',a.can_sell,'canOpen',a.can_open,'canReconcile',a.can_reconcile,'nativeProfile',p.profile,'profileRevision',p.profile_revision,
  'session',(select jsonb_build_object('id',ss.id,'status',ss.status,'openingCents',ss.opening_cents,'currency',ss.currency)
   from private.totus_tpv_sessions ss where ss.connection_id=a.connection_id and ss.shop_id=a.shop_id and ss.drawer_id=a.drawer_id
    and ss.environment=a.environment and ss.status='open')) order by s.name,d.name),'[]'::jsonb) into result
 from private.totus_tpv_assignments a join private.totus_api_connections c on c.id=a.connection_id
 join private.totus_tpv_native_profiles p on p.connection_id=a.connection_id and p.shop_id=a.shop_id and p.connection_revision=c.revision
  and p.store_id=a.store_id and p.website_key=a.website_key
 join private.totus_websites w on w.key=a.website_key and w.connection_id=c.id and w.status='active'
 join public.ops_stores s on s.id=a.store_id and s.active join public.ops_cash_drawers d on d.id=a.drawer_id and d.store_id=s.id and d.active
 where a.actor_id=actor and a.active and a.environment='qa' and c.enabled and c.real_data_authorized and c.verified_revision=c.revision;
 return jsonb_build_object('actorId',actor,'workstations',result);
end $$;
revoke all on function public.totus_tpv_context() from public,anon;
grant execute on function public.totus_tpv_context() to authenticated;
commit;
