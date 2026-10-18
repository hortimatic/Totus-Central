-- Storage rules must protect historical PDFs/logos even when the caller cannot
-- read the billing module. The private helper returns only a boolean.
create function private.totus_issued_file_locked(p_bucket text,p_path text)
returns boolean language sql stable security definer set search_path='' as $$
 select case p_bucket
 when 'business-documents' then exists(
  select 1 from public.ops_documents d join public.ops_sales_invoices i
   on d.id in (i.source_document_id,i.generated_document_id)
  where i.status<>'borrador' and d.storage_path=p_path)
 when 'business-assets' then exists(
  select 1 from public.ops_sales_invoices i where i.status<>'borrador'
   and jsonb_path_exists(jsonb_build_array(i.template_snapshot,i.design_snapshot),
    'lax $.**.logo_path ? (@ == $path)',jsonb_build_object('path',p_path)))
 else false end;
$$;
revoke all on function private.totus_issued_file_locked(text,text) from public,anon;
grant execute on function private.totus_issued_file_locked(text,text) to authenticated,service_role;

create policy totus_issued_files_delete_lock on storage.objects as restrictive
 for delete to authenticated using(not private.totus_issued_file_locked(bucket_id,name));
create policy totus_issued_files_update_lock on storage.objects as restrictive
 for update to authenticated using(not private.totus_issued_file_locked(bucket_id,name))
 with check(not private.totus_issued_file_locked(bucket_id,name));

create function private.totus_guard_issued_document_file() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' or (new.storage_path,new.original_name,new.mime_type,new.size_bytes,new.sha256)
  is distinct from (old.storage_path,old.original_name,old.mime_type,old.size_bytes,old.sha256) then
  if exists(select 1 from public.ops_sales_invoices i where i.status<>'borrador'
    and old.id in (i.source_document_id,i.generated_document_id)) then
   raise exception 'El archivo original de una factura emitida se conserva. Utiliza una rectificativa para corregir la factura';
  end if;
 end if;
 if tg_op='DELETE' then return old;end if;
 return new;
end;
$$;
revoke all on function private.totus_guard_issued_document_file() from public,anon,authenticated;
create trigger totus_guard_issued_document_file before update or delete on public.ops_documents
 for each row execute function private.totus_guard_issued_document_file();
