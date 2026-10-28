-- Disposable PostgreSQL only. Zero-value concepts isolate scope/validation from
-- the separate accounting-trigger fixtures; this does not test tax arithmetic.
BEGIN;
ALTER TABLE public.ops_expenses
 ALTER COLUMN id SET DEFAULT gen_random_uuid(),
 ADD COLUMN store_id uuid REFERENCES public.ops_stores(id),ADD COLUMN expense_date date,
 ADD COLUMN supplier_name text,ADD COLUMN supplier_tax_id text,ADD COLUMN invoice_number text,
 ADD COLUMN category_id uuid,ADD COLUMN description text,ADD COLUMN payment_method text,
 ADD COLUMN paid_status text,ADD COLUMN paid_date date,ADD COLUMN base_amount numeric,
 ADD COLUMN vat_rate numeric,ADD COLUMN vat_amount numeric,ADD COLUMN re_rate numeric,
 ADD COLUMN re_amount numeric,ADD COLUMN withholding_rate numeric,ADD COLUMN withholding_amount numeric DEFAULT 0,
 ADD COLUMN withholding_model text,ADD COLUMN gross_expense numeric,ADD COLUMN accounting_amount numeric DEFAULT 0,
 ADD COLUMN amount_paid numeric,ADD COLUMN deductible_irpf boolean,ADD COLUMN deductible_pct numeric,
 ADD COLUMN fixed_asset boolean,ADD COLUMN amortization_years numeric,ADD COLUMN document_id uuid,
 ADD COLUMN notes text,ADD COLUMN created_by uuid,ADD COLUMN document_kind text,ADD COLUMN source text,
 ADD COLUMN fiscal_reviewed boolean,ADD COLUMN management_only boolean,ADD COLUMN personnel_kind text,
 ADD COLUMN supplier_id uuid,ADD COLUMN source_ref text,ADD COLUMN updated_at timestamptz;
ALTER TABLE public.ops_expense_lines
 ALTER COLUMN id SET DEFAULT gen_random_uuid(),
 ADD COLUMN expense_id uuid REFERENCES public.ops_expenses(id),ADD COLUMN sort_order integer,
 ADD COLUMN category_id uuid,ADD COLUMN description text,ADD COLUMN base_amount numeric,
 ADD COLUMN vat_rate numeric,ADD COLUMN vat_amount numeric,ADD COLUMN re_base numeric,
 ADD COLUMN re_rate numeric,ADD COLUMN re_amount numeric,ADD COLUMN irpf_imputable numeric,
 ADD COLUMN withholding_base numeric,ADD COLUMN withholding_rate numeric,ADD COLUMN withholding_amount numeric,
 ADD COLUMN withholding_model text,ADD COLUMN deductible_irpf boolean,ADD COLUMN deductible_pct numeric,
 ADD COLUMN fixed_asset boolean,ADD COLUMN amortization_years numeric,ADD COLUMN notes text;
ALTER TABLE public.ops_audit_log ADD COLUMN IF NOT EXISTS entity_id uuid;
CREATE OR REPLACE FUNCTION private.totus_audit(text,text,uuid,jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE sql AS $$INSERT INTO public.ops_audit_log(area,action,entity_id,detail) VALUES($1,$2,$3,$4)$$;
\ir ../supabase/migrations/20261024190449_per_expense_report_category.sql
REVOKE ALL ON FUNCTION public.totus_save_expense(jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.totus_save_expense(jsonb,jsonb) TO authenticated;
\ir ../supabase/review_patches/020_common_expense_scope.sql
\ir ../supabase/review_patches/020_common_expense_scope.sql
DO $test$
DECLARE e jsonb; l jsonb; saved uuid;
BEGIN
 PERFORM set_config('request.jwt.claims','{}',true);
 e=jsonb_build_object('store_id',NULL,'expense_date',current_date,'supplier_name','QA common scope','invoice_number','QA-COMMON','paid_status','pendiente','amount_paid',0);
 l=jsonb_build_array(jsonb_build_object('description','Zero-value scope test','base_amount',0));
 BEGIN
  PERFORM public.totus_save_expense(e,l);RAISE EXCEPTION 'Unauthorized common write accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Solo administración%' THEN RAISE; END IF;END;
 PERFORM set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","email":"qa@example.invalid","allow":true}',true);
 saved=public.totus_save_expense(e,l);
 IF NOT EXISTS(SELECT 1 FROM public.ops_expenses WHERE id=saved AND store_id IS NULL) THEN RAISE EXCEPTION 'Common scope not saved'; END IF;
 PERFORM public.totus_save_expense(e||jsonb_build_object('id',saved,'notes','Edited common scope'),l);
 IF NOT EXISTS(SELECT 1 FROM public.ops_expenses WHERE id=saved AND store_id IS NULL AND notes='Edited common scope') THEN RAISE EXCEPTION 'Edit changed common scope'; END IF;
 BEGIN
  PERFORM public.totus_save_expense(e,l);RAISE EXCEPTION 'Duplicate common invoice accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Ya existe esa factura%' THEN RAISE; END IF;END;
 BEGIN
  PERFORM public.totus_save_expense(e||jsonb_build_object('invoice_number','QA-NO-NAME','supplier_name',''),l);RAISE EXCEPTION 'Empty supplier accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Fecha y proveedor%' THEN RAISE; END IF;END;
 IF (SELECT count(*) FROM public.ops_audit_log WHERE entity_id=saved AND area='gastos')<>2 THEN RAISE EXCEPTION 'Scope changes not audited'; END IF;
 IF has_function_privilege('anon','public.totus_save_expense(jsonb,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous access expanded'; END IF;
END $test$;
\ir ../supabase/review_patches/021_expense_input_completeness.sql
\ir ../supabase/review_patches/021_expense_input_completeness.sql
DO $test$
DECLARE e jsonb; l jsonb; bad jsonb; saved uuid;
BEGIN
 e=jsonb_build_object('expense_date',current_date,'supplier_name','QA completeness','paid_status','pendiente','amount_paid',0);
 l=jsonb_build_array(jsonb_build_object('description','Explicit zero','base_amount',0));
 saved=public.totus_save_expense(e,l);
 IF saved IS NULL THEN RAISE EXCEPTION 'Explicit zero was rejected'; END IF;
 UPDATE public.ops_expenses SET invoice_number='QA-LINKED',supplier_tax_id='QA-TAX' WHERE id=saved;
 INSERT INTO public.ops_expenses(supplier_name,supplier_tax_id,invoice_number,management_only,source_ref)
 VALUES('Bank evidence','QA-TAX','QA-LINKED',true,jsonb_build_object('kind','bank_payment_source','related_invoice_expense_id',saved)::text);
 PERFORM public.totus_save_expense(e||jsonb_build_object('id',saved,'invoice_number','QA-LINKED','supplier_tax_id','QA-TAX'),l);
 BEGIN
  PERFORM public.totus_save_expense(e||jsonb_build_object('invoice_number','QA-LINKED','supplier_tax_id','QA-TAX'),l);
  RAISE EXCEPTION 'Unrelated duplicate accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Ya existe esa factura%' THEN RAISE; END IF; END;
 FOREACH bad IN ARRAY ARRAY[
  '{"description":"Missing base"}'::jsonb,
  '{"description":"Null base","base_amount":null}'::jsonb,
  '{"description":"Nonfinite","base_amount":"NaN"}'::jsonb,
  '{"description":"Invalid VAT","base_amount":0,"vat_rate":101}'::jsonb,
  '{"description":"Invalid RE","base_amount":0,"re_rate":101}'::jsonb,
  '{"description":"Invalid retention","base_amount":0,"withholding_rate":101}'::jsonb
 ] LOOP
  BEGIN
   PERFORM public.totus_save_expense(e,jsonb_build_array(bad));
   RAISE EXCEPTION 'Incomplete or invalid concept accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Completa la base%' THEN RAISE; END IF; END;
 END LOOP;
 BEGIN
  PERFORM public.totus_save_expense(e||'{"paid_status":"parcial","amount_paid":1}'::jsonb,l);
  RAISE EXCEPTION 'Undated partial payment accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Indica la fecha de pago' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claims','{}',true);
 BEGIN
  PERFORM public.totus_save_expense(e,l);RAISE EXCEPTION 'Anonymous expense accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Solo administración%' THEN RAISE; END IF; END;
 IF has_function_privilege('anon','public.totus_save_expense(jsonb,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous privileges widened'; END IF;
END $test$;
ROLLBACK;
