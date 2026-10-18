-- Real SQL/RLS guard checks. No physical Storage metadata is inserted or deleted.
begin;
do $$
declare actor uuid; email text; shop uuid; series uuid; document uuid; invoice uuid;
 rejected boolean; path text='qa-rollback/issued-original.pdf'; logo text;
begin
 select p.id,p.email into actor,email from public.profiles p join public.team_members t
  on lower(t.email)=lower(p.email) where t.active and t.role='admin' limit 1;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email',email,'role','authenticated')::text,true);
 select id into shop from public.ops_stores where active order by code limit 1;
 select id into series from public.ops_invoice_series where active and store_id is null
  and document_type='factura' and series_kind='invoice' and year=extract(year from current_date) limit 1;
 insert into public.ops_documents(storage_path,original_name,mime_type,size_bytes,uploaded_by)
  values(path,'issued-original.pdf','application/pdf',50,actor) returning id into document;
 invoice=public.totus_save_sales_document(jsonb_build_object('store_id',shop,'series_id',series,
  'issue_date',current_date,'document_type','factura','invoice_kind','invoice','origin','totus',
  'customer_name','FILE INTEGRITY ROLLBACK QA','source_document_id',document,'paid_status','pendiente','paid_amount',0),
  '[{"description":"Synthetic service","quantity":1,"unit_price_base":10,"discount_pct":0,"vat_rate":21}]');
 if private.totus_issued_file_locked('business-documents',path) then raise exception 'Draft incorrectly frozen';end if;
 if not exists(select 1 from public.ops_documents where id=document and linked_entity_id=invoice and linked_entity_type='sales_invoice') then raise exception 'Invoice source link not synchronized';end if;
 perform public.totus_finalize_sales_document(invoice);
 if not private.totus_issued_file_locked('business-documents',path) then raise exception 'Issued PDF not protected';end if;
 select template_snapshot->>'logo_path' into logo from public.ops_sales_invoices where id=invoice;
 if logo is not null and not private.totus_issued_file_locked('business-assets',logo) then raise exception 'Historic logo not protected';end if;
 rejected=false;
 begin update public.ops_documents set storage_path='qa-rollback/changed.pdf' where id=document;
 exception when raise_exception then rejected=true;end;
 if not rejected then raise exception 'Issued original replaced';end if;
 rejected=false;
 begin delete from public.ops_documents where id=document;
 exception when raise_exception then rejected=true;end;
 if not rejected then raise exception 'Issued original removed';end if;
 update public.ops_documents set notes='Classification notes remain editable' where id=document;
 if private.totus_issued_file_locked('business-documents','unlinked.pdf') then raise exception 'Unlinked file frozen';end if;
 if (select count(*) from pg_policy where polrelid='storage.objects'::regclass
  and polname in ('totus_issued_files_delete_lock','totus_issued_files_update_lock') and not polpermissive)<>2 then
  raise exception 'Storage DELETE/UPDATE guards are not restrictive';end if;
end $$;
select 'OK: issued PDF metadata and frozen logos protected; drafts and notes remain editable' as result;
rollback;
