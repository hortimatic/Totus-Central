begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
-- Preferences only. Saving these fields never updates a product or its codes.
create table private.totus_tpv_barcode_settings(
 actor_id uuid not null references public.profiles(id),
 connection_id uuid not null references private.totus_api_connections(id),
 shop_id bigint not null check(shop_id>0),drawer_id uuid not null references public.ops_cash_drawers(id),
 field text not null default 'ean13' check(field in ('ean13','upc','reference')),
 generator_enabled boolean not null default false,
 updated_at timestamptz not null default clock_timestamp(),
 primary key(actor_id,connection_id,shop_id,drawer_id)
);
alter table private.totus_tpv_barcode_settings enable row level security;
create policy tpv_barcode_settings_server on private.totus_tpv_barcode_settings to service_role using(true) with check(true);
revoke all on private.totus_tpv_barcode_settings from public,anon,authenticated;
grant select,insert,update on private.totus_tpv_barcode_settings to service_role;

create function public.totus_tpv_barcode_options(p_connection uuid,p_shop bigint,p_drawer uuid,p_settings jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();ctx jsonb;saved private.totus_tpv_barcode_settings;
begin
 if actor is null then raise exception 'TPV_AUTH_REQUIRED';end if;
 ctx:=public.totus_tpv_context();
 if ctx->>'actorId' is distinct from actor::text or not exists(
  select 1 from jsonb_array_elements(ctx->'workstations') w where w->>'connectionId'=p_connection::text
   and w->>'shopId'=p_shop::text and w->>'drawerId'=p_drawer::text and w->>'canReconcile'='true')
 then raise exception 'TPV_BARCODE_FORBIDDEN';end if;
 if p_settings is not null then
  if jsonb_typeof(p_settings) is distinct from 'object' or length(p_settings::text)>1000
   or p_settings-array['field','generatorEnabled']<>'{}'::jsonb
   or p_settings?'field' and (jsonb_typeof(p_settings->'field') is distinct from 'string' or p_settings->>'field' not in ('ean13','upc','reference'))
   or p_settings?'generatorEnabled' and jsonb_typeof(p_settings->'generatorEnabled') is distinct from 'boolean'
  then raise exception 'TPV_BARCODE_SETTINGS_INVALID';end if;
  if not private.totus_module_can((select email from public.profiles where id=actor and active),'productos','edit')
  then raise exception 'TPV_BARCODE_FORBIDDEN';end if;
  insert into private.totus_tpv_barcode_settings as stored(actor_id,connection_id,shop_id,drawer_id,field,generator_enabled)
   values(actor,p_connection,p_shop,p_drawer,coalesce(p_settings->>'field','ean13'),coalesce((p_settings->>'generatorEnabled')::boolean,false))
   on conflict(actor_id,connection_id,shop_id,drawer_id) do update
   set field=coalesce(p_settings->>'field',stored.field),
       generator_enabled=coalesce((p_settings->>'generatorEnabled')::boolean,stored.generator_enabled),updated_at=clock_timestamp()
   returning * into saved;
 else
  select * into saved from private.totus_tpv_barcode_settings where actor_id=actor and connection_id=p_connection and shop_id=p_shop and drawer_id=p_drawer;
 end if;
 return jsonb_build_object('field',coalesce(saved.field,'ean13'),'generatorEnabled',coalesce(saved.generator_enabled,false));
end $$;
revoke all on function public.totus_tpv_barcode_options(uuid,bigint,uuid,jsonb) from public,anon;
grant execute on function public.totus_tpv_barcode_options(uuid,bigint,uuid,jsonb) to authenticated;
commit;
