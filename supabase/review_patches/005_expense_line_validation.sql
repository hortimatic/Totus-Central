-- STAGING ONLY / Totus Central / 2026-10-14
-- Applied through the staging project's tracked migration:
-- validate_expense_line_amounts_20261014
-- Prevents silent corruption through direct API calls, bypassing the browser's validators.
-- No user data was changed; there were zero rows in ops_expense_lines before migration.
ALTER TABLE public.ops_expense_lines
 ADD CONSTRAINT ops_expense_lines_valid_amounts_ck
 CHECK (
   base_amount IS NOT NULL AND base_amount >= 0
   AND vat_rate BETWEEN 0 AND 100
   AND re_rate BETWEEN 0 AND 100
   AND withholding_rate BETWEEN 0 AND 100
   AND deductible_pct BETWEEN 0 AND 100
 );
-- Verified after apply: pg_constraint.convalidated = true.
-- This file documents the applied migration; do not apply again blindly.
