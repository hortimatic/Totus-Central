begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
-- The complete target list is captured before confirmation. Fifty is a read
-- page size, never a functional maximum on a generation.
create table private.totus_tpv_barcode_jobs(
 id uuid primary key,actor_id uuid not null references public.profiles(id),
 connection_id uuid not null references private.totus_api_connections(id),shop_id bigint not null check(shop_id>0),
 drawer_id uuid not null references public.ops_cash_drawers(id),store_id uuid not null references public.ops_stores(id),
 scope jsonb not null check(jsonb_typeof(scope)='object'),field text not null check(field in ('ean13','upc','reference')),
 status text not null default 'preparing' check(status in ('preparing','review','processing','paused','completed','cancelled')),
 resume_status text check(resume_status in ('preparing','processing')),version bigint not null default 1 check(version>0),
 capture_cursor jsonb not null default '[0,0]',capture_bounds jsonb,capture_complete boolean not null default false,
 last_capture jsonb,last_from_cursor jsonb,confirmed_at timestamptz,
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 check(status<>'processing' or capture_complete and confirmed_at is not null)
);
create unique index tpv_barcode_one_active on private.totus_tpv_barcode_jobs(actor_id,connection_id,shop_id,drawer_id,field)
 where status not in ('completed','cancelled');
create index tpv_barcode_history on private.totus_tpv_barcode_jobs(actor_id,connection_id,shop_id,drawer_id,created_at desc);
create table private.totus_tpv_barcode_targets(
 job_id uuid not null references private.totus_tpv_barcode_jobs(id),ordinal bigint not null check(ordinal>0),
 product_id bigint not null check(product_id between 1 and 2147483647),attribute_id bigint not null check(attribute_id between 0 and 2147483647),
 name text not null check(length(name)<=255),variant_name text not null check(length(variant_name)<=255),reference text not null check(length(reference)<=64),
 primary key(job_id,product_id,attribute_id),unique(job_id,ordinal)
);
alter table private.totus_tpv_barcode_jobs enable row level security;
alter table private.totus_tpv_barcode_targets enable row level security;
create policy tpv_barcode_jobs_server on private.totus_tpv_barcode_jobs to service_role using(true) with check(true);
create policy tpv_barcode_targets_server on private.totus_tpv_barcode_targets to service_role using(true) with check(true);
revoke all on private.totus_tpv_barcode_jobs,private.totus_tpv_barcode_targets from public,anon,authenticated;
grant select,insert,update on private.totus_tpv_barcode_jobs,private.totus_tpv_barcode_targets to service_role;

create function private.totus_tpv_barcode_authorize(p_scope jsonb,p_write boolean) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if jsonb_typeof(p_scope) is distinct from 'object' or length(p_scope::text)>2000 or
  p_scope-array['actorId','connectionId','connectionRevision','storeId','shopId','drawerId','currency','environment']<>'{}'::jsonb
 then raise exception 'TPV_BARCODE_SCOPE_INVALID';end if;
 perform private.totus_tpv_authorize(p_scope,'read');
 if not private.totus_module_can((select email from public.profiles where id=(p_scope->>'actorId')::uuid and active),'productos',case when p_write then 'edit' else 'view' end)
 then raise exception 'TPV_BARCODE_FORBIDDEN';end if;
end $$;
revoke all on function private.totus_tpv_barcode_authorize(jsonb,boolean) from public,anon,authenticated;
grant execute on function private.totus_tpv_barcode_authorize(jsonb,boolean) to service_role;

create function private.totus_tpv_barcode_job_json(j private.totus_tpv_barcode_jobs,p_after bigint default 0,p_size integer default 50) returns jsonb
language sql volatile security invoker set search_path='' as $$
 with page as(select t.* from private.totus_tpv_barcode_targets t where t.job_id=j.id and t.ordinal>p_after order by t.ordinal limit p_size),
 summary as(select coalesce(jsonb_agg(jsonb_build_object('ordinal',ordinal,'productId',product_id,'attributeId',attribute_id,'name',name,'variantName',variant_name,'reference',reference) order by ordinal),'[]'::jsonb) items,coalesce(max(ordinal),p_after) next_after from page)
 select jsonb_build_object('id',j.id,'scope',j.scope,'field',j.field,'status',j.status,'version',j.version,
  'cursor',j.capture_cursor,'bounds',j.capture_bounds,'captureComplete',j.capture_complete,'confirmedAt',j.confirmed_at,
  'createdAt',j.created_at,'updatedAt',j.updated_at,'capturedCount',(select count(*) from private.totus_tpv_barcode_targets where job_id=j.id),
  'items',s.items,'nextAfter',s.next_after,'hasMore',exists(select 1 from private.totus_tpv_barcode_targets where job_id=j.id and ordinal>s.next_after)) from summary s;
$$;
revoke all on function private.totus_tpv_barcode_job_json(private.totus_tpv_barcode_jobs,bigint,integer) from public,anon,authenticated;
grant execute on function private.totus_tpv_barcode_job_json(private.totus_tpv_barcode_jobs,bigint,integer) to service_role;

create function public.totus_tpv_barcode_jobs(p_action text,p_id uuid,p_scope jsonb,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare j private.totus_tpv_barcode_jobs;settings private.totus_tpv_barcode_settings;page jsonb;entry jsonb;bounds jsonb;
 previous_product bigint;previous_attribute bigint;next_product bigint;next_attribute bigint;ordinal_number bigint;page_after bigint:=0;page_size integer:=50;
begin
 p_scope:=p_scope-'sessionId';
 if p_action is null or p_action not in ('create','get','list','capture','confirm','pause','resume','cancel') or jsonb_typeof(p_data) is distinct from 'object' or length(p_data::text)>262144 or p_action<>'list' and p_id is null
 then raise exception 'TPV_BARCODE_REQUEST_INVALID';end if;
 perform private.totus_tpv_barcode_authorize(p_scope,p_action not in ('get','list'));
 select * into settings from private.totus_tpv_barcode_settings where actor_id=(p_scope->>'actorId')::uuid and connection_id=(p_scope->>'connectionId')::uuid and shop_id=(p_scope->>'shopId')::bigint and drawer_id=(p_scope->>'drawerId')::uuid;
 if p_action='list' then
  if p_data<>'{}'::jsonb then raise exception 'TPV_BARCODE_REQUEST_INVALID';end if;
  return coalesce((select jsonb_agg(x.value order by x.active desc,x.created_at desc) from (
   select j2.status not in ('completed','cancelled') active,j2.created_at,private.totus_tpv_barcode_job_json(j2,0,1) value
   from private.totus_tpv_barcode_jobs j2 where j2.actor_id=(p_scope->>'actorId')::uuid and j2.connection_id=(p_scope->>'connectionId')::uuid and j2.shop_id=(p_scope->>'shopId')::bigint and j2.drawer_id=(p_scope->>'drawerId')::uuid and j2.store_id=(p_scope->>'storeId')::uuid
   order by active desc,j2.created_at desc limit 100) x),'[]'::jsonb);
 end if;
 if p_action='create' then
  if p_data<>'{}'::jsonb then raise exception 'TPV_BARCODE_REQUEST_INVALID';end if;
  if not exists(select 1 from private.totus_tpv_barcode_jobs where id=p_id) then
   if settings.generator_enabled is distinct from true then raise exception 'TPV_BARCODE_DISABLED';end if;
   begin
    insert into private.totus_tpv_barcode_jobs(id,actor_id,connection_id,shop_id,drawer_id,store_id,scope,field)
     values(p_id,(p_scope->>'actorId')::uuid,(p_scope->>'connectionId')::uuid,(p_scope->>'shopId')::bigint,(p_scope->>'drawerId')::uuid,(p_scope->>'storeId')::uuid,p_scope,settings.field)
     on conflict(id) do nothing;
   exception when unique_violation then raise exception 'TPV_BARCODE_ALREADY_ACTIVE';end;
  end if;
 end if;
 select * into j from private.totus_tpv_barcode_jobs where id=p_id for update;
 if not found or j.actor_id is distinct from (p_scope->>'actorId')::uuid or j.connection_id is distinct from (p_scope->>'connectionId')::uuid or j.shop_id is distinct from (p_scope->>'shopId')::bigint or j.drawer_id is distinct from (p_scope->>'drawerId')::uuid or j.store_id is distinct from (p_scope->>'storeId')::uuid
 then raise exception 'TPV_BARCODE_NOT_FOUND';end if;
 if p_action not in ('get','cancel') and j.scope is distinct from p_scope then raise exception 'TPV_BARCODE_CONTEXT_STALE';end if;
 if p_action='get' then
  if p_data-array['after','pageSize']<>'{}'::jsonb or p_data?'after' and (jsonb_typeof(p_data->'after') is distinct from 'number' or p_data->>'after' !~ '^(0|[1-9][0-9]{0,9})$') or p_data?'pageSize' and (jsonb_typeof(p_data->'pageSize') is distinct from 'number' or p_data->>'pageSize' !~ '^[1-9][0-9]{0,2}$' or (p_data->>'pageSize')::integer>100)
  then raise exception 'TPV_BARCODE_REQUEST_INVALID';end if;
  page_after:=coalesce((p_data->>'after')::bigint,0);page_size:=coalesce((p_data->>'pageSize')::integer,50);
 elsif p_action='capture' then
  if p_data-array['fromCursor','page']<>'{}'::jsonb or jsonb_typeof(p_data->'fromCursor') is distinct from 'array' or jsonb_typeof(p_data->'page') is distinct from 'object' then raise exception 'TPV_BARCODE_CAPTURE_INVALID';end if;
  if j.last_from_cursor=p_data->'fromCursor' and j.last_capture=p_data->'page' then return private.totus_tpv_barcode_job_json(j);end if;
  if j.status<>'preparing' or j.capture_cursor is distinct from p_data->'fromCursor' then raise exception 'TPV_BARCODE_CAPTURE_STALE';end if;
  page:=p_data->'page';bounds:=page->'bounds';
  if page-array['source','plan_version','field','shop_id','items','has_more','cursor','bounds']<>'{}'::jsonb or page->>'source' is distinct from 'native-missing-barcode-targets' or page->'plan_version' is distinct from '1'::jsonb or page->>'field' is distinct from j.field or page->'shop_id' is distinct from to_jsonb(j.shop_id) or jsonb_typeof(page->'has_more') is distinct from 'boolean' or jsonb_typeof(page->'items') is distinct from 'array' or jsonb_typeof(page->'cursor') is distinct from 'array' or jsonb_typeof(bounds) is distinct from 'object'
  then raise exception 'TPV_BARCODE_CAPTURE_INVALID';end if;
  if jsonb_array_length(page->'items')>50 or jsonb_array_length(page->'cursor')<>2 or bounds-array['product','attribute']<>'{}'::jsonb or (j.capture_bounds is not null and j.capture_bounds is distinct from bounds)
  then raise exception 'TPV_BARCODE_CAPTURE_INVALID';end if;
  for entry in select value from jsonb_array_elements(page->'cursor') union all select value from jsonb_each(bounds) loop
   if jsonb_typeof(entry) is distinct from 'number' or entry::text !~ '^(0|[1-9][0-9]{0,9})$' or (entry::text)::bigint>2147483647 then raise exception 'TPV_BARCODE_CAPTURE_INVALID';end if;
  end loop;
  if not(bounds?'product' and bounds?'attribute') then raise exception 'TPV_BARCODE_CAPTURE_INVALID';end if;
  previous_product:=(j.capture_cursor->>0)::bigint;previous_attribute:=(j.capture_cursor->>1)::bigint;next_product:=(page->'cursor'->>0)::bigint;next_attribute:=(page->'cursor'->>1)::bigint;
  if row(next_product,next_attribute)<row(previous_product,previous_attribute) or page->'has_more'='true'::jsonb and row(next_product,next_attribute)<=row(previous_product,previous_attribute) or next_product>(bounds->>'product')::bigint or next_attribute>(bounds->>'attribute')::bigint then raise exception 'TPV_BARCODE_CAPTURE_INVALID';end if;
  select coalesce(max(ordinal),0) into ordinal_number from private.totus_tpv_barcode_targets where job_id=j.id;
  for entry in select value from jsonb_array_elements(page->'items') loop
   if jsonb_typeof(entry) is distinct from 'object' or entry-array['product_id','attribute_id','name','variant_name','reference']<>'{}'::jsonb or jsonb_typeof(entry->'product_id') is distinct from 'number' or jsonb_typeof(entry->'attribute_id') is distinct from 'number' or coalesce(entry->>'product_id','') !~ '^[1-9][0-9]{0,9}$' or coalesce(entry->>'attribute_id','') !~ '^(0|[1-9][0-9]{0,9})$' or (entry->>'product_id')::bigint>2147483647 or (entry->>'attribute_id')::bigint>2147483647 or jsonb_typeof(entry->'name') is distinct from 'string' or length(entry->>'name')>255 or jsonb_typeof(entry->'variant_name') is distinct from 'string' or length(entry->>'variant_name')>255 or jsonb_typeof(entry->'reference') is distinct from 'string' or length(entry->>'reference')>64
   then raise exception 'TPV_BARCODE_CAPTURE_INVALID';end if;
   if row((entry->>'product_id')::bigint,(entry->>'attribute_id')::bigint)<=row(previous_product,previous_attribute) or row((entry->>'product_id')::bigint,(entry->>'attribute_id')::bigint)>row(next_product,next_attribute) or (entry->>'product_id')::bigint>(bounds->>'product')::bigint or (entry->>'attribute_id')::bigint>(bounds->>'attribute')::bigint then raise exception 'TPV_BARCODE_CAPTURE_INVALID';end if;
   previous_product:=(entry->>'product_id')::bigint;previous_attribute:=(entry->>'attribute_id')::bigint;ordinal_number:=ordinal_number+1;
   insert into private.totus_tpv_barcode_targets(job_id,ordinal,product_id,attribute_id,name,variant_name,reference) values(j.id,ordinal_number,previous_product,previous_attribute,entry->>'name',entry->>'variant_name',entry->>'reference');
  end loop;
  update private.totus_tpv_barcode_jobs set capture_cursor=page->'cursor',capture_bounds=bounds,last_capture=page,last_from_cursor=p_data->'fromCursor',capture_complete=page->'has_more'='false'::jsonb,status=case when page->'has_more'='true'::jsonb then 'preparing' when ordinal_number=0 then 'completed' else 'review' end,version=version+1,updated_at=clock_timestamp() where id=j.id returning * into j;
 elsif p_action in ('confirm','resume') then
  if p_action='confirm' and p_data is distinct from '{"accepted":true}'::jsonb or p_action='resume' and p_data<>'{}'::jsonb then raise exception 'TPV_BARCODE_REQUEST_INVALID';end if;
  if p_action='confirm' and j.confirmed_at is not null or p_action='resume' and j.status in ('preparing','processing') then return private.totus_tpv_barcode_job_json(j);end if;
  if settings.generator_enabled is distinct from true or settings.field is distinct from j.field then raise exception 'TPV_BARCODE_SETTINGS_CHANGED';end if;
  if p_action='confirm' and j.status<>'review' or p_action='resume' and j.status<>'paused' then raise exception 'TPV_BARCODE_STATE_INVALID';end if;
  update private.totus_tpv_barcode_jobs set status=case when p_action='confirm' then 'processing' else resume_status end,resume_status=null,confirmed_at=case when p_action='confirm' then clock_timestamp() else confirmed_at end,version=version+1,updated_at=clock_timestamp() where id=j.id returning * into j;
 elsif p_action in ('pause','cancel') then
  if p_data<>'{}'::jsonb then raise exception 'TPV_BARCODE_REQUEST_INVALID';end if;
  if p_action='pause' and j.status='paused' or p_action='cancel' and j.status in ('completed','cancelled') then return private.totus_tpv_barcode_job_json(j);end if;
  if p_action='pause' and j.status not in ('preparing','processing') then raise exception 'TPV_BARCODE_STATE_INVALID';end if;
  update private.totus_tpv_barcode_jobs set resume_status=case when p_action='pause' then status else null end,status=case when p_action='pause' then 'paused' else 'cancelled' end,version=version+1,updated_at=clock_timestamp() where id=j.id returning * into j;
 end if;
 return private.totus_tpv_barcode_job_json(j,page_after,page_size);
end $$;
revoke all on function public.totus_tpv_barcode_jobs(text,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.totus_tpv_barcode_jobs(text,uuid,jsonb,jsonb) to service_role;
commit;
