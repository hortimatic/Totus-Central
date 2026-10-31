-- Isolated CI only; no real identities or documents.
create table public.ops_documents(id uuid primary key,storage_path text,size_bytes bigint,sha256 text,notes text);
create schema storage;
create table storage.objects(bucket_id text,name text,metadata jsonb,version text,last_accessed_at timestamptz);
alter table public.ops_backup_work add column lease_until timestamptz,add column updated_at timestamptz not null default now();
create function public.totus_export_recovery_snapshot() returns jsonb language sql as $$select jsonb_build_object('database','{}'::jsonb,'revision',repeat('a',64),'identities','[]'::jsonb,'storage',jsonb_build_object('business-documents',jsonb_build_array('qa/old.pdf'),'business-assets',jsonb_build_array('qa/logo.png')))$$;
\i supabase/review_patches/026_backup_snapshot_staging.sql
\i supabase/review_patches/027_backup_capture_deadline.sql
\i supabase/review_patches/032_backup_source_inventory.sql
begin;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into public.ops_documents values('55555555-5555-4555-8555-555555555555','qa/old.pdf',3,repeat('a',64),'before');
insert into storage.objects values('business-documents','qa/old.pdf','{"size":3}','v1',now()),('business-assets','qa/logo.png','{"size":3}','v1',now());
insert into public.ops_backup_runs(id,status) values('44444444-4444-4444-8444-444444444444','running');
select public.totus_backup_capture_snapshot('44444444-4444-4444-8444-444444444444','66666666-6666-4666-8666-666666666666');
select public.qa_denied($q$delete from public.ops_documents where storage_path='qa/old.pdf'$q$,'copia en curso');
select public.qa_denied($q$update public.ops_documents set storage_path='qa/new.pdf' where storage_path='qa/old.pdf'$q$,'copia en curso');
select public.qa_denied($q$update public.ops_documents set sha256=repeat('b',64) where storage_path='qa/old.pdf'$q$,'copia en curso');
select public.qa_denied($q$delete from storage.objects where name='qa/old.pdf'$q$,'copia en curso');
select public.qa_denied($q$update storage.objects set version='v2' where name='qa/logo.png'$q$,'copia en curso');
update public.ops_documents set notes='Metadata edits remain available' where storage_path='qa/old.pdf';
update storage.objects set last_accessed_at=now()+interval '1 second' where name='qa/old.pdf';
insert into public.ops_documents values('77777777-7777-4777-8777-777777777777','qa/new.pdf',3,repeat('c',64),'new documents remain available');
delete from public.ops_documents where storage_path='qa/new.pdf';
select public.qa_assert((select notes from public.ops_documents where storage_path='qa/old.pdf')='Metadata edits remain available','ordinary document work remains available');
select public.qa_assert((select proconfig @> array['statement_timeout=30s','lock_timeout=5s'] from pg_proc where oid='public.totus_backup_capture_snapshot(uuid,uuid)'::regprocedure),'capture deadlines preserved');
select public.qa_assert(not has_function_privilege('authenticated','public.totus_backup_capture_snapshot(uuid,uuid)','execute'),'no new client capture permission');
update public.ops_backup_runs set status='success';
delete from public.ops_documents where storage_path='qa/old.pdf';
delete from storage.objects;
select public.qa_assert(not exists(select 1 from public.ops_documents),'source releases after confirmed completion');
rollback;
