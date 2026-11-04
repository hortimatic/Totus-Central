-- Preserve original PrestaShop tax precision in future linked draft lines only.
-- Ordinary invoices keep their existing rounding. Issued lines are not updated.
begin;
create or replace function public.ops_calc_invoice_line() returns trigger
language plpgsql security invoker set search_path='public' as $$
declare raw_base numeric; source_precision boolean;
begin
 raw_base=new.quantity*new.unit_price_base*(1-new.discount_pct/100);
 select coalesce(i.origin='totus' and i.document_type='factura' and i.invoice_kind='invoice' and i.purchase_order_ref like 'prestashop:%',false)
 into source_precision from public.ops_sales_invoices i where i.id=new.invoice_id;
 new.base_amount=round(raw_base,2);
 new.vat_amount=round((case when source_precision then raw_base else new.base_amount end)*new.vat_rate/100,2);
 new.total_amount=round(new.base_amount+new.vat_amount,2);
 return new;
end $$;
commit;
