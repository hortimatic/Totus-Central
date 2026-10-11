-- Totus Central · clean application API
-- Additive rewrite: no business data is created, changed or deleted by this migration.

create or replace function private.totus_is_team_member()
returns boolean
language sql
stable
security definer
set search_path='public'
as $$
  select exists(
    select 1
    from public.profiles p
    join public.team_members t on lower(t.email)=lower(coalesce(p.email,''))
    where p.id=auth.uid() and t.active=true
  );
$$;

create or replace function private.totus_is_manager()
returns boolean
language sql
stable
security definer
set search_path='public'
as $$
  select exists(
    select 1
    from public.profiles p
    join public.team_members t on lower(t.email)=lower(coalesce(p.email,''))
    where p.id=auth.uid() and t.active=true and t.role in ('admin','gerente')
  );
$$;

create or replace function private.totus_audit(p_area text,p_action text,p_entity uuid,p_detail jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path='public'
as $$
declare v_email text;
begin
  if not private.totus_is_team_member() then raise exception 'Sin acceso'; end if;
  select email into v_email from public.profiles where id=auth.uid();
  insert into public.ops_audit_log(user_id,user_email,area,action,entity_id,detail)
  values(auth.uid(),coalesce(v_email,''),p_area,p_action,p_entity,coalesce(p_detail,'{}'::jsonb));
end;
$$;

create or replace function public.totus_save_closing(p_closing jsonb,p_drawers jsonb)
returns uuid
language plpgsql
security definer
set search_path='public,private'
as $$
declare
  v_id uuid := nullif(p_closing->>'id','')::uuid;
  v_store uuid := nullif(p_closing->>'store_id','')::uuid;
  v_date date := nullif(p_closing->>'business_date','')::date;
  v_status text := coalesce(nullif(p_closing->>'status',''),'cerrado');
  v_open numeric := 0;
  v_close numeric := 0;
  v_card numeric := 0;
  v_bizum numeric := 0;
  v_online numeric := 0;
  v_other numeric := 0;
  v_withdraw numeric := 0;
  v_cash_exp numeric := 0;
  v_extra_in numeric := 0;
  v_extra_out numeric := 0;
  v_cash_sales numeric := 0;
begin
  if not private.totus_is_manager() then raise exception 'Solo administración o gerencia puede guardar cierres'; end if;
  if v_store is null or v_date is null then raise exception 'Tienda y fecha son obligatorias'; end if;
  if v_status not in ('borrador','cerrado') then raise exception 'Estado de cierre no válido'; end if;
  if jsonb_typeof(p_drawers)<>'array' or jsonb_array_length(p_drawers)=0 then raise exception 'Incluye al menos una caja'; end if;

  if exists(
    select 1 from jsonb_array_elements(p_drawers) j
    left join public.ops_cash_drawers d on d.id=nullif(j->>'drawer_id','')::uuid and d.store_id=v_store and d.active
    where d.id is null
  ) then raise exception 'Hay una caja que no pertenece al establecimiento'; end if;

  if exists(
    select 1 from (
      select nullif(j->>'drawer_id','')::uuid id,count(*)
      from jsonb_array_elements(p_drawers) j group by 1 having count(*)>1
    ) x
  ) then raise exception 'No se puede repetir una caja'; end if;

  select
    coalesce(sum(coalesce((j->>'opening_cash')::numeric,0)),0),
    coalesce(sum(coalesce((j->>'closing_cash')::numeric,0)),0),
    coalesce(sum(coalesce((j->>'card_sales')::numeric,0)),0),
    coalesce(sum(coalesce((j->>'bizum_sales')::numeric,0)),0),
    coalesce(sum(coalesce((j->>'online_sales')::numeric,0)),0),
    coalesce(sum(coalesce((j->>'other_income')::numeric,0)),0),
    coalesce(sum(coalesce((j->>'cash_withdrawals')::numeric,0)),0),
    coalesce(sum(coalesce((j->>'cash_expenses_declared')::numeric,0)),0),
    coalesce(sum(coalesce((j->>'cash_extra_in')::numeric,0)),0),
    coalesce(sum(coalesce((j->>'cash_extra_out')::numeric,0)),0)
  into v_open,v_close,v_card,v_bizum,v_online,v_other,v_withdraw,v_cash_exp,v_extra_in,v_extra_out
  from jsonb_array_elements(p_drawers) j;

  v_cash_sales := v_close + v_withdraw + v_cash_exp + v_extra_out - v_extra_in - v_open;

  if v_id is null then
    insert into public.ops_daily_closings(
      store_id,business_date,opening_cash,cash_sales,card_sales,bizum_sales,online_sales,other_income,
      cash_withdrawals,cash_expenses_declared,expected_cash,actual_cash,difference,notes,status,
      created_by,closed_by,source,legacy_cash_method,include_in_income
    ) values(
      v_store,v_date,v_open,v_cash_sales,v_card,v_bizum,v_online,v_other,
      v_withdraw,v_cash_exp,v_close,v_close,0,coalesce(p_closing->>'notes',''),v_status,
      auth.uid(),case when v_status='cerrado' then auth.uid() else null end,'manual',false,true
    ) returning id into v_id;
  else
    if not exists(select 1 from public.ops_daily_closings where id=v_id) then raise exception 'Cierre no encontrado'; end if;
    update public.ops_daily_closings set
      store_id=v_store,business_date=v_date,opening_cash=v_open,cash_sales=v_cash_sales,
      card_sales=v_card,bizum_sales=v_bizum,online_sales=v_online,other_income=v_other,
      cash_withdrawals=v_withdraw,cash_expenses_declared=v_cash_exp,expected_cash=v_close,
      actual_cash=v_close,difference=0,notes=coalesce(p_closing->>'notes',''),status=v_status,
      closed_by=case when v_status='cerrado' then auth.uid() else null end,
      source='manual',legacy_cash_method=false,include_in_income=true
    where id=v_id;
    delete from public.ops_daily_closing_drawers where closing_id=v_id;
  end if;

  insert into public.ops_daily_closing_drawers(
    closing_id,drawer_id,opening_cash,closing_cash,notes,card_sales,bizum_sales,online_sales,
    other_income,cash_withdrawals,cash_expenses_declared,cash_extra_in,cash_extra_out
  )
  select
    v_id,nullif(j->>'drawer_id','')::uuid,
    coalesce((j->>'opening_cash')::numeric,0),coalesce((j->>'closing_cash')::numeric,0),
    coalesce(j->>'notes',''),coalesce((j->>'card_sales')::numeric,0),coalesce((j->>'bizum_sales')::numeric,0),
    coalesce((j->>'online_sales')::numeric,0),coalesce((j->>'other_income')::numeric,0),
    coalesce((j->>'cash_withdrawals')::numeric,0),coalesce((j->>'cash_expenses_declared')::numeric,0),
    coalesce((j->>'cash_extra_in')::numeric,0),coalesce((j->>'cash_extra_out')::numeric,0)
  from jsonb_array_elements(p_drawers) j;

  perform private.totus_audit('cajas',case when nullif(p_closing->>'id','') is null then 'crear' else 'actualizar' end,v_id,
    jsonb_build_object('fecha',v_date,'tienda',v_store,'total',v_cash_sales+v_card+v_bizum+v_online+v_other));
  return v_id;
end;
$$;

create or replace function public.totus_delete_closing(p_id uuid,p_reason text)
returns uuid
language plpgsql
security definer
set search_path='public,private'
as $$
begin
  if not private.totus_is_manager() then raise exception 'Solo administración o gerencia puede eliminar cierres'; end if;
  if nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'Motivo obligatorio'; end if;
  if not exists(select 1 from public.ops_daily_closings where id=p_id) then raise exception 'Cierre no encontrado'; end if;
  perform private.totus_audit('cajas','eliminar',p_id,jsonb_build_object('motivo',p_reason));
  delete from public.ops_daily_closing_drawers where closing_id=p_id;
  delete from public.ops_daily_closings where id=p_id;
  return p_id;
end;
$$;

create or replace function public.totus_save_expense(p_expense jsonb,p_lines jsonb)
returns uuid
language plpgsql
security definer
set search_path='public,private'
as $$
declare
  v_id uuid := nullif(p_expense->>'id','')::uuid;
  v_store uuid := nullif(p_expense->>'store_id','')::uuid;
  v_date date := nullif(p_expense->>'expense_date','')::date;
  v_supplier text := btrim(coalesce(p_expense->>'supplier_name',''));
begin
  if not private.totus_is_manager() then raise exception 'Solo administración o gerencia puede guardar gastos'; end if;
  if v_store is null or v_date is null or v_supplier='' then raise exception 'Tienda, fecha y proveedor son obligatorios'; end if;
  if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'El gasto debe tener al menos una línea'; end if;

  if v_id is null then
    insert into public.ops_expenses(
      store_id,expense_date,supplier_name,supplier_tax_id,invoice_number,category_id,description,
      payment_method,paid_status,paid_date,base_amount,vat_rate,vat_amount,re_rate,re_amount,
      withholding_rate,withholding_amount,withholding_model,gross_expense,amount_paid,deductible_irpf,
      deductible_pct,fixed_asset,amortization_years,document_id,notes,created_by,document_kind,source,
      fiscal_reviewed,management_only,personnel_kind,supplier_id
    ) values(
      v_store,v_date,v_supplier,coalesce(p_expense->>'supplier_tax_id',''),coalesce(p_expense->>'invoice_number',''),
      nullif(p_expense->>'category_id','')::uuid,coalesce(p_expense->>'description',''),
      coalesce(nullif(p_expense->>'payment_method',''),'tarjeta'),coalesce(nullif(p_expense->>'paid_status',''),'pagado'),
      nullif(p_expense->>'paid_date','')::date,0,coalesce((p_expense->>'vat_rate')::numeric,0),0,
      coalesce((p_expense->>'re_rate')::numeric,0),0,coalesce((p_expense->>'withholding_rate')::numeric,0),0,
      nullif(p_expense->>'withholding_model',''),0,coalesce((p_expense->>'amount_paid')::numeric,0),
      coalesce((p_expense->>'deductible_irpf')::boolean,true),coalesce((p_expense->>'deductible_pct')::numeric,100),
      coalesce((p_expense->>'fixed_asset')::boolean,false),nullif(p_expense->>'amortization_years','')::numeric,
      nullif(p_expense->>'document_id','')::uuid,coalesce(p_expense->>'notes',''),auth.uid(),
      coalesce(nullif(p_expense->>'document_kind',''),'factura'),'manual',
      coalesce((p_expense->>'fiscal_reviewed')::boolean,false),coalesce((p_expense->>'management_only')::boolean,false),
      nullif(p_expense->>'personnel_kind',''),nullif(p_expense->>'supplier_id','')::uuid
    ) returning id into v_id;
  else
    if not exists(select 1 from public.ops_expenses where id=v_id) then raise exception 'Gasto no encontrado'; end if;
    update public.ops_expenses set
      store_id=v_store,expense_date=v_date,supplier_name=v_supplier,supplier_tax_id=coalesce(p_expense->>'supplier_tax_id',''),
      invoice_number=coalesce(p_expense->>'invoice_number',''),category_id=nullif(p_expense->>'category_id','')::uuid,
      description=coalesce(p_expense->>'description',''),payment_method=coalesce(nullif(p_expense->>'payment_method',''),'tarjeta'),
      paid_status=coalesce(nullif(p_expense->>'paid_status',''),'pagado'),paid_date=nullif(p_expense->>'paid_date','')::date,
      vat_rate=coalesce((p_expense->>'vat_rate')::numeric,0),re_rate=coalesce((p_expense->>'re_rate')::numeric,0),
      withholding_rate=coalesce((p_expense->>'withholding_rate')::numeric,0),withholding_model=nullif(p_expense->>'withholding_model',''),
      amount_paid=coalesce((p_expense->>'amount_paid')::numeric,0),deductible_irpf=coalesce((p_expense->>'deductible_irpf')::boolean,true),
      deductible_pct=coalesce((p_expense->>'deductible_pct')::numeric,100),fixed_asset=coalesce((p_expense->>'fixed_asset')::boolean,false),
      amortization_years=nullif(p_expense->>'amortization_years','')::numeric,document_id=nullif(p_expense->>'document_id','')::uuid,
      notes=coalesce(p_expense->>'notes',''),document_kind=coalesce(nullif(p_expense->>'document_kind',''),'factura'),
      fiscal_reviewed=coalesce((p_expense->>'fiscal_reviewed')::boolean,false),management_only=coalesce((p_expense->>'management_only')::boolean,false),
      personnel_kind=nullif(p_expense->>'personnel_kind',''),supplier_id=nullif(p_expense->>'supplier_id','')::uuid
    where id=v_id;
    delete from public.ops_expense_lines where expense_id=v_id;
  end if;

  insert into public.ops_expense_lines(
    expense_id,sort_order,category_id,description,base_amount,vat_rate,vat_amount,re_base,re_rate,re_amount,
    irpf_imputable,withholding_base,withholding_rate,withholding_amount,withholding_model,deductible_irpf,
    deductible_pct,fixed_asset,amortization_years,notes
  )
  select
    v_id,coalesce((j->>'sort_order')::integer,10),nullif(j->>'category_id','')::uuid,
    coalesce(j->>'description',''),coalesce((j->>'base_amount')::numeric,0),coalesce((j->>'vat_rate')::numeric,0),
    coalesce((j->>'vat_amount')::numeric,0),coalesce((j->>'re_base')::numeric,0),coalesce((j->>'re_rate')::numeric,0),
    coalesce((j->>'re_amount')::numeric,0),coalesce((j->>'irpf_imputable')::numeric,0),
    coalesce((j->>'withholding_base')::numeric,0),coalesce((j->>'withholding_rate')::numeric,0),
    coalesce((j->>'withholding_amount')::numeric,0),nullif(j->>'withholding_model',''),
    coalesce((j->>'deductible_irpf')::boolean,true),coalesce((j->>'deductible_pct')::numeric,100),
    coalesce((j->>'fixed_asset')::boolean,false),nullif(j->>'amortization_years','')::numeric,coalesce(j->>'notes','')
  from jsonb_array_elements(p_lines) j;

  perform private.totus_audit('gastos',case when nullif(p_expense->>'id','') is null then 'crear' else 'actualizar' end,v_id,
    jsonb_build_object('fecha',v_date,'proveedor',v_supplier));
  return v_id;
end;
$$;

create or replace function public.totus_delete_expense(p_id uuid,p_reason text)
returns uuid
language plpgsql
security definer
set search_path='public,private'
as $$
begin
  if not private.totus_is_manager() then raise exception 'Solo administración o gerencia puede eliminar gastos'; end if;
  if nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'Motivo obligatorio'; end if;
  if not exists(select 1 from public.ops_expenses where id=p_id) then raise exception 'Gasto no encontrado'; end if;
  perform private.totus_audit('gastos','eliminar',p_id,jsonb_build_object('motivo',p_reason));
  delete from public.ops_expense_lines where expense_id=p_id;
  delete from public.ops_expenses where id=p_id;
  return p_id;
end;
$$;

create or replace function public.totus_save_sales_document(p_document jsonb,p_lines jsonb)
returns uuid
language plpgsql
security definer
set search_path='public,private'
as $$
declare
  v_id uuid := nullif(p_document->>'id','')::uuid;
  v_status text;
begin
  if not private.totus_is_manager() then raise exception 'Solo administración o gerencia puede guardar documentos de venta'; end if;
  if nullif(p_document->>'series_id','') is null or nullif(p_document->>'issue_date','') is null then raise exception 'Serie y fecha son obligatorias'; end if;
  if nullif(btrim(coalesce(p_document->>'customer_name','')),'') is null then raise exception 'Cliente obligatorio'; end if;
  if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'Incluye al menos una línea'; end if;

  if v_id is null then
    insert into public.ops_sales_invoices(
      series_id,store_id,issue_date,due_date,operation_date,origin,status,document_type,invoice_kind,
      customer_id,customer_name,customer_tax_id,customer_address,customer_email,concept,payment_method,
      paid_status,paid_date,include_in_income,template_id,terms_text,footer_text,purchase_order_ref,currency,
      notes,created_by
    ) values(
      nullif(p_document->>'series_id','')::uuid,nullif(p_document->>'store_id','')::uuid,
      (p_document->>'issue_date')::date,nullif(p_document->>'due_date','')::date,nullif(p_document->>'operation_date','')::date,
      coalesce(nullif(p_document->>'origin',''),'totus'),'borrador',coalesce(nullif(p_document->>'document_type',''),'factura'),
      coalesce(nullif(p_document->>'invoice_kind',''),'invoice'),nullif(p_document->>'customer_id','')::uuid,
      btrim(p_document->>'customer_name'),coalesce(p_document->>'customer_tax_id',''),coalesce(p_document->>'customer_address',''),
      coalesce(p_document->>'customer_email',''),coalesce(p_document->>'concept',''),coalesce(nullif(p_document->>'payment_method',''),'transferencia'),
      coalesce(nullif(p_document->>'paid_status',''),'pendiente'),nullif(p_document->>'paid_date','')::date,
      coalesce((p_document->>'include_in_income')::boolean,false),nullif(p_document->>'template_id','')::uuid,
      coalesce(p_document->>'terms_text',''),coalesce(p_document->>'footer_text',''),coalesce(p_document->>'purchase_order_ref',''),
      coalesce(nullif(p_document->>'currency',''),'EUR'),coalesce(p_document->>'notes',''),auth.uid()
    ) returning id into v_id;
  else
    select status into v_status from public.ops_sales_invoices where id=v_id for update;
    if not found then raise exception 'Documento no encontrado'; end if;
    if v_status<>'borrador' then raise exception 'Solo se pueden editar documentos en borrador'; end if;
    update public.ops_sales_invoices set
      series_id=nullif(p_document->>'series_id','')::uuid,store_id=nullif(p_document->>'store_id','')::uuid,
      issue_date=(p_document->>'issue_date')::date,due_date=nullif(p_document->>'due_date','')::date,
      operation_date=nullif(p_document->>'operation_date','')::date,origin=coalesce(nullif(p_document->>'origin',''),'totus'),
      document_type=coalesce(nullif(p_document->>'document_type',''),'factura'),
      invoice_kind=coalesce(nullif(p_document->>'invoice_kind',''),'invoice'),customer_id=nullif(p_document->>'customer_id','')::uuid,
      customer_name=btrim(p_document->>'customer_name'),customer_tax_id=coalesce(p_document->>'customer_tax_id',''),
      customer_address=coalesce(p_document->>'customer_address',''),customer_email=coalesce(p_document->>'customer_email',''),
      concept=coalesce(p_document->>'concept',''),payment_method=coalesce(nullif(p_document->>'payment_method',''),'transferencia'),
      paid_status=coalesce(nullif(p_document->>'paid_status',''),'pendiente'),paid_date=nullif(p_document->>'paid_date','')::date,
      include_in_income=coalesce((p_document->>'include_in_income')::boolean,false),template_id=nullif(p_document->>'template_id','')::uuid,
      terms_text=coalesce(p_document->>'terms_text',''),footer_text=coalesce(p_document->>'footer_text',''),
      purchase_order_ref=coalesce(p_document->>'purchase_order_ref',''),currency=coalesce(nullif(p_document->>'currency',''),'EUR'),
      notes=coalesce(p_document->>'notes','')
    where id=v_id;
    delete from public.ops_sales_invoice_lines where invoice_id=v_id;
  end if;

  insert into public.ops_sales_invoice_lines(invoice_id,sort_order,description,quantity,unit_price_base,discount_pct,vat_rate)
  select v_id,coalesce((j->>'sort_order')::integer,10),btrim(coalesce(j->>'description','')),
    coalesce((j->>'quantity')::numeric,1),coalesce((j->>'unit_price_base')::numeric,0),
    coalesce((j->>'discount_pct')::numeric,0),coalesce((j->>'vat_rate')::numeric,21)
  from jsonb_array_elements(p_lines) j;

  perform private.totus_audit('facturacion',case when nullif(p_document->>'id','') is null then 'crear' else 'actualizar' end,v_id,
    jsonb_build_object('tipo',coalesce(p_document->>'document_type','factura'),'fecha',p_document->>'issue_date'));
  return v_id;
end;
$$;

create or replace function public.totus_finalize_sales_document(p_id uuid)
returns public.ops_sales_invoices
language plpgsql
security definer
set search_path='public,private,extensions'
as $$
declare
  v_doc public.ops_sales_invoices;
  v_series public.ops_invoice_series;
  v_num integer;
  v_prev text;
  v_hash text;
  v_tpl jsonb := '{}'::jsonb;
begin
  if not private.totus_is_manager() then raise exception 'Solo administración o gerencia puede emitir documentos'; end if;
  select * into v_doc from public.ops_sales_invoices where id=p_id for update;
  if not found then raise exception 'Documento no encontrado'; end if;
  if v_doc.status='emitida' then return v_doc; end if;
  if v_doc.status<>'borrador' then raise exception 'El documento no puede emitirse en su estado actual'; end if;
  if not exists(select 1 from public.ops_sales_invoice_lines where invoice_id=p_id) then raise exception 'El documento no tiene líneas'; end if;

  select * into v_series from public.ops_invoice_series where id=v_doc.series_id for update;
  if not found or not v_series.active then raise exception 'Serie no disponible'; end if;
  v_num:=v_series.next_number;
  update public.ops_invoice_series set next_number=v_num+1 where id=v_series.id;

  if v_doc.template_id is not null then
    select to_jsonb(t) into v_tpl from public.ops_document_templates t where t.id=v_doc.template_id;
    v_tpl:=coalesce(v_tpl,'{}'::jsonb);
  end if;

  if v_doc.document_type='factura' then
    select record_hash into v_prev from public.ops_sales_invoices
    where document_type='factura' and status in ('emitida','anulada') and series_id=v_doc.series_id and record_hash is not null
    order by issued_at desc nulls last,created_at desc limit 1;
  end if;

  v_hash:=encode(extensions.digest(concat_ws('|',v_doc.id::text,v_doc.document_type,v_series.code,v_num::text,
    v_doc.issue_date::text,v_doc.customer_tax_id,v_doc.customer_name,v_doc.base_amount::text,
    v_doc.vat_amount::text,v_doc.total_amount::text,coalesce(v_prev,'')),'sha256'),'hex');

  update public.ops_sales_invoices set
    number=v_num,display_number=v_series.prefix||lpad(v_num::text,v_series.padding,'0'),
    status='emitida',issued_at=now(),design_snapshot=v_tpl,template_snapshot=v_tpl,
    previous_hash=v_prev,record_hash=v_hash,updated_at=now()
  where id=p_id returning * into v_doc;

  perform private.totus_audit('facturacion','emitir',p_id,jsonb_build_object('numero',v_doc.display_number));
  return v_doc;
end;
$$;

create or replace function public.totus_convert_proforma(p_id uuid,p_invoice_series uuid)
returns uuid
language plpgsql
security definer
set search_path='public,private'
as $$
declare v_p public.ops_sales_invoices; v_new uuid;
begin
  if not private.totus_is_manager() then raise exception 'Solo administración o gerencia puede convertir proformas'; end if;
  select * into v_p from public.ops_sales_invoices where id=p_id for update;
  if not found or v_p.document_type<>'proforma' then raise exception 'Proforma no encontrada'; end if;
  if v_p.status='convertida' and v_p.converted_invoice_id is not null then return v_p.converted_invoice_id; end if;
  if v_p.status not in ('emitida','aceptada') then raise exception 'Emite o acepta la proforma antes de convertirla'; end if;

  insert into public.ops_sales_invoices(
    series_id,store_id,issue_date,due_date,operation_date,origin,status,document_type,invoice_kind,
    customer_id,customer_name,customer_tax_id,customer_address,customer_email,concept,payment_method,
    paid_status,include_in_income,template_id,terms_text,footer_text,purchase_order_ref,currency,notes,created_by,
    source_proforma_document_id
  ) values(
    p_invoice_series,v_p.store_id,current_date,v_p.due_date,v_p.operation_date,'totus','borrador','factura','invoice',
    v_p.customer_id,v_p.customer_name,v_p.customer_tax_id,v_p.customer_address,v_p.customer_email,v_p.concept,
    v_p.payment_method,'pendiente',false,v_p.template_id,v_p.terms_text,v_p.footer_text,v_p.purchase_order_ref,
    coalesce(v_p.currency,'EUR'),v_p.notes,auth.uid(),v_p.id
  ) returning id into v_new;

  insert into public.ops_sales_invoice_lines(invoice_id,sort_order,description,quantity,unit_price_base,discount_pct,vat_rate)
  select v_new,sort_order,description,quantity,unit_price_base,discount_pct,vat_rate
  from public.ops_sales_invoice_lines where invoice_id=v_p.id order by sort_order,id;

  update public.ops_sales_invoices set status='convertida',converted_invoice_id=v_new where id=v_p.id;
  perform private.totus_audit('facturacion','convertir_proforma',p_id,jsonb_build_object('factura',v_new));
  return v_new;
end;
$$;

revoke all on function private.totus_is_team_member() from public;
revoke all on function private.totus_is_manager() from public;
revoke all on function private.totus_audit(text,text,uuid,jsonb) from public;

revoke all on function public.totus_save_closing(jsonb,jsonb) from public,anon;
revoke all on function public.totus_delete_closing(uuid,text) from public,anon;
revoke all on function public.totus_save_expense(jsonb,jsonb) from public,anon;
revoke all on function public.totus_delete_expense(uuid,text) from public,anon;
revoke all on function public.totus_save_sales_document(jsonb,jsonb) from public,anon;
revoke all on function public.totus_finalize_sales_document(uuid) from public,anon;
revoke all on function public.totus_convert_proforma(uuid,uuid) from public,anon;

grant execute on function public.totus_save_closing(jsonb,jsonb) to authenticated;
grant execute on function public.totus_delete_closing(uuid,text) to authenticated;
grant execute on function public.totus_save_expense(jsonb,jsonb) to authenticated;
grant execute on function public.totus_delete_expense(uuid,text) to authenticated;
grant execute on function public.totus_save_sales_document(jsonb,jsonb) to authenticated;
grant execute on function public.totus_finalize_sales_document(uuid) to authenticated;
grant execute on function public.totus_convert_proforma(uuid,uuid) to authenticated;
