
create or replace function private.totus_recovery_files_ready(p_payload jsonb,p_job uuid)
returns boolean language sql stable set search_path='' as $f$
with saved_docs as materialized (
 select * from jsonb_to_recordset(p_payload->'ops_documents') as d(storage_path text,sha256 text,size_bytes bigint)
), refs as materialized (
 select * from private.totus_recovery_file_refs(p_payload)
), reusable_docs as materialized (
 select live.storage_path from public.ops_documents live join saved_docs saved
 on saved.storage_path=live.storage_path and saved.sha256=live.sha256 and saved.size_bytes=live.size_bytes
 where nullif(live.sha256,'') is not null
), cloud_docs as materialized (
 select live.storage_path from public.ops_documents live join saved_docs saved
 on saved.storage_path=live.storage_path and saved.sha256=live.sha256 and saved.size_bytes=live.size_bytes
 join public.ops_onedrive_documents m on m.document_id=live.id and m.source_path=live.storage_path
 and m.sha256=live.sha256 and m.size_bytes=live.size_bytes and m.verified_at is not null
), live_assets as materialized (
 select f.path from private.totus_recovery_file_refs(jsonb_build_object(
 'ops_documents','[]'::jsonb,
 'ops_document_templates',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.ops_document_templates t),
 'ops_sales_invoices',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.ops_sales_invoices t),
 'ops_business_settings',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.ops_business_settings t))) f
 where f.bucket='business-assets'
)
select not exists(
 select 1 from refs f left join storage.objects o on o.bucket_id=f.bucket and o.name=f.path
 where not (
 (o.id is not null or (f.bucket='business-documents' and exists(select 1 from cloud_docs c where c.storage_path=f.path)))
 and (f.path like 'recovery/'||p_job::text||'/%'
 or (f.bucket='business-documents' and exists(select 1 from reusable_docs d where d.storage_path=f.path))
 or (f.bucket='business-assets' and exists(select 1 from live_assets a where a.path=f.path)))
 )
);
$f$;
revoke all on function private.totus_recovery_files_ready(jsonb,uuid) from public,anon,authenticated;
do $migration$
declare definition text; start_at int; end_at int;
begin
 definition=pg_get_functiondef('public.totus_commit_recovery(uuid,jsonb,jsonb)'::regprocedure);
 start_at=strpos(definition,' if exists(select 1 from private.totus_recovery_file_refs(p_payload) f left join storage.objects o');
 end_at=strpos(definition,'  raise exception ''Hay archivos de la copia que no han sido preparados'';');
 if start_at=0 or end_at<=start_at then raise exception 'Unexpected recovery file validation block'; end if;
 definition=substring(definition from 1 for start_at-1)||' if not private.totus_recovery_files_ready(p_payload,p_job) then'||chr(10)||substring(definition from end_at);
 execute definition;
end $migration$;
