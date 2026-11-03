-- Administrative audit only. No credentials, document contents or business amounts.
begin transaction read only;
select jsonb_build_object(
 'public_tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),
 'tables_without_rls',(select coalesce(jsonb_agg(c.relname),'[]'::jsonb) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity),
 'public_views',(select coalesce(jsonb_agg(jsonb_build_object('name',c.relname,'options',c.reloptions)),'[]'::jsonb) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v'),
 'public_definer_anon',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and has_function_privilege('anon',p.oid,'execute')),
 'buckets',(select jsonb_agg(jsonb_build_object('id',id,'public',public,'limit',file_size_limit)) from storage.buckets),
 'cron',(select jsonb_agg(jsonb_build_object('name',jobname,'active',active,'schedule',schedule)) from cron.job),
 'cron_history',(select jsonb_build_object('rows',count(*),'oldest',min(start_time),'latest',max(start_time)) from cron.job_run_details),
 'cron_history_bytes',pg_total_relation_size('cron.job_run_details'),
 'latest_backup',(select jsonb_build_object('status',status,'started_at',started_at,'finished_at',finished_at,'has_path',storage_path is not null,'has_hash',archive_sha256 is not null) from public.ops_backup_runs order by started_at desc limit 1),
 'integrity',jsonb_build_object(
  'expense_lines_orphaned',(select count(*) from public.ops_expense_lines l left join public.ops_expenses e on e.id=l.expense_id where e.id is null),
  'invoice_lines_orphaned',(select count(*) from public.ops_sales_invoice_lines l left join public.ops_sales_invoices i on i.id=l.invoice_id where i.id is null),
  'stock_document_orphaned',(select count(*) from public.ops_stock_sources s left join public.ops_documents d on d.id=s.document_id where d.id is null),
  'mirror_mismatch',(select count(*) from public.ops_onedrive_documents m join public.ops_documents d on d.id=m.document_id where m.sha256 is distinct from d.sha256 or m.size_bytes is distinct from d.size_bytes),
  'suppliers_id_mismatch',(select count(*) from public.ops_suppliers s full join public.providers p on s.id=p.id where s.id is null or p.id is null)
 )
) as audit;
rollback;
