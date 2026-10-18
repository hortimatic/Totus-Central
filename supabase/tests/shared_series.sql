-- Run against staging with an existing administrator and shared invoice series.
-- Every invoice, number allocation and audit entry is rolled back.
begin;
do $$
declare admin_id uuid; admin_email text; common_id uuid; start_number integer; shop record;
        draft public.ops_sales_invoices; issued public.ops_sales_invoices;
        template_id uuid; i integer:=0;
begin
 select p.id,p.email into admin_id,admin_email from public.profiles p join public.team_members t on lower(t.email)=lower(p.email) where t.role='admin' and t.active limit 1;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'email',admin_email,'role','authenticated')::text,true);
 select id,next_number into common_id,start_number from public.ops_invoice_series
 where active and store_id is null and document_type='factura' and series_kind='invoice'
 and year=extract(year from current_date) order by code limit 1;
 if common_id is null then raise exception 'Shared series required'; end if;
 for shop in select id from public.ops_stores where active order by code loop
  select id into template_id from public.ops_document_templates where store_id=shop.id and default_invoice and active limit 1;
  select * into draft from public.totus_save_sales_document(
    jsonb_build_object('series_id',common_id,'store_id',shop.id,'issue_date',current_date,
      'origin','totus','document_type','factura','invoice_kind','invoice','customer_name','SHARED SERIES ROLLBACK QA',
      'paid_status','pendiente','paid_amount',0,'template_id',template_id),
    jsonb_build_array(jsonb_build_object('description','Synthetic service','quantity',1,'unit_price_base',10,'vat_rate',21,'discount_pct',0)));
  select * into issued from public.totus_finalize_sales_document(draft.id);
  if issued.number<>start_number+i then raise exception 'Shops did not share consecutive numbers'; end if;
  if issued.template_snapshot->'issuer'->>'business_name' is distinct from
     (select business_name from public.ops_business_settings where id=1) then raise exception 'Issuer not frozen'; end if;
  if issued.template_snapshot->>'logo_path' is distinct from
     (select logo_path from public.ops_document_templates where id=template_id) then raise exception 'Shop logo not frozen'; end if;
  i:=i+1;
 end loop;
 if i<>2 then raise exception 'Expected two shops'; end if;
 if (select next_number from public.ops_invoice_series where id=common_id)<>start_number+2 then raise exception 'Unexpected counter'; end if;
end;
$$;
rollback;
