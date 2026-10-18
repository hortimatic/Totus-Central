-- Keep legacy entrypoints closed after deployment and default-grant changes.
revoke all on function public.totus_backup_contract() from public,anon;
grant execute on function public.totus_backup_contract() to authenticated;
revoke all on function public.totus_restore_backup(jsonb,text) from public,anon,authenticated;
