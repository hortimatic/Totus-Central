-- A recoverable workflow, not a product master. Product IDs, relationships and
-- stock remain native; the existing product create/stage journals own writes.
begin;
set local lock_timeout='5s';
create table private.totus_tpv_product_intakes(
 id uuid primary key,actor_id uuid not null references public.profiles(id),
 connection_id uuid not null references private.totus_api_connections(id),connection_revision bigint not null check(connection_revision>0),
 store_id uuid not null references public.ops_stores(id),drawer_id uuid not null references public.ops_cash_drawers(id),
 shop_id bigint not null check(shop_id>0),environment text not null check(environment='qa'),currency text not null check(currency='EUR'),
 manifest_hash text not null check(manifest_hash~'^[a-f0-9]{64}$'),payload jsonb not null check(jsonb_typeof(payload)='object'),
 base_payload jsonb not null check(jsonb_typeof(base_payload)='object'),base_fingerprint text not null check(base_fingerprint~'^[a-f0-9]{64}$'),
 steps jsonb not null check(jsonb_typeof(steps)='array'),current_step integer not null default 0 check(current_step>=0),
 status text not null default 'ready' check(status in ('ready','processing','attention','completed','cancelled')),
 lease_token uuid,lease_until timestamptz,version bigint not null default 1 check(version>0),error_code text,
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 check((lease_token is null)=(lease_until is null)),check((status='processing')=(lease_token is not null))
);
create index tpv_product_intakes_owner on private.totus_tpv_product_intakes(actor_id,connection_id,shop_id,drawer_id,created_at desc);
alter table private.totus_tpv_product_intakes enable row level security;
create policy tpv_product_intakes_server on private.totus_tpv_product_intakes to service_role using(true) with check(true);
revoke all on private.totus_tpv_product_intakes from public,anon,authenticated;
grant select,insert,update on private.totus_tpv_product_intakes to service_role;

create function private.totus_tpv_product_intake_json(p_row private.totus_tpv_product_intakes) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',p_row.id,'actorId',p_row.actor_id,'connectionId',p_row.connection_id,
  'connectionRevision',p_row.connection_revision,'storeId',p_row.store_id,'drawerId',p_row.drawer_id,'shopId',p_row.shop_id,
  'manifestHash',p_row.manifest_hash,'payload',p_row.payload,'basePayload',p_row.base_payload,'baseFingerprint',p_row.base_fingerprint,
  'steps',p_row.steps,'currentStep',p_row.current_step,'status',p_row.status,'version',p_row.version,'errorCode',p_row.error_code,
  'leaseToken',p_row.lease_token,'leaseUntil',p_row.lease_until,'createdAt',p_row.created_at,'updatedAt',p_row.updated_at)
$$;
revoke all on function private.totus_tpv_product_intake_json(private.totus_tpv_product_intakes) from public,anon,authenticated;
grant execute on function private.totus_tpv_product_intake_json(private.totus_tpv_product_intakes) to service_role;

create function public.totus_tpv_product_intake(p_action text,p_id uuid,p_scope jsonb,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r private.totus_tpv_product_intakes; actor public.profiles; result jsonb; prepared_steps jsonb; token uuid; step jsonb; writes boolean;
begin
 if p_action not in ('create','list','get','start','verified','failed','cancel') or jsonb_typeof(p_data) is distinct from 'object'
  or (p_action<>'list' and p_id is null) then raise exception 'TPV_PRODUCT_REQUEST_INVALID';end if;
 writes:=p_action not in ('list','get');
 perform private.totus_tpv_authorize(p_scope,case when writes then 'sell' else 'read' end);
 select * into actor from public.profiles where id=(p_scope->>'actorId')::uuid and active;
 if not found or not private.totus_module_can(actor.email,'productos',case when writes then 'create' else 'view' end)
 then raise exception 'TPV_PRODUCT_FORBIDDEN';end if;
 if p_action='list' then
  if p_data<>'{}'::jsonb then raise exception 'TPV_PRODUCT_REQUEST_INVALID';end if;
  select coalesce(jsonb_agg(t.entry order by t.active desc,t.created_at desc),'[]'::jsonb) into result from (
   select created_at,status not in ('completed','cancelled') active,jsonb_build_object('id',id,'name',payload->>'name','reference',payload->>'reference','status',status,
    'currentStep',current_step,'stepCount',jsonb_array_length(steps),'createdAt',created_at,'updatedAt',updated_at) entry
   from private.totus_tpv_product_intakes where actor_id=actor.id and connection_id=(p_scope->>'connectionId')::uuid
    and store_id=(p_scope->>'storeId')::uuid and drawer_id=(p_scope->>'drawerId')::uuid and shop_id=(p_scope->>'shopId')::bigint
    and environment='qa' order by (status not in ('completed','cancelled')) desc,created_at desc limit 100
  ) t;return result;
 end if;
 if p_action='create' then
  perform pg_advisory_xact_lock(hashtextextended('totus-tpv-product-owner:'||actor.id::text||':'||
   (p_scope->>'connectionId')||':'||(p_scope->>'shopId')||':'||(p_scope->>'drawerId'),0));
  if not exists(select 1 from private.totus_tpv_product_intakes where id=p_id) and
   (select count(*) from private.totus_tpv_product_intakes where actor_id=actor.id and connection_id=(p_scope->>'connectionId')::uuid
    and shop_id=(p_scope->>'shopId')::bigint and drawer_id=(p_scope->>'drawerId')::uuid and status not in ('completed','cancelled'))>=100
  then raise exception 'TPV_PRODUCT_ACTIVE_LIMIT';end if;
  if length(p_data::text)>6500000 or p_data-array['manifestHash','payload','basePayload','baseFingerprint','plan']<>'{}'::jsonb
   or coalesce(p_data->>'manifestHash','') !~ '^[a-f0-9]{64}$' or coalesce(p_data->>'baseFingerprint','') !~ '^[a-f0-9]{64}$'
   or jsonb_typeof(p_data->'payload') is distinct from 'object' or jsonb_typeof(p_data->'basePayload') is distinct from 'object'
   or jsonb_typeof(p_data->'plan') is distinct from 'array' then raise exception 'TPV_PRODUCT_REQUEST_INVALID';end if;
  if jsonb_array_length(p_data->'plan') not between 2 and 410
   or p_data->'plan'->0->>'kind' is distinct from 'base' or p_data->'plan'->(-1)->>'kind' is distinct from 'finish'
   or (select count(*) from jsonb_array_elements(p_data->'plan') e where e->>'kind' in ('base','finish'))<>2
   or exists(select 1 from jsonb_array_elements(p_data->'plan') e where
    jsonb_typeof(e) is distinct from 'object' or e-array['key','kind','label','index']<>'{}'::jsonb
    or coalesce(e->>'key','') !~ '^[a-z0-9][a-z0-9_-]{0,63}$'
    or coalesce(e->>'kind','') not in ('base','image','variation','stock','supplier_price','finish')
    or jsonb_typeof(e->'label') is distinct from 'string' or length(e->>'label') not between 1 and 120)
   or exists(select 1 from jsonb_array_elements(p_data->'plan') e group by e->>'key' having count(*)>1)
  then raise exception 'TPV_PRODUCT_REQUEST_INVALID';end if;
  select jsonb_agg(e.value||jsonb_build_object('status','pending') order by e.ordinality) into prepared_steps
   from jsonb_array_elements(p_data->'plan') with ordinality e(value,ordinality);
  insert into private.totus_tpv_product_intakes(id,actor_id,connection_id,connection_revision,store_id,drawer_id,shop_id,environment,currency,
   manifest_hash,payload,base_payload,base_fingerprint,steps)
   values(p_id,actor.id,(p_scope->>'connectionId')::uuid,(p_scope->>'connectionRevision')::bigint,(p_scope->>'storeId')::uuid,
    (p_scope->>'drawerId')::uuid,(p_scope->>'shopId')::bigint,p_scope->>'environment',p_scope->>'currency',p_data->>'manifestHash',
    p_data->'payload',p_data->'basePayload',p_data->>'baseFingerprint',prepared_steps)
   on conflict(id) do nothing;
 end if;
 select * into r from private.totus_tpv_product_intakes where id=p_id for update;
 if not found or r.actor_id<>actor.id or r.connection_id<>(p_scope->>'connectionId')::uuid or r.store_id<>(p_scope->>'storeId')::uuid
  or r.drawer_id<>(p_scope->>'drawerId')::uuid or r.shop_id<>(p_scope->>'shopId')::bigint
  or r.environment is distinct from p_scope->>'environment' or r.currency is distinct from p_scope->>'currency'
 then raise exception 'TPV_PRODUCT_NOT_FOUND';end if;
 if writes and r.connection_revision<>(p_scope->>'connectionRevision')::bigint then raise exception 'TPV_CONTEXT_STALE';end if;
 if p_action='create' then
  if r.manifest_hash is distinct from p_data->>'manifestHash' or r.payload is distinct from p_data->'payload'
   or r.base_payload is distinct from p_data->'basePayload' or r.base_fingerprint is distinct from p_data->>'baseFingerprint'
   or (select jsonb_agg(e.value-array['status','recordId'] order by e.ordinality) from jsonb_array_elements(r.steps) with ordinality e(value,ordinality)) is distinct from p_data->'plan'
  then raise exception 'TPV_PRODUCT_REQUEST_ALREADY_BOUND';end if;
  return private.totus_tpv_product_intake_json(r);
 end if;
 if p_action='get' then
  if p_data<>'{}'::jsonb then raise exception 'TPV_PRODUCT_REQUEST_INVALID';end if;
  return private.totus_tpv_product_intake_json(r);
 end if;
 if p_action='cancel' then
  if p_data='{}'::jsonb and r.status='cancelled' then return private.totus_tpv_product_intake_json(r);end if;
  if p_data<>'{}'::jsonb or r.status not in ('ready','attention') or r.current_step<>0 or r.lease_token is not null
  then raise exception 'TPV_PRODUCT_RECONCILIATION_REQUIRED';end if;
  update private.totus_tpv_product_intakes set status='cancelled',version=version+1,updated_at=clock_timestamp() where id=r.id returning * into r;
  return private.totus_tpv_product_intake_json(r);
 end if;
 if p_action='start' then
  if p_data-array['token']<>'{}'::jsonb or coalesce(p_data->>'token','') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  then raise exception 'TPV_PRODUCT_REQUEST_INVALID';end if;
  if r.status in ('completed','cancelled') then return private.totus_tpv_product_intake_json(r);end if;
  if r.status='processing' and r.lease_until>clock_timestamp() then return private.totus_tpv_product_intake_json(r)||jsonb_build_object('busy',true);end if;
  update private.totus_tpv_product_intakes set status='processing',lease_token=(p_data->>'token')::uuid,
   lease_until=clock_timestamp()+interval '5 minutes',error_code=null,version=version+1,updated_at=clock_timestamp() where id=r.id returning * into r;
  return private.totus_tpv_product_intake_json(r);
 end if;
 if p_data-array['token','stepKey','recordId','code']<>'{}'::jsonb or coalesce(p_data->>'token','') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 then raise exception 'TPV_PRODUCT_REQUEST_INVALID';end if;
 token:=(p_data->>'token')::uuid;
 if r.status<>'processing' or r.lease_token is distinct from token then
  return private.totus_tpv_product_intake_json(r)||jsonb_build_object('superseded',true);
 end if;
 step:=r.steps->r.current_step;
 if p_data->>'stepKey' is distinct from step->>'key' then raise exception 'TPV_PRODUCT_STEP_CHANGED';end if;
 if p_action='verified' then
  if coalesce(p_data->>'recordId','') !~ '^[1-9][0-9]{0,14}$' or p_data?'code' then raise exception 'TPV_PRODUCT_RESULT_INVALID';end if;
  update private.totus_tpv_product_intakes set steps=jsonb_set(steps,array[current_step::text],
    step||jsonb_build_object('status','verified','recordId',p_data->>'recordId')),
   current_step=current_step+1,status=case when current_step+1=jsonb_array_length(steps) then 'completed' else 'ready' end,
   lease_token=null,lease_until=null,error_code=null,version=version+1,updated_at=clock_timestamp() where id=r.id returning * into r;
 else
  if p_action<>'failed' or coalesce(p_data->>'code','') not in ('TPV_PRODUCT_STEP_UNCERTAIN','TPV_PRODUCT_VALIDATION_CHANGED') or p_data?'recordId'
  then raise exception 'TPV_PRODUCT_RESULT_INVALID';end if;
  update private.totus_tpv_product_intakes set status='attention',error_code=p_data->>'code',lease_token=null,lease_until=null,
   version=version+1,updated_at=clock_timestamp() where id=r.id returning * into r;
 end if;
 return private.totus_tpv_product_intake_json(r);
end $$;
revoke all on function public.totus_tpv_product_intake(text,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.totus_tpv_product_intake(text,uuid,jsonb,jsonb) to service_role;
commit;
