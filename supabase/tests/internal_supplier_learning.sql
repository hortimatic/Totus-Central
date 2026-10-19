begin;
do $test$
declare store uuid; expense uuid;
begin
 select id into store from public.ops_stores order by name limit 1;
 if store is null then raise exception 'Test requires a store fixture'; end if;
 insert into public.ops_expenses(store_id,expense_date,supplier_name,document_kind,management_only)
 values(store,current_date,'QA unstructured internal label','otro',true) returning id into expense;
 if exists(select 1 from public.ops_suppliers where name='QA unstructured internal label')
    or (select supplier_id from public.ops_expenses where id=expense) is not null then
  raise exception 'An unstructured internal label must not become a supplier';
 end if;
 insert into public.ops_expenses(store_id,expense_date,supplier_name,document_kind,management_only)
 values(store,current_date,'QA real supplier learning','factura',false) returning id into expense;
 if (select supplier_id from public.ops_expenses where id=expense) is null then
  raise exception 'Regular supplier learning must continue to work';
 end if;
end $test$;
rollback;
