alter table public.profiles add column if not exists ui_preferences jsonb not null default '{}'::jsonb;
alter table public.ops_onedrive_documents add constraint qa_onedrive_document_unique unique(document_id);
create schema extensions;create extension pgcrypto with schema extensions;
create schema storage;
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,unique(bucket_id,name));
alter table public.team_members add column full_name text not null default '';
alter table public.profiles add column email text;
alter table public.ops_onedrive_config add column retirement_lock_until timestamptz;
create table public.ops_onedrive_cleanup(document_id uuid,onedrive_path text,onedrive_item_id text unique,size_bytes bigint,sha256 text);
create table private.totus_recovery_identity(singleton boolean primary key,instance_id uuid not null);
insert into private.totus_recovery_identity values(true,'99999999-9999-4999-8999-999999999999');
insert into public.ops_onedrive_config(id,drive_id) values(1,'drive-qa');
create function private.is_admin() returns boolean language sql as $$select coalesce(auth.jwt()->>'role','')='service_role'$$;
grant usage on schema auth,private to authenticated,service_role;
CREATE OR REPLACE FUNCTION private.totus_recovery_schema_hash()
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select encode(extensions.digest(jsonb_build_object(
  'columns',(select jsonb_agg(jsonb_build_array(c.relname,a.attname,pg_catalog.format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attgenerated,a.attidentity) order by c.relname,a.attnum)
    from pg_catalog.pg_attribute a join pg_catalog.pg_class c on c.oid=a.attrelid
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
    and c.relname=any(private.totus_recovery_tables()) and a.attnum>0 and not a.attisdropped
    and not (c.relname='profiles' and a.attname='ui_preferences')
    and not (c.relname='ops_expense_categories' and a.attname='report_group')),
  'constraints',(select jsonb_agg(jsonb_build_array(c.relname,k.conname,pg_catalog.pg_get_constraintdef(k.oid)) order by c.relname,k.conname)
    from pg_catalog.pg_constraint k join pg_catalog.pg_class c on c.oid=k.conrelid
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
    and c.relname=any(private.totus_recovery_tables())
    and not (c.relname='ops_expense_categories' and k.conname='ops_expense_categories_report_group_check'))
 )::text,'sha256'),'hex');
$function$;

CREATE OR REPLACE FUNCTION private.totus_recovery_dataset()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.totus_export_recovery_snapshot()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET lock_timeout TO '5s'
AS $function$
declare data jsonb; files jsonb; identities jsonb;
begin
 if coalesce((select auth.jwt()->>'role'),'')<>'service_role' and not private.is_admin() then
  raise exception 'Solo administración puede descargar una copia completa';
 end if;
 data=private.totus_recovery_dataset();
 if exists(select 1 from private.totus_recovery_file_refs(data) f left join storage.objects o
  on o.bucket_id=f.bucket and o.name=f.path where o.id is null and not (f.bucket='business-documents' and private.totus_verified_onedrive_file(f.path))) then
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
$function$;

create function public.qa_assert(ok boolean,label text) returns void language plpgsql as $$begin if not coalesce(ok,false) then raise exception 'QA failed: %',label;end if;end$$;
