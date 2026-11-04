\set ON_ERROR_STOP on
begin;
create trigger rounding_test before insert or update on public.ops_sales_invoice_lines for each row execute function public.ops_calc_invoice_line();
insert into public.ops_stores values('11111111-1111-4111-8111-111111111111','Hortimatic');
insert into public.ops_sales_invoices(id,store_id,origin,document_type,invoice_kind,purchase_order_ref,include_in_income) values('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','totus','factura','invoice','prestashop:hortimatic:order:15076',false),('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','totus','factura','invoice','manual',true);
insert into public.ops_sales_invoice_lines(invoice_id,quantity,unit_price_base,discount_pct,vat_rate) values('33333333-3333-4333-8333-333333333333',1,2.644628,0,21),('33333333-3333-4333-8333-333333333333',1,5.206612,0,21),('44444444-4444-4444-8444-444444444444',1,2.644628,0,21);
do $$ begin
 if (select sum(total_amount) from public.ops_sales_invoice_lines where invoice_id='33333333-3333-4333-8333-333333333333')<>9.50 then raise exception 'Source total changed';end if;
 if (select total_amount from public.ops_sales_invoice_lines where invoice_id='44444444-4444-4444-8444-444444444444')<>3.19 then raise exception 'Ordinary invoice rounding changed';end if;
end $$;
rollback;
