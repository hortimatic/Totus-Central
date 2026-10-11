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

-- RPC CRUD antiguos sustituidos por la API totus_*.
drop function if exists public.ops_convert_proforma(uuid,uuid);
drop function if exists public.ops_delete_closing_controlled(uuid,text);
drop function if exists public.ops_delete_document(uuid);
drop function if exists public.ops_delete_document_controlled(uuid,text);
drop function if exists public.ops_delete_expense_controlled(uuid,text);
drop function if exists public.ops_delete_manual_expense(uuid);
drop function if exists public.ops_delete_supplier_controlled(uuid,text);
drop function if exists public.ops_finalize_document(uuid);
drop function if exists public.ops_issue_invoice(uuid);
drop function if exists public.ops_link_expense_document(uuid,uuid);
drop function if exists public.ops_register_external_document(uuid,integer);
drop function if exists public.ops_save_closing(jsonb,jsonb);
drop function if exists public.ops_save_document_draft(jsonb,jsonb);
drop function if exists public.ops_save_document_template(uuid,jsonb);
drop function if exists public.ops_save_expense(jsonb,jsonb);
drop function if exists public.ops_set_closing_status_controlled(uuid,text,text);
drop function if exists public.ops_storage_usage();

drop function if exists private.ops_convert_proforma_internal(uuid,uuid);
drop function if exists private.ops_delete_closing_controlled_internal(uuid,text);
drop function if exists private.ops_delete_document_controlled_internal(uuid,text);
drop function if exists private.ops_delete_document_internal(uuid);
drop function if exists private.ops_delete_expense_controlled_internal(uuid,text);
drop function if exists private.ops_delete_manual_expense_internal(uuid);
drop function if exists private.ops_delete_supplier_controlled_internal(uuid,text);
drop function if exists private.ops_finalize_document_internal(uuid);
drop function if exists private.ops_issue_invoice_internal(uuid);
drop function if exists private.ops_link_expense_document_internal(uuid,uuid);
drop function if exists private.ops_register_external_document_internal(uuid,integer);
drop function if exists private.ops_save_closing_internal(jsonb,jsonb);
drop function if exists private.ops_save_document_draft_internal(jsonb,jsonb);
drop function if exists private.ops_save_document_template_internal(uuid,jsonb);
drop function if exists private.ops_save_expense_internal(jsonb,jsonb);
drop function if exists private.ops_set_closing_status_controlled_internal(uuid,text,text);
drop function if exists private.ops_storage_usage_internal();
drop function if exists private.ops_log_revision(text,uuid,text,text,jsonb,jsonb,jsonb);

alter table public.ops_daily_closings drop column if exists legacy_cash_method;
