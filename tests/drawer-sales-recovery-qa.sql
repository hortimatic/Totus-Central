\set ON_ERROR_STOP on
-- Only run against the disposable 52-table recovery fixture.
select set_config('request.jwt.claims','{"role":"service_role"}',false);
select private.totus_recovery_schema_hash() as before_hash \gset
\ir ../supabase/migrations/20261019120841_preserve_closing_income_selection_on_reconciliation.sql
\ir ../supabase/review_patches/035_drawer_sales_references.sql
select public.qa_assert(private.totus_recovery_schema_hash()=:'before_hash','Existing backup schema fingerprint preserved');
insert into public.ops_daily_closing_drawers(id,reported_total_sales) values('dddddddd-dddd-4ddd-8ddd-dddddddddddd',12.34);
select public.totus_export_recovery_snapshot() as snapshot \gset
insert into public.ops_recovery_jobs(id,status,checkpoint_path,before_revision,requested_by,requested_email)
 values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','prepared','verified-fixture-checkpoint',:'snapshot'::jsonb->>'revision','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','qa@example.invalid');
select public.totus_commit_recovery('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',:'snapshot'::jsonb->'database',:'snapshot'::jsonb);
select public.qa_assert((select reported_total_sales=12.34 from public.ops_daily_closing_drawers where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'),'New backup recovers per-drawer sales');
select public.totus_export_recovery_snapshot() as before_legacy \gset
select jsonb_set(:'before_legacy'::jsonb->'database','{ops_daily_closing_drawers}',(select jsonb_agg(value-'reported_total_sales') from jsonb_array_elements(:'before_legacy'::jsonb->'database'->'ops_daily_closing_drawers'))) as legacy \gset
insert into public.ops_recovery_jobs(id,status,checkpoint_path,before_revision,requested_by,requested_email)
 values('ffffffff-ffff-4fff-8fff-ffffffffffff','prepared','verified-fixture-checkpoint',:'before_legacy'::jsonb->>'revision','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','qa@example.invalid');
select public.totus_commit_recovery('ffffffff-ffff-4fff-8fff-ffffffffffff',:'legacy'::jsonb,jsonb_set(:'before_legacy'::jsonb,'{schema_hash}',to_jsonb(:'before_hash'::text)));
select public.qa_assert((select reported_total_sales is null from public.ops_daily_closing_drawers where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'),'Old backup recovers unknown drawer reference as NULL, never zero');
select 'Drawer sales recovery: new field, old archive and unchanged schema fingerprint OK';
