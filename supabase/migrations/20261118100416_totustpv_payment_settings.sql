begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
-- Drawer policy is shared by its operators. Native payment labels remain in
-- the native profile and are never replaced by these counter display names.
create table private.totus_tpv_payment_settings(
 connection_id uuid not null references private.totus_api_connections(id),
 shop_id bigint not null check(shop_id>0),
 drawer_id uuid not null references public.ops_cash_drawers(id),
 options jsonb not null check(jsonb_typeof(options)='object'),
 revision bigint not null default 1 check(revision>0),
 updated_by uuid not null references public.profiles(id),
 updated_at timestamptz not null default clock_timestamp(),
 primary key(connection_id,shop_id,drawer_id)
);
create table private.totus_tpv_payment_settings_history(
 id bigint generated always as identity primary key,
 connection_id uuid not null,shop_id bigint not null,drawer_id uuid not null,
 revision bigint not null,actor_id uuid not null references public.profiles(id),
 before_options jsonb,after_options jsonb not null,
 recorded_at timestamptz not null default clock_timestamp(),
 unique(connection_id,shop_id,drawer_id,revision)
);
alter table private.totus_tpv_payment_settings enable row level security;
alter table private.totus_tpv_payment_settings_history enable row level security;
create policy tpv_payment_settings_server on private.totus_tpv_payment_settings to service_role using(true) with check(true);
create policy tpv_payment_history_server on private.totus_tpv_payment_settings_history to service_role using(true) with check(true);
revoke all on private.totus_tpv_payment_settings,private.totus_tpv_payment_settings_history from public,anon,authenticated;
grant select,insert,update on private.totus_tpv_payment_settings to service_role;
grant select on private.totus_tpv_payment_settings_history to service_role;

create function public.totus_tpv_payment_options(p_connection uuid,p_shop bigint,p_drawer uuid,p_options jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();ctx jsonb;native jsonb;available text[];enabled jsonb;labels jsonb;
 defaults jsonb:='{"cash":"Efectivo","card":"Tarjeta","bizum":"Bizum","transfer":"Transferencia"}';
 prior private.totus_tpv_payment_settings;saved private.totus_tpv_payment_settings;clean jsonb;
begin
 if actor is null then raise exception 'TPV_AUTH_REQUIRED';end if;
 ctx:=public.totus_tpv_context();
 if ctx->>'actorId' is distinct from actor::text or not exists(
  select 1 from jsonb_array_elements(ctx->'workstations') w where w->>'connectionId'=p_connection::text
   and w->>'shopId'=p_shop::text and w->>'drawerId'=p_drawer::text and w->>'canReconcile'='true')
 then raise exception 'TPV_PAYMENT_SETTINGS_FORBIDDEN';end if;
 select profile->'payment_labels' into native from private.totus_tpv_native_profiles
  where connection_id=p_connection and shop_id=p_shop;
 select array_agg(id order by ord) into available from unnest(array['cash','card','bizum','transfer']) with ordinality x(id,ord) where native?id;
 if coalesce(cardinality(available),0)=0 then raise exception 'TPV_PAYMENT_SETTINGS_UNAVAILABLE';end if;
 if p_options is not null then
  if not private.totus_module_can((select email from public.profiles where id=actor and active),'configuracion','edit')
  then raise exception 'TPV_PAYMENT_SETTINGS_FORBIDDEN';end if;
  if jsonb_typeof(p_options) is distinct from 'object' or length(p_options::text)>2000
   or p_options-array['enabledMethods','labels']<>'{}'::jsonb
  then raise exception 'TPV_PAYMENT_SETTINGS_INVALID';end if;
  enabled:=coalesce(p_options->'enabledMethods',to_jsonb(available));labels:=coalesce(p_options->'labels','{}');
  if jsonb_typeof(enabled) is distinct from 'array' or jsonb_typeof(labels) is distinct from 'object'
  then raise exception 'TPV_PAYMENT_SETTINGS_INVALID';end if;
  if jsonb_array_length(enabled) not between 1 and cardinality(available)
   or exists(select 1 from jsonb_array_elements(enabled) x where jsonb_typeof(x)<>'string' or not (x#>>'{}'=any(available)))
   or (select count(distinct x) from jsonb_array_elements(enabled) x)<>jsonb_array_length(enabled)
   or exists(select 1 from jsonb_each(labels) x where not(x.key=any(available)) or jsonb_typeof(x.value)<>'string')
  then raise exception 'TPV_PAYMENT_SETTINGS_INVALID';end if;
  select jsonb_object_agg(id,normalize(btrim(coalesce(labels->>id,defaults->>id)),NFC)) into labels from unnest(available) x(id);
  if exists(select 1 from jsonb_each_text(labels) x where length(x.value) not between 1 and 40 or x.value ~ '[[:cntrl:]<>]')
   or (select count(distinct lower(labels->>id)) from jsonb_array_elements_text(enabled) x(id))<>jsonb_array_length(enabled)
  then raise exception 'TPV_PAYMENT_SETTINGS_INVALID';end if;
  clean:=jsonb_build_object('enabledMethods',enabled,'labels',labels);
  -- Serialize configuration edits even before the first row exists.
  perform pg_advisory_xact_lock(hashtextextended(p_connection::text||':'||p_shop::text||':'||p_drawer::text,0));
  select * into prior from private.totus_tpv_payment_settings where connection_id=p_connection and shop_id=p_shop and drawer_id=p_drawer for update;
  insert into private.totus_tpv_payment_settings as stored(connection_id,shop_id,drawer_id,options,updated_by)
   values(p_connection,p_shop,p_drawer,clean,actor)
   on conflict(connection_id,shop_id,drawer_id) do update set options=excluded.options,
    revision=case when stored.options is distinct from excluded.options then stored.revision+1 else stored.revision end,
    updated_by=case when stored.options is distinct from excluded.options then actor else stored.updated_by end,
    updated_at=case when stored.options is distinct from excluded.options then clock_timestamp() else stored.updated_at end
   returning * into saved;
  if prior.options is distinct from saved.options then
   insert into private.totus_tpv_payment_settings_history(connection_id,shop_id,drawer_id,revision,actor_id,before_options,after_options)
    values(p_connection,p_shop,p_drawer,saved.revision,actor,prior.options,saved.options);
  end if;
 else
  select * into saved from private.totus_tpv_payment_settings where connection_id=p_connection and shop_id=p_shop and drawer_id=p_drawer;
 end if;
 select jsonb_object_agg(id,defaults->>id) into labels from unnest(available) x(id);
 return jsonb_build_object('revision',coalesce(saved.revision,0),'options',coalesce(saved.options,jsonb_build_object('enabledMethods',to_jsonb(available),'labels',labels)));
end $$;
revoke all on function public.totus_tpv_payment_options(uuid,bigint,uuid,jsonb) from public,anon;
grant execute on function public.totus_tpv_payment_options(uuid,bigint,uuid,jsonb) to authenticated;
commit;
