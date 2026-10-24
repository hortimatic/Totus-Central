-- Isolated database fixture; no production records or persistent test writes.
BEGIN;
ALTER TABLE public.ops_expenses ADD COLUMN source_ref text, ADD COLUMN updated_at timestamptz, ADD COLUMN gross_expense numeric, ADD COLUMN description text;
ALTER TABLE public.ops_audit_log ADD COLUMN IF NOT EXISTS entity_id uuid;
CREATE OR REPLACE FUNCTION private.totus_audit(p_area text,p_action text,p_entity uuid,p_detail jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE sql AS $$INSERT INTO public.ops_audit_log(area,action,entity_id,detail) VALUES(p_area,p_action,p_entity,p_detail)$$;
\ir ../supabase/migrations/20261024190449_per_expense_report_category.sql
\ir ../supabase/migrations/20261024190556_expense_report_group_source_reference.sql
INSERT INTO public.ops_expenses(id,source_ref,gross_expense,description) VALUES('77777777-7777-4777-8777-777777777777','{"kind":"invoice_original","source":{"color":"00B0F0"}}',100,'Unchanged');
DO $$
DECLARE original jsonb; current_row jsonb;
BEGIN
 SELECT to_jsonb(e) INTO original FROM public.ops_expenses e WHERE id='77777777-7777-4777-8777-777777777777';
 BEGIN
  PERFORM public.totus_set_expense_report_group('77777777-7777-4777-8777-777777777777','fixed',NULL);
  RAISE EXCEPTION 'Unauthorized preference change accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'No tienes permiso%' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","email":"qa@example.invalid","allow":true}',true);
 PERFORM public.totus_set_expense_report_group('77777777-7777-4777-8777-777777777777','fixed',NULL);
 SELECT to_jsonb(e) INTO current_row FROM public.ops_expenses e WHERE id='77777777-7777-4777-8777-777777777777';
 IF original-ARRAY['source_ref','updated_at'] IS DISTINCT FROM current_row-ARRAY['source_ref','updated_at'] THEN RAISE EXCEPTION 'Business fields changed'; END IF;
 IF (current_row->>'source_ref')::jsonb->'source'->>'color'<>'00B0F0' THEN RAISE EXCEPTION 'Original metadata lost'; END IF;
 BEGIN
  PERFORM public.totus_set_expense_report_group('77777777-7777-4777-8777-777777777777','orders',NULL);
  RAISE EXCEPTION 'Stale write accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'La categoría del Excel ha cambiado%' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.totus_set_expense_report_group('77777777-7777-4777-8777-777777777777','invalid','fixed');
  RAISE EXCEPTION 'Invalid choice accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Selecciona una categoría%' THEN RAISE; END IF; END;
 PERFORM public.totus_set_expense_report_group('77777777-7777-4777-8777-777777777777',NULL,'fixed');
 IF (SELECT source_ref::jsonb FROM public.ops_expenses WHERE id='77777777-7777-4777-8777-777777777777') IS DISTINCT FROM (original->>'source_ref')::jsonb THEN RAISE EXCEPTION 'Automatic reset lost original metadata'; END IF;
 IF (SELECT count(*) FROM public.ops_audit_log WHERE action='categoria_excel')<>2 THEN RAISE EXCEPTION 'Preference audit missing'; END IF;
 IF has_function_privilege('anon','public.totus_set_expense_report_group(uuid,text,text)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous execution allowed'; END IF;
END $$;
ROLLBACK;
