select set_config('request.jwt.claims','{"role":"service_role"}',false);
select public.totus_export_recovery_snapshot() as old_forecast_snapshot \gset
\i supabase/review_patches/081_recurring_expenses.sql
\i supabase/review_patches/083_recurring_expense_recovery.sql
select public.qa_assert(cardinality(private.totus_recovery_tables())=53,'forecast is included in backup inventory');
select public.qa_assert(exists(select 1 from private.totus_recovery_schema_versions where schema_hash=(:'old_forecast_snapshot'::jsonb->>'schema_hash') and table_count=52),'exact old recovery schema registered');
select public.qa_assert(private.totus_stock_recovery_payload(:'old_forecast_snapshot'::jsonb->'database')->'ops_recurring_expenses'='[]'::jsonb,'old snapshots gain an empty forecast table');
insert into public.ops_recurring_expenses(id,title,amount_cents,first_on,frequency,history) values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Previsión recuperable',1200,'2026-11-12','monthly','[{"due_on":"2026-11-12","status":"paid","amount_cents":1200}]');
select public.totus_export_recovery_snapshot() as new_forecast_snapshot \gset
select public.qa_assert(jsonb_array_length(:'new_forecast_snapshot'::jsonb#>'{database,ops_recurring_expenses}')=1,'forecast and history are captured');
select public.qa_assert((public.totus_verify_recovery_rows(:'new_forecast_snapshot'::jsonb->'database')->>'table_count')::integer=53,'all forecast foreign keys rehearse without deleting data');
