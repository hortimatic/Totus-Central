\set ON_ERROR_STOP on
begin;
insert into public.ops_stores values('11111111-1111-4111-8111-111111111111','Hortimatic'),('22222222-2222-4222-8222-222222222222','NewOldSmok');
insert into public.ops_sales_invoices(store_id,origin,document_type,invoice_kind,purchase_order_ref,include_in_income) values('11111111-1111-4111-8111-111111111111','totus','factura','invoice','prestashop:hortimatic:order:1',false);
do $$ begin
 begin insert into public.ops_sales_invoices(store_id,origin,document_type,invoice_kind,purchase_order_ref,include_in_income) values('11111111-1111-4111-8111-111111111111','totus','factura','invoice','prestashop:hortimatic:order:1',false);raise exception 'Duplicate accepted';exception when unique_violation then null;end;
 begin update public.ops_sales_invoices set include_in_income=true where purchase_order_ref='prestashop:hortimatic:order:1';raise exception 'Double income accepted';exception when invalid_parameter_value then null;end;
 begin insert into public.ops_sales_invoices(store_id,origin,document_type,invoice_kind,purchase_order_ref,include_in_income) values('22222222-2222-4222-8222-222222222222','totus','factura','invoice','prestashop:hortimatic:order:2',false);raise exception 'Wrong store accepted';exception when invalid_parameter_value then null;end;
end $$;
insert into public.ops_sales_invoices(store_id,origin,document_type,invoice_kind,purchase_order_ref,include_in_income) values('11111111-1111-4111-8111-111111111111','totus','factura','rectifying','prestashop:hortimatic:order:1',false),('11111111-1111-4111-8111-111111111111','totus','proforma','invoice','prestashop:hortimatic:order:1',false),('11111111-1111-4111-8111-111111111111','totus','factura','invoice','Manual libre',true);
rollback;
