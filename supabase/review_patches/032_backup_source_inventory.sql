-- Preserve the immutable file inventory while a partitioned backup is running.
-- Does not change business data, grants, recovery format or retention.
begin;
set local lock_timeout='5s';
create or replace function private.totus_guard_backup_source() returns trigger
language plpgsql security definer set search_path='' as $$
declare oldrow jsonb=to_jsonb(old); newrow jsonb; bucket text; path text;
begin
 if tg_op='UPDATE' then
  newrow=to_jsonb(new);
  if tg_table_schema='storage' then
   if (newrow->'bucket_id') is not distinct from (oldrow->'bucket_id')
    and (newrow->'name') is not distinct from (oldrow->'name')
    and (newrow->'metadata') is not distinct from (oldrow->'metadata')
    and (newrow->'version') is not distinct from (oldrow->'version') then return new;end if;
  elsif newrow->'storage_path' is not distinct from oldrow->'storage_path'
   and newrow->'size_bytes' is not distinct from oldrow->'size_bytes'
   and (newrow->'sha256' is not distinct from oldrow->'sha256' or (coalesce(oldrow->>'sha256','')='' and coalesce(newrow->>'sha256','') ~ '^[a-f0-9]{64}$'))
   and (tg_table_name<>'ops_chat_files' or newrow->'status' is not distinct from oldrow->'status') then return new;
  end if;
 end if;
 bucket=case when tg_table_schema='storage' then oldrow->>'bucket_id' else 'business-documents' end;
 path=case when tg_table_schema='storage' then oldrow->>'name' else oldrow->>'storage_path' end;
 if bucket in ('business-documents','business-assets') and coalesce(path,'')<>'' then
  perform pg_advisory_xact_lock(hashtextextended('totus-backup-source-inventory',0));
  if exists(select 1 from public.ops_backup_work w join public.ops_backup_runs r on r.id=w.run_id
   where r.status='running' and coalesce(w.snapshot->'storage'->bucket,'[]'::jsonb) ? path) then
   raise exception 'Este archivo está incluido en una copia en curso. Espera a que termine para sustituirlo o eliminarlo; el resto del trabajo puede continuar.';
  end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function private.totus_guard_backup_source() from public,anon,authenticated,service_role;
drop trigger if exists totus_backup_source_guard on public.ops_documents;
create trigger totus_backup_source_guard before update or delete on public.ops_documents for each row execute function private.totus_guard_backup_source();
drop trigger if exists totus_backup_source_guard on public.ops_chat_files;
create trigger totus_backup_source_guard before update or delete on public.ops_chat_files for each row execute function private.totus_guard_backup_source();
drop trigger if exists totus_backup_source_guard on storage.objects;
create trigger totus_backup_source_guard before update or delete on storage.objects for each row execute function private.totus_guard_backup_source();
do $patch$
declare definition text; marker text='captured=public.totus_export_recovery_snapshot();';
begin
 definition=pg_get_functiondef('public.totus_backup_capture_snapshot(uuid,uuid)'::regprocedure);
 if strpos(definition,'totus-backup-source-inventory')=0 then
  if strpos(definition,marker)=0 then raise exception 'La captura ha cambiado; revisar antes de instalar.';end if;
  execute replace(definition,marker,'perform pg_advisory_xact_lock(hashtextextended(''totus-backup-source-inventory'',0));'||chr(10)||' '||marker);
 end if;
end $patch$;
commit;
