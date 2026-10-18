-- These columns mirror the authoritative financial FK. Keep both sides in the
-- same transaction; the browser must never finish the association afterwards.
create function private.totus_sync_document_link() returns trigger
language plpgsql security definer set search_path='' as $$
declare old_document uuid; new_document uuid; owner_id uuid;
begin
 if tg_op<>'INSERT' then old_document=nullif(to_jsonb(old)->>tg_argv[0],'')::uuid;owner_id=old.id;end if;
 if tg_op<>'DELETE' then new_document=nullif(to_jsonb(new)->>tg_argv[0],'')::uuid;owner_id=new.id;end if;
 if old_document is not null and old_document is distinct from new_document then
  update public.ops_documents set linked_entity_id=null,linked_entity_type=''
   where id=old_document and linked_entity_id=owner_id and linked_entity_type=tg_argv[1];
 end if;
 if new_document is not null then
  update public.ops_documents set linked_entity_id=owner_id,linked_entity_type=tg_argv[1]
   where id=new_document and (linked_entity_id,linked_entity_type) is distinct from (owner_id,tg_argv[1]);
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end;
$$;
revoke all on function private.totus_sync_document_link() from public,anon,authenticated;
create trigger totus_sync_expense_document after insert or update of document_id or delete on public.ops_expenses
 for each row execute function private.totus_sync_document_link('document_id','expense');
create trigger totus_sync_invoice_document after insert or update of source_document_id or delete on public.ops_sales_invoices
 for each row execute function private.totus_sync_document_link('source_document_id','sales_invoice');
