-- Exercises the real row-restoration engine, including issued documents and authors.
-- File transfer is verified independently by the coordinator and live staging round trip.
begin;
do $$
declare admin_id uuid; admin_email text; shop_id uuid; series_id uuid; rect_series uuid;
 invoice_id uuid; credit_id uuid; job_id uuid=gen_random_uuid(); failed_job uuid=gen_random_uuid();
 concurrent_job uuid=gen_random_uuid(); snap jsonb; payload jsonb; before_failure jsonb; results jsonb;
 rejected boolean; triggers_before jsonb; triggers_after jsonb; original_number text;
begin
 select p.id,p.email into admin_id,admin_email from public.profiles p
 join public.team_members t on lower(t.email)=lower(p.email) where t.active and t.role='admin' limit 1;
 if admin_id is null then raise exception 'Active administrator required'; end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'email',admin_email,'role','authenticated')::text,true);
 select id into shop_id from public.ops_stores where active order by code limit 1;
 select id into series_id from public.ops_invoice_series where active and store_id is null
  and series_kind='invoice' and document_type='factura' and year=extract(year from current_date) limit 1;
 select id into rect_series from public.ops_invoice_series where active and store_id is null
  and series_kind='rectifying' and document_type='factura' and year=extract(year from current_date) limit 1;
 invoice_id=public.totus_save_sales_document(jsonb_build_object('series_id',series_id,'store_id',shop_id,
  'issue_date',current_date,'customer_name','RECOVERY ROLLBACK QA','customer_tax_id','QA-RECOVERY',
  'document_type','factura','invoice_kind','invoice','paid_status','pendiente','paid_amount',0),
  '[{"description":"Recovery fixture","quantity":2,"unit_price_base":100,"discount_pct":0,"vat_rate":21}]');
 perform public.totus_finalize_sales_document(invoice_id);
 credit_id=public.totus_save_sales_document(jsonb_build_object('series_id',rect_series,'store_id',shop_id,
  'issue_date',current_date,'customer_name','RECOVERY ROLLBACK QA','customer_tax_id','QA-RECOVERY',
  'document_type','factura','invoice_kind','rectifying','rectified_invoice_id',invoice_id,
  'rectification_reason','Recovery fixture refund','paid_status','pendiente','paid_amount',0),
  '[{"description":"Return fixture","quantity":-1,"unit_price_base":100,"discount_pct":0,"vat_rate":21}]');
 perform public.totus_finalize_sales_document(credit_id);
 perform public.totus_update_invoice_payment(credit_id,jsonb_build_object('paid_status','parcial','paid_amount',20,'paid_date',current_date));
 select display_number into original_number from public.ops_sales_invoices where id=invoice_id;
 snap=public.totus_export_recovery_snapshot();payload=snap->'database';
 -- Remove asset references in the transaction-only row fixture. No Storage metadata is written.
 payload=jsonb_set(payload,'{ops_document_templates}',(select jsonb_agg(value||jsonb_build_object('logo_path',null)) from jsonb_array_elements(payload->'ops_document_templates')));
 insert into public.ops_recovery_jobs(id,requested_by,requested_email,status,source_path,checkpoint_path,before_revision)
 values(job_id,admin_id,lower(admin_email),'prepared','qa/source','qa/checkpoint',snap->>'revision');
 select jsonb_object_agg(t.oid::text,t.tgenabled) into triggers_before from pg_trigger t
 where t.tgrelid in (select format('public.%I',x)::regclass from unnest(private.totus_recovery_tables()) x) and not t.tgisinternal;
 results=public.totus_commit_recovery(job_id,payload,snap);
 if (results->>'ops_sales_invoices')::integer<2 then raise exception 'Issued invoices missing after restore'; end if;
 if (select total_amount<>242 or display_number<>original_number or created_by<>admin_id from public.ops_sales_invoices where id=invoice_id) then raise exception 'Original invoice or author changed'; end if;
 if (select rectified_invoice_id<>invoice_id or paid_amount<>20 or total_amount<>-121 or created_by<>admin_id from public.ops_sales_invoices where id=credit_id) then raise exception 'Credit links, refund or author lost'; end if;
 if (select status from public.ops_recovery_jobs where id=job_id)<>'committed' then raise exception 'Commit not journalled'; end if;
 select jsonb_object_agg(t.oid::text,t.tgenabled) into triggers_after from pg_trigger t
 where t.tgrelid in (select format('public.%I',x)::regclass from unnest(private.totus_recovery_tables()) x) and not t.tgisinternal;
 if triggers_before is distinct from triggers_after then raise exception 'Trigger state was not restored'; end if;
 before_failure=private.totus_recovery_dataset();
 if public.totus_commit_recovery(job_id,payload,snap) is distinct from results then raise exception 'Committed retry not idempotent'; end if;
 if private.totus_recovery_dataset() is distinct from before_failure then raise exception 'Retry rewrote data'; end if;
 snap=public.totus_export_recovery_snapshot();payload=snap->'database';
 payload=jsonb_set(payload,'{ops_sales_invoice_lines,0,invoice_id}',to_jsonb(gen_random_uuid()));
 insert into public.ops_recovery_jobs(id,requested_by,requested_email,status,source_path,checkpoint_path,before_revision)
 values(failed_job,admin_id,lower(admin_email),'prepared','qa/source','qa/checkpoint',snap->>'revision');
 rejected=false;
 begin perform public.totus_commit_recovery(failed_job,payload,snap);
 exception when foreign_key_violation then rejected=true; end;
 if not rejected then raise exception 'Invalid FK payload accepted'; end if;
 if private.totus_recovery_dataset() is distinct from before_failure then raise exception 'Failure after truncate did not roll back all data'; end if;
 select jsonb_object_agg(t.oid::text,t.tgenabled) into triggers_after from pg_trigger t
 where t.tgrelid in (select format('public.%I',x)::regclass from unnest(private.totus_recovery_tables()) x) and not t.tgisinternal;
 if triggers_before is distinct from triggers_after then raise exception 'Failure left triggers disabled'; end if;
 snap=public.totus_export_recovery_snapshot();payload=snap->'database';
 insert into public.ops_recovery_jobs(id,requested_by,requested_email,status,source_path,checkpoint_path,before_revision)
 values(concurrent_job,admin_id,lower(admin_email),'prepared','qa/source','qa/checkpoint',snap->>'revision');
 update public.ops_stores set name=name||' QA concurrent' where id=shop_id;
 before_failure=private.totus_recovery_dataset();rejected=false;
 begin perform public.totus_commit_recovery(concurrent_job,payload,snap);
 exception when raise_exception then rejected=true; end;
 if not rejected then raise exception 'Concurrent changes were overwritten'; end if;
 if private.totus_recovery_dataset() is distinct from before_failure then raise exception 'Concurrent changes not preserved'; end if;
 if has_function_privilege('authenticated','public.totus_commit_recovery(uuid,jsonb,jsonb)','execute')
  or has_function_privilege('anon','public.totus_commit_recovery(uuid,jsonb,jsonb)','execute') then raise exception 'Browser can call destructive recovery directly'; end if;
end $$;
select 'OK: atomic recovery, issued invoices, authors, refund links, failure rollback, trigger states, idempotency and concurrent-change protection' as result;
rollback;
