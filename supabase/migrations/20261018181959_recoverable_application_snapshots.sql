-- Same-project application recovery. Auth credentials are never exported/restored.
create table private.totus_recovery_identity (
 singleton boolean primary key default true check(singleton),
 instance_id uuid not null default gen_random_uuid()
);
insert into private.totus_recovery_identity(singleton) values(true);
revoke all on private.totus_recovery_identity from public,anon,authenticated;

create table public.ops_recovery_jobs (
 id uuid primary key,
 requested_by uuid not null,
 requested_email text not null,
 status text not null default 'uploaded' check(status in ('uploaded','preparing','prepared','committed','failed')),
 source_path text not null,
 checkpoint_path text,
 before_revision text,
 result jsonb,
 error text,
 created_at timestamptz not null default now(),
 finished_at timestamptz
);
alter table public.ops_recovery_jobs enable row level security;
revoke all on public.ops_recovery_jobs from public,anon,authenticated;
grant select on public.ops_recovery_jobs to authenticated;
grant all on public.ops_recovery_jobs to service_role;
create policy totus_recovery_admin_read on public.ops_recovery_jobs for select to authenticated
 using (private.is_admin());
create policy totus_recovery_source_insert on storage.objects for insert to authenticated
 with check (bucket_id='business-backups' and private.is_admin()
  and split_part(name,'/',3)=(select auth.uid())::text
  and name ~ '^restauraciones/solicitudes/[0-9a-f-]{36}/[0-9a-f-]{36}\.totusbackup$');

create function private.totus_recovery_tables() returns text[]
language sql immutable security invoker set search_path='' as $$
 select array[
 'ops_business_settings','ops_stores','ops_expense_categories','ops_cash_drawers','ops_invoice_series',
 'ops_suppliers','ops_customers','ops_document_templates','ops_documents','ops_daily_closings','ops_daily_closing_drawers',
 'ops_expenses','ops_expense_lines','ops_sales_invoices','ops_sales_invoice_lines','ops_tax_payments','ops_fiscal_adjustments','ops_income_adjustments','ops_reta_brackets','ops_audit_log',
 'brands','families','providers','products','product_variants','product_provider_prices','product_competitor_prices','price_history','consultations','consultation_history',
 'ops_roles','ops_role_permissions','ops_user_permissions','ops_backup_config',
 'profiles','team_members','team_email_log','team_user_audit_log']::text[];
$$;
revoke all on function private.totus_recovery_tables() from public,anon,authenticated;

create function private.totus_recovery_schema_hash() returns text
language sql stable security invoker set search_path='' as $$
 select encode(extensions.digest(jsonb_build_object(
  'columns',(select jsonb_agg(jsonb_build_array(c.relname,a.attname,pg_catalog.format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attgenerated,a.attidentity) order by c.relname,a.attnum)
    from pg_catalog.pg_attribute a join pg_catalog.pg_class c on c.oid=a.attrelid
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
    and c.relname=any(private.totus_recovery_tables()) and a.attnum>0 and not a.attisdropped),
  'constraints',(select jsonb_agg(jsonb_build_array(c.relname,k.conname,pg_catalog.pg_get_constraintdef(k.oid)) order by c.relname,k.conname)
    from pg_catalog.pg_constraint k join pg_catalog.pg_class c on c.oid=k.conrelid
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
    and c.relname=any(private.totus_recovery_tables()))
 )::text,'sha256'),'hex');
$$;
revoke all on function private.totus_recovery_schema_hash() from public,anon,authenticated;

create function private.totus_recovery_dataset() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare tab text; rows jsonb; dataset jsonb='{}';
begin
 for tab in select unnest(private.totus_recovery_tables()) order by 1 loop
  execute format('lock table public.%I in share mode',tab);
 end loop;
 foreach tab in array private.totus_recovery_tables() loop
  execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb) from public.%I t',tab) into rows;
  dataset=dataset||jsonb_build_object(tab,rows);
 end loop;
 return dataset;
end;
$$;
revoke all on function private.totus_recovery_dataset() from public,anon,authenticated;

create function private.totus_recovery_file_refs(data jsonb)
returns table(bucket text,path text) language sql immutable security invoker set search_path='' as $$
 select 'business-documents'::text,d->>'storage_path' from jsonb_array_elements(data->'ops_documents') d
 where nullif(d->>'storage_path','') is not null
 union
 select 'business-assets'::text,j #>> '{}' from jsonb_path_query(
   jsonb_build_array(data->'ops_document_templates',data->'ops_sales_invoices',data->'ops_business_settings'),
   'lax $.**.logo_path') j
 where jsonb_typeof(j)='string' and nullif(j #>> '{}','') is not null;
$$;
revoke all on function private.totus_recovery_file_refs(jsonb) from public,anon,authenticated;

create function public.totus_export_recovery_snapshot() returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare data jsonb; files jsonb; identities jsonb;
begin
 if coalesce((select auth.jwt()->>'role'),'')<>'service_role' and not private.is_admin() then
  raise exception 'Solo administración puede descargar una copia completa';
 end if;
 data=private.totus_recovery_dataset();
 if exists(select 1 from private.totus_recovery_file_refs(data) f left join storage.objects o
  on o.bucket_id=f.bucket and o.name=f.path where o.id is null) then
   raise exception 'Hay documentos o logos vinculados cuyo archivo no existe. Repara los vínculos antes de crear la copia';
 end if;
 select jsonb_object_agg(b.bucket,coalesce((select jsonb_agg(f.path order by f.path)
  from private.totus_recovery_file_refs(data) f where f.bucket=b.bucket),'[]'::jsonb)) into files
 from (values('business-documents'),('business-assets')) b(bucket);
 select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'email',lower(u.email)) order by u.id),'[]'::jsonb)
 into identities from auth.users u;
 return jsonb_build_object('database',data,'storage',files,'identities',identities,'created_at',now(),
 'database_instance',(select instance_id from private.totus_recovery_identity where singleton),
 'schema_hash',private.totus_recovery_schema_hash(),
 'revision',encode(extensions.digest(data::text,'sha256'),'hex'));
end;
$$;
revoke all on function public.totus_export_recovery_snapshot() from public,anon;
grant execute on function public.totus_export_recovery_snapshot() to authenticated,service_role;

-- Caller is the authenticated coordinator service, never a browser-provided SQL payload.
create function public.totus_commit_recovery(p_job uuid,p_payload jsonb,p_metadata jsonb)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare job public.ops_recovery_jobs; tab text; tabs text[]=private.totus_recovery_tables();
 pending text[]; remaining text[]; ready boolean; progressed boolean; before_data jsonb; after_data jsonb;
 columns_sql text; truncate_sql text; trigger_state jsonb; seq record; next_id bigint;
 expected jsonb; counts jsonb='{}'; item jsonb;
begin
 select * into job from public.ops_recovery_jobs where id=p_job for update;
 if not found then raise exception 'Solicitud de recuperación inexistente'; end if;
 if job.status='committed' then return job.result; end if;
 if job.status<>'prepared' or job.checkpoint_path is null or job.before_revision is null then
  raise exception 'La preparación y el punto de recuperación no están completos';
 end if;
 if not exists(select 1 from auth.users u join public.team_members t on lower(t.email)=lower(u.email)
  where u.id=job.requested_by and lower(u.email)=job.requested_email and t.active and t.role='admin') then
  raise exception 'La cuenta solicitante ya no es un administrador activo';
 end if;
 if p_metadata->>'database_instance' is distinct from (select instance_id::text from private.totus_recovery_identity where singleton)
  or p_metadata->>'schema_hash' is distinct from private.totus_recovery_schema_hash() then
  raise exception 'La copia pertenece a otro proyecto o a una estructura de datos incompatible';
 end if;
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Datos de copia no válidos'; end if;
 foreach tab in array tabs loop
  if jsonb_typeof(p_payload->tab) is distinct from 'array' then raise exception 'Falta la tabla % en la copia',tab; end if;
 end loop;
 if not exists(select 1 from jsonb_array_elements(p_payload->'team_members') t
   where lower(t->>'email')=job.requested_email and t->>'role'='admin' and (t->>'active')::boolean)
  or not exists(select 1 from jsonb_array_elements(p_payload->'profiles') p
   where p->>'id'=job.requested_by::text and lower(p->>'email')=job.requested_email) then
  raise exception 'La copia no conserva la cuenta administradora que realiza la recuperación';
 end if;
 for item in select value from jsonb_array_elements(p_payload->'profiles') loop
  if not exists(select 1 from auth.users u join jsonb_array_elements(p_metadata->'identities') i
   on i->>'id'=u.id::text and lower(i->>'email')=lower(u.email)
   where u.id::text=item->>'id' and lower(u.email)=lower(item->>'email')) then
   raise exception 'La copia hace referencia a una cuenta que falta o ha cambiado. No se han sustituido datos';
  end if;
 end loop;
 if exists(select 1 from private.totus_recovery_file_refs(p_payload) f left join storage.objects o
  on o.bucket_id=f.bucket and o.name=f.path where o.id is null or f.path not like 'recovery/'||p_job::text||'/%') then
  raise exception 'Hay archivos de la copia que no han sido preparados';
 end if;
 for tab in select unnest(tabs) order by 1 loop
  execute format('lock table public.%I in access exclusive mode',tab);
 end loop;
 before_data=private.totus_recovery_dataset();
 if encode(extensions.digest(before_data::text,'sha256'),'hex')<>job.before_revision then
  raise exception 'Los datos han cambiado durante la preparación. Se cancela para conservar los cambios recientes';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'state',t.tgenabled)),'[]'::jsonb)
 into trigger_state from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid
 join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any(tabs) and not t.tgisinternal;
 for item in select value from jsonb_array_elements(trigger_state) loop
  execute format('alter table public.%I disable trigger %I',item->>'table',item->>'name');
 end loop;
 select string_agg(format('public.%I',t),',') into truncate_sql from unnest(tabs) t;
 execute 'truncate table '||truncate_sql||' restart identity';
 pending=tabs;
 while cardinality(pending)>0 loop
  progressed=false;remaining='{}'::text[];
  foreach tab in array pending loop
   select not exists(select 1 from pg_catalog.pg_constraint c
    where c.contype='f' and c.conrelid=format('public.%I',tab)::regclass
    and c.confrelid<>c.conrelid and c.confrelid in
      (select format('public.%I',x)::regclass from unnest(pending) x)) into ready;
   if ready then
    select string_agg(format('%I',a.attname),',' order by a.attnum) into columns_sql
     from pg_catalog.pg_attribute a where a.attrelid=format('public.%I',tab)::regclass
     and a.attnum>0 and not a.attisdropped and a.attgenerated='';
    execute format('insert into public.%I (%s) overriding system value select %s from jsonb_populate_recordset(null::public.%I,$1)',tab,columns_sql,columns_sql,tab)
     using p_payload->tab;
    counts=counts||jsonb_build_object(tab,jsonb_array_length(p_payload->tab));
    progressed=true;
   else remaining=array_append(remaining,tab);
   end if;
  end loop;
  if not progressed then raise exception 'Dependencias cíclicas no compatibles con la recuperación'; end if;
  pending=remaining;
 end loop;
 after_data=private.totus_recovery_dataset();
 foreach tab in array tabs loop
  select coalesce(jsonb_agg(value order by value::text),'[]'::jsonb) into expected from jsonb_array_elements(p_payload->tab);
  if after_data->tab is distinct from expected then raise exception 'La verificación de la tabla % no coincide con la copia',tab; end if;
 end loop;
 for seq in select c.table_name,c.column_name,pg_catalog.pg_get_serial_sequence(format('public.%I',c.table_name),c.column_name) as name
  from information_schema.columns c where c.table_schema='public' and c.table_name=any(tabs) loop
  if seq.name is not null then
   execute format('select greatest(coalesce(max(%I),0)+1,1) from public.%I',seq.column_name,seq.table_name) into next_id;
   execute format('alter sequence %s restart with %s',seq.name,next_id);
  end if;
 end loop;
 for item in select value from jsonb_array_elements(trigger_state) loop
  execute format('alter table public.%I %s trigger %I',item->>'table',
   case item->>'state' when 'D' then 'disable' when 'R' then 'enable replica' when 'A' then 'enable always' else 'enable' end,item->>'name');
 end loop;
 insert into public.ops_audit_log(user_id,user_email,area,action,detail)
 values(job.requested_by,job.requested_email,'administracion','recovery_committed',
  jsonb_build_object('job',p_job,'checkpoint',job.checkpoint_path,'before_revision',job.before_revision,'counts',counts));
 update public.ops_recovery_jobs set status='committed',result=counts,finished_at=now(),error=null where id=p_job;
 return counts;
end;
$$;
revoke all on function public.totus_commit_recovery(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.totus_commit_recovery(uuid,jsonb,jsonb) to service_role;

create or replace function public.totus_restore_backup(p_payload jsonb,p_reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 raise exception 'La recuperación antigua está deshabilitada. Utiliza una copia v3 y el coordinador de recuperación con punto de vuelta atrás';
end;
$$;

create or replace function public.totus_backup_contract()
returns jsonb
language plpgsql security definer
set search_path='public,private'
as $$
begin
  if not private.totus_is_admin() then raise exception 'Solo administración puede comprobar la restauración'; end if;
  return jsonb_build_object('version',3,'income_adjustments',true,'storage',true,'coordinated_recovery',true,'auth_credentials',false);
end;
$$;


