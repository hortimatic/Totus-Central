-- Totus Central · restringir restauración de backup al servicio interno
-- La restauración ya no puede invocarse directamente desde un cliente authenticated.
-- El navegador llama a la Edge Function ops-restore-backup, que valida admin y usa service_role.

revoke all on function public.ops_restore_backup_data(jsonb,text) from public;
revoke execute on function public.ops_restore_backup_data(jsonb,text) from anon, authenticated;
grant execute on function public.ops_restore_backup_data(jsonb,text) to service_role;
