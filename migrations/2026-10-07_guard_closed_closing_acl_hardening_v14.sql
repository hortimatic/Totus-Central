-- Totus Central · hardening adicional del trigger de cierres.
-- Aplicada en Supabase como guard_closed_closing_acl_hardening_v14.

revoke all on function public.ops_guard_closed_closing() from public, anon, authenticated;
grant execute on function public.ops_guard_closed_closing() to postgres, service_role;
