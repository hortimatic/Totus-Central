-- Retirada definitiva de estructuras de compatibilidad heredadas.
drop view if exists public.ops_gestor_natural_rows;
drop table if exists public.ops_backup_archives cascade;
drop table if exists public.ops_reconciliation_notes cascade;
drop table if exists public.ops_import_batches cascade;
drop table if exists public.ops_gestor_quarter_summary cascade;
drop table if exists public.ops_gestor_source_rows cascade;
drop table if exists public.ops_fiscal_reference_periods cascade;
drop table if exists public.ops_legacy_daily_rows cascade;
drop table if exists public.ops_historical_income_periods cascade;
drop table if exists public.ops_personnel cascade;

drop function if exists private.ops_log_revision() cascade;
drop table if exists public.ops_entity_revisions cascade;

drop table if exists public.ops_income_adjustments cascade;
