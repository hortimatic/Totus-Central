begin;
create function private.totus_test_reject_link_sync() returns trigger language plpgsql as $$
begin
 if old.notes='QA_SYNC_FAIL' and new.linked_entity_id is not null then raise exception 'QA injected link failure';end if;
 return new;
end $$;
create trigger zz_qa_reject_link_sync before update of linked_entity_id on public.ops_documents
 for each row execute function private.totus_test_reject_link_sync();
do $$
declare actor uuid; email text; shop uuid; first_doc uuid; second_doc uuid; expense uuid;
 rejected boolean; before_count bigint;
begin
 select p.id,p.email into actor,email from public.profiles p join public.team_members t
  on lower(t.email)=lower(p.email) where t.active and t.role='admin' limit 1;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'email',email,'role','authenticated')::text,true);
 select id into shop from public.ops_stores where active order by code limit 1;
 insert into public.ops_documents(storage_path,original_name,uploaded_by) values('qa/first.txt','first.txt',actor) returning id into first_doc;
 insert into public.ops_documents(storage_path,original_name,uploaded_by) values('qa/second.txt','second.txt',actor) returning id into second_doc;
 insert into public.ops_expenses(store_id,expense_date,supplier_name,document_id)
  values(shop,current_date,'ATOMIC LINK ROLLBACK QA',first_doc) returning id into expense;
 if not exists(select 1 from public.ops_documents where id=first_doc and linked_entity_id=expense and linked_entity_type='expense') then raise exception 'Expense link not synchronized';end if;
 update public.ops_expenses set document_id=second_doc where id=expense;
 if not exists(select 1 from public.ops_documents where id=first_doc and linked_entity_id is null and linked_entity_type='') then raise exception 'Old file was not retained and unlinked';end if;
 if not exists(select 1 from public.ops_documents where id=second_doc and linked_entity_id=expense) then raise exception 'Replacement link missing';end if;
 delete from public.ops_expenses where id=expense;
 if not exists(select 1 from public.ops_documents where id=second_doc and linked_entity_id is null) then raise exception 'Delete did not retain and unlink original';end if;
 update public.ops_documents set notes='QA_SYNC_FAIL' where id=first_doc;
 select count(*) into before_count from public.ops_expenses;
 rejected=false;
 begin insert into public.ops_expenses(store_id,expense_date,supplier_name,document_id)
  values(shop,current_date,'ATOMIC LINK FAILURE QA',first_doc);
 exception when raise_exception then rejected=true;end;
 if not rejected or (select count(*) from public.ops_expenses)<>before_count then raise exception 'Link failure left a partial expense';end if;
 if (select linked_entity_id is not null from public.ops_documents where id=first_doc) then raise exception 'Link failure left a partial document';end if;
end $$;
select 'OK: link, replacement and delete are atomic; injected link failure rolls back the financial row' as result;
rollback;
