-- Totus Central · backup y almacenamiento limpio
-- No contiene Auth ni usuarios. Restaurar exige rol admin.

create or replace function private.totus_is_admin()
returns boolean
language sql stable security definer
set search_path='public'
as $$
  select exists(
    select 1
    from public.profiles p
    join public.team_members t on lower(t.email)=lower(coalesce(p.email,''))
    where p.id=auth.uid() and t.active=true and t.role='admin'
  );
$$;

create or replace function public.totus_storage_usage()
returns jsonb
language plpgsql security definer
set search_path='public,storage,private'
as $$
declare
  v_docs bigint:=0; v_assets bigint:=0;
  v_docs_count bigint:=0; v_assets_count bigint:=0;
  v_limit bigint:=524288000;
begin
  if not private.totus_is_team_member() then raise exception 'Sin acceso'; end if;
  select coalesce(sum(coalesce((metadata->>'size')::bigint,0)),0),count(*)
    into v_docs,v_docs_count from storage.objects where bucket_id='business-documents';
  select coalesce(sum(coalesce((metadata->>'size')::bigint,0)),0),count(*)
    into v_assets,v_assets_count from storage.objects where bucket_id='business-assets';
  select coalesce(storage_limit_bytes,524288000) into v_limit
    from public.ops_business_settings where id=1;
  return jsonb_build_object(
    'documents_bytes',v_docs,'documents_count',v_docs_count,
    'assets_bytes',v_assets,'assets_count',v_assets_count,
    'total_bytes',v_docs+v_assets,'limit_bytes',v_limit
  );
end;
$$;

create or replace function public.totus_restore_backup(p_payload jsonb,p_reason text)
returns jsonb
language plpgsql security definer
set search_path='public,private'
as $$
declare
  v_table text;
  v_required text[] := array[
    'ops_business_settings','ops_stores','ops_expense_categories','ops_cash_drawers','ops_invoice_series',
    'ops_suppliers','ops_customers','ops_document_templates','ops_documents','ops_daily_closings','ops_daily_closing_drawers',
    'ops_expenses','ops_expense_lines','ops_sales_invoices','ops_sales_invoice_lines','ops_tax_payments','ops_fiscal_adjustments','ops_income_adjustments','ops_reta_brackets','ops_audit_log',
    'brands','families','providers','products','product_variants','product_provider_prices','product_competitor_prices',
    'price_history','consultations','consultation_history'
  ];
begin
  if not private.totus_is_admin() then raise exception 'Solo administración puede restaurar copias'; end if;
  if nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'Motivo obligatorio'; end if;
  if jsonb_typeof(p_payload)<>'object' then raise exception 'Copia no válida'; end if;
  foreach v_table in array v_required loop
    if jsonb_typeof(p_payload->v_table)<>'array' then raise exception 'Falta o no es válida la tabla %',v_table; end if;
  end loop;
  if jsonb_array_length(p_payload->'ops_business_settings')=0 then raise exception 'La copia no contiene configuración'; end if;
  if jsonb_array_length(p_payload->'ops_stores')=0 then raise exception 'La copia no contiene establecimientos'; end if;
  if jsonb_array_length(p_payload->'ops_invoice_series')=0 then raise exception 'La copia no contiene series'; end if;

  update public.ops_sales_invoices set status='borrador' where status<>'borrador';

  delete from public.ops_business_settings;
  delete from public.consultation_history;
  delete from public.consultations;
  delete from public.price_history;
  delete from public.product_competitor_prices;
  delete from public.product_provider_prices;
  delete from public.product_variants;
  delete from public.products;
  delete from public.families;
  delete from public.brands;
  delete from public.providers;
  delete from public.ops_sales_invoice_lines;
  delete from public.ops_sales_invoices;
  delete from public.ops_expense_lines;
  delete from public.ops_expenses;
  delete from public.ops_daily_closing_drawers;
  delete from public.ops_daily_closings;
  delete from public.ops_audit_log;
  delete from public.ops_tax_payments;
  delete from public.ops_fiscal_adjustments;
  delete from public.ops_income_adjustments;
  delete from public.ops_reta_brackets;
  delete from public.ops_documents;
  delete from public.ops_document_templates;
  delete from public.ops_customers;
  delete from public.ops_suppliers;
  delete from public.ops_cash_drawers;
  delete from public.ops_invoice_series;
  delete from public.ops_expense_categories;
  delete from public.ops_stores;

  insert into public.brands select * from jsonb_populate_recordset(null::public.brands,p_payload->'brands');
  insert into public.families select * from jsonb_populate_recordset(null::public.families,p_payload->'families');
  insert into public.providers select * from jsonb_populate_recordset(null::public.providers,p_payload->'providers');
  insert into public.products select * from jsonb_populate_recordset(null::public.products,p_payload->'products');
  insert into public.product_variants select * from jsonb_populate_recordset(null::public.product_variants,p_payload->'product_variants');
  insert into public.product_provider_prices select * from jsonb_populate_recordset(null::public.product_provider_prices,p_payload->'product_provider_prices');
  insert into public.product_competitor_prices select * from jsonb_populate_recordset(null::public.product_competitor_prices,p_payload->'product_competitor_prices');
  insert into public.price_history select * from jsonb_populate_recordset(null::public.price_history,p_payload->'price_history');
  insert into public.consultations select * from jsonb_populate_recordset(null::public.consultations,p_payload->'consultations');
  insert into public.consultation_history select * from jsonb_populate_recordset(null::public.consultation_history,p_payload->'consultation_history');

  insert into public.ops_stores select * from jsonb_populate_recordset(null::public.ops_stores,p_payload->'ops_stores');
  insert into public.ops_expense_categories select * from jsonb_populate_recordset(null::public.ops_expense_categories,p_payload->'ops_expense_categories');
  insert into public.ops_cash_drawers select * from jsonb_populate_recordset(null::public.ops_cash_drawers,p_payload->'ops_cash_drawers');
  insert into public.ops_invoice_series select * from jsonb_populate_recordset(null::public.ops_invoice_series,p_payload->'ops_invoice_series');
  insert into public.ops_suppliers select * from jsonb_populate_recordset(null::public.ops_suppliers,p_payload->'ops_suppliers');
  insert into public.ops_customers select * from jsonb_populate_recordset(null::public.ops_customers,p_payload->'ops_customers');
  insert into public.ops_document_templates select * from jsonb_populate_recordset(null::public.ops_document_templates,p_payload->'ops_document_templates');
  insert into public.ops_business_settings select * from jsonb_populate_recordset(null::public.ops_business_settings,p_payload->'ops_business_settings');
  insert into public.ops_documents select * from jsonb_populate_recordset(null::public.ops_documents,p_payload->'ops_documents');
  insert into public.ops_daily_closings select * from jsonb_populate_recordset(null::public.ops_daily_closings,p_payload->'ops_daily_closings');
  insert into public.ops_daily_closing_drawers select * from jsonb_populate_recordset(null::public.ops_daily_closing_drawers,p_payload->'ops_daily_closing_drawers');
  insert into public.ops_expenses select * from jsonb_populate_recordset(null::public.ops_expenses,p_payload->'ops_expenses');
  insert into public.ops_expense_lines select * from jsonb_populate_recordset(null::public.ops_expense_lines,p_payload->'ops_expense_lines');

  with src as (select * from jsonb_populate_recordset(null::public.ops_sales_invoices,p_payload->'ops_sales_invoices'))
  insert into public.ops_sales_invoices(
    id,series_id,store_id,issue_date,number,display_number,origin,status,customer_name,customer_tax_id,
    customer_address,customer_email,concept,payment_method,paid_status,paid_date,base_amount,vat_amount,total_amount,
    source_document_id,generated_document_id,notes,created_by,created_at,updated_at,external_number_text,include_in_income,
    document_type,due_date,operation_date,customer_id,template_id,terms_text,footer_text,purchase_order_ref,currency,
    converted_invoice_id,design_snapshot,record_hash,previous_hash,issued_at,invoice_kind,template_snapshot,source_proforma_document_id,paid_amount
  )
  select
    id,series_id,store_id,issue_date,number,display_number,origin,'borrador',customer_name,customer_tax_id,
    customer_address,customer_email,concept,payment_method,paid_status,paid_date,base_amount,vat_amount,total_amount,
    source_document_id,generated_document_id,notes,null,created_at,updated_at,external_number_text,include_in_income,
    document_type,due_date,operation_date,customer_id,template_id,terms_text,footer_text,purchase_order_ref,currency,
    null,design_snapshot,record_hash,previous_hash,issued_at,invoice_kind,template_snapshot,null,paid_amount
  from src;

  insert into public.ops_sales_invoice_lines
  select * from jsonb_populate_recordset(null::public.ops_sales_invoice_lines,p_payload->'ops_sales_invoice_lines');

  with src as (select * from jsonb_populate_recordset(null::public.ops_sales_invoices,p_payload->'ops_sales_invoices'))
  update public.ops_sales_invoices d set
    status=s.status,base_amount=s.base_amount,vat_amount=s.vat_amount,total_amount=s.total_amount,
    converted_invoice_id=s.converted_invoice_id,source_proforma_document_id=s.source_proforma_document_id,
    design_snapshot=s.design_snapshot,record_hash=s.record_hash,previous_hash=s.previous_hash,
    issued_at=s.issued_at,template_snapshot=s.template_snapshot,paid_amount=s.paid_amount,updated_at=s.updated_at
  from src s where d.id=s.id;

  insert into public.ops_tax_payments select * from jsonb_populate_recordset(null::public.ops_tax_payments,p_payload->'ops_tax_payments');
  insert into public.ops_fiscal_adjustments select * from jsonb_populate_recordset(null::public.ops_fiscal_adjustments,p_payload->'ops_fiscal_adjustments');
  insert into public.ops_income_adjustments select * from jsonb_populate_recordset(null::public.ops_income_adjustments,p_payload->'ops_income_adjustments');
  insert into public.ops_reta_brackets select * from jsonb_populate_recordset(null::public.ops_reta_brackets,p_payload->'ops_reta_brackets');
  insert into public.ops_audit_log select * from jsonb_populate_recordset(null::public.ops_audit_log,p_payload->'ops_audit_log');
  perform setval(pg_get_serial_sequence('public.ops_reta_brackets','id'),greatest(coalesce((select max(id) from public.ops_reta_brackets),1),1),true);
  perform setval(pg_get_serial_sequence('public.ops_audit_log','id'),greatest(coalesce((select max(id) from public.ops_audit_log),1),1),true);

  perform private.totus_audit('backup','restaurar',null,jsonb_build_object('motivo',p_reason));
  return jsonb_build_object(
    'productos',(select count(*) from public.products),
    'cierres',(select count(*) from public.ops_daily_closings),
    'gastos',(select count(*) from public.ops_expenses),
    'facturas',(select count(*) from public.ops_sales_invoices),
    'documentos',(select count(*) from public.ops_documents)
  );
end;
$$;

-- Contrato explícito de restauración: impide recuperar copias en servidores con función SQL obsoleta.
create or replace function public.totus_backup_contract()
returns jsonb
language plpgsql security definer
set search_path='public,private'
as $
begin
  if not private.totus_is_admin() then raise exception 'Solo administración puede comprobar la restauración'; end if;
  return jsonb_build_object('version',2,'income_adjustments',true,'storage',true);
end;
$;

revoke all on function public.totus_backup_contract() from public,anon;
grant execute on function public.totus_backup_contract() to authenticated;

revoke all on function private.totus_is_admin() from public;
revoke all on function public.totus_storage_usage() from public,anon;
revoke all on function public.totus_restore_backup(jsonb,text) from public,anon;
grant execute on function public.totus_storage_usage() to authenticated;
grant execute on function public.totus_restore_backup(jsonb,text) to authenticated;
