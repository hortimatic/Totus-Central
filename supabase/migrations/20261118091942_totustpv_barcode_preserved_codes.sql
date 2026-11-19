begin;
set local lock_timeout='5s';set local statement_timeout='60s';
-- A preserved external identifier is a resolved failed intention, never a
-- fabricated verified native update. Keep its operation/payload immutable.
-- Fifteen write-plan targets fit the 64 KiB wire envelope even at the native
-- metadata limits with JSON-escaped characters. Capture/review pages stay50
-- and total catalogue membership has no functional limit.
create table private.totus_tpv_barcode_resolutions(
 operation_id uuid primary key references private.totus_tpv_native_commands(id),
 job_id uuid not null,ordinal bigint not null,kind text not null default 'already-set' check(kind='already-set'),
 code text not null check(length(code) between 1 and 64),proof jsonb not null check(jsonb_typeof(proof)='object'),
 created_at timestamptz not null default clock_timestamp(),unique(job_id,ordinal),
 foreign key(job_id,ordinal) references private.totus_tpv_barcode_lines(job_id,ordinal),
 foreign key(operation_id) references private.totus_tpv_barcode_lines(operation_id)
);
alter table private.totus_tpv_barcode_resolutions enable row level security;
create policy tpv_barcode_resolutions_server on private.totus_tpv_barcode_resolutions to service_role using(true) with check(true);
revoke all on private.totus_tpv_barcode_resolutions from public,anon,authenticated;
grant select,insert on private.totus_tpv_barcode_resolutions to service_role;
create or replace function private.totus_tpv_barcode_job_json(j private.totus_tpv_barcode_jobs,p_after bigint default 0,p_size integer default 50) returns jsonb
language sql volatile security invoker set search_path='' as $$
 with page as(select t.*,coalesce(l.skip_reason,z.kind) skip_reason,coalesce(l.existing_code,z.code) existing_code,case when z.operation_id is null then c.status else null end command_status,c.result from private.totus_tpv_barcode_targets t
  left join private.totus_tpv_barcode_lines l on l.job_id=t.job_id and l.ordinal=t.ordinal
  left join private.totus_tpv_native_commands c on c.id=l.operation_id left join private.totus_tpv_barcode_resolutions z on z.operation_id=l.operation_id
  where t.job_id=j.id and t.ordinal>p_after order by t.ordinal limit p_size),
 summary as(select coalesce(jsonb_agg(jsonb_build_object('ordinal',ordinal,'productId',product_id,'attributeId',attribute_id,'name',name,'variantName',variant_name,'reference',reference,
  'status',case when skip_reason is not null then skip_reason when command_status='verified' then 'generated' else coalesce(command_status,'pending') end,
  'code',case when command_status='verified' then result->'items'->0->>'code' else existing_code end) order by ordinal),'[]'::jsonb) items,coalesce(max(ordinal),p_after) next_after from page),
 counts as(select count(*) total,count(*) filter(where l.skip_reason='already-set' or z.kind='already-set') kept,count(*) filter(where l.skip_reason='unavailable') unavailable,count(*) filter(where c.status='verified' and z.operation_id is null) generated,
  count(*) filter(where c.id is not null and c.status<>'verified' and z.operation_id is null) uncertain
  from private.totus_tpv_barcode_targets t left join private.totus_tpv_barcode_lines l on l.job_id=t.job_id and l.ordinal=t.ordinal left join private.totus_tpv_native_commands c on c.id=l.operation_id left join private.totus_tpv_barcode_resolutions z on z.operation_id=l.operation_id where t.job_id=j.id)
 select jsonb_build_object('id',j.id,'scope',j.scope,'field',j.field,'status',j.status,'version',j.version,
  'cursor',j.capture_cursor,'bounds',j.capture_bounds,'captureComplete',j.capture_complete,'confirmedAt',j.confirmed_at,
  'createdAt',j.created_at,'updatedAt',j.updated_at,'capturedCount',c.total,'generatedCount',c.generated,'keptCount',c.kept,'unavailableCount',c.unavailable,'uncertainCount',c.uncertain,'pendingCount',c.total-c.generated-c.kept-c.unavailable,
  'items',s.items,'nextAfter',s.next_after,'hasMore',exists(select 1 from private.totus_tpv_barcode_targets where job_id=j.id and ordinal>s.next_after)) from summary s cross join counts c;
$$;
create or replace function public.totus_tpv_barcode_execution(p_action text,p_id uuid,p_scope jsonb,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare j private.totus_tpv_barcode_jobs;t private.totus_tpv_barcode_targets;l private.totus_tpv_barcode_lines;
 planned jsonb;entry jsonb;selected jsonb;after_number bigint;last_number bigint;entry_index integer;pending_count bigint;line private.totus_tpv_barcode_lines;command private.totus_tpv_native_commands;preserved_proof jsonb;expected jsonb;
begin
 p_scope:=p_scope-'sessionId';
 if p_action is null or p_action not in ('next','plan','preserve') or p_id is null or jsonb_typeof(p_data) is distinct from 'object' or length(p_data::text)>65536 then raise exception 'TPV_BARCODE_REQUEST_INVALID';end if;
 perform public.totus_tpv_barcode_jobs('get',p_id,p_scope);
 select * into j from private.totus_tpv_barcode_jobs where id=p_id for update;
 if j.scope is distinct from p_scope then raise exception 'TPV_BARCODE_CONTEXT_STALE';end if;
 if p_action='preserve' then
  if p_data-array['operationId','proof']<>'{}'::jsonb or jsonb_typeof(p_data->'operationId') is distinct from 'string' or jsonb_typeof(p_data->'proof') is distinct from 'object' then raise exception 'TPV_BARCODE_PRESERVATION_INVALID';end if;
  select * into line from private.totus_tpv_barcode_lines where job_id=j.id and operation_id=(p_data->>'operationId')::uuid;
  if not found then raise exception 'TPV_BARCODE_PRESERVATION_INVALID';end if;
  select * into command from private.totus_tpv_native_commands where id=line.operation_id for update;
  if not found or command.command<>'barcodes.assign' or command.scope is distinct from j.scope or command.payload is distinct from line.payload or command.status<>'uncertain' then raise exception 'TPV_BARCODE_PRESERVATION_INVALID';end if;
  preserved_proof:=p_data->'proof';entry:=line.payload->'items'->((line.payload->>'item_index')::integer);
  if jsonb_typeof(preserved_proof->'code') is distinct from 'string' or length(preserved_proof->>'code') not between 1 and 64 then raise exception 'TPV_BARCODE_PRESERVATION_INVALID';end if;
  expected:=jsonb_build_object('plan_version',1,'shop_id',j.shop_id,'field',j.field,'product_id',entry->'product_id','attribute_id',entry->'attribute_id','code',preserved_proof->>'code','plan_fingerprint',line.payload->'plan_fingerprint','item_index',line.payload->'item_index');
  if preserved_proof is distinct from expected then raise exception 'TPV_BARCODE_PRESERVATION_INVALID';end if;
  if exists(select 1 from private.totus_tpv_barcode_resolutions z where z.operation_id=line.operation_id and z.proof is distinct from preserved_proof) then raise exception 'TPV_BARCODE_PRESERVATION_CHANGED';end if;
  insert into private.totus_tpv_barcode_resolutions(operation_id,job_id,ordinal,code,proof) values(line.operation_id,j.id,line.ordinal,preserved_proof->>'code',preserved_proof) on conflict(operation_id) do nothing;
 elsif p_action='plan' then
  perform private.totus_tpv_barcode_authorize(p_scope,true);
  if j.status<>'processing' then raise exception 'TPV_BARCODE_STATE_INVALID';end if;
  if not exists(select 1 from private.totus_tpv_barcode_settings s where s.actor_id=j.actor_id and s.connection_id=j.connection_id and s.shop_id=j.shop_id and s.drawer_id=j.drawer_id and s.generator_enabled and s.field=j.field) then raise exception 'TPV_BARCODE_SETTINGS_CHANGED';end if;
  if p_data-array['afterOrdinal','plan']<>'{}'::jsonb or jsonb_typeof(p_data->'afterOrdinal') is distinct from 'number' or coalesce(p_data->>'afterOrdinal','') !~ '^(0|[1-9][0-9]{0,9})$' or jsonb_typeof(p_data->'plan') is distinct from 'object' then raise exception 'TPV_BARCODE_PLAN_INVALID';end if;
  after_number:=(p_data->>'afterOrdinal')::bigint;planned:=p_data->'plan';
  if exists(select 1 from private.totus_tpv_barcode_blocks b where b.job_id=j.id and b.after_ordinal=after_number) then
   if not exists(select 1 from private.totus_tpv_barcode_blocks b where b.job_id=j.id and b.after_ordinal=after_number and b.plan=planned) then raise exception 'TPV_BARCODE_PLAN_CHANGED';end if;
  else
   select coalesce(max(ordinal),0) into last_number from private.totus_tpv_barcode_lines where job_id=j.id;
   if last_number<>after_number or exists(select 1 from private.totus_tpv_barcode_lines a left join private.totus_tpv_native_commands c on c.id=a.operation_id where a.job_id=j.id and a.operation_id is not null and c.status is distinct from 'verified' and not exists(select 1 from private.totus_tpv_barcode_resolutions z where z.operation_id=a.operation_id)) then raise exception 'TPV_BARCODE_PLAN_STALE';end if;
   if planned-array['source','plan_version','capability','field','scheme','shop_id','items','skipped_targets','has_more','skipped_shared','plan_fingerprint']<>'{}'::jsonb or
    planned->>'source' is distinct from 'native-missing-barcodes-plan' or planned->'plan_version' is distinct from '1'::jsonb or planned->'capability' is distinct from '{"can_execute":true,"reason":"ready"}'::jsonb or planned->>'field' is distinct from j.field or planned->>'scheme' is distinct from (case j.field when 'ean13' then 'rcn13-04' when 'upc' then 'rcn12-4' else 'totus-reference' end) or planned->'shop_id' is distinct from to_jsonb(j.shop_id) or jsonb_typeof(planned->'items') is distinct from 'array' or jsonb_typeof(planned->'skipped_targets') is distinct from 'array' or coalesce(planned->>'plan_fingerprint','') !~ '^[a-f0-9]{64}$' then raise exception 'TPV_BARCODE_PLAN_INVALID';end if;
   select jsonb_agg(jsonb_build_object('product_id',product_id,'attribute_id',attribute_id) order by ordinal) into selected from
    (select * from private.totus_tpv_barcode_targets where job_id=j.id and ordinal>after_number order by ordinal limit 15) x;
   if selected is null or jsonb_array_length(planned->'items')+jsonb_array_length(planned->'skipped_targets')<>jsonb_array_length(selected) then raise exception 'TPV_BARCODE_PLAN_INVALID';end if;
   -- Both arrays together must cover exactly the next captured block, once.
   if exists(select 1 from jsonb_array_elements((planned->'items')||(planned->'skipped_targets')) x group by x->'product_id',x->'attribute_id' having count(*)<>1) or
    exists(select 1 from jsonb_array_elements((planned->'items')||(planned->'skipped_targets')) x where not selected @> jsonb_build_array(jsonb_build_object('product_id',x->'product_id','attribute_id',x->'attribute_id'))) then raise exception 'TPV_BARCODE_PLAN_INVALID';end if;
   insert into private.totus_tpv_barcode_blocks(job_id,after_ordinal,plan) values(j.id,after_number,planned);
   entry_index:=0;
   for entry in select value from jsonb_array_elements(planned->'items') loop
    if entry-array['product_id','attribute_id','name','variant_name','reference','code','snapshot_fingerprint']<>'{}'::jsonb or jsonb_typeof(entry->'code') is distinct from 'string' or length(entry->>'code') not between 1 and 64 or coalesce(entry->>'snapshot_fingerprint','') !~ '^[a-f0-9]{64}$' then raise exception 'TPV_BARCODE_PLAN_INVALID';end if;
    select * into strict t from private.totus_tpv_barcode_targets where job_id=j.id and product_id=(entry->>'product_id')::bigint and attribute_id=(entry->>'attribute_id')::bigint;
    insert into private.totus_tpv_barcode_lines(job_id,ordinal,operation_id,payload) values(j.id,t.ordinal,gen_random_uuid(),jsonb_build_object('plan_version',1,'field',j.field,'items',planned->'items','plan_fingerprint',planned->'plan_fingerprint','item_index',entry_index));
    entry_index:=entry_index+1;
   end loop;
   for entry in select value from jsonb_array_elements(planned->'skipped_targets') loop
    if entry-array['product_id','attribute_id','reason','code']<>'{}'::jsonb or coalesce(entry->>'reason','') not in ('already-set','unavailable') or
     (entry->>'reason'='already-set' and (jsonb_typeof(entry->'code') is distinct from 'string' or length(entry->>'code') not between 1 and 64)) or
     (entry->>'reason'='unavailable' and entry->'code' is distinct from 'null'::jsonb) then raise exception 'TPV_BARCODE_PLAN_INVALID';end if;
    select * into strict t from private.totus_tpv_barcode_targets where job_id=j.id and product_id=(entry->>'product_id')::bigint and attribute_id=(entry->>'attribute_id')::bigint;
    insert into private.totus_tpv_barcode_lines(job_id,ordinal,skip_reason,existing_code) values(j.id,t.ordinal,entry->>'reason',entry->>'code');
   end loop;
  end if;
 elsif p_data<>'{}'::jsonb then raise exception 'TPV_BARCODE_REQUEST_INVALID';end if;
 select a.* into l from private.totus_tpv_barcode_lines a left join private.totus_tpv_native_commands c on c.id=a.operation_id
  where a.job_id=j.id and a.operation_id is not null and c.status is distinct from 'verified' and not exists(select 1 from private.totus_tpv_barcode_resolutions z where z.operation_id=a.operation_id) and (j.status='processing' or c.id is not null) order by a.ordinal limit 1;
 if found then return jsonb_build_object('kind',case when exists(select 1 from private.totus_tpv_native_commands where id=l.operation_id) then 'recover' else 'execute' end,'operationId',l.operation_id,'payload',l.payload);end if;
 if j.status<>'processing' then return jsonb_build_object('kind','idle');end if;
 select coalesce(max(ordinal),0) into after_number from private.totus_tpv_barcode_lines where job_id=j.id;
 select jsonb_agg(jsonb_build_object('productId',product_id,'attributeId',attribute_id) order by ordinal) into selected from
  (select * from private.totus_tpv_barcode_targets where job_id=j.id and ordinal>after_number order by ordinal limit 15) x;
 if selected is not null then return jsonb_build_object('kind','plan','afterOrdinal',after_number,'targets',selected,'field',j.field);end if;
 update private.totus_tpv_barcode_jobs set status='completed',version=version+1,updated_at=clock_timestamp() where id=j.id;
 return jsonb_build_object('kind','completed');
end $$;
create or replace function public.totus_tpv_native_command(p_action text,p_id uuid,p_scope jsonb,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r private.totus_tpv_native_commands;l private.totus_tpv_barcode_lines;j private.totus_tpv_barcode_jobs;won boolean:=false;expected jsonb;item jsonb;
begin
 select * into r from private.totus_tpv_native_commands where id=p_id;
 if coalesce(case when p_action='claim' then p_data->>'command' else r.command end,'')<>'barcodes.assign' then
  return private.totus_tpv_native_command_before_barcodes(p_action,p_id,p_scope,p_data);
 end if;
 p_scope:=p_scope-'sessionId';
 if p_action is null or p_action not in ('claim','get','complete','uncertain') or p_id is null or jsonb_typeof(p_data) is distinct from 'object' or length(p_data::text)>65536 then raise exception 'TPV_NATIVE_REQUEST_INVALID';end if;
 perform private.totus_tpv_barcode_authorize(p_scope,p_action='claim' and r.id is null);
 select * into l from private.totus_tpv_barcode_lines where operation_id=p_id;
 if not found then raise exception 'TPV_BARCODE_OPERATION_NOT_APPROVED';end if;
 select * into j from private.totus_tpv_barcode_jobs where id=l.job_id for update;
 if j.scope is distinct from p_scope or r.id is not null and r.scope is distinct from p_scope then raise exception 'TPV_NATIVE_REQUEST_ALREADY_BOUND';end if;
 if p_action='claim' then
  if p_data is distinct from jsonb_build_object('command','barcodes.assign','payload',l.payload) then raise exception 'TPV_NATIVE_REQUEST_ALREADY_BOUND';end if;
  if r.id is null then
   if j.status<>'processing' or j.confirmed_at is null then raise exception 'TPV_BARCODE_STATE_INVALID';end if;
   if not exists(select 1 from private.totus_tpv_barcode_settings s where s.actor_id=j.actor_id and s.connection_id=j.connection_id and s.shop_id=j.shop_id and s.drawer_id=j.drawer_id and s.field=j.field and s.generator_enabled) then raise exception 'TPV_BARCODE_SETTINGS_CHANGED';end if;
   if exists(select 1 from private.totus_tpv_barcode_lines a left join private.totus_tpv_native_commands c on c.id=a.operation_id where a.job_id=j.id and a.ordinal<l.ordinal and a.operation_id is not null and c.status is distinct from 'verified' and not exists(select 1 from private.totus_tpv_barcode_resolutions z where z.operation_id=a.operation_id)) then raise exception 'TPV_BARCODE_PREVIOUS_PENDING';end if;
   insert into private.totus_tpv_native_commands(id,scope,command,payload) values(p_id,p_scope,'barcodes.assign',l.payload) on conflict(id) do nothing;won:=found;
  end if;
 end if;
 select * into r from private.totus_tpv_native_commands where id=p_id for update;
 if not found then return null;end if;
 if r.command<>'barcodes.assign' or r.payload is distinct from l.payload then raise exception 'TPV_NATIVE_REQUEST_ALREADY_BOUND';end if;
 if p_action='complete' then
  item:=l.payload->'items'->((l.payload->>'item_index')::integer);
  expected:=jsonb_build_object('verified',true,'native_reference',p_id,'shop_id',j.shop_id,'plan_version',1,'field',j.field,'scheme',case j.field when 'ean13' then 'rcn13-04' when 'upc' then 'rcn12-4' else 'totus-reference' end,'plan_fingerprint',l.payload->'plan_fingerprint','item_index',l.payload->'item_index','items',jsonb_build_array(item),'count',1);
  if p_data is distinct from jsonb_build_object('result',expected) then raise exception 'TPV_NATIVE_READBACK_REQUIRED';end if;
  if r.status='verified' and r.result is distinct from expected then raise exception 'TPV_NATIVE_RESULT_CHANGED';end if;
  update private.totus_tpv_native_commands set status='verified',result=expected,reason=null,updated_at=clock_timestamp() where id=p_id returning * into r;
 elsif p_action='uncertain' and r.status<>'verified' then
  update private.totus_tpv_native_commands set status='uncertain',reason='TPV_NATIVE_RESULT_UNCERTAIN',updated_at=clock_timestamp() where id=p_id returning * into r;
 end if;
 return jsonb_build_object('id',r.id,'scope',r.scope,'command',r.command,'payload',r.payload,'status',r.status,'result',r.result,'won',won);
end $$;
commit;
