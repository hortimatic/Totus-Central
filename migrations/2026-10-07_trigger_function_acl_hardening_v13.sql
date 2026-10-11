-- Totus Central · hardening de funciones trigger internas.
-- Aplicada en Supabase como trigger_function_acl_hardening_v13.

revoke all on function public.ops_advance_series_external() from public, anon, authenticated;
revoke all on function public.ops_calc_expense_line() from public, anon, authenticated;
revoke all on function public.ops_calc_invoice_line() from public, anon, authenticated;
revoke all on function public.ops_calc_proforma_line() from public, anon, authenticated;
revoke all on function public.ops_guard_invoice_lines() from public, anon, authenticated;
revoke all on function public.ops_guard_issued_invoice() from public, anon, authenticated;
revoke all on function public.ops_recalc_expense_header() from public, anon, authenticated;
revoke all on function public.ops_recalc_invoice_totals() from public, anon, authenticated;
revoke all on function public.ops_recalc_proforma_totals() from public, anon, authenticated;
revoke all on function public.ops_touch_invoice_template() from public, anon, authenticated;
revoke all on function public.ops_touch_updated_at() from public, anon, authenticated;
revoke all on function public.ops_validate_sales_document_series() from public, anon, authenticated;

grant execute on function public.ops_advance_series_external() to postgres, service_role;
grant execute on function public.ops_calc_expense_line() to postgres, service_role;
grant execute on function public.ops_calc_invoice_line() to postgres, service_role;
grant execute on function public.ops_calc_proforma_line() to postgres, service_role;
grant execute on function public.ops_guard_invoice_lines() to postgres, service_role;
grant execute on function public.ops_guard_issued_invoice() to postgres, service_role;
grant execute on function public.ops_recalc_expense_header() to postgres, service_role;
grant execute on function public.ops_recalc_invoice_totals() to postgres, service_role;
grant execute on function public.ops_recalc_proforma_totals() to postgres, service_role;
grant execute on function public.ops_touch_invoice_template() to postgres, service_role;
grant execute on function public.ops_touch_updated_at() to postgres, service_role;
grant execute on function public.ops_validate_sales_document_series() to postgres, service_role;
