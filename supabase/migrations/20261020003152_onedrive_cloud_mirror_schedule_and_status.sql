alter table public.ops_onedrive_config add column mirror_lock_until timestamptz, add column mirror_last_attempt timestamptz, add column mirror_last_error text;
create or replace function public.totus_onedrive_mirror_tick() returns bigint language plpgsql security definer set search_path='' as $$
declare request_id bigint;
begin
 if not exists(select 1 from public.ops_onedrive_config where id=1 and connected and tested_at is not null and (mirror_lock_until is null or mirror_lock_until<now())) then return null; end if;
 if not exists(select 1 from public.ops_documents d left join public.ops_onedrive_documents m on m.document_id=d.id where coalesce(d.storage_path,'')<>'' and (m.document_id is null or m.source_path<>d.storage_path or m.size_bytes<>d.size_bytes or (d.sha256 is not null and m.sha256<>d.sha256))) then return null; end if;
 select net.http_post(url:='https://awmojepsasikxocoeqtu.supabase.co/functions/v1/totus-onedrive',headers:=jsonb_build_object('Content-Type','application/json','x-totus-backup-job',(select decrypted_secret from vault.decrypted_secrets where name='totus_staging_backup_cron_secret')),body:='{"action":"mirror-documents"}'::jsonb,timeout_milliseconds:=120000) into request_id;
 return request_id;
end $$;
revoke all on function public.totus_onedrive_mirror_tick() from public,anon,authenticated;
grant execute on function public.totus_onedrive_mirror_tick() to service_role;
select cron.schedule('totus-onedrive-mirror-every-two-minutes','*/2 * * * *','select public.totus_onedrive_mirror_tick();');