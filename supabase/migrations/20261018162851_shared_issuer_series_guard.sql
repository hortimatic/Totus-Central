-- Keep the fiscal issuer independent from physical shops. Existing issued rows
-- remain immutable; the finalizer's row lock still allocates numbers atomically.
create or replace function private.totus_validate_issuing_series()
returns trigger language plpgsql set search_path='' as $$
declare series public.ops_invoice_series;
begin
 if new.status='emitida' and (tg_op='INSERT' or old.status='borrador') and new.origin='totus' then
  select * into series from public.ops_invoice_series where id=new.series_id;
  if not found or not series.active or series.document_type<>new.document_type
    or series.series_kind<>new.invoice_kind or series.year<>extract(year from new.issue_date)
    or (series.store_id is not null and series.store_id is distinct from new.store_id) then
   raise exception 'La serie no corresponde al documento, año o tienda. Revisa la serie antes de emitir.';
  end if;
  if new.document_type='factura' and new.invoice_kind='invoice' and series.store_id is not null
    and exists(select 1 from public.ops_invoice_series s where s.active and s.store_id is null
      and s.document_type='factura' and s.series_kind='invoice' and s.year=series.year) then
   raise exception 'Las dos tiendas deben utilizar la serie común del titular.';
  end if;
 end if;
 return new;
end;
$$;
revoke all on function private.totus_validate_issuing_series() from public,anon,authenticated;
create trigger ops_validate_issuing_series before insert or update on public.ops_sales_invoices
for each row execute function private.totus_validate_issuing_series();
