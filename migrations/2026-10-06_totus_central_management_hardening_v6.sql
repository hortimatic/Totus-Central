-- Totus Central V6 · estado canónico de endurecimiento de Gestión
-- Consolida permisos, guardados atómicos, facturación y coherencia de series.
-- Generado desde el esquema operativo validado · 2026-10-06

begin;

CREATE OR REPLACE FUNCTION private.ops_convert_proforma_internal(p_proforma_id uuid, p_invoice_series_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare p public.ops_sales_invoices; iid uuid; ser public.ops_invoice_series;
begin
  if not private.is_manager() then raise exception 'Solo administración o gerencia puede convertir proformas'; end if;

  select * into p
  from public.ops_sales_invoices
  where id=p_proforma_id
  for update;

  if not found then raise exception 'Proforma no encontrada'; end if;
  if p.document_type<>'proforma' then raise exception 'El documento indicado no es una proforma'; end if;
  if p.status='convertida' and p.converted_invoice_id is not null then return p.converted_invoice_id; end if;
  if p.status in ('anulada','rechazada') then raise exception 'La proforma no se puede convertir en su estado actual'; end if;
  if p.status not in ('emitida','aceptada') then raise exception 'Emite o acepta la proforma antes de convertirla'; end if;

  select * into ser
  from public.ops_invoice_series
  where id=p_invoice_series_id
  for update;

  if not found or not ser.active or ser.document_type<>'factura' or ser.series_kind<>'invoice'
    then raise exception 'Serie de factura ordinaria no válida'; end if;

  if p.store_id is not null and ser.store_id is not null and p.store_id<>ser.store_id
    then raise exception 'La serie de factura no corresponde al establecimiento de la proforma'; end if;

  insert into public.ops_sales_invoices(
    series_id,store_id,issue_date,due_date,operation_date,origin,status,document_type,invoice_kind,
    customer_id,customer_name,customer_tax_id,customer_address,customer_email,concept,payment_method,
    paid_status,paid_date,include_in_income,template_id,terms_text,footer_text,purchase_order_ref,currency,
    notes,created_by,source_proforma_document_id
  ) values(
    p_invoice_series_id,p.store_id,current_date,p.due_date,p.operation_date,'totus','borrador','factura','invoice',
    p.customer_id,p.customer_name,p.customer_tax_id,p.customer_address,p.customer_email,p.concept,p.payment_method,
    'pendiente',null,false,p.template_id,p.terms_text,p.footer_text,p.purchase_order_ref,coalesce(p.currency,'EUR'),
    p.notes,auth.uid(),p.id
  )
  returning id into iid;

  insert into public.ops_sales_invoice_lines(
    invoice_id,sort_order,description,quantity,unit_price_base,discount_pct,vat_rate,
    base_amount,vat_amount,total_amount
  )
  select iid,sort_order,description,quantity,unit_price_base,discount_pct,vat_rate,
         base_amount,vat_amount,total_amount
  from public.ops_sales_invoice_lines
  where invoice_id=p.id
  order by sort_order,id;

  update public.ops_sales_invoices
  set status='convertida',converted_invoice_id=iid,updated_at=now()
  where id=p.id;

  return iid;
end;
$function$;

CREATE OR REPLACE FUNCTION private.ops_finalize_document_internal(p_document_id uuid)
 RETURNS ops_sales_invoices
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d public.ops_sales_invoices; s public.ops_invoice_series; n integer; prev_hash text; tpl jsonb; new_hash text;
begin
  if not private.is_manager() then raise exception 'Solo administración o gerencia puede emitir documentos'; end if;
  select * into d from public.ops_sales_invoices where id=p_document_id for update;
  if not found then raise exception 'Documento no encontrado'; end if;
  if d.status<>'borrador' then return d; end if;
  if not exists(select 1 from public.ops_sales_invoice_lines where invoice_id=p_document_id)
    then raise exception 'El documento no tiene líneas'; end if;

  select * into s from public.ops_invoice_series where id=d.series_id for update;
  if not found or not s.active then raise exception 'Serie no disponible'; end if;
  if s.document_type<>d.document_type then raise exception 'La serie no corresponde al tipo de documento'; end if;
  if d.document_type='factura' and coalesce(s.series_kind,'invoice')<>coalesce(d.invoice_kind,'invoice') then
    raise exception 'La serie no corresponde al tipo de factura';
  end if;

  n=s.next_number;
  update public.ops_invoice_series set next_number=n+1 where id=s.id;

  select to_jsonb(t) into tpl from public.ops_document_templates t where t.id=d.template_id;
  if tpl is null then tpl='{}'::jsonb; end if;

  if d.document_type='factura' then
    select record_hash into prev_hash
      from public.ops_sales_invoices
      where document_type='factura' and status in ('emitida','anulada')
        and series_id=d.series_id and record_hash is not null
      order by issued_at desc nulls last, created_at desc limit 1;
  else
    prev_hash=null;
  end if;

  new_hash=encode(extensions.digest(
    concat_ws('|',d.id::text,d.document_type,s.code,n::text,d.issue_date::text,
              d.customer_tax_id,d.customer_name,d.base_amount::text,d.vat_amount::text,
              d.total_amount::text,coalesce(prev_hash,'')),
    'sha256'),'hex');

  update public.ops_sales_invoices set
    number=n,
    display_number=s.prefix||lpad(n::text,s.padding,'0'),
    status='emitida',
    issued_at=now(),
    design_snapshot=tpl,
    template_snapshot=tpl,
    previous_hash=prev_hash,
    record_hash=new_hash,
    updated_at=now()
  where id=p_document_id returning * into d;
  return d;
end $function$;

CREATE OR REPLACE FUNCTION private.ops_issue_invoice_internal(p_invoice_id uuid)
 RETURNS ops_sales_invoices
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare inv public.ops_sales_invoices; ser public.ops_invoice_series;
        n integer; tpl jsonb; prev_hash text; new_hash text;
begin
  if not private.is_manager() then raise exception 'Solo administración o gerencia puede emitir facturas'; end if;
  select * into inv from public.ops_sales_invoices where id=p_invoice_id for update;
  if not found then raise exception 'Factura no encontrada'; end if;
  if inv.document_type<>'factura' then raise exception 'El documento no es una factura'; end if;
  if inv.status='emitida' then return inv; end if;
  if inv.status='anulada' then raise exception 'Una factura anulada no puede emitirse'; end if;
  if not exists(select 1 from public.ops_sales_invoice_lines where invoice_id=p_invoice_id)
    then raise exception 'La factura no tiene líneas'; end if;
  select * into ser from public.ops_invoice_series where id=inv.series_id for update;
  if not found or not ser.active then raise exception 'Serie no disponible'; end if;
  if ser.document_type<>'factura' or ser.series_kind<>inv.invoice_kind
    then raise exception 'La serie no corresponde al tipo de factura'; end if;
  n=ser.next_number;
  update public.ops_invoice_series set next_number=n+1 where id=ser.id;
  select to_jsonb(t) into tpl from public.ops_document_templates t where t.id=inv.template_id;
  if tpl is null then tpl='{}'::jsonb; end if;
  select record_hash into prev_hash
  from public.ops_sales_invoices
  where document_type='factura'
    and status in ('emitida','anulada')
    and series_id=inv.series_id and record_hash is not null
  order by issued_at desc nulls last, created_at desc limit 1;
  new_hash=encode(extensions.digest(
    concat_ws('|',inv.id::text,inv.document_type,ser.code,n::text,inv.issue_date::text,
      inv.customer_tax_id,inv.customer_name,inv.base_amount::text,inv.vat_amount::text,
      inv.total_amount::text,coalesce(prev_hash,'')),
    'sha256'),'hex');
  update public.ops_sales_invoices set
    number=n,
    display_number=ser.prefix||lpad(n::text,ser.padding,'0'),
    status='emitida',
    issued_at=now(),
    design_snapshot=tpl,
    template_snapshot=tpl,
    previous_hash=prev_hash,
    record_hash=new_hash,
    updated_at=now()
  where id=p_invoice_id returning * into inv;
  return inv;
end $function$;

CREATE OR REPLACE FUNCTION private.ops_register_external_document_internal(p_document_id uuid, p_number integer)
 RETURNS ops_sales_invoices
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d public.ops_sales_invoices; s public.ops_invoice_series; tpl jsonb; prev_hash text; new_hash text;
begin
  if not private.is_manager() then raise exception 'Solo administración o gerencia puede registrar documentos externos'; end if;
  if p_number is null or p_number < 1 then raise exception 'Número externo no válido'; end if;

  select * into d from public.ops_sales_invoices where id=p_document_id for update;
  if not found then raise exception 'Documento no encontrado'; end if;
  if d.origin<>'externa' then raise exception 'El documento no está marcado como externo'; end if;
  if d.status<>'borrador' then return d; end if;
  if not exists(select 1 from public.ops_sales_invoice_lines where invoice_id=p_document_id)
    then raise exception 'El documento no tiene líneas'; end if;

  select * into s from public.ops_invoice_series where id=d.series_id for update;
  if not found or not s.active then raise exception 'Serie no disponible'; end if;
  if s.document_type<>d.document_type then raise exception 'La serie no corresponde al tipo de documento'; end if;
  if d.document_type='factura' and s.series_kind<>d.invoice_kind
    then raise exception 'La serie no corresponde al tipo de factura'; end if;

  if exists(
    select 1 from public.ops_sales_invoices x
    where x.series_id=d.series_id and x.number=p_number and x.id<>d.id
  ) then
    raise exception 'Ese número ya existe en la serie';
  end if;

  update public.ops_invoice_series
  set next_number=greatest(next_number,p_number+1)
  where id=s.id;

  select to_jsonb(t) into tpl from public.ops_document_templates t where t.id=d.template_id;
  if tpl is null then tpl='{}'::jsonb; end if;

  if d.document_type='factura' then
    select record_hash into prev_hash
    from public.ops_sales_invoices
    where document_type='factura'
      and status in ('emitida','anulada')
      and series_id=d.series_id
      and record_hash is not null
    order by issued_at desc nulls last, created_at desc
    limit 1;
  else
    prev_hash=null;
  end if;

  new_hash=encode(extensions.digest(
    concat_ws('|',d.id::text,d.document_type,s.code,p_number::text,d.issue_date::text,
      d.customer_tax_id,d.customer_name,d.base_amount::text,d.vat_amount::text,
      d.total_amount::text,coalesce(prev_hash,'')),
    'sha256'),'hex');

  update public.ops_sales_invoices set
    number=p_number,
    display_number=s.prefix||lpad(p_number::text,s.padding,'0'),
    external_number_text=p_number::text,
    status='emitida',
    issued_at=now(),
    design_snapshot=tpl,
    template_snapshot=tpl,
    previous_hash=prev_hash,
    record_hash=new_hash,
    updated_at=now()
  where id=d.id
  returning * into d;

  return d;
end;
$function$;

CREATE OR REPLACE FUNCTION private.ops_save_closing_internal(p_closing jsonb, p_drawers jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_old_status text;
  v_store uuid;
  v_date date;
  v_opening numeric := 0;
  v_closing numeric := 0;
  v_withdrawals numeric := coalesce((p_closing->>'cash_withdrawals')::numeric,0);
  v_cash_expenses numeric := coalesce((p_closing->>'cash_expenses_declared')::numeric,0);
  v_cash_sales numeric;
begin
  if not private.is_team_member() then raise exception 'Sin acceso'; end if;

  v_id := nullif(p_closing->>'id','')::uuid;
  v_store := nullif(p_closing->>'store_id','')::uuid;
  v_date := nullif(p_closing->>'business_date','')::date;

  if v_store is null or v_date is null then
    raise exception 'Tienda y fecha son obligatorias';
  end if;
  if jsonb_typeof(p_drawers) <> 'array' or jsonb_array_length(p_drawers)=0 then
    raise exception 'El cierre debe incluir al menos una caja';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_drawers) j
    left join public.ops_cash_drawers d
      on d.id=(j->>'drawer_id')::uuid and d.store_id=v_store and d.active
    where d.id is null
  ) then
    raise exception 'Hay una caja no válida para este establecimiento';
  end if;
  if exists (
    select 1
    from (
      select (j->>'drawer_id')::uuid id,count(*)
      from jsonb_array_elements(p_drawers) j
      group by 1 having count(*)>1
    ) x
  ) then
    raise exception 'No se puede repetir una caja en el cierre';
  end if;

  select
    coalesce(sum(coalesce((j->>'opening_cash')::numeric,0)),0),
    coalesce(sum(coalesce((j->>'closing_cash')::numeric,0)),0)
  into v_opening,v_closing
  from jsonb_array_elements(p_drawers) j;

  v_cash_sales := v_closing + v_withdrawals + v_cash_expenses - v_opening;

  if v_id is not null then
    select status into v_old_status
    from public.ops_daily_closings
    where id=v_id
    for update;
    if not found then raise exception 'Cierre no encontrado'; end if;
    if v_old_status='cerrado' and not private.is_manager() then
      raise exception 'Cierre cerrado. Solo administración/gerencia puede modificarlo';
    end if;

    update public.ops_daily_closings
    set store_id=v_store,
        business_date=v_date,
        opening_cash=v_opening,
        cash_sales=v_cash_sales,
        card_sales=coalesce((p_closing->>'card_sales')::numeric,0),
        bizum_sales=coalesce((p_closing->>'bizum_sales')::numeric,0),
        online_sales=coalesce((p_closing->>'online_sales')::numeric,0),
        other_income=coalesce((p_closing->>'other_income')::numeric,0),
        cash_withdrawals=v_withdrawals,
        cash_expenses_declared=v_cash_expenses,
        expected_cash=v_closing,
        actual_cash=v_closing,
        difference=0,
        notes=coalesce(p_closing->>'notes',''),
        status=coalesce(nullif(p_closing->>'status',''),'cerrado'),
        closed_by=case when coalesce(nullif(p_closing->>'status',''),'cerrado')='cerrado' then auth.uid() else null end,
        source='manual',
        legacy_cash_method=false,
        updated_at=now()
    where id=v_id;

    delete from public.ops_daily_closing_drawers where closing_id=v_id;
  else
    insert into public.ops_daily_closings(
      store_id,business_date,opening_cash,cash_sales,card_sales,bizum_sales,online_sales,other_income,
      cash_withdrawals,cash_expenses_declared,expected_cash,actual_cash,difference,notes,status,
      created_by,closed_by,source,legacy_cash_method
    ) values (
      v_store,v_date,v_opening,v_cash_sales,
      coalesce((p_closing->>'card_sales')::numeric,0),
      coalesce((p_closing->>'bizum_sales')::numeric,0),
      coalesce((p_closing->>'online_sales')::numeric,0),
      coalesce((p_closing->>'other_income')::numeric,0),
      v_withdrawals,v_cash_expenses,v_closing,v_closing,0,
      coalesce(p_closing->>'notes',''),
      coalesce(nullif(p_closing->>'status',''),'cerrado'),
      auth.uid(),
      case when coalesce(nullif(p_closing->>'status',''),'cerrado')='cerrado' then auth.uid() else null end,
      'manual',false
    ) returning id into v_id;
  end if;

  insert into public.ops_daily_closing_drawers(closing_id,drawer_id,opening_cash,closing_cash,notes)
  select
    v_id,
    (j->>'drawer_id')::uuid,
    coalesce((j->>'opening_cash')::numeric,0),
    coalesce((j->>'closing_cash')::numeric,0),
    coalesce(j->>'notes','')
  from jsonb_array_elements(p_drawers) j;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.ops_save_document_draft_internal(p_document jsonb, p_lines jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_status text;
begin
  if not private.is_manager() then raise exception 'Solo administración o gerencia puede guardar documentos de venta'; end if;
  if nullif(p_document->>'series_id','') is null then raise exception 'Serie obligatoria'; end if;
  if nullif(p_document->>'issue_date','') is null then raise exception 'Fecha obligatoria'; end if;
  if nullif(btrim(coalesce(p_document->>'customer_name','')),'') is null then raise exception 'Cliente obligatorio'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines)=0 then raise exception 'El documento debe tener líneas'; end if;
  if exists(select 1 from jsonb_array_elements(p_lines) j where nullif(btrim(coalesce(j->>'description','')),'') is null or coalesce((j->>'quantity')::numeric,0)=0)
    then raise exception 'Hay líneas incompletas'; end if;

  v_id := nullif(p_document->>'id','')::uuid;

  if v_id is not null then
    select status into v_status from public.ops_sales_invoices where id=v_id for update;
    if not found then raise exception 'Documento no encontrado'; end if;
    if v_status<>'borrador' then raise exception 'Solo se pueden editar documentos en borrador'; end if;

    update public.ops_sales_invoices set
      series_id=(p_document->>'series_id')::uuid,
      store_id=nullif(p_document->>'store_id','')::uuid,
      issue_date=(p_document->>'issue_date')::date,
      due_date=nullif(p_document->>'due_date','')::date,
      operation_date=nullif(p_document->>'operation_date','')::date,
      origin=coalesce(nullif(p_document->>'origin',''),'totus'),
      document_type=coalesce(nullif(p_document->>'document_type',''),'factura'),
      invoice_kind=coalesce(nullif(p_document->>'invoice_kind',''),'invoice'),
      customer_id=nullif(p_document->>'customer_id','')::uuid,
      customer_name=btrim(p_document->>'customer_name'),
      customer_tax_id=coalesce(p_document->>'customer_tax_id',''),
      customer_address=coalesce(p_document->>'customer_address',''),
      customer_email=coalesce(p_document->>'customer_email',''),
      concept=coalesce(p_document->>'concept',''),
      payment_method=coalesce(nullif(p_document->>'payment_method',''),'transferencia'),
      paid_status=coalesce(nullif(p_document->>'paid_status',''),'pendiente'),
      paid_date=nullif(p_document->>'paid_date','')::date,
      include_in_income=coalesce((p_document->>'include_in_income')::boolean,false),
      template_id=nullif(p_document->>'template_id','')::uuid,
      terms_text=coalesce(p_document->>'terms_text',''),
      footer_text=coalesce(p_document->>'footer_text',''),
      purchase_order_ref=coalesce(p_document->>'purchase_order_ref',''),
      notes=coalesce(p_document->>'notes',''),
      updated_at=now()
    where id=v_id;

    delete from public.ops_sales_invoice_lines where invoice_id=v_id;
  else
    insert into public.ops_sales_invoices(
      series_id,store_id,issue_date,due_date,operation_date,origin,status,document_type,invoice_kind,
      customer_id,customer_name,customer_tax_id,customer_address,customer_email,concept,payment_method,
      paid_status,paid_date,include_in_income,template_id,terms_text,footer_text,purchase_order_ref,notes,created_by
    ) values (
      (p_document->>'series_id')::uuid,
      nullif(p_document->>'store_id','')::uuid,
      (p_document->>'issue_date')::date,
      nullif(p_document->>'due_date','')::date,
      nullif(p_document->>'operation_date','')::date,
      coalesce(nullif(p_document->>'origin',''),'totus'),
      'borrador',
      coalesce(nullif(p_document->>'document_type',''),'factura'),
      coalesce(nullif(p_document->>'invoice_kind',''),'invoice'),
      nullif(p_document->>'customer_id','')::uuid,
      btrim(p_document->>'customer_name'),
      coalesce(p_document->>'customer_tax_id',''),
      coalesce(p_document->>'customer_address',''),
      coalesce(p_document->>'customer_email',''),
      coalesce(p_document->>'concept',''),
      coalesce(nullif(p_document->>'payment_method',''),'transferencia'),
      coalesce(nullif(p_document->>'paid_status',''),'pendiente'),
      nullif(p_document->>'paid_date','')::date,
      coalesce((p_document->>'include_in_income')::boolean,false),
      nullif(p_document->>'template_id','')::uuid,
      coalesce(p_document->>'terms_text',''),
      coalesce(p_document->>'footer_text',''),
      coalesce(p_document->>'purchase_order_ref',''),
      coalesce(p_document->>'notes',''),
      auth.uid()
    ) returning id into v_id;
  end if;

  insert into public.ops_sales_invoice_lines(
    invoice_id,sort_order,description,quantity,unit_price_base,discount_pct,vat_rate
  )
  select
    v_id,
    coalesce((j->>'sort_order')::int,10),
    btrim(j->>'description'),
    coalesce((j->>'quantity')::numeric,1),
    coalesce((j->>'unit_price_base')::numeric,0),
    coalesce((j->>'discount_pct')::numeric,0),
    coalesce((j->>'vat_rate')::numeric,21)
  from jsonb_array_elements(p_lines) j;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.ops_save_expense_internal(p_expense jsonb, p_lines jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_management boolean := coalesce((p_expense->>'management_only')::boolean,false);
  v_base numeric := 0;
  v_vat numeric := 0;
  v_re numeric := 0;
  v_wh numeric := 0;
  v_accounting numeric := 0;
  v_payable numeric := 0;
begin
  if not private.is_team_member() then raise exception 'Sin acceso'; end if;
  if nullif(btrim(coalesce(p_expense->>'supplier_name','')),'') is null then raise exception 'Proveedor obligatorio'; end if;
  if nullif(p_expense->>'expense_date','') is null then raise exception 'Fecha obligatoria'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines)=0 then raise exception 'El gasto debe tener líneas'; end if;

  select
    coalesce(sum(coalesce((j->>'base_amount')::numeric,0)),0),
    coalesce(sum(coalesce((j->>'base_amount')::numeric,0)*coalesce((j->>'vat_rate')::numeric,0)/100),0),
    coalesce(sum(coalesce((j->>'base_amount')::numeric,0)*coalesce((j->>'re_rate')::numeric,0)/100),0),
    coalesce(sum(coalesce((j->>'base_amount')::numeric,0)*coalesce((j->>'withholding_rate')::numeric,0)/100),0)
  into v_base,v_vat,v_re,v_wh
  from jsonb_array_elements(p_lines) j;

  if v_base <= 0 then raise exception 'El gasto debe tener una base mayor que cero'; end if;
  v_accounting := v_base+v_vat+v_re;
  v_payable := v_accounting-v_wh;

  v_id := nullif(p_expense->>'id','')::uuid;

  if v_id is not null then
    perform 1 from public.ops_expenses where id=v_id for update;
    if not found then raise exception 'Gasto no encontrado'; end if;

    update public.ops_expenses set
      store_id=nullif(p_expense->>'store_id','')::uuid,
      expense_date=(p_expense->>'expense_date')::date,
      supplier_name=btrim(p_expense->>'supplier_name'),
      supplier_tax_id=coalesce(p_expense->>'supplier_tax_id',''),
      invoice_number=coalesce(p_expense->>'invoice_number',''),
      description=coalesce(p_expense->>'description',''),
      payment_method=coalesce(nullif(p_expense->>'payment_method',''),'transferencia'),
      paid_status=coalesce(nullif(p_expense->>'paid_status',''),'pagado'),
      paid_date=nullif(p_expense->>'paid_date','')::date,
      base_amount=v_base,
      vat_amount=v_vat,
      re_amount=v_re,
      withholding_amount=case when v_management then 0 else v_wh end,
      gross_expense=v_accounting,
      amount_paid=case when nullif(p_expense->>'amount_paid','') is null then v_payable else (p_expense->>'amount_paid')::numeric end,
      deductible_irpf=not v_management,
      deductible_pct=case when v_management then 0 else 100 end,
      notes=coalesce(p_expense->>'notes',''),
      document_kind=coalesce(nullif(p_expense->>'document_kind',''),'factura'),
      source='manual',
      fiscal_reviewed=case when v_management then false else coalesce((p_expense->>'fiscal_reviewed')::boolean,false) end,
      accounting_amount=v_accounting,
      management_only=v_management,
      updated_at=now()
    where id=v_id;

    delete from public.ops_expense_lines where expense_id=v_id;
  else
    insert into public.ops_expenses(
      store_id,expense_date,supplier_name,supplier_tax_id,invoice_number,description,payment_method,
      paid_status,paid_date,base_amount,vat_amount,re_amount,withholding_amount,gross_expense,amount_paid,
      deductible_irpf,deductible_pct,notes,created_by,document_kind,source,fiscal_reviewed,accounting_amount,management_only
    ) values (
      nullif(p_expense->>'store_id','')::uuid,
      (p_expense->>'expense_date')::date,
      btrim(p_expense->>'supplier_name'),
      coalesce(p_expense->>'supplier_tax_id',''),
      coalesce(p_expense->>'invoice_number',''),
      coalesce(p_expense->>'description',''),
      coalesce(nullif(p_expense->>'payment_method',''),'transferencia'),
      coalesce(nullif(p_expense->>'paid_status',''),'pagado'),
      nullif(p_expense->>'paid_date','')::date,
      v_base,v_vat,v_re,case when v_management then 0 else v_wh end,v_accounting,
      case when nullif(p_expense->>'amount_paid','') is null then v_payable else (p_expense->>'amount_paid')::numeric end,
      not v_management,case when v_management then 0 else 100 end,
      coalesce(p_expense->>'notes',''),auth.uid(),
      coalesce(nullif(p_expense->>'document_kind',''),'factura'),'manual',
      case when v_management then false else coalesce((p_expense->>'fiscal_reviewed')::boolean,false) end,
      v_accounting,v_management
    ) returning id into v_id;
  end if;

  insert into public.ops_expense_lines(
    expense_id,sort_order,category_id,description,base_amount,vat_rate,vat_amount,re_base,re_rate,re_amount,
    irpf_imputable,withholding_base,withholding_rate,withholding_amount,withholding_model,deductible_irpf,
    deductible_pct,fixed_asset,notes
  )
  select
    v_id,
    coalesce((j->>'sort_order')::int,10),
    nullif(j->>'category_id','')::uuid,
    coalesce(j->>'description',''),
    coalesce((j->>'base_amount')::numeric,0),
    case when v_management then 0 else coalesce((j->>'vat_rate')::numeric,0) end,
    case when v_management then 0 else coalesce((j->>'base_amount')::numeric,0)*coalesce((j->>'vat_rate')::numeric,0)/100 end,
    case when not v_management and coalesce((j->>'re_rate')::numeric,0)<>0 then coalesce((j->>'base_amount')::numeric,0) else 0 end,
    case when v_management then 0 else coalesce((j->>'re_rate')::numeric,0) end,
    case when v_management then 0 else coalesce((j->>'base_amount')::numeric,0)*coalesce((j->>'re_rate')::numeric,0)/100 end,
    case when not v_management and coalesce((j->>'deductible_irpf')::boolean,true) and not coalesce((j->>'fixed_asset')::boolean,false)
      then coalesce((j->>'base_amount')::numeric,0)
           +coalesce((j->>'base_amount')::numeric,0)*coalesce((j->>'vat_rate')::numeric,0)/100
           +coalesce((j->>'base_amount')::numeric,0)*coalesce((j->>'re_rate')::numeric,0)/100
      else 0 end,
    case when not v_management and coalesce((j->>'withholding_rate')::numeric,0)<>0 then coalesce((j->>'base_amount')::numeric,0) else 0 end,
    case when v_management then 0 else coalesce((j->>'withholding_rate')::numeric,0) end,
    case when v_management then 0 else coalesce((j->>'base_amount')::numeric,0)*coalesce((j->>'withholding_rate')::numeric,0)/100 end,
    case when v_management then null else nullif(j->>'withholding_model','') end,
    case when v_management then false else coalesce((j->>'deductible_irpf')::boolean,true) end,
    case when v_management then 0 else coalesce((j->>'deductible_pct')::numeric,100) end,
    coalesce((j->>'fixed_asset')::boolean,false),
    coalesce(j->>'notes','')
  from jsonb_array_elements(p_lines) j;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.ops_validate_sales_document_series()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare s public.ops_invoice_series;
begin
  if tg_op='UPDATE'
     and new.series_id is not distinct from old.series_id
     and new.issue_date is not distinct from old.issue_date
     and new.document_type is not distinct from old.document_type
     and new.invoice_kind is not distinct from old.invoice_kind
     and new.store_id is not distinct from old.store_id
  then
    return new;
  end if;

  select * into s from public.ops_invoice_series where id=new.series_id;
  if not found then raise exception 'Serie no encontrada'; end if;
  if not s.active then raise exception 'La serie no está activa'; end if;

  if s.year <> extract(year from new.issue_date)::integer then
    raise exception 'La fecha del documento (%) no corresponde al año de la serie (%)',new.issue_date,s.year;
  end if;

  if s.document_type <> new.document_type then
    raise exception 'La serie no corresponde al tipo de documento';
  end if;

  if new.document_type='factura'
     and coalesce(s.series_kind,'invoice') <> coalesce(new.invoice_kind,'invoice')
  then
    raise exception 'La serie no corresponde al tipo de factura';
  end if;

  if s.store_id is not null and new.store_id is distinct from s.store_id then
    raise exception 'La serie no corresponde al establecimiento seleccionado';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.ops_convert_proforma(p_proforma_id uuid, p_invoice_series_id uuid)
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select private.ops_convert_proforma_internal(p_proforma_id,p_invoice_series_id); $function$;

CREATE OR REPLACE FUNCTION public.ops_finalize_document(p_document_id uuid)
 RETURNS ops_sales_invoices
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select private.ops_finalize_document_internal(p_document_id); $function$;

CREATE OR REPLACE FUNCTION public.ops_issue_invoice(p_invoice_id uuid)
 RETURNS ops_sales_invoices
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select private.ops_issue_invoice_internal(p_invoice_id); $function$;

CREATE OR REPLACE FUNCTION public.ops_register_external_document(p_document_id uuid, p_number integer)
 RETURNS ops_sales_invoices
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select private.ops_register_external_document_internal(p_document_id,p_number); $function$;

CREATE OR REPLACE FUNCTION public.ops_save_closing(p_closing jsonb, p_drawers jsonb)
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select private.ops_save_closing_internal(p_closing,p_drawers); $function$;

CREATE OR REPLACE FUNCTION public.ops_save_document_draft(p_document jsonb, p_lines jsonb)
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select private.ops_save_document_draft_internal(p_document,p_lines); $function$;

CREATE OR REPLACE FUNCTION public.ops_save_expense(p_expense jsonb, p_lines jsonb)
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select private.ops_save_expense_internal(p_expense,p_lines); $function$;

drop policy if exists ops_invoices_insert on public.ops_sales_invoices;
create policy ops_invoices_insert on public.ops_sales_invoices for insert to authenticated with check (private.is_manager());
drop policy if exists ops_invoices_update on public.ops_sales_invoices;
create policy ops_invoices_update on public.ops_sales_invoices for update to authenticated using (private.is_manager()) with check (private.is_manager());

drop policy if exists ops_invoice_lines_insert on public.ops_sales_invoice_lines;
create policy ops_invoice_lines_insert on public.ops_sales_invoice_lines for insert to authenticated with check (private.is_manager());
drop policy if exists ops_invoice_lines_update on public.ops_sales_invoice_lines;
create policy ops_invoice_lines_update on public.ops_sales_invoice_lines for update to authenticated using (private.is_manager()) with check (private.is_manager());
drop policy if exists ops_invoice_lines_delete on public.ops_sales_invoice_lines;
create policy ops_invoice_lines_delete on public.ops_sales_invoice_lines for delete to authenticated using (private.is_manager());

drop policy if exists ops_closings_insert on public.ops_daily_closings;
create policy ops_closings_insert on public.ops_daily_closings for insert to authenticated with check (private.is_manager());
drop policy if exists ops_closings_update on public.ops_daily_closings;
create policy ops_closings_update on public.ops_daily_closings for update to authenticated using (private.is_manager()) with check (private.is_manager());

drop policy if exists ops_closing_drawers_insert on public.ops_daily_closing_drawers;
create policy ops_closing_drawers_insert on public.ops_daily_closing_drawers for insert to authenticated with check (private.is_manager());
drop policy if exists ops_closing_drawers_update on public.ops_daily_closing_drawers;
create policy ops_closing_drawers_update on public.ops_daily_closing_drawers for update to authenticated using (private.is_manager()) with check (private.is_manager());

drop policy if exists ops_expenses_insert on public.ops_expenses;
create policy ops_expenses_insert on public.ops_expenses for insert to authenticated with check (private.is_manager());
drop policy if exists ops_expenses_update on public.ops_expenses;
create policy ops_expenses_update on public.ops_expenses for update to authenticated using (private.is_manager()) with check (private.is_manager());

drop policy if exists ops_expense_lines_insert on public.ops_expense_lines;
create policy ops_expense_lines_insert on public.ops_expense_lines for insert to authenticated with check (private.is_manager());
drop policy if exists ops_expense_lines_update on public.ops_expense_lines;
create policy ops_expense_lines_update on public.ops_expense_lines for update to authenticated using (private.is_manager()) with check (private.is_manager());
drop policy if exists ops_expense_lines_delete on public.ops_expense_lines;
create policy ops_expense_lines_delete on public.ops_expense_lines for delete to authenticated using (private.is_manager());

drop policy if exists ops_customers_insert on public.ops_customers;
create policy ops_customers_insert on public.ops_customers for insert to authenticated with check (private.is_manager());
drop policy if exists ops_customers_update on public.ops_customers;
create policy ops_customers_update on public.ops_customers for update to authenticated using (private.is_manager()) with check (private.is_manager());

drop trigger if exists ops_validate_sales_document_series_tg on public.ops_sales_invoices;
create trigger ops_validate_sales_document_series_tg
before insert or update on public.ops_sales_invoices
for each row execute function public.ops_validate_sales_document_series();

revoke all on function public.ops_save_closing(jsonb,jsonb) from public,anon;
revoke all on function public.ops_save_expense(jsonb,jsonb) from public,anon;
revoke all on function public.ops_save_document_draft(jsonb,jsonb) from public,anon;
revoke all on function public.ops_finalize_document(uuid) from public,anon;
revoke all on function public.ops_register_external_document(uuid,integer) from public,anon;
revoke all on function public.ops_convert_proforma(uuid,uuid) from public,anon;
revoke all on function public.ops_issue_invoice(uuid) from public,anon;

grant execute on function public.ops_save_closing(jsonb,jsonb) to authenticated,service_role;
grant execute on function public.ops_save_expense(jsonb,jsonb) to authenticated,service_role;
grant execute on function public.ops_save_document_draft(jsonb,jsonb) to authenticated,service_role;
grant execute on function public.ops_finalize_document(uuid) to authenticated,service_role;
grant execute on function public.ops_register_external_document(uuid,integer) to authenticated,service_role;
grant execute on function public.ops_convert_proforma(uuid,uuid) to authenticated,service_role;
grant execute on function public.ops_issue_invoice(uuid) to authenticated,service_role;



-- Boundary RPC: funciones públicas invocadoras; privilegios reales permanecen en private.
grant usage on schema private to authenticated, service_role;
revoke usage on schema private from anon;

revoke all on function private.ops_save_closing_internal(jsonb,jsonb) from public,anon;
revoke all on function private.ops_save_expense_internal(jsonb,jsonb) from public,anon;
revoke all on function private.ops_save_document_draft_internal(jsonb,jsonb) from public,anon;
revoke all on function private.ops_finalize_document_internal(uuid) from public,anon;
revoke all on function private.ops_register_external_document_internal(uuid,integer) from public,anon;
revoke all on function private.ops_convert_proforma_internal(uuid,uuid) from public,anon;
revoke all on function private.ops_issue_invoice_internal(uuid) from public,anon;

grant execute on function private.ops_save_closing_internal(jsonb,jsonb) to authenticated,service_role;
grant execute on function private.ops_save_expense_internal(jsonb,jsonb) to authenticated,service_role;
grant execute on function private.ops_save_document_draft_internal(jsonb,jsonb) to authenticated,service_role;
grant execute on function private.ops_finalize_document_internal(uuid) to authenticated,service_role;
grant execute on function private.ops_register_external_document_internal(uuid,integer) to authenticated,service_role;
grant execute on function private.ops_convert_proforma_internal(uuid,uuid) to authenticated,service_role;
grant execute on function private.ops_issue_invoice_internal(uuid) to authenticated,service_role;

alter function public.ops_save_closing(jsonb,jsonb) security invoker;
alter function public.ops_save_expense(jsonb,jsonb) security invoker;
alter function public.ops_save_document_draft(jsonb,jsonb) security invoker;
alter function public.ops_finalize_document(uuid) security invoker;
alter function public.ops_register_external_document(uuid,integer) security invoker;
alter function public.ops_convert_proforma(uuid,uuid) security invoker;
alter function public.ops_issue_invoice(uuid) security invoker;


-- Storage: documentos de negocio y recursos de marca.
drop policy if exists "totus_business_documents_read" on storage.objects;
create policy "totus_business_documents_read"
on storage.objects for select to authenticated
using (bucket_id='business-documents' and private.is_team_member());

drop policy if exists "totus_business_documents_insert" on storage.objects;
create policy "totus_business_documents_insert"
on storage.objects for insert to authenticated
with check (bucket_id='business-documents' and private.is_team_member());

drop policy if exists "totus_business_documents_update" on storage.objects;
create policy "totus_business_documents_update"
on storage.objects for update to authenticated
using (bucket_id='business-documents' and private.is_team_member())
with check (bucket_id='business-documents' and private.is_team_member());

drop policy if exists "totus_business_documents_delete" on storage.objects;
create policy "totus_business_documents_delete"
on storage.objects for delete to authenticated
using (bucket_id='business-documents' and private.is_manager());

drop policy if exists "totus_business_assets_read" on storage.objects;
create policy "totus_business_assets_read"
on storage.objects for select to authenticated
using (bucket_id='business-assets' and private.is_team_member());

drop policy if exists "totus_business_assets_insert" on storage.objects;
create policy "totus_business_assets_insert"
on storage.objects for insert to authenticated
with check (bucket_id='business-assets' and private.is_manager());

drop policy if exists "totus_business_assets_update" on storage.objects;
create policy "totus_business_assets_update"
on storage.objects for update to authenticated
using (bucket_id='business-assets' and private.is_manager())
with check (bucket_id='business-assets' and private.is_manager());

drop policy if exists "totus_business_assets_delete" on storage.objects;
create policy "totus_business_assets_delete"
on storage.objects for delete to authenticated
using (bucket_id='business-assets' and private.is_manager());


-- Contador real de almacenamiento desde storage.objects.
create or replace function private.ops_storage_usage_internal()
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $function$
declare
  docs_bytes bigint:=0;
  assets_bytes bigint:=0;
  docs_count integer:=0;
  assets_count integer:=0;
begin
  if not private.is_team_member() then raise exception 'Sin acceso'; end if;

  select count(*)::int,coalesce(sum(coalesce((metadata->>'size')::bigint,0)),0)::bigint
    into docs_count,docs_bytes
  from storage.objects where bucket_id='business-documents';

  select count(*)::int,coalesce(sum(coalesce((metadata->>'size')::bigint,0)),0)::bigint
    into assets_count,assets_bytes
  from storage.objects where bucket_id='business-assets';

  return jsonb_build_object(
    'documents_count',docs_count,
    'documents_bytes',docs_bytes,
    'assets_count',assets_count,
    'assets_bytes',assets_bytes,
    'total_bytes',docs_bytes+assets_bytes
  );
end;
$function$;

create or replace function public.ops_storage_usage()
returns jsonb
language sql
security invoker
set search_path = public
as $function$
  select private.ops_storage_usage_internal();
$function$;

revoke all on function private.ops_storage_usage_internal() from public,anon;
grant execute on function private.ops_storage_usage_internal() to authenticated,service_role;
revoke all on function public.ops_storage_usage() from public,anon;
grant execute on function public.ops_storage_usage() to authenticated,service_role;


-- Eliminación controlada de gastos manuales.
create or replace function private.ops_delete_manual_expense_internal(p_expense_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  e public.ops_expenses;
  d public.ops_documents;
begin
  if not private.is_manager() then raise exception 'Solo administración o gerencia puede eliminar gastos'; end if;

  select * into e from public.ops_expenses where id=p_expense_id for update;
  if not found then raise exception 'Gasto no encontrado'; end if;
  if coalesce(e.source,'manual')<>'manual' then raise exception 'Los gastos importados no se eliminan desde la aplicación'; end if;

  if e.document_id is not null then
    select * into d from public.ops_documents
    where id=e.document_id and linked_entity_type='expense' and linked_entity_id=e.id
    for update;
  end if;

  delete from public.ops_expenses where id=e.id;
  if d.id is not null then delete from public.ops_documents where id=d.id; end if;

  return jsonb_build_object('expense_id',e.id,'document_id',d.id,'storage_path',d.storage_path);
end;
$function$;

create or replace function public.ops_delete_manual_expense(p_expense_id uuid)
returns jsonb
language sql
security invoker
set search_path = public
as $function$
  select private.ops_delete_manual_expense_internal(p_expense_id);
$function$;

revoke all on function private.ops_delete_manual_expense_internal(uuid) from public,anon;
grant execute on function private.ops_delete_manual_expense_internal(uuid) to authenticated,service_role;
revoke all on function public.ops_delete_manual_expense(uuid) from public,anon;
grant execute on function public.ops_delete_manual_expense(uuid) to authenticated,service_role;


-- Plantillas documentales y borrado de documentos: operaciones atómicas.
create or replace function private.ops_save_document_template_internal(p_id uuid,p_template jsonb)
returns uuid
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_inv boolean:=coalesce((p_template->>'default_invoice')::boolean,false);
  v_pro boolean:=coalesce((p_template->>'default_proforma')::boolean,false);
begin
  if not private.is_manager() then raise exception 'Solo administración o gerencia puede editar plantillas'; end if;
  if not exists(select 1 from public.ops_document_templates where id=p_id) then raise exception 'Plantilla no encontrada'; end if;
  if nullif(btrim(coalesce(p_template->>'name','')),'') is null then raise exception 'Nombre de plantilla obligatorio'; end if;
  if coalesce((p_template->>'logo_width_mm')::numeric,34)<10 or coalesce((p_template->>'logo_width_mm')::numeric,34)>80 then
    raise exception 'El ancho del logo debe estar entre 10 y 80 mm';
  end if;
  if v_inv then update public.ops_document_templates set default_invoice=false where id<>p_id and default_invoice; end if;
  if v_pro then update public.ops_document_templates set default_proforma=false where id<>p_id and default_proforma; end if;
  update public.ops_document_templates set
    name=btrim(p_template->>'name'),style=coalesce(nullif(p_template->>'style',''),'clean'),
    primary_color=coalesce(nullif(p_template->>'primary_color',''),'#17202A'),
    secondary_color=coalesce(nullif(p_template->>'secondary_color',''),'#3B82F6'),
    text_color=coalesce(nullif(p_template->>'text_color',''),'#17202A'),
    font_family=coalesce(nullif(p_template->>'font_family',''),'helvetica'),
    logo_width_mm=coalesce((p_template->>'logo_width_mm')::numeric,34),
    logo_position=coalesce(nullif(p_template->>'logo_position',''),'left'),
    show_logo=coalesce((p_template->>'show_logo')::boolean,true),
    show_payment_details=coalesce((p_template->>'show_payment_details')::boolean,true),
    invoice_title=coalesce(nullif(btrim(p_template->>'invoice_title'),''),'FACTURA'),
    proforma_title=coalesce(nullif(btrim(p_template->>'proforma_title'),''),'FACTURA PROFORMA'),
    header_text=coalesce(p_template->>'header_text',''),
    payment_terms_default=coalesce(p_template->>'payment_terms_default',''),
    bank_details=coalesce(p_template->>'bank_details',''),
    footer_text=coalesce(p_template->>'footer_text',''),
    default_invoice=v_inv,default_proforma=v_pro,updated_at=now()
  where id=p_id;
  return p_id;
end;
$function$;

create or replace function public.ops_save_document_template(p_id uuid,p_template jsonb)
returns uuid language sql security invoker set search_path=public
as $function$ select private.ops_save_document_template_internal(p_id,p_template); $function$;

revoke all on function private.ops_save_document_template_internal(uuid,jsonb) from public,anon;
grant execute on function private.ops_save_document_template_internal(uuid,jsonb) to authenticated,service_role;
revoke all on function public.ops_save_document_template(uuid,jsonb) from public,anon;
grant execute on function public.ops_save_document_template(uuid,jsonb) to authenticated,service_role;

create or replace function private.ops_delete_document_internal(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare d public.ops_documents;
begin
  if not private.is_manager() then raise exception 'Solo administración o gerencia puede eliminar documentos'; end if;
  select * into d from public.ops_documents where id=p_id for update;
  if not found then raise exception 'Documento no encontrado'; end if;
  if coalesce(d.linked_entity_type,'') like 'sales_invoice%' then raise exception 'Los documentos de facturación no se eliminan desde el archivo'; end if;
  delete from public.ops_documents where id=p_id;
  return jsonb_build_object('id',d.id,'storage_path',d.storage_path,'original_name',d.original_name);
end;
$function$;

create or replace function public.ops_delete_document(p_id uuid)
returns jsonb language sql security invoker set search_path=public
as $function$ select private.ops_delete_document_internal(p_id); $function$;

revoke all on function private.ops_delete_document_internal(uuid) from public,anon;
grant execute on function private.ops_delete_document_internal(uuid) to authenticated,service_role;
revoke all on function public.ops_delete_document(uuid) from public,anon;
grant execute on function public.ops_delete_document(uuid) to authenticated,service_role;

commit;