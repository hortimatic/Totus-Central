set statement_timeout='3s';
do $test$
declare payload jsonb; changed jsonb; doc_id uuid; job_id uuid=gen_random_uuid();
begin
 payload=private.totus_recovery_dataset();
 if not private.totus_recovery_files_ready(payload,job_id) then raise exception 'Current files rejected'; end if;
 changed=jsonb_set(payload,'{ops_documents,0,sha256}',to_jsonb(repeat('0',64)));
 if private.totus_recovery_files_ready(changed,job_id) then raise exception 'Changed SHA accepted'; end if;
 changed=jsonb_set(payload,'{ops_documents,0,size_bytes}',to_jsonb(1::bigint));
 if private.totus_recovery_files_ready(changed,job_id) then raise exception 'Changed size accepted'; end if;
 changed=jsonb_set(payload,'{ops_documents,0,storage_path}',to_jsonb('recovery/'||job_id::text||'/missing.pdf'));
 if private.totus_recovery_files_ready(changed,job_id) then raise exception 'Missing prepared file accepted'; end if;
 doc_id=(payload->'ops_documents'->0->>'id')::uuid;
 begin
  update public.ops_onedrive_documents set size_bytes=size_bytes+1 where document_id=doc_id;
  if private.totus_recovery_files_ready(payload,job_id) then raise exception 'Stale cloud mapping accepted'; end if;
  raise exception '__EXPECTED_ROLLBACK__';
 exception when others then if sqlerrm<>'__EXPECTED_ROLLBACK__' then raise; end if; end;
 if not private.totus_recovery_files_ready(payload,job_id) then raise exception 'Test did not roll back'; end if;
end $test$;