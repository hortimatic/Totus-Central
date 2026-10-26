-- Reviewed correction to the existing issuance function; no historic invoices are updated.
-- Source: the already-versioned 20261018175807_rectifying_invoice_refunds.sql.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='15s';
DO $guard$
BEGIN
 IF md5(btrim(replace(pg_get_functiondef('public.totus_finalize_sales_document(uuid)'::regprocedure),chr(13),''),E' \n\r\t;')) NOT IN ('69365411ec497290a8ab2b12f952a024','8eec55889ca359479ea5ae2fbea9816f') THEN
  RAISE EXCEPTION 'Issuance implementation changed. Review the current function before applying this correction.';
 END IF;
END $guard$;

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
    order by number desc nulls last,issued_at desc nulls last,id desc limit 1;
  end if;

  v_hash:=encode(extensions.digest(concat_ws('|',v_doc.id::text,v_doc.document_type,v_series.code,v_num::text,
    v_doc.issue_date::text,v_doc.customer_tax_id,v_doc.customer_name,v_doc.base_amount::text,
    v_doc.vat_amount::text,v_doc.total_amount::text,coalesce(v_doc.rectified_invoice_id::text,''),
    coalesce(v_doc.rectification_reason,''),coalesce(v_doc.rectified_invoice_snapshot::text,''),coalesce(v_prev,'')),'sha256'),'hex');

  update public.ops_sales_invoices set
    number=v_num,display_number=v_series.prefix||lpad(v_num::text,greatest(v_series.padding,length(v_num::text)),'0'),
    status='emitida',issued_at=now(),design_snapshot=v_tpl,template_snapshot=v_tpl,
    previous_hash=v_prev,record_hash=v_hash,updated_at=now()
  where id=p_id returning * into v_doc;

  perform private.totus_audit('facturacion','emitir',p_id,jsonb_build_object('numero',v_doc.display_number));
  return v_doc;
end;
$function$;
COMMIT;
