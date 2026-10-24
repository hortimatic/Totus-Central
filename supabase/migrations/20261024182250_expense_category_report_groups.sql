ALTER TABLE public.ops_expense_categories
 ADD COLUMN IF NOT EXISTS report_group text;
ALTER TABLE public.ops_expense_categories
 ADD CONSTRAINT ops_expense_categories_report_group_check
 CHECK (report_group IS NULL OR report_group IN ('other','payroll','orders','fixed','irpf'));
COMMENT ON COLUMN public.ops_expense_categories.report_group IS
 'Presentation override for monthly Excel group and color. NULL preserves original imported colors and falls back to the category code. Never a fiscal classification.';
