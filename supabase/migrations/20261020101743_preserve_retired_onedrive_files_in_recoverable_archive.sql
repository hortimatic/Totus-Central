alter table public.ops_onedrive_cleanup add column archived_at timestamptz,add column archived_path text,add column resolution text,add column size_bytes bigint,add column sha256 text;
create index ops_onedrive_cleanup_pending on public.ops_onedrive_cleanup(created_at) where archived_at is null;
create or replace function private.totus_queue_retired_onedrive_document()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.ops_onedrive_cleanup(document_id,onedrive_path,onedrive_item_id,size_bytes,sha256)
 select document_id,onedrive_path,onedrive_item_id,size_bytes,sha256 from public.ops_onedrive_documents
 where document_id=old.id on conflict(onedrive_item_id) do nothing;
 if tg_op='UPDATE' then
  delete from public.ops_onedrive_documents where document_id=old.id and source_path=old.storage_path;
  return new;
 end if;
 return old;
end;
$$;
revoke all on function private.totus_queue_retired_onedrive_document() from public,anon,authenticated;
CREATE OR REPLACE FUNCTION public.totus_onedrive_mirror_tick()
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare request_id bigint;
begin
 if not exists(select 1 from public.ops_onedrive_config where id=1 and connected and tested_at is not null and (mirror_lock_until is null or mirror_lock_until<now())) then return null; end if;
 if not exists(select 1 from public.ops_documents d left join public.ops_onedrive_documents m on m.document_id=d.id where coalesce(d.storage_path,'')<>'' and (m.document_id is null or m.source_path<>d.storage_path or m.size_bytes<>d.size_bytes or (d.sha256 is not null and m.sha256<>d.sha256))) and not exists(select 1 from public.ops_onedrive_cleanup where archived_at is null) then return null; end if;
 select net.http_post(url:='https://awmojepsasikxocoeqtu.supabase.co/functions/v1/totus-onedrive',headers:=jsonb_build_object('Content-Type','application/json','x-totus-backup-job',(select decrypted_secret from vault.decrypted_secrets where name='totus_staging_backup_cron_secret')),body:='{"action":"mirror-documents"}'::jsonb,timeout_milliseconds:=120000) into request_id;
 return request_id;
end $function$

