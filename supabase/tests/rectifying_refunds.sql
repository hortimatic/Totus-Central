-- Real database test. Invoices, numbering, author links and audit rows roll back.
begin;
do $$
declare admin_id uuid; admin_email text; shop_id uuid; normal_series uuid; rect_series uuid;
 original_id uuid; rect_id uuid; original_number text; rejected boolean;
 original_doc jsonb; rect_doc jsonb; ordinary_lines jsonb; credit_lines jsonb;
begin
 select p.id,p.email into admin_id,admin_email from public.profiles p
 join public.team_members t on lower(t.email)=lower(p.email) where t.role='admin' and t.active limit 1;
 if admin_id is null then raise exception 'An active administrator is required'; end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'email',admin_email,'role','authenticated')::text,true);
 select id into shop_id from public.ops_stores where active order by code limit 1;
 select id into normal_series from public.ops_invoice_series where active and store_id is null
 and document_type='factura' and series_kind='invoice' and year=extract(year from current_date) limit 1;
 select id into rect_series from public.ops_invoice_series where active and store_id is null
 and document_type='factura' and series_kind='rectifying' and year=extract(year from current_date) limit 1;
 original_doc=jsonb_build_object('store_id',shop_id,'series_id',normal_series,'issue_date',current_date,
 'document_type','factura','invoice_kind','invoice','origin','totus','customer_name','REFUND ROLLBACK QA',
 'customer_tax_id','QA-REFUND','paid_status','pendiente','paid_amount',0);
 ordinary_lines='[{"description":"Synthetic sale","quantity":2,"unit_price_base":50,"discount_pct":0,"vat_rate":21}]';
 credit_lines='[{"description":"Synthetic return","quantity":-1,"unit_price_base":50,"discount_pct":0,"vat_rate":21}]';
 original_id=public.totus_save_sales_document(original_doc,ordinary_lines);
 perform public.totus_finalize_sales_document(original_id);
 select display_number into original_number from public.ops_sales_invoices where id=original_id;
 rect_doc=original_doc||jsonb_build_object('series_id',rect_series,'invoice_kind','rectifying',
 'rectified_invoice_id',original_id,'rectification_reason','Devolución parcial de una unidad');
 rejected=false;
 begin perform public.totus_save_sales_document(rect_doc-'rectification_reason',credit_lines);
 exception when raise_exception then rejected=true; end;
 if not rejected then raise exception 'Missing rectification reason was accepted'; end if;
 rejected=false;
 begin perform public.totus_save_sales_document(rect_doc-'rectified_invoice_id',credit_lines);
 exception when raise_exception then rejected=true; end;
 if not rejected then raise exception 'Missing original invoice was accepted'; end if;
 rejected=false;
 begin perform public.totus_save_sales_document(original_doc,credit_lines);
 exception when raise_exception then rejected=true; end;
 if not rejected then raise exception 'Negative ordinary invoice was accepted'; end if;
 rect_id=public.totus_save_sales_document(rect_doc,credit_lines);
 perform public.totus_finalize_sales_document(rect_id);
 if (select total_amount from public.ops_sales_invoices where id=rect_id)<>-60.50 then raise exception 'Wrong credit total'; end if;
 if (select rectified_invoice_snapshot->>'number' from public.ops_sales_invoices where id=rect_id)<>original_number then raise exception 'Original number not frozen'; end if;
 perform public.totus_update_invoice_payment(rect_id,jsonb_build_object('paid_status','parcial','paid_amount',20,'paid_date',current_date,'payment_method','transferencia'));
 if (select paid_amount from public.ops_sales_invoices where id=rect_id)<>20 then raise exception 'Partial refund not recorded'; end if;
 rejected=false;
 begin perform public.totus_update_invoice_payment(rect_id,jsonb_build_object('paid_status','pagada','paid_amount',61,'paid_date',current_date));
 exception when raise_exception then rejected=true; end;
 if not rejected then raise exception 'Excess refund accepted'; end if;
 rejected=false;
 begin perform public.totus_update_invoice_payment(rect_id,jsonb_build_object('paid_status','parcial','paid_amount',-1,'paid_date',current_date));
 exception when raise_exception then rejected=true; end;
 if not rejected then raise exception 'Negative settlement magnitude accepted'; end if;
 rejected=false;
 begin update public.ops_sales_invoices set rectification_reason='Altered after issue' where id=rect_id;
 exception when raise_exception then rejected=true; end;
 if not rejected then raise exception 'Issued reason was mutable'; end if;
 perform public.totus_update_invoice_payment(rect_id,jsonb_build_object('paid_status','pagada','paid_amount',60.50,'paid_date',current_date,'payment_method','transferencia'));
 if (select paid_status from public.ops_sales_invoices where id=rect_id)<>'pagada' then raise exception 'Full refund not settled'; end if;
 if (select total_amount<>121 or paid_amount<>0 or display_number<>original_number from public.ops_sales_invoices where id=original_id) then raise exception 'Original invoice was rewritten'; end if;
end $$;
select 'OK: reference, reason, partial/full refunds, negative ordinary invoice and original immutability' as result;
rollback;
