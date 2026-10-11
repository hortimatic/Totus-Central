-- Totus Central · una factura externa emitida debe conservar su documento original.
alter table public.ops_sales_invoices
  drop constraint if exists ops_external_issued_requires_source_document;

alter table public.ops_sales_invoices
  add constraint ops_external_issued_requires_source_document
  check (
    origin <> 'externa'
    or status <> 'emitida'
    or source_document_id is not null
  ) not valid;

alter table public.ops_sales_invoices
  validate constraint ops_external_issued_requires_source_document;
