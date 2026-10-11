-- Totus Central · Gastos V11
-- Validación coherente de pagos y soporte real de rectificativas/abonos.
CREATE OR REPLACE FUNCTION private.ops_save_expense_internal(p_expense jsonb, p_lines jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_existing public.ops_expenses;
  v_management boolean:=coalesce((p_expense->>'management_only')::boolean,false);
  v_document_kind text:=coalesce(nullif(p_expense->>'document_kind',''),'factura');
  v_paid_status text:=coalesce(nullif(p_expense->>'paid_status',''),'pagado');
  v_base numeric:=0; v_vat numeric:=0; v_re numeric:=0; v_wh numeric:=0;
  v_accounting numeric:=0; v_payable numeric:=0; v_amount_paid numeric:=0;
  v_paid_date date;
begin
  if not private.is_team_member() then raise exception 'Sin acceso'; end if;
  if nullif(btrim(coalesce(p_expense->>'supplier_name','')),'') is null then raise exception 'Proveedor obligatorio'; end if;
  if nullif(p_expense->>'expense_date','') is null then raise exception 'Fecha obligatoria'; end if;
  if v_document_kind not in ('factura','rectificativa','ticket','nomina','seguridad_social','recibo','otro') then
    raise exception 'Tipo de documento no válido';
  end if;
  if v_paid_status not in ('pagado','pendiente','parcial') then raise exception 'Estado de pago no válido'; end if;
  if v_document_kind in ('factura','rectificativa') and nullif(btrim(coalesce(p_expense->>'invoice_number','')),'') is null then
    raise exception 'Número de factura obligatorio';
  end if;
  if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'El gasto debe tener líneas'; end if;

  if exists(
    select 1 from jsonb_array_elements(p_lines) j
    where coalesce((j->>'base_amount')::numeric,0)=0
  ) then raise exception 'Todas las líneas deben tener una base distinta de cero'; end if;

  if v_document_kind<>'rectificativa' and exists(
    select 1 from jsonb_array_elements(p_lines) j where coalesce((j->>'base_amount')::numeric,0)<0
  ) then raise exception 'Las bases negativas solo se permiten en rectificativas / abonos'; end if;

  if exists(
    select 1 from jsonb_array_elements(p_lines) j
    where coalesce((j->>'vat_rate')::numeric,0) not between 0 and 100
       or coalesce((j->>'re_rate')::numeric,0) not between 0 and 100
       or coalesce((j->>'withholding_rate')::numeric,0) not between 0 and 100
       or coalesce((j->>'deductible_pct')::numeric,100) not between 0 and 100
  ) then raise exception 'Porcentajes fuera de rango'; end if;

  select
    coalesce(sum(coalesce((j->>'base_amount')::numeric,0)),0),
    coalesce(sum(case when v_management then 0 else coalesce((j->>'base_amount')::numeric,0)*coalesce((j->>'vat_rate')::numeric,0)/100 end),0),
    coalesce(sum(case when v_management then 0 else coalesce((j->>'base_amount')::numeric,0)*coalesce((j->>'re_rate')::numeric,0)/100 end),0),
    coalesce(sum(case when v_management then 0 else coalesce((j->>'base_amount')::numeric,0)*coalesce((j->>'withholding_rate')::numeric,0)/100 end),0)
  into v_base,v_vat,v_re,v_wh
  from jsonb_array_elements(p_lines) j;

  if v_document_kind='rectificativa' then
    if v_base=0 then raise exception 'La rectificativa debe tener un importe distinto de cero'; end if;
  elsif v_base<=0 then
    raise exception 'El gasto debe tener una base mayor que cero';
  end if;

  v_accounting:=v_base+v_vat+v_re;
  v_payable:=v_accounting-v_wh;

  if v_paid_status='pendiente' then
    v_amount_paid:=0;
    v_paid_date:=null;
  else
    v_amount_paid:=case when nullif(p_expense->>'amount_paid','') is null then v_payable else (p_expense->>'amount_paid')::numeric end;
    v_paid_date:=coalesce(nullif(p_expense->>'paid_date','')::date,(p_expense->>'expense_date')::date);
    if v_document_kind<>'rectificativa' then
      if v_amount_paid<0 then raise exception 'El importe pagado no puede ser negativo'; end if;
      if v_paid_status='parcial' and not (v_amount_paid>0 and v_amount_paid<v_payable) then
        raise exception 'El pago parcial debe ser mayor que cero y menor que el total a pagar';
      end if;
    end if;
  end if;

  v_id:=nullif(p_expense->>'id','')::uuid;

  if v_id is not null then
    select * into v_existing from public.ops_expenses where id=v_id for update;
    if not found then raise exception 'Gasto no encontrado'; end if;
    if v_existing.source<>'manual' and not private.is_manager() then
      raise exception 'Solo administración o gerencia puede modificar gastos importados';
    end if;

    update public.ops_expenses set
      store_id=nullif(p_expense->>'store_id','')::uuid,
      expense_date=(p_expense->>'expense_date')::date,
      supplier_name=btrim(p_expense->>'supplier_name'),
      supplier_tax_id=coalesce(p_expense->>'supplier_tax_id',''),
      invoice_number=coalesce(p_expense->>'invoice_number',''),
      description=coalesce(p_expense->>'description',''),
      payment_method=coalesce(nullif(p_expense->>'payment_method',''),'transferencia'),
      paid_status=v_paid_status,
      paid_date=v_paid_date,
      base_amount=v_base,vat_amount=v_vat,re_amount=v_re,
      withholding_amount=case when v_management then 0 else v_wh end,
      gross_expense=v_accounting,
      amount_paid=v_amount_paid,
      notes=coalesce(p_expense->>'notes',''),
      document_kind=v_document_kind,
      fiscal_reviewed=case when v_management then false else coalesce((p_expense->>'fiscal_reviewed')::boolean,false) end,
      accounting_amount=v_accounting,management_only=v_management,updated_at=now()
    where id=v_id;

    delete from public.ops_expense_lines where expense_id=v_id;
  else
    insert into public.ops_expenses(
      store_id,expense_date,supplier_name,supplier_tax_id,invoice_number,description,payment_method,
      paid_status,paid_date,base_amount,vat_amount,re_amount,withholding_amount,gross_expense,amount_paid,
      deductible_irpf,deductible_pct,notes,created_by,document_kind,source,fiscal_reviewed,accounting_amount,management_only
    ) values(
      nullif(p_expense->>'store_id','')::uuid,(p_expense->>'expense_date')::date,btrim(p_expense->>'supplier_name'),
      coalesce(p_expense->>'supplier_tax_id',''),coalesce(p_expense->>'invoice_number',''),coalesce(p_expense->>'description',''),
      coalesce(nullif(p_expense->>'payment_method',''),'transferencia'),v_paid_status,
      v_paid_date,v_base,v_vat,v_re,case when v_management then 0 else v_wh end,v_accounting,v_amount_paid,
      false,0,coalesce(p_expense->>'notes',''),auth.uid(),
      v_document_kind,'manual',
      case when v_management then false else coalesce((p_expense->>'fiscal_reviewed')::boolean,false) end,
      v_accounting,v_management
    ) returning id into v_id;
  end if;

  insert into public.ops_expense_lines(
    expense_id,sort_order,category_id,description,base_amount,vat_rate,vat_amount,re_base,re_rate,re_amount,
    irpf_imputable,withholding_base,withholding_rate,withholding_amount,withholding_model,deductible_irpf,
    deductible_pct,fixed_asset,notes
  )
  select v_id,
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
      then (coalesce((j->>'base_amount')::numeric,0)
           +coalesce((j->>'base_amount')::numeric,0)*coalesce((j->>'vat_rate')::numeric,0)/100
           +coalesce((j->>'base_amount')::numeric,0)*coalesce((j->>'re_rate')::numeric,0)/100)
           *least(100,greatest(0,coalesce((j->>'deductible_pct')::numeric,100)))/100
      else 0 end,
    case when not v_management and coalesce((j->>'withholding_rate')::numeric,0)<>0 then coalesce((j->>'base_amount')::numeric,0) else 0 end,
    case when v_management then 0 else coalesce((j->>'withholding_rate')::numeric,0) end,
    case when v_management then 0 else coalesce((j->>'base_amount')::numeric,0)*coalesce((j->>'withholding_rate')::numeric,0)/100 end,
    case when v_management then null else nullif(j->>'withholding_model','') end,
    case when v_management then false else coalesce((j->>'deductible_irpf')::boolean,true) end,
    case when v_management then 0 else least(100,greatest(0,coalesce((j->>'deductible_pct')::numeric,100))) end,
    coalesce((j->>'fixed_asset')::boolean,false),coalesce(j->>'notes','')
  from jsonb_array_elements(p_lines) j;

  update public.ops_expenses e set
    deductible_irpf=exists(
      select 1 from public.ops_expense_lines l
      where l.expense_id=e.id and l.deductible_irpf and not l.fixed_asset and l.deductible_pct>0
    ),
    deductible_pct=case when abs(e.accounting_amount)>0 then
      least(100,greatest(0,100*abs(coalesce((select sum(l.irpf_imputable) from public.ops_expense_lines l where l.expense_id=e.id),0))/abs(e.accounting_amount)))
      else 0 end
  where e.id=v_id;

  return v_id;
end
$function$
;
