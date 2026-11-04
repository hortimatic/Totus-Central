-- One ordinary Totus invoice per PrestaShop order; original documents and numbering unchanged.
begin;
create unique index if not exists ops_sales_invoices_prestashop_origin_unique
 on public.ops_sales_invoices (purchase_order_ref)
 where origin='totus' and document_type='factura' and invoice_kind='invoice' and purchase_order_ref like 'prestashop:%';
create or replace function private.totus_prestashop_invoice_origin_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare shop text;
begin
 if tg_op='UPDATE' and old.purchase_order_ref like 'prestashop:%' and old.origin='totus' and old.document_type='factura' and old.invoice_kind='invoice' and new.purchase_order_ref is distinct from old.purchase_order_ref then raise exception 'La referencia del pedido de origen no se puede sustituir.' using errcode='22023';end if;
 if new.purchase_order_ref like 'prestashop:%' and new.origin='totus' and new.document_type='factura' and new.invoice_kind='invoice' then
  if new.purchase_order_ref !~ '^prestashop:(hortimatic|newoldsmok):order:[1-9][0-9]{0,14}$' then raise exception 'Referencia PrestaShop no válida.' using errcode='22023';end if;
  shop=split_part(new.purchase_order_ref,':',2);
  if not exists(select 1 from public.ops_stores s where s.id=new.store_id and lower(trim(s.name))=shop) then raise exception 'La factura no corresponde a la tienda del pedido.' using errcode='22023';end if;
  if new.include_in_income is distinct from false then raise exception 'La venta PrestaShop ya pertenece al cierre: no se puede sumar otra vez a ingresos.' using errcode='22023';end if;
 end if;
 return new;
end $$;
revoke all on function private.totus_prestashop_invoice_origin_guard() from public,anon,authenticated;
drop trigger if exists totus_prestashop_invoice_origin_guard on public.ops_sales_invoices;
create trigger totus_prestashop_invoice_origin_guard before insert or update on public.ops_sales_invoices for each row execute function private.totus_prestashop_invoice_origin_guard();
commit;
