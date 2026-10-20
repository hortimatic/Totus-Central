
create or replace function public.totus_onedrive_mirror_tick()
returns bigint language plpgsql security definer set search_path='' as $f$
declare c public.ops_onedrive_config; request_id bigint; target text; body jsonb; backup_id uuid;
begin
 select * into c from public.ops_onedrive_config where id=1;
 if not found or not c.connected or c.tested_at is null then return null; end if;
 if (c.mirror_lock_until is null or c.mirror_lock_until<now()) and
  (exists(select 1 from public.ops_documents d left join public.ops_onedrive_documents m on m.document_id=d.id
   where coalesce(d.storage_path,'')<>'' and (m.document_id is null or m.source_path<>d.storage_path or m.size_bytes<>d.size_bytes or (d.sha256 is not null and m.sha256<>d.sha256)))
   or exists(select 1 from public.ops_onedrive_cleanup where archived_at is null)) then
  target='totus-onedrive';body='{"action":"mirror-documents"}'::jsonb;
 elsif (c.backup_mirror_lock_until is null or c.backup_mirror_lock_until<now()) and exists(
  select 1 from public.ops_backup_runs r left join public.ops_onedrive_backups m on m.run_id=r.id
  where r.status='success' and r.archive_manifest->>'version'='3'
   and (m.verified_at is null or m.archive_sha256 is distinct from r.archive_sha256)) then
  target='totus-onedrive';body='{"action":"mirror-backups","full":true}'::jsonb;
 elsif (c.backup_mirror_lock_until is null or c.backup_mirror_lock_until<now()) and exists(
  select 1 from public.ops_onedrive_backups m join public.ops_backup_runs r on r.id=m.run_id
  where r.status in ('expired','failed') and m.created_at<now()-interval '15 minutes'
   and not exists(select 1 from public.ops_recovery_jobs j where j.source_path=m.source_path or j.checkpoint_path=m.source_path)
 ) and exists(select 1 from public.ops_onedrive_backups m join public.ops_backup_runs r on r.id=m.run_id where r.status='success' and m.verified_at is not null) then
  target='totus-onedrive';body='{"action":"prune-backups"}'::jsonb;
 elsif c.retirement_lock_until is null or c.retirement_lock_until<now() then
  select r.id into backup_id from public.ops_backup_runs r join public.ops_onedrive_backups m on m.run_id=r.id
   where r.status='success' and r.storage_provider='supabase' and r.archive_manifest->>'version'='3'
    and m.verified_at is not null and m.archive_sha256=r.archive_sha256 and r.size_bytes>8388608
   order by r.started_at desc limit 1;
  if backup_id is not null then
   target='totus-backup-run';body=jsonb_build_object('mode','scheduled','action','retire-backup-parts','id',backup_id);
  elsif exists(select 1 from public.ops_onedrive_documents m where m.retired_from_supabase_at is null and exists(
   select 1 from public.ops_backup_runs r join public.ops_onedrive_backups b on b.run_id=r.id
    where r.status='success' and b.verified_at is not null and r.archive_manifest->'integrity'->'storage'->'business-documents'->>m.source_path=m.sha256)) then
   target='totus-backup-run';body='{"mode":"scheduled","action":"retire-documents"}'::jsonb;
  end if;
 end if;
 if target is null then return null; end if;
 select net.http_post(url:='https://awmojepsasikxocoeqtu.supabase.co/functions/v1/'||target,
 headers:=jsonb_build_object('Content-Type','application/json','x-totus-backup-job',(select decrypted_secret from vault.decrypted_secrets where name='totus_staging_backup_cron_secret')),
 body:=body,timeout_milliseconds:=120000) into request_id;
 return request_id;
end $f$;
revoke all on function public.totus_onedrive_mirror_tick() from public,anon,authenticated;
grant execute on function public.totus_onedrive_mirror_tick() to service_role;
