-- Only the authenticated server writes these proofs; client access stays read-only.
alter table public.ops_backup_runs add column snapshot_revision text;
alter table public.ops_backup_runs add column archive_sha256 text;
alter table public.ops_backup_runs add column archive_manifest jsonb;

create function private.totus_reusable_live_file(p_bucket text,p_path text,p_payload jsonb) returns boolean
language sql stable security invoker set search_path='' as $$
 select case when p_bucket='business-documents' then exists (
  select 1 from public.ops_documents live join jsonb_array_elements(p_payload->'ops_documents') saved
   on saved->>'storage_path'=live.storage_path and saved->>'sha256'=live.sha256
  where live.storage_path=p_path and nullif(live.sha256,'') is not null)
 when p_bucket='business-assets' then exists (
  select 1 from private.totus_recovery_file_refs(jsonb_build_object(
   'ops_documents','[]'::jsonb,
   'ops_document_templates',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.ops_document_templates t),
   'ops_sales_invoices',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.ops_sales_invoices t),
   'ops_business_settings',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.ops_business_settings t))) f
  where f.bucket=p_bucket and f.path=p_path)
 else false end;
$$;
revoke all on function private.totus_reusable_live_file(text,text,jsonb) from public,anon,authenticated;

-- Retain the service-only coordinator, identity checks, revision fence, atomic
-- transaction and trigger restoration. Reuse is restricted to currently linked
-- originals; the server additionally compares their verified checkpoint hashes.
do $$
declare definition text; needle text='o.id is null or f.path not like ''recovery/''||p_job::text||''/%''';
begin
 select pg_get_functiondef('public.totus_commit_recovery(uuid,jsonb,jsonb)'::regprocedure) into definition;
 if position(needle in definition)=0 then raise exception 'Recovery file guard not found'; end if;
 execute replace(definition,needle,'o.id is null or (f.path not like ''recovery/''||p_job::text||''/%'' and not private.totus_reusable_live_file(f.bucket,f.path,p_payload))');
end $$;

-- Serialize claims through the existing configuration-row lock. A worker cannot
-- run beyond 150 seconds on this project; stale executions are never called good.
do $$
declare definition text; needle text='IF NOT FOUND THEN RAISE EXCEPTION ''Falta configuración''; END IF;';
begin
 select pg_get_functiondef('public.totus_backup_claim(text)'::regprocedure) into definition;
 if position(needle in definition)=0 then raise exception 'Backup claim guard not found'; end if;
 execute replace(definition,needle,needle||$body$
 IF EXISTS(select 1 from public.ops_backup_runs where status='running' and started_at>now()-interval '3 minutes') THEN RETURN null; END IF;
 UPDATE public.ops_backup_runs SET status='failed',finished_at=now(),error_message='La ejecución no terminó dentro del plazo del servidor; se conserva la última copia verificada.'
 WHERE status='running' and started_at<=now()-interval '3 minutes';
 $body$);
end $$;
