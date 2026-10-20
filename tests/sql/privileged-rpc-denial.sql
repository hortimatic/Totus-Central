set statement_timeout='3s';
do $test$
declare call text; rejected boolean;
begin
 perform set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000000","email":"revoked-qa@example.invalid"}',true);
 foreach call in array array['totus_backup_contract()','totus_backup_save_settings(''{}''::jsonb)','totus_convert_proforma(''00000000-0000-4000-8000-000000000000''::uuid,''00000000-0000-4000-8000-000000000000''::uuid)','totus_delete_closing(''00000000-0000-4000-8000-000000000000''::uuid,''QA'')','totus_delete_expense(''00000000-0000-4000-8000-000000000000''::uuid,''QA'')','totus_delete_income_adjustment(''00000000-0000-4000-8000-000000000000''::uuid,''QA'')','totus_delete_sales_draft(''00000000-0000-4000-8000-000000000000''::uuid,''QA'')','totus_export_recovery_snapshot()','totus_finalize_sales_document(''00000000-0000-4000-8000-000000000000''::uuid)','totus_register_external_document(''00000000-0000-4000-8000-000000000000''::uuid,1)','totus_save_closing(''{}''::jsonb,''[]''::jsonb)','totus_save_expense(''{}''::jsonb,''[]''::jsonb)','totus_save_sales_document(''{}''::jsonb,''[]''::jsonb)','totus_set_closed_period(''2026-09-30''::date,''QA'')','totus_set_expense_payment(''00000000-0000-4000-8000-000000000000''::uuid,''pagado'',1,''2026-10-20''::date)','totus_storage_usage()','totus_update_invoice_payment(''00000000-0000-4000-8000-000000000000''::uuid,''{}''::jsonb)']
 loop
  rejected=false;
  begin execute 'select public.'||call;
  exception when others then
   if sqlerrm ~* 'solo|sin permiso|no tienes permiso|acceso|equipo|autorizad|miembro' then rejected=true;
   else raise exception 'Unexpected denial result for %: %',split_part(call,'(',1),sqlerrm; end if;
  end;
  if not rejected then raise exception 'Unauthorized RPC accepted: %',split_part(call,'(',1); end if;
 end loop;
end $test$;