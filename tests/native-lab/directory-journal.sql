-- Local test fixture only. Existing Central directory journal schema/function
-- inspected read-only on 2026-11-16. Not a migration or a deployment input.
create table private.totus_directory_operations (
 request_id uuid primary key, actor_id uuid not null,connection_id uuid not null,revision bigint not null,
 resource text not null,operation text not null,signature text not null,status text not null,record_id bigint,
 scope_hash text,baseline_ids jsonb not null default '[]',created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp());
create unique index totus_directory_pending_creation on private.totus_directory_operations(connection_id,resource,scope_hash)
 where operation='create' and status in ('pending','uncertain');
alter table private.totus_directory_operations enable row level security;
create policy directory_server_fixture on private.totus_directory_operations to service_role using(true) with check(true);
grant select,insert,update on private.totus_directory_operations to service_role;
CREATE OR REPLACE FUNCTION public.totus_directory_operation(p_action text, p_request_id uuid, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare r private.totus_directory_operations%rowtype; a uuid:=(p_data->>'actor_id')::uuid; c uuid:=(p_data->>'connection_id')::uuid; v bigint:=(p_data->>'revision')::bigint; h text:=p_data->>'signature'; resource_name text:=p_data->>'resource'; operation_name text:=p_data->>'operation';
begin
 if p_request_id is null or a is null or c is null or v is null or v<1 or h is null or h !~ '^[a-f0-9]{64}$' or p_action is null or p_action not in ('lookup','claim','complete','uncertain') or resource_name is null or resource_name not in ('customers','addresses','suppliers','manufacturers','product_options','product_option_values','product_features','product_feature_values') or operation_name is null or operation_name not in ('create','update','delete') then raise exception 'Identidad de operación de directorio no válida.';end if;
 if not exists(select 1 from private.totus_api_connections x where x.id=c and x.protocol='prestashop' and x.enabled and x.real_data_authorized and x.revision=v and x.verified_revision=v and exists(select 1 from private.totus_websites w where w.connection_id=x.id and w.status='active')) then raise exception 'La conexión no está verificada.';end if;
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
end $function$;

revoke all on function public.totus_directory_operation(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.totus_directory_operation(text,uuid,jsonb) to service_role;

