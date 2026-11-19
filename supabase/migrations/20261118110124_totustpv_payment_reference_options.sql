begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
-- External references configure counter annotations, never bank proof.
create or replace function public.totus_tpv_payment_options(p_connection uuid,p_shop bigint,p_drawer uuid,p_options jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();ctx jsonb;native jsonb;available text[];enabled jsonb;labels jsonb;reference_policy jsonb;reference_defaults jsonb;
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
 select coalesce(jsonb_object_agg(id,'hidden'::text),'{}'::jsonb) into reference_defaults from unnest(available) x(id) where id<>'cash';
 if p_options is not null then
  if not private.totus_module_can((select email from public.profiles where id=actor and active),'configuracion','edit')
  then raise exception 'TPV_PAYMENT_SETTINGS_FORBIDDEN';end if;
  if jsonb_typeof(p_options) is distinct from 'object' or length(p_options::text)>2000
   or p_options-array['enabledMethods','labels','referencePolicy']<>'{}'::jsonb
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
  reference_policy:=coalesce(p_options->'referencePolicy','{}'::jsonb);
  if jsonb_typeof(reference_policy) is distinct from 'object' then raise exception 'TPV_PAYMENT_SETTINGS_INVALID';end if;
  if exists(select 1 from jsonb_each(reference_policy) x where x.key='cash' or not(x.key=any(available)) or jsonb_typeof(x.value)<>'string' or x.value#>>'{}' not in ('hidden','optional','required'))
  then raise exception 'TPV_PAYMENT_SETTINGS_INVALID';end if;
  reference_policy:=reference_defaults||reference_policy;
  clean:=jsonb_build_object('enabledMethods',enabled,'labels',labels,'referencePolicy',reference_policy);
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
 return jsonb_build_object('revision',coalesce(saved.revision,0),'options',jsonb_build_object('referencePolicy',reference_defaults)||coalesce(saved.options,jsonb_build_object('enabledMethods',to_jsonb(available),'labels',labels)));
end $$;
revoke all on function public.totus_tpv_payment_options(uuid,bigint,uuid,jsonb) from public,anon;
grant execute on function public.totus_tpv_payment_options(uuid,bigint,uuid,jsonb) to authenticated;

commit;
