set statement_timeout='8s';
do $test$
declare snapshot jsonb; original_maps bigint; job_id uuid=gen_random_uuid(); actor record; checkpoint text; result jsonb;
begin
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 snapshot=public.totus_export_recovery_snapshot();
 select count(*) into original_maps from public.ops_onedrive_documents;
 select u.id,lower(u.email) as email into actor from auth.users u join public.team_members t on lower(t.email)=lower(u.email) where t.active and t.role='admin' limit 1;
 select storage_path into checkpoint from public.ops_backup_runs where status='success' and archive_manifest->>'version'='3' order by started_at desc limit 1;
 if actor.id is null or checkpoint is null then raise exception 'Test requires an administrator and a complete checkpoint'; end if;
 begin
  insert into public.ops_recovery_jobs(id,requested_by,requested_email,source_path,status,checkpoint_path,before_revision)
  values(job_id,actor.id,actor.email,'simulaciones/solo-sql.totusbackup','prepared',checkpoint,snapshot->>'revision');
  result=public.totus_commit_recovery(job_id,snapshot->'database',snapshot);
  if (select count(*) from public.ops_onedrive_documents)<>original_maps then raise exception 'OneDrive mappings were not preserved'; end if;
  if exists(select 1 from public.ops_onedrive_documents m left join public.ops_documents d on d.id=m.document_id and d.storage_path=m.source_path and d.sha256=m.sha256 and d.size_bytes=m.size_bytes where d.id is null) then raise exception 'Recovered mapping integrity failed'; end if;
  if (select count(*) from public.ops_documents)<>jsonb_array_length(snapshot->'database'->'ops_documents') then raise exception 'Recovered document count differs'; end if;
  raise exception '__ROLLBACK_TEST_SUCCESS__';
 exception when others then
  if sqlerrm<>'__ROLLBACK_TEST_SUCCESS__' then raise; end if;
 end;
 if exists(select 1 from public.ops_recovery_jobs where id=job_id) or (select count(*) from public.ops_onedrive_documents)<>original_maps then raise exception 'Rollback test left changes'; end if;
end $test$;