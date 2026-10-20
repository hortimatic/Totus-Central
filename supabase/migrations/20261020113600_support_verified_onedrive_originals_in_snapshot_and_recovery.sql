
create or replace function private.totus_verified_onedrive_file(p_path text,p_payload jsonb default null)
returns boolean language sql stable set search_path='' as $f$
select exists(
 select 1 from public.ops_documents d join public.ops_onedrive_documents m on m.document_id=d.id
 where d.storage_path=p_path and m.source_path=d.storage_path and m.size_bytes=d.size_bytes
 and nullif(d.sha256,'') is not null and m.sha256=d.sha256 and m.verified_at is not null
 and (p_payload is null or exists(select 1 from jsonb_array_elements(p_payload->'ops_documents') saved
 where saved->>'storage_path'=d.storage_path and saved->>'sha256'=d.sha256 and (saved->>'size_bytes')::bigint=d.size_bytes))
);
$f$;
revoke all on function private.totus_verified_onedrive_file(text,jsonb) from public,anon,authenticated;
do $migration$
declare definition text; needle text; replacement text;
begin
 definition=pg_get_functiondef('public.totus_export_recovery_snapshot()'::regprocedure);
 needle='on o.bucket_id=f.bucket and o.name=f.path where o.id is null)';
 replacement='on o.bucket_id=f.bucket and o.name=f.path where o.id is null and not (f.bucket=''business-documents'' and private.totus_verified_onedrive_file(f.path)))';
 if position(needle in definition)=0 then raise exception 'Unexpected snapshot guard'; end if;
 execute replace(definition,needle,replacement);
 definition=pg_get_functiondef('public.totus_commit_recovery(uuid,jsonb,jsonb)'::regprocedure);
 needle='where o.id is null or (f.path not like';
 replacement='where (o.id is null and not (f.bucket=''business-documents'' and private.totus_verified_onedrive_file(f.path,p_payload))) or (f.path not like';
 if position(needle in definition)=0 then raise exception 'Unexpected recovery file guard'; end if;
 definition=replace(definition,needle,replacement);
 needle='expected jsonb; counts jsonb=';
 if position(needle in definition)=0 then raise exception 'Unexpected recovery declarations'; end if;
 definition=replace(definition,needle,'onedrive_before jsonb; expected jsonb; counts jsonb=');
 needle=' select string_agg(format(''public.%I'',t),'','') into truncate_sql from unnest(tabs) t;';
 replacement=' select coalesce(jsonb_agg(to_jsonb(m)),''[]''::jsonb) into onedrive_before from public.ops_onedrive_documents m;'||chr(10)||needle;
 if position(needle in definition)=0 then raise exception 'Unexpected recovery truncate guard'; end if;
 definition=replace(definition,needle,replacement);
 needle=' after_data=private.totus_recovery_dataset();';
 replacement=$restore$
 insert into public.ops_onedrive_documents(document_id,source_path,onedrive_path,onedrive_item_id,size_bytes,sha256,verified_at,retired_from_supabase_at)
 select d.id,m.source_path,m.onedrive_path,m.onedrive_item_id,m.size_bytes,m.sha256,m.verified_at,m.retired_from_supabase_at
 from jsonb_populate_recordset(null::public.ops_onedrive_documents,onedrive_before) m
 join public.ops_documents d on d.storage_path=m.source_path and d.sha256=m.sha256 and d.size_bytes=m.size_bytes
 where m.verified_at is not null
 on conflict(document_id) do nothing;
 insert into public.ops_onedrive_cleanup(document_id,onedrive_path,onedrive_item_id,size_bytes,sha256)
 select m.document_id,m.onedrive_path,m.onedrive_item_id,m.size_bytes,m.sha256
 from jsonb_populate_recordset(null::public.ops_onedrive_documents,onedrive_before) m
 where not exists(select 1 from public.ops_onedrive_documents live where live.onedrive_item_id=m.onedrive_item_id)
 on conflict(onedrive_item_id) do nothing;
 after_data=private.totus_recovery_dataset();
$restore$;
 if position(needle in definition)=0 then raise exception 'Unexpected recovery verification guard'; end if;
 execute replace(definition,needle,replacement);
end;
$migration$;
