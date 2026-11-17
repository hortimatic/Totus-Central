-- Prepared helper operations, not a second category catalogue. The existing
-- directory journal owns the native write; this table retains its review.
begin;
set local lock_timeout='5s';
do $patch$ declare definition text; needle constant text:='resource_name not in (''customers'',''addresses'',''suppliers'',''manufacturers'',''product_options'',''product_option_values'',''product_features'',''product_feature_values'')';
begin
 definition:=pg_get_functiondef('public.totus_directory_operation(text,uuid,jsonb)'::regprocedure);
 if strpos(definition,needle)=0 then raise exception 'Unexpected directory journal resource guard';end if;
 execute replace(definition,needle,'resource_name not in (''customers'',''addresses'',''suppliers'',''manufacturers'',''product_options'',''product_option_values'',''product_features'',''product_feature_values'',''categories'')');
end $patch$;

create table private.totus_tpv_catalogue_intakes(
 id uuid primary key,actor_id uuid not null references public.profiles(id),
 connection_id uuid not null references private.totus_api_connections(id),connection_revision bigint not null check(connection_revision>0),
 store_id uuid not null references public.ops_stores(id),drawer_id uuid not null references public.ops_cash_drawers(id),shop_id bigint not null check(shop_id>0),
 environment text not null check(environment='qa'),currency text not null check(currency='EUR'),kind text not null check(kind='category'),
 payload jsonb not null check(jsonb_typeof(payload)='object'),payload_hash text not null check(payload_hash~'^[a-f0-9]{64}$'),
 fingerprint text not null check(fingerprint~'^[a-f0-9]{64}$'),status text not null default 'ready' check(status in ('ready','processing','attention','completed','cancelled')),
 record_id bigint check(record_id>0),lease_token uuid,lease_until timestamptz,error_code text,version bigint not null default 1 check(version>0),
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 check((lease_token is null)=(lease_until is null)),check((status='processing')=(lease_token is not null)),check((status='completed')=(record_id is not null))
);
create index tpv_catalogue_intakes_owner on private.totus_tpv_catalogue_intakes(actor_id,connection_id,shop_id,drawer_id,created_at desc);
alter table private.totus_tpv_catalogue_intakes enable row level security;
create policy tpv_catalogue_intakes_server on private.totus_tpv_catalogue_intakes to service_role using(true) with check(true);
revoke all on private.totus_tpv_catalogue_intakes from public,anon,authenticated;
grant select,insert,update on private.totus_tpv_catalogue_intakes to service_role;

create function private.totus_tpv_catalogue_intake_json(p_row private.totus_tpv_catalogue_intakes) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',p_row.id,'kind',p_row.kind,'payload',p_row.payload,'payloadHash',p_row.payload_hash,
  'fingerprint',p_row.fingerprint,'status',p_row.status,'recordId',p_row.record_id::text,'version',p_row.version,
  'leaseToken',p_row.lease_token,'leaseUntil',p_row.lease_until,'errorCode',p_row.error_code,'createdAt',p_row.created_at,'updatedAt',p_row.updated_at)
$$;
revoke all on function private.totus_tpv_catalogue_intake_json(private.totus_tpv_catalogue_intakes) from public,anon,authenticated;
grant execute on function private.totus_tpv_catalogue_intake_json(private.totus_tpv_catalogue_intakes) to service_role;

create function public.totus_tpv_catalogue_intake(p_action text,p_id uuid,p_scope jsonb,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r private.totus_tpv_catalogue_intakes; actor public.profiles; result jsonb; writes boolean;
begin
 if p_action is null or p_action not in ('create','list','get','start','verified','failed','cancel') or jsonb_typeof(p_data) is distinct from 'object'
  or (p_action<>'list' and p_id is null) then raise exception 'TPV_CATALOGUE_INTENT_INVALID';end if;
 writes:=p_action not in ('list','get');
 perform private.totus_tpv_authorize(p_scope,case when writes then 'sell' else 'read' end);
 select * into actor from public.profiles where id=(p_scope->>'actorId')::uuid and active;
 if not found or not private.totus_module_can(actor.email,'productos','view')
  or writes and not private.totus_module_can(actor.email,'productos','create') then raise exception 'TPV_PRODUCT_FORBIDDEN';end if;
 if p_action='list' then
  if p_data<>'{}'::jsonb then raise exception 'TPV_CATALOGUE_INTENT_INVALID';end if;
  select coalesce(jsonb_agg(t.entry order by t.active desc,t.created_at desc),'[]'::jsonb) into result from (
   select created_at,status not in ('completed','cancelled') active,jsonb_build_object('id',id,'kind',kind,'name',payload->>'name','parentId',payload->>'parentId',
    'status',status,'recordId',record_id::text,'updatedAt',updated_at) entry
   from private.totus_tpv_catalogue_intakes where actor_id=actor.id and connection_id=(p_scope->>'connectionId')::uuid
    and store_id=(p_scope->>'storeId')::uuid and drawer_id=(p_scope->>'drawerId')::uuid and shop_id=(p_scope->>'shopId')::bigint and environment='qa'
   order by (status not in ('completed','cancelled')) desc,created_at desc limit 100
  ) t;return result;
 end if;
 if p_action='create' then
  perform pg_advisory_xact_lock(hashtextextended('totus-tpv-catalogue-owner:'||actor.id::text||':'||(p_scope->>'connectionId')||':'||(p_scope->>'shopId')||':'||(p_scope->>'drawerId'),0));
  if not exists(select 1 from private.totus_tpv_catalogue_intakes where id=p_id) and
   (select count(*) from private.totus_tpv_catalogue_intakes where actor_id=actor.id and connection_id=(p_scope->>'connectionId')::uuid
    and shop_id=(p_scope->>'shopId')::bigint and drawer_id=(p_scope->>'drawerId')::uuid and status not in ('completed','cancelled'))>=100
  then raise exception 'TPV_CATALOGUE_INTENT_LIMIT';end if;
  if p_data-array['kind','payload','payloadHash','fingerprint']<>'{}'::jsonb or p_data->>'kind' is distinct from 'category'
   or length(p_data::text)>10000 or coalesce(p_data->>'payloadHash','') !~ '^[a-f0-9]{64}$' or coalesce(p_data->>'fingerprint','') !~ '^[a-f0-9]{64}$'
   or jsonb_typeof(p_data->'payload') is distinct from 'object' then raise exception 'TPV_CATALOGUE_INTENT_INVALID';end if;
  if (p_data->'payload')-array['name','parentId']<>'{}'::jsonb or jsonb_typeof(p_data->'payload'->'name') is distinct from 'string'
   or length(btrim(p_data->'payload'->>'name')) not between 1 and 128 or p_data->'payload'->>'name' ~ '[[:cntrl:]<>{}=]'
   or jsonb_typeof(p_data->'payload'->'parentId') is distinct from 'string' or coalesce(p_data->'payload'->>'parentId','') !~ '^[1-9][0-9]{0,14}$'
  then raise exception 'TPV_CATALOGUE_INTENT_INVALID';end if;
  insert into private.totus_tpv_catalogue_intakes(id,actor_id,connection_id,connection_revision,store_id,drawer_id,shop_id,environment,currency,kind,payload,payload_hash,fingerprint)
   values(p_id,actor.id,(p_scope->>'connectionId')::uuid,(p_scope->>'connectionRevision')::bigint,(p_scope->>'storeId')::uuid,
    (p_scope->>'drawerId')::uuid,(p_scope->>'shopId')::bigint,p_scope->>'environment',p_scope->>'currency','category',p_data->'payload',p_data->>'payloadHash',p_data->>'fingerprint')
   on conflict(id) do nothing;
 end if;
 select * into r from private.totus_tpv_catalogue_intakes where id=p_id for update;
 if not found or r.actor_id<>actor.id or r.connection_id<>(p_scope->>'connectionId')::uuid or r.store_id<>(p_scope->>'storeId')::uuid
  or r.drawer_id<>(p_scope->>'drawerId')::uuid or r.shop_id<>(p_scope->>'shopId')::bigint
  or r.environment is distinct from p_scope->>'environment' or r.currency is distinct from p_scope->>'currency' then raise exception 'TPV_CATALOGUE_INTENT_NOT_FOUND';end if;
 if writes and r.connection_revision<>(p_scope->>'connectionRevision')::bigint then raise exception 'TPV_CONTEXT_STALE';end if;
 if p_action='create' then
  if r.payload_hash is distinct from p_data->>'payloadHash' or r.payload is distinct from p_data->'payload' or r.fingerprint is distinct from p_data->>'fingerprint'
  then raise exception 'TPV_CATALOGUE_INTENT_BOUND';end if;return private.totus_tpv_catalogue_intake_json(r);
 end if;
 if p_action='get' then
  if p_data<>'{}'::jsonb then raise exception 'TPV_CATALOGUE_INTENT_INVALID';end if;return private.totus_tpv_catalogue_intake_json(r);
 end if;
 if p_action='cancel' then
  if p_data='{}'::jsonb and r.status='cancelled' then return private.totus_tpv_catalogue_intake_json(r);end if;
  if p_data<>'{}'::jsonb or r.status not in ('ready','attention') or r.lease_token is not null
   or exists(select 1 from private.totus_directory_operations where request_id=r.id)
   then raise exception 'TPV_CATALOGUE_INTENT_REVIEW_REQUIRED';end if;
  update private.totus_tpv_catalogue_intakes set status='cancelled',version=version+1,updated_at=clock_timestamp() where id=r.id returning * into r;
  return private.totus_tpv_catalogue_intake_json(r);
 end if;
 if p_action='start' then
  if p_data-array['token']<>'{}'::jsonb or coalesce(p_data->>'token','') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  then raise exception 'TPV_CATALOGUE_INTENT_INVALID';end if;
  if r.status in ('completed','cancelled') then return private.totus_tpv_catalogue_intake_json(r);end if;
  if r.status='processing' and r.lease_until>clock_timestamp() then return private.totus_tpv_catalogue_intake_json(r)||jsonb_build_object('busy',true);end if;
  update private.totus_tpv_catalogue_intakes set status='processing',lease_token=(p_data->>'token')::uuid,lease_until=clock_timestamp()+interval '5 minutes',
   error_code=null,version=version+1,updated_at=clock_timestamp() where id=r.id returning * into r;
  return private.totus_tpv_catalogue_intake_json(r);
 end if;
 if p_data-array['token','recordId','code']<>'{}'::jsonb or coalesce(p_data->>'token','') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 then raise exception 'TPV_CATALOGUE_INTENT_INVALID';end if;
 if r.status<>'processing' or r.lease_token is distinct from (p_data->>'token')::uuid then return private.totus_tpv_catalogue_intake_json(r)||jsonb_build_object('superseded',true);end if;
 if p_action='verified' then
  if coalesce(p_data->>'recordId','') !~ '^[1-9][0-9]{0,14}$' or p_data?'code' then raise exception 'TPV_CATALOGUE_INTENT_RESULT_INVALID';end if;
  update private.totus_tpv_catalogue_intakes set status='completed',record_id=(p_data->>'recordId')::bigint,lease_token=null,lease_until=null,error_code=null,
   version=version+1,updated_at=clock_timestamp() where id=r.id returning * into r;
 else
  if p_action<>'failed' or coalesce(p_data->>'code','') not in ('TPV_CATALOGUE_INTENT_UNCERTAIN','TPV_CATALOGUE_INTENT_CHANGED') or p_data?'recordId'
  then raise exception 'TPV_CATALOGUE_INTENT_RESULT_INVALID';end if;
  update private.totus_tpv_catalogue_intakes set status='attention',lease_token=null,lease_until=null,error_code=p_data->>'code',
   version=version+1,updated_at=clock_timestamp() where id=r.id returning * into r;
 end if;
 return private.totus_tpv_catalogue_intake_json(r);
end $$;
revoke all on function public.totus_tpv_catalogue_intake(text,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.totus_tpv_catalogue_intake(text,uuid,jsonb,jsonb) to service_role;
commit;
