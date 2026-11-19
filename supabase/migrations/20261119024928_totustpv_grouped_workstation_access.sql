-- Existing-access batches reuse individual authorization and audit atomically.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create table private.totus_tpv_access_batches(
 id uuid primary key,manager_id uuid not null references public.profiles(id),connection_id uuid not null references private.totus_api_connections(id),
 connection_revision bigint not null,request_data jsonb not null,reply jsonb not null,recorded_at timestamptz not null default clock_timestamp());
alter table private.totus_tpv_access_batches enable row level security;
create policy tpv_access_batches_service on private.totus_tpv_access_batches for select to service_role using(true);
create policy tpv_access_batches_insert on private.totus_tpv_access_batches for insert to service_role with check(true);
revoke all on private.totus_tpv_access_batches from public,anon,authenticated;
grant select,insert on private.totus_tpv_access_batches to service_role;
create function public.totus_tpv_workstation_access_batch(p_actor uuid,p_connection uuid,p_revision bigint,p_request_id uuid,p_data jsonb default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare saved private.totus_tpv_access_batches;target jsonb;assignment private.totus_tpv_assignments;item jsonb;items jsonb:='[]';result jsonb;child uuid;
begin
 perform private.totus_tpv_access_manager(p_actor,p_connection,p_revision);
 if p_request_id is null then raise exception 'TPV_ACCESS_BATCH_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended('totus-tpv-access-batch:'||p_request_id::text,0));
 select * into saved from private.totus_tpv_access_batches where id=p_request_id;
 if found and (saved.manager_id<>p_actor or saved.connection_id<>p_connection) then raise exception 'TPV_ACCESS_REQUEST_ALREADY_BOUND';end if;
 if p_data is null then return saved.reply;end if;
 if saved.id is not null then
  if saved.request_data is distinct from p_data or saved.connection_revision<>p_revision then raise exception 'TPV_ACCESS_REQUEST_ALREADY_BOUND';end if;
  return saved.reply;
 end if;
 if jsonb_typeof(p_data) is distinct from 'object' or p_data-array['group','targets','permissions','active']<>'{}'::jsonb
  or jsonb_typeof(p_data->'group') is distinct from 'object' or (p_data->'group')-array['kind','id']<>'{}'::jsonb
  or coalesce(p_data#>>'{group,kind}','') not in ('store','operator')
  or coalesce(p_data#>>'{group,id}','')!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  or jsonb_typeof(p_data->'targets') is distinct from 'array' or jsonb_array_length(p_data->'targets') not between 1 and 100
  or jsonb_typeof(p_data->'permissions') is distinct from 'object' or (p_data->'permissions')-array['sell','open','reconcile']<>'{}'::jsonb
  or not((p_data->'permissions')?&array['sell','open','reconcile']) or exists(select 1 from jsonb_each(p_data->'permissions') e where jsonb_typeof(e.value) is distinct from 'boolean')
  or jsonb_typeof(p_data->'active') is distinct from 'boolean' or p_data->'active'='true'::jsonb and p_data#>'{permissions,reconcile}' is distinct from 'true'::jsonb
 then raise exception 'TPV_ACCESS_BATCH_INVALID';end if;
 for target in select value from jsonb_array_elements(p_data->'targets') loop
  if jsonb_typeof(target) is distinct from 'object' or target-array['operatorId','drawerId','shopId','assignmentRevision']<>'{}'::jsonb
   or coalesce(target->>'operatorId','')!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
   or coalesce(target->>'drawerId','')!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
   or jsonb_typeof(target->'shopId') is distinct from 'number' or coalesce(target->>'shopId','')!~'^[1-9][0-9]{0,9}$'
   or jsonb_typeof(target->'assignmentRevision') is distinct from 'number' or coalesce(target->>'assignmentRevision','')!~'^[1-9][0-9]{0,14}$'
  then raise exception 'TPV_ACCESS_BATCH_INVALID';end if;
 end loop;
 if (select count(distinct (value->>'operatorId',value->>'drawerId',value->>'shopId')) from jsonb_array_elements(p_data->'targets'))<>jsonb_array_length(p_data->'targets') then raise exception 'TPV_ACCESS_BATCH_INVALID';end if;
 for target in select value from jsonb_array_elements(p_data->'targets') order by value->>'drawerId',value->>'operatorId',value->>'shopId' loop
  select * into assignment from private.totus_tpv_assignments where actor_id=(target->>'operatorId')::uuid and connection_id=p_connection
   and shop_id=(target->>'shopId')::bigint and drawer_id=(target->>'drawerId')::uuid and environment='qa' for update;
  if not found then raise exception 'TPV_ACCESS_ASSIGNMENT_NOT_FOUND';end if;
  if p_data#>>'{group,kind}'='store' and assignment.store_id<>(p_data#>>'{group,id}')::uuid
   or p_data#>>'{group,kind}'='operator' and assignment.actor_id<>(p_data#>>'{group,id}')::uuid then raise exception 'TPV_ACCESS_BATCH_GROUP_MISMATCH';end if;
  if assignment.access_revision<>(target->>'assignmentRevision')::bigint then raise exception 'TPV_ACCESS_CHANGED';end if;
  child:=md5('totus-tpv-access-batch:'||p_request_id::text||':'||assignment.actor_id::text||':'||assignment.drawer_id::text||':'||assignment.shop_id::text)::uuid;
  item:=public.totus_tpv_update_workstation_access(p_actor,p_connection,p_revision,child,jsonb_build_object('operatorId',assignment.actor_id,'drawerId',assignment.drawer_id,'shopId',assignment.shop_id,
   'expectedRevision',assignment.access_revision,'permissions',p_data->'permissions','active',p_data->'active'));
  items:=items||jsonb_build_array(item);
 end loop;
 result:=jsonb_build_object('id',p_request_id,'connectionId',p_connection,'confirmed',true,'group',p_data->'group','items',items);
 insert into private.totus_tpv_access_batches(id,manager_id,connection_id,connection_revision,request_data,reply) values(p_request_id,p_actor,p_connection,p_revision,p_data,result);
 return result;
end $$;
revoke all on function public.totus_tpv_workstation_access_batch(uuid,uuid,bigint,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.totus_tpv_workstation_access_batch(uuid,uuid,bigint,uuid,jsonb) to service_role;
commit;
