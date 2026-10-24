CREATE OR REPLACE FUNCTION private.totus_expense_report_source(p_source text,p_group text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO ''
AS $fn$
DECLARE source jsonb; chosen text=nullif(p_group,'');
BEGIN
 IF chosen IS NOT NULL AND chosen NOT IN ('other','payroll','orders','fixed','irpf') THEN RAISE EXCEPTION 'Selecciona una categoría del Excel válida'; END IF;
 BEGIN source=coalesce(nullif(p_source,''),'{}')::jsonb;
 EXCEPTION WHEN others THEN RAISE EXCEPTION 'No se puede leer el origen de este gasto. No se ha modificado'; END;
 IF jsonb_typeof(source)<>'object' THEN RAISE EXCEPTION 'El origen del gasto no es válido. No se ha modificado'; END IF;
 IF chosen IS NULL THEN source=source-'report_display';
 ELSE source=jsonb_set(source,'{report_display}',jsonb_build_object('group',chosen)); END IF;
 RETURN CASE WHEN source='{}'::jsonb THEN NULL ELSE source::text END;
END $fn$;
REVOKE ALL ON FUNCTION private.totus_expense_report_source(text,text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.totus_set_expense_report_group(p_id uuid,p_group text,p_expected_group text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE before_row jsonb; after_row jsonb; source text; previous_group text;
BEGIN
 IF auth.uid() IS NULL OR NOT private.totus_can('gastos','edit') THEN RAISE EXCEPTION 'No tienes permiso para editar gastos'; END IF;
 SELECT to_jsonb(e),e.source_ref INTO before_row,source FROM public.ops_expenses e WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Gasto no encontrado'; END IF;
 BEGIN previous_group=(coalesce(nullif(source,''),'{}')::jsonb)->'report_display'->>'group';
 EXCEPTION WHEN others THEN RAISE EXCEPTION 'No se puede leer el origen de este gasto. No se ha modificado'; END;
 IF nullif(previous_group,'') IS DISTINCT FROM nullif(p_expected_group,'') THEN RAISE EXCEPTION 'La categoría del Excel ha cambiado. Actualiza la ficha antes de guardar'; END IF;
 UPDATE public.ops_expenses e SET source_ref=private.totus_expense_report_source(source,p_group) WHERE id=p_id
 RETURNING to_jsonb(e) INTO after_row;
 IF before_row-ARRAY['source_ref','updated_at'] IS DISTINCT FROM after_row-ARRAY['source_ref','updated_at'] THEN
  RAISE EXCEPTION 'No se ha guardado: la operación intentaba cambiar otros datos del gasto';
 END IF;
 PERFORM private.totus_audit('gastos','categoria_excel',p_id,jsonb_build_object('antes',previous_group,'despues',nullif(p_group,'')));
 RETURN p_id;
END $fn$;
REVOKE ALL ON FUNCTION public.totus_set_expense_report_group(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.totus_set_expense_report_group(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.totus_save_expense(p_expense jsonb, p_lines jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public,private'
AS $function$
declare
  v_id uuid := nullif(p_expense->>'id','')::uuid;
  v_store uuid := nullif(p_expense->>'store_id','')::uuid;
  v_date date := nullif(p_expense->>'expense_date','')::date;
  v_supplier text := btrim(coalesce(p_expense->>'supplier_name',''));
  v_tax text := btrim(coalesce(p_expense->>'supplier_tax_id',''));
  v_invoice text := btrim(coalesce(p_expense->>'invoice_number',''));
  v_paid_status text := coalesce(nullif(p_expense->>'paid_status',''),'pagado');
  v_paid_date date := nullif(p_expense->>'paid_date','')::date;
  v_amount_paid numeric := coalesce((p_expense->>'amount_paid')::numeric,0);
begin
  if not (private.totus_can('gastos',case when nullif(p_expense->>'id','') is null then 'create' else 'edit' end)) then raise exception 'Solo administración o gerencia puede guardar gastos'; end if;
  if v_store is null or v_date is null or v_supplier='' then raise exception 'Tienda, fecha y proveedor son obligatorios'; end if;
  if v_date>current_date then raise exception 'La fecha del gasto no puede ser futura'; end if;
  if v_paid_date is not null and v_paid_date>current_date then raise exception 'La fecha de pago no puede ser futura'; end if;
  if v_paid_status not in ('pendiente','pagado','parcial') then raise exception 'Estado de pago no válido'; end if;
  if v_amount_paid<0 and coalesce(p_expense->>'document_kind','factura')<>'rectificativa' then raise exception 'Un importe devuelto negativo exige una rectificativa'; end if;
  if v_paid_status='pendiente' and v_amount_paid<>0 then raise exception 'Un gasto pendiente no puede tener importe pagado'; end if;
  if v_paid_status='pagado' and v_paid_date is null then raise exception 'Indica la fecha de pago'; end if;
  if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'El gasto debe tener al menos una línea'; end if;

  if v_invoice<>'' and exists(
    select 1 from public.ops_expenses e
    where e.id is distinct from v_id
      and lower(btrim(coalesce(e.invoice_number,'')))=lower(v_invoice)
      and (
        (v_tax<>'' and lower(btrim(coalesce(e.supplier_tax_id,'')))=lower(v_tax))
        or (v_tax='' and lower(btrim(coalesce(e.supplier_name,'')))=lower(v_supplier))
      )
  ) then raise exception 'Ya existe esa factura para el mismo proveedor'; end if;

  if exists(
    select 1 from jsonb_array_elements(p_lines) j
    where nullif(btrim(coalesce(j->>'description','')),'') is null
       or (coalesce((j->>'base_amount')::numeric,0)<0 and coalesce(p_expense->>'document_kind','factura')<>'rectificativa')
       or coalesce((j->>'vat_rate')::numeric,0)<0
       or coalesce((j->>'re_rate')::numeric,0)<0
       or coalesce((j->>'withholding_rate')::numeric,0)<0
       or coalesce((j->>'deductible_pct')::numeric,100)<0
       or coalesce((j->>'deductible_pct')::numeric,100)>100
       or (nullif(j->>'withholding_model','') is not null and nullif(j->>'withholding_model','') not in ('111','115'))
  ) then raise exception 'Hay líneas del gasto con valores no válidos'; end if;

  if v_id is null then
    insert into public.ops_expenses(
      store_id,expense_date,supplier_name,supplier_tax_id,invoice_number,category_id,description,
      payment_method,paid_status,paid_date,base_amount,vat_rate,vat_amount,re_rate,re_amount,
      withholding_rate,withholding_amount,withholding_model,gross_expense,amount_paid,deductible_irpf,
      deductible_pct,fixed_asset,amortization_years,document_id,notes,created_by,document_kind,source,
      fiscal_reviewed,management_only,personnel_kind,supplier_id
    ) values(
      v_store,v_date,v_supplier,v_tax,v_invoice,
      nullif(p_expense->>'category_id','')::uuid,coalesce(p_expense->>'description',''),
      coalesce(nullif(p_expense->>'payment_method',''),'tarjeta'),v_paid_status,v_paid_date,
      0,coalesce((p_expense->>'vat_rate')::numeric,0),0,
      coalesce((p_expense->>'re_rate')::numeric,0),0,coalesce((p_expense->>'withholding_rate')::numeric,0),0,
      nullif(p_expense->>'withholding_model',''),0,v_amount_paid,
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
      store_id=v_store,expense_date=v_date,supplier_name=v_supplier,supplier_tax_id=v_tax,invoice_number=v_invoice,
      category_id=nullif(p_expense->>'category_id','')::uuid,description=coalesce(p_expense->>'description',''),
      payment_method=coalesce(nullif(p_expense->>'payment_method',''),'tarjeta'),paid_status=v_paid_status,paid_date=v_paid_date,
      vat_rate=coalesce((p_expense->>'vat_rate')::numeric,0),re_rate=coalesce((p_expense->>'re_rate')::numeric,0),
      withholding_rate=coalesce((p_expense->>'withholding_rate')::numeric,0),withholding_model=nullif(p_expense->>'withholding_model',''),
      amount_paid=v_amount_paid,deductible_irpf=coalesce((p_expense->>'deductible_irpf')::boolean,true),
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
    btrim(coalesce(j->>'description','')),coalesce((j->>'base_amount')::numeric,0),coalesce((j->>'vat_rate')::numeric,0),
    coalesce((j->>'vat_amount')::numeric,0),coalesce((j->>'re_base')::numeric,0),coalesce((j->>'re_rate')::numeric,0),
    coalesce((j->>'re_amount')::numeric,0),coalesce((j->>'irpf_imputable')::numeric,0),
    coalesce((j->>'withholding_base')::numeric,0),coalesce((j->>'withholding_rate')::numeric,0),
    coalesce((j->>'withholding_amount')::numeric,0),nullif(j->>'withholding_model',''),
    coalesce((j->>'deductible_irpf')::boolean,true),coalesce((j->>'deductible_pct')::numeric,100),
    coalesce((j->>'fixed_asset')::boolean,false),nullif(j->>'amortization_years','')::numeric,coalesce(j->>'notes','')
  from jsonb_array_elements(p_lines) j;

  if v_paid_status='pagado' and abs(coalesce((select accounting_amount-withholding_amount from public.ops_expenses where id=v_id),0)-v_amount_paid)>.02 then
    raise exception 'El importe pagado no coincide con el neto a pagar del gasto';
  end if;
  if v_amount_paid<>0 and v_amount_paid*coalesce((select accounting_amount-withholding_amount from public.ops_expenses where id=v_id),0)<0 then raise exception 'El pago o devolución debe tener el mismo signo que la factura'; end if;
  if v_paid_status='parcial' and (v_amount_paid=0 or abs(v_amount_paid)>=abs(coalesce((select accounting_amount-withholding_amount from public.ops_expenses where id=v_id),0))) then
    raise exception 'Un pago parcial debe ser menor que el total';
  end if;

  if p_expense ? 'report_group' then
    update public.ops_expenses set source_ref=private.totus_expense_report_source(source_ref,p_expense->>'report_group') where id=v_id;
  end if;
  perform private.totus_audit('gastos',case when nullif(p_expense->>'id','') is null then 'crear' else 'actualizar' end,v_id,
    jsonb_build_object('fecha',v_date,'proveedor',v_supplier,'factura',v_invoice,'estado_pago',v_paid_status));
  return v_id;
end;
$function$
