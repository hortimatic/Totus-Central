-- Rectifying invoices by differences; positive paid_amount records the refund magnitude.
alter table public.ops_sales_invoice_lines drop constraint ops_sales_invoice_lines_quantity_check;
alter table public.ops_sales_invoice_lines add constraint ops_sales_invoice_lines_quantity_check check (quantity<>0);
alter table public.ops_sales_invoices
 add column rectified_invoice_id uuid references public.ops_sales_invoices(id) on delete restrict,
 add column rectification_reason text not null default '',
 add column rectified_invoice_snapshot jsonb not null default '{}'::jsonb;
create index ops_sales_invoices_rectified_invoice_idx on public.ops_sales_invoices(rectified_invoice_id)
 where rectified_invoice_id is not null;

create or replace function private.totus_validate_invoice_settlement(
 p_total numeric,p_amount numeric,p_status text,p_date date)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_total is null or p_amount is null or p_total::text in ('NaN','Infinity','-Infinity')
    or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<0 then
   raise exception 'Introduce un importe liquidado válido, igual o superior a cero';
 end if;
 if p_status is null or p_status not in ('pendiente','pagada','parcial') then raise exception 'Estado de liquidación no válido'; end if;
 if p_date>current_date then raise exception 'La fecha de liquidación no puede ser futura'; end if;
 if p_amount>abs(p_total)+0.02 then raise exception 'El importe liquidado no puede superar el total del documento'; end if;
 if p_status='pendiente' and p_amount<>0 then raise exception 'Un documento pendiente no puede tener importe liquidado'; end if;
 if p_status='pagada' and (p_date is null or abs(p_amount-abs(p_total))>0.02) then
   raise exception 'Un documento saldado debe tener fecha y el importe total liquidado';
 end if;
 if p_status='parcial' and (p_date is null or p_amount<=0 or p_amount>=abs(p_total)-0.02) then
   raise exception 'Una liquidación parcial necesita fecha e importe mayor que cero e inferior al total';
 end if;
end;
$$;
revoke all on function private.totus_validate_invoice_settlement(numeric,numeric,text,date) from public,anon;
grant execute on function private.totus_validate_invoice_settlement(numeric,numeric,text,date) to authenticated;

create or replace function private.totus_guard_rectifying_invoice()
returns trigger language plpgsql security invoker set search_path='' as $$
declare original public.ops_sales_invoices;
begin
 if TG_OP='UPDATE' and old.status<>'borrador' then
   if new.rectified_invoice_id is distinct from old.rectified_invoice_id
      or new.rectification_reason is distinct from old.rectification_reason
      or new.rectified_invoice_snapshot is distinct from old.rectified_invoice_snapshot then
     raise exception 'Documento emitido: la referencia y el motivo de rectificación son inalterables';
   end if;
   if new.document_type='factura' then
     perform private.totus_validate_invoice_settlement(new.total_amount,new.paid_amount,new.paid_status,new.paid_date);
   end if;
   return new;
 end if;
 new.rectification_reason=btrim(coalesce(new.rectification_reason,''));
 if new.document_type='factura' and new.invoice_kind='rectifying' then
   if new.rectified_invoice_id is null or new.rectified_invoice_id=new.id then
     raise exception 'Selecciona una factura original distinta de la rectificativa';
   end if;
   if new.rectification_reason='' or length(new.rectification_reason)>2000 then
     raise exception 'Indica el motivo de rectificación (máximo 2000 caracteres)';
   end if;
   select * into original from public.ops_sales_invoices where id=new.rectified_invoice_id for key share;
   if not found or original.document_type<>'factura' or original.status<>'emitida' then
     raise exception 'La factura original debe estar emitida';
   end if;
   if new.issue_date<original.issue_date then raise exception 'La rectificativa no puede ser anterior a la factura original'; end if;
   new.rectified_invoice_snapshot=jsonb_build_object(
     'number',coalesce(original.display_number,original.external_number_text),
     'issue_date',original.issue_date,'customer_name',original.customer_name,'customer_tax_id',original.customer_tax_id);
 else
   if new.rectified_invoice_id is not null or new.rectification_reason<>'' then
     raise exception 'Solo una rectificativa puede incluir factura original y motivo de rectificación';
   end if;
   new.rectified_invoice_snapshot='{}'::jsonb;
 end if;
 if new.status='emitida' and new.document_type='factura' then
   if new.total_amount<0 and new.invoice_kind<>'rectifying' then raise exception 'Un total negativo exige una rectificativa'; end if;
   perform private.totus_validate_invoice_settlement(new.total_amount,new.paid_amount,new.paid_status,new.paid_date);
 end if;
 return new;
end;
$$;
revoke all on function private.totus_guard_rectifying_invoice() from public,anon,authenticated;
create trigger totus_rectifying_reference_guard
 before insert or update on public.ops_sales_invoices
 for each row execute function private.totus_guard_rectifying_invoice();

CREATE OR REPLACE FUNCTION public.totus_save_sales_document(p_document jsonb, p_lines jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public,private'
AS $function$
declare
  v_id uuid := nullif(p_document->>'id','')::uuid;
  v_status text;
  v_issue date := nullif(p_document->>'issue_date','')::date;
  v_due date := nullif(p_document->>'due_date','')::date;
  v_operation date := nullif(p_document->>'operation_date','')::date;
  v_paid date := nullif(p_document->>'paid_date','')::date;
  v_origin text := coalesce(nullif(p_document->>'origin',''),'totus');
  v_type text := coalesce(nullif(p_document->>'document_type',''),'factura');
  v_kind text := coalesce(nullif(p_document->>'invoice_kind',''),'invoice');
begin
  if not (private.totus_can('facturacion',case when nullif(p_document->>'id','') is null then 'create' else 'edit' end)) then raise exception 'Solo administración o gerencia puede guardar documentos de venta'; end if;
  if nullif(p_document->>'series_id','') is null or v_issue is null then raise exception 'Serie y fecha son obligatorias'; end if;
  if v_issue>current_date then raise exception 'La fecha de emisión no puede ser futura'; end if;
  if v_operation is not null and v_operation>current_date then raise exception 'La fecha de operación no puede ser futura'; end if;
  if v_due is not null and v_due<v_issue then raise exception 'El vencimiento no puede ser anterior a la emisión'; end if;
  if v_paid is not null and v_paid>current_date then raise exception 'La fecha de cobro no puede ser futura'; end if;
  if nullif(btrim(coalesce(p_document->>'customer_name','')),'') is null then raise exception 'Cliente obligatorio'; end if;
  if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'Incluye al menos una línea'; end if;
  if v_origin not in ('totus','externa') then raise exception 'Origen no válido'; end if;
  if v_type not in ('factura','proforma') then raise exception 'Tipo de documento no válido'; end if;
  if v_kind not in ('invoice','rectifying') then raise exception 'Tipo de factura no válido'; end if;
  if coalesce(nullif(p_document->>'paid_status',''),'pendiente') not in ('pendiente','pagada','parcial') then raise exception 'Estado de cobro no válido'; end if;
  if coalesce((p_document->>'paid_amount')::numeric,0)<0 then raise exception 'El importe cobrado no puede ser negativo'; end if;
  if coalesce(nullif(p_document->>'paid_status',''),'pendiente')='pendiente' and coalesce((p_document->>'paid_amount')::numeric,0)>0 then raise exception 'Un documento pendiente no puede tener importe cobrado'; end if;
  if coalesce(nullif(p_document->>'paid_status',''),'pendiente')='pagada' and v_paid is null then raise exception 'Indica la fecha de cobro de una factura pagada'; end if;
  if v_type='proforma' then v_kind:='invoice'; end if;
  if v_origin='externa' and nullif(btrim(coalesce(p_document->>'external_number_text','')),'') is null then raise exception 'Indica el número de la factura externa'; end if;
  if v_origin='externa' and nullif(p_document->>'source_document_id','') is null then raise exception 'La factura externa exige el archivo original'; end if;

  if exists(
    select 1 from jsonb_array_elements(p_lines) j
    where nullif(btrim(coalesce(j->>'description','')),'') is null
       or coalesce((j->>'quantity')::numeric,0)=0
       or coalesce((j->>'discount_pct')::numeric,0)<0
       or coalesce((j->>'discount_pct')::numeric,0)>100
       or coalesce((j->>'vat_rate')::numeric,0)<0
  ) then raise exception 'Hay líneas con valores no válidos'; end if;

  if v_id is null then
    insert into public.ops_sales_invoices(
      series_id,store_id,issue_date,due_date,operation_date,origin,status,document_type,invoice_kind,
      customer_id,customer_name,customer_tax_id,customer_address,customer_email,concept,payment_method,
      paid_status,paid_date,include_in_income,template_id,terms_text,footer_text,purchase_order_ref,currency,
      notes,created_by,source_document_id,external_number_text,paid_amount,rectified_invoice_id,rectification_reason
    ) values(
      nullif(p_document->>'series_id','')::uuid,nullif(p_document->>'store_id','')::uuid,
      v_issue,v_due,v_operation,v_origin,'borrador',v_type,v_kind,nullif(p_document->>'customer_id','')::uuid,
      btrim(p_document->>'customer_name'),coalesce(p_document->>'customer_tax_id',''),coalesce(p_document->>'customer_address',''),
      coalesce(p_document->>'customer_email',''),coalesce(p_document->>'concept',''),coalesce(nullif(p_document->>'payment_method',''),'transferencia'),
      case when v_type='proforma' then 'pendiente' else coalesce(nullif(p_document->>'paid_status',''),'pendiente') end,
      case when v_type='proforma' then null else v_paid end,
      case when v_type='proforma' then false else coalesce((p_document->>'include_in_income')::boolean,true) end,
      nullif(p_document->>'template_id','')::uuid,coalesce(p_document->>'terms_text',''),coalesce(p_document->>'footer_text',''),
      coalesce(p_document->>'purchase_order_ref',''),coalesce(nullif(p_document->>'currency',''),'EUR'),coalesce(p_document->>'notes',''),
      auth.uid(),nullif(p_document->>'source_document_id','')::uuid,coalesce(p_document->>'external_number_text',''),
      case when v_type='proforma' then 0 else coalesce((p_document->>'paid_amount')::numeric,0) end,
      nullif(p_document->>'rectified_invoice_id','')::uuid,coalesce(p_document->>'rectification_reason','')
    ) returning id into v_id;
  else
    select status into v_status from public.ops_sales_invoices where id=v_id for update;
    if not found then raise exception 'Documento no encontrado'; end if;
    if v_status<>'borrador' then raise exception 'Solo se pueden editar documentos en borrador'; end if;
    update public.ops_sales_invoices set
      series_id=nullif(p_document->>'series_id','')::uuid,store_id=nullif(p_document->>'store_id','')::uuid,
      issue_date=v_issue,due_date=v_due,operation_date=v_operation,origin=v_origin,document_type=v_type,invoice_kind=v_kind,
      customer_id=nullif(p_document->>'customer_id','')::uuid,customer_name=btrim(p_document->>'customer_name'),
      customer_tax_id=coalesce(p_document->>'customer_tax_id',''),customer_address=coalesce(p_document->>'customer_address',''),
      customer_email=coalesce(p_document->>'customer_email',''),concept=coalesce(p_document->>'concept',''),
      payment_method=coalesce(nullif(p_document->>'payment_method',''),'transferencia'),
      paid_status=case when v_type='proforma' then 'pendiente' else coalesce(nullif(p_document->>'paid_status',''),'pendiente') end,
      paid_date=case when v_type='proforma' then null else v_paid end,
      include_in_income=case when v_type='proforma' then false else coalesce((p_document->>'include_in_income')::boolean,true) end,
      template_id=nullif(p_document->>'template_id','')::uuid,terms_text=coalesce(p_document->>'terms_text',''),
      footer_text=coalesce(p_document->>'footer_text',''),purchase_order_ref=coalesce(p_document->>'purchase_order_ref',''),
      currency=coalesce(nullif(p_document->>'currency',''),'EUR'),notes=coalesce(p_document->>'notes',''),
      source_document_id=nullif(p_document->>'source_document_id','')::uuid,external_number_text=coalesce(p_document->>'external_number_text',''),
      paid_amount=case when v_type='proforma' then 0 else coalesce((p_document->>'paid_amount')::numeric,0) end,
      rectified_invoice_id=nullif(p_document->>'rectified_invoice_id','')::uuid,
      rectification_reason=coalesce(p_document->>'rectification_reason','')
    where id=v_id;
    delete from public.ops_sales_invoice_lines where invoice_id=v_id;
  end if;

  insert into public.ops_sales_invoice_lines(invoice_id,sort_order,description,quantity,unit_price_base,discount_pct,vat_rate)
  select v_id,coalesce((j->>'sort_order')::integer,10),btrim(coalesce(j->>'description','')),
    coalesce((j->>'quantity')::numeric,1),coalesce((j->>'unit_price_base')::numeric,0),
    coalesce((j->>'discount_pct')::numeric,0),coalesce((j->>'vat_rate')::numeric,21)
  from jsonb_array_elements(p_lines) j;

  if v_type='factura' then
    if v_kind<>'rectifying' and (select total_amount<0 from public.ops_sales_invoices where id=v_id) then
      raise exception 'Una factura ordinaria no puede tener total negativo: utiliza una rectificativa';
    end if;
    perform private.totus_validate_invoice_settlement(
      (select total_amount from public.ops_sales_invoices where id=v_id),
      coalesce((p_document->>'paid_amount')::numeric,0),
      coalesce(nullif(p_document->>'paid_status',''),'pendiente'),v_paid);
  end if;

  perform private.totus_audit('facturacion',case when nullif(p_document->>'id','') is null then 'crear' else 'actualizar' end,v_id,
    jsonb_build_object('tipo',v_type,'kind',v_kind,'origen',v_origin,'fecha',v_issue));
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.totus_update_invoice_payment(p_id uuid, p_payment jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public,private'
AS $function$
declare
  v_total numeric; v_type text; v_status text; v_amount numeric; v_date date; v_method text;
begin
  if not (private.totus_can('facturacion','edit')) then raise exception 'Solo administración o gerencia puede actualizar cobros'; end if;
  select total_amount,document_type into v_total,v_type from public.ops_sales_invoices where id=p_id;
  if not found then raise exception 'Factura no encontrada'; end if;
  if v_type='proforma' then raise exception 'Una proforma no tiene cobro'; end if;
  v_status:=coalesce(nullif(p_payment->>'paid_status',''),'pendiente');
  v_amount:=coalesce((p_payment->>'paid_amount')::numeric,0);
  v_date:=nullif(p_payment->>'paid_date','')::date;
  v_method:=coalesce(nullif(p_payment->>'payment_method',''),'transferencia');
  perform private.totus_validate_invoice_settlement(v_total,v_amount,v_status,v_date);
  update public.ops_sales_invoices set payment_method=v_method,paid_status=v_status,paid_date=v_date,paid_amount=v_amount,updated_at=now() where id=p_id;
  perform private.totus_audit('facturacion','actualizar_cobro',p_id,jsonb_build_object('estado',v_status,'importe',v_amount,'fecha',v_date,'metodo',v_method));
end;
$function$;

CREATE OR REPLACE FUNCTION public.totus_finalize_sales_document(p_id uuid)
 RETURNS ops_sales_invoices
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public,private,extensions'
AS $function$
declare
  v_doc public.ops_sales_invoices;
  v_series public.ops_invoice_series;
  v_num integer;
  v_prev text;
  v_hash text;
  v_tpl jsonb := '{}'::jsonb;
begin
  if not (private.totus_can('facturacion','edit')) then raise exception 'Solo administración o gerencia puede emitir documentos'; end if;
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
    v_doc.vat_amount::text,v_doc.total_amount::text,coalesce(v_doc.rectified_invoice_id::text,''),
    coalesce(v_doc.rectification_reason,''),coalesce(v_doc.rectified_invoice_snapshot::text,''),coalesce(v_prev,'')),'sha256'),'hex');

  update public.ops_sales_invoices set
    number=v_num,display_number=v_series.prefix||lpad(v_num::text,v_series.padding,'0'),
    status='emitida',issued_at=now(),design_snapshot=v_tpl,template_snapshot=v_tpl,
    previous_hash=v_prev,record_hash=v_hash,updated_at=now()
  where id=p_id returning * into v_doc;

  perform private.totus_audit('facturacion','emitir',p_id,jsonb_build_object('numero',v_doc.display_number));
  return v_doc;
end;
$function$;
