-- Preserve the live RPC's authorization, replay, locking, audit and calculations.
-- No table changes and no historical accounting rewrites.
CREATE OR REPLACE FUNCTION private.totus_payment_links_invoice(p_source text,p_invoice uuid)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $fn$
DECLARE source jsonb;
BEGIN
 IF p_invoice IS NULL THEN RETURN false; END IF;
 BEGIN source=p_source::jsonb; EXCEPTION WHEN invalid_text_representation THEN RETURN false; END;
 RETURN coalesce(source->>'kind'='bank_payment_source' AND source->>'related_invoice_expense_id'=p_invoice::text,false);
END $fn$;
REVOKE ALL ON FUNCTION private.totus_payment_links_invoice(text,uuid) FROM PUBLIC,anon,authenticated;
DO $patch$
DECLARE definition text;
 marker text := '  if v_invoice<>'''' and exists(';
 guard text := $guard$
  -- expense_input_completeness_v1
  if v_paid_status='parcial' and v_paid_date is null then
    raise exception 'Indica la fecha de pago';
  end if;
  if exists(select 1 from jsonb_array_elements(p_lines) j
    where nullif(btrim(j->>'base_amount'),'') is null
       or j->>'base_amount' in ('NaN','Infinity','-Infinity')
       or coalesce(j->>'vat_rate','0') in ('NaN','Infinity','-Infinity')
       or coalesce(j->>'re_rate','0') in ('NaN','Infinity','-Infinity')
       or coalesce(j->>'withholding_rate','0') in ('NaN','Infinity','-Infinity')
       or coalesce(j->>'deductible_pct','100') in ('NaN','Infinity','-Infinity')
       or coalesce((j->>'vat_rate')::numeric,0)>100
       or coalesce((j->>'re_rate')::numeric,0)>100
       or coalesce((j->>'withholding_rate')::numeric,0)>100) then
    raise exception 'Completa la base y revisa los importes y porcentajes del gasto';
  end if;
$guard$;
BEGIN
 SELECT pg_get_functiondef('public.totus_save_expense(jsonb,jsonb)'::regprocedure) INTO definition;
 IF position('expense_input_completeness_v1' in definition)>0 THEN RETURN; END IF;
 IF position(marker in definition)=0 THEN RAISE EXCEPTION 'La función de gastos ha cambiado: revisar el ajuste'; END IF;
 definition=replace(definition,marker,guard||marker);
 IF position('where e.id is distinct from v_id' in definition)=0 THEN RAISE EXCEPTION 'Revisar control de duplicados de gastos'; END IF;
 definition=replace(definition,'where e.id is distinct from v_id',
  'where e.id is distinct from v_id and not (coalesce(e.management_only,false) and private.totus_payment_links_invoice(e.source_ref,v_id))');
 EXECUTE definition;
END $patch$;
