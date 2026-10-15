-- Applied to staging on 2026-10-15. READ BEFORE REUSE.
-- Existing synthetic stores STG-A/STG-B had zero closings, expenses, invoices and documents.
-- IDs were preserved. No production data or transactions were changed.
-- Original store codes: STG-A, STG-B. Original drawer codes: CAJA-1 in each.
-- Replace synthetic presentation data by the actual configured operating structure.
-- Target result: Hortimatic/Vape, Hortimatic/Head, NewOldSmok/Vape.
-- This file records the operation; do not rerun without checking live records.
BEGIN;
UPDATE public.ops_stores SET name='Hortimatic',code='HORTIMATIC',sort_order=10 WHERE code='STG-A';
UPDATE public.ops_stores SET name='NewOldSmok',code='NEWOLDSMOK',sort_order=20 WHERE code='STG-B';
UPDATE public.ops_cash_drawers SET name='Vape',code='VAPE',sort_order=10
 WHERE code='CAJA-1' AND store_id=(SELECT id FROM public.ops_stores WHERE code='HORTIMATIC');
UPDATE public.ops_cash_drawers SET name='Vape',code='VAPE',sort_order=10
 WHERE code='CAJA-1' AND store_id=(SELECT id FROM public.ops_stores WHERE code='NEWOLDSMOK');
INSERT INTO public.ops_cash_drawers (store_id,name,code,active,sort_order)
SELECT id,'Head','HEAD',true,20 FROM public.ops_stores WHERE code='HORTIMATIC'
ON CONFLICT DO NOTHING;
COMMIT;
-- SQL SELECT verifies exactly 2 shops and 3 drawers with correct labels.
