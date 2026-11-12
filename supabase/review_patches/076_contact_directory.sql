-- Native shop directories retain the permissions of their existing Totus module.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create or replace function public.totus_directory_context(p_kind text,p_action text default 'view') returns jsonb
language plpgsql security definer set search_path='' as $$
declare m text;
begin
 m=case p_kind when 'clientes' then 'facturacion' when 'proveedores' then 'gastos' when 'marcas' then 'pricing' when 'atributos' then 'productos' end;
 if auth.uid() is null or m is null or p_action is null or p_action not in ('view','create','edit','delete','export') or not coalesce(private.totus_can(m,p_action),false) then raise exception 'No tienes permiso para esta operación del directorio.';end if;
 return jsonb_build_object('connections',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'protocol',c.protocol,'enabled',c.enabled,'revision',c.revision,'verified_revision',c.verified_revision,'verified_at',c.verified_at,'real_data_authorized',c.real_data_authorized,'configured',exists(select 1 from vault.decrypted_secrets v where v.name='totus_api_'||c.id and length(v.decrypted_secret)>0))) from private.totus_api_connections c where c.protocol='prestashop' and c.name in ('PrestaShop · Hortimatic','PrestaShop · NewOldSmok')),'[]'::jsonb));
end $$;
revoke all on function public.totus_directory_context(text,text) from public,anon;
grant execute on function public.totus_directory_context(text,text) to authenticated;

create table private.totus_directory_operations(
 request_id uuid primary key,actor_id uuid not null,connection_id uuid not null,
 revision bigint not null,resource text not null check(resource in ('customers','addresses','suppliers','manufacturers','product_options','product_option_values','product_features','product_feature_values')),
 operation text not null check(operation in ('create','update','delete')),
 signature text not null check(signature ~ '^[a-f0-9]{64}$'),
 status text not null check(status in ('pending','completed','uncertain')),
 record_id bigint check(record_id is null or record_id>0),scope_hash text check(scope_hash is null or scope_hash ~ '^[a-f0-9]{64}$'),baseline_ids jsonb not null default '[]',created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp()
);
alter table private.totus_directory_operations enable row level security;
revoke all on private.totus_directory_operations from public,anon,authenticated;
grant select,insert,update on private.totus_directory_operations to service_role;
create index totus_directory_operations_actor_created on private.totus_directory_operations(actor_id,created_at desc);
create unique index totus_directory_pending_creation on private.totus_directory_operations(connection_id,resource,scope_hash) where operation='create' and status in ('pending','uncertain');

create or replace function public.totus_directory_operation(p_action text,p_request_id uuid,p_data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r private.totus_directory_operations%rowtype; a uuid:=(p_data->>'actor_id')::uuid; c uuid:=(p_data->>'connection_id')::uuid; v bigint:=(p_data->>'revision')::bigint; h text:=p_data->>'signature'; resource_name text:=p_data->>'resource'; operation_name text:=p_data->>'operation';
begin
 if p_request_id is null or a is null or c is null or v is null or v<1 or h is null or h !~ '^[a-f0-9]{64}$' or p_action is null or p_action not in ('lookup','claim','complete','uncertain') or resource_name is null or resource_name not in ('customers','addresses','suppliers','manufacturers','product_options','product_option_values','product_features','product_feature_values') or operation_name is null or operation_name not in ('create','update','delete') then raise exception 'Identidad de operación de directorio no válida.';end if;
 if not exists(select 1 from private.totus_api_connections x where x.id=c and x.protocol='prestashop' and x.enabled and x.real_data_authorized and x.revision=v and x.verified_revision=v and x.name in ('PrestaShop · Hortimatic','PrestaShop · NewOldSmok')) then raise exception 'La conexión no está verificada.';end if;
 if p_action='claim' then
  if operation_name='create' and (coalesce(p_data->>'scope_hash','') !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_data->'baseline_ids') is distinct from 'array' or jsonb_array_length(p_data->'baseline_ids')>10000 or exists(select 1 from jsonb_array_elements(p_data->'baseline_ids')x where jsonb_typeof(x)<>'string' or (x#>>'{}') !~ '^[1-9][0-9]{0,14}$')) then raise exception 'Falta el contraste previo del alta.';end if;
  insert into private.totus_directory_operations(request_id,actor_id,connection_id,revision,resource,operation,signature,status,record_id,scope_hash,baseline_ids) values(p_request_id,a,c,v,resource_name,operation_name,h,'pending',nullif(p_data->>'record_id','')::bigint,p_data->>'scope_hash',coalesce(p_data->'baseline_ids','[]')) on conflict do nothing returning * into r;
  if found then return jsonb_build_object('status','claimed');end if;
  if not exists(select 1 from private.totus_directory_operations where request_id=p_request_id) then return jsonb_build_object('status','in_progress');end if;
 end if;
 select * into r from private.totus_directory_operations where request_id=p_request_id for update;
 if not found then if p_action='lookup' then return null;end if;raise exception 'Operación no registrada.';end if;
 if r.actor_id<>a or r.connection_id<>c or r.revision<>v or r.signature<>h or r.resource<>resource_name or r.operation<>operation_name then raise exception 'La solicitud pertenece a otra operación o identidad.';end if;
 if p_action in ('complete','uncertain') then
  if r.status='completed' then if p_action='complete' then return jsonb_build_object('status',r.status,'record_id',r.record_id);end if;raise exception 'La operación ya está completada.';end if;
  if p_action='complete' and coalesce(nullif(p_data->>'record_id','')::bigint,r.record_id,0)<=0 then raise exception 'Falta el identificador verificado.';end if;
  update private.totus_directory_operations set status=case when p_action='complete' then 'completed' else 'uncertain' end,record_id=coalesce(nullif(p_data->>'record_id','')::bigint,record_id),updated_at=clock_timestamp() where request_id=p_request_id returning * into r;
 end if;
 return jsonb_build_object('status',r.status,'record_id',r.record_id,'updated_at',r.updated_at,'baseline_ids',r.baseline_ids);
end $$;
revoke all on function public.totus_directory_operation(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.totus_directory_operation(text,uuid,jsonb) to service_role;
commit;
