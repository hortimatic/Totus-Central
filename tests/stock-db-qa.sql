do $test$
declare r public.ops_stock_receipts;s1 uuid;s2 uuid;result jsonb;got text;failed boolean;
begin
 select * into r from public.totus_stock_create('11111111-1111-4111-8111-111111111111','Proveedor QA','Pedido 1',current_date,'','qa@example.invalid');
 if r.revision<>1 then raise exception 'Initial revision';end if;
 failed=false;
 begin perform public.totus_stock_add_source(r.id,1,'55555555-5555-4555-8555-555555555555','supplier','Text','{"state":"ready"}','qa@example.invalid');
 exception when others then failed=true;end;
 if not failed then raise exception 'Cross-store document accepted';end if;
 select * into r from public.totus_stock_add_source(r.id,1,'33333333-3333-4333-8333-333333333333','supplier','Product 10','{"state":"ready"}','qa@example.invalid');
 failed=false;
 begin perform public.totus_stock_add_source(r.id,1,'44444444-4444-4444-8444-444444444444','prestashop','Text','{"state":"ready"}','qa@example.invalid');
 exception when others then failed=true;end;
 if not failed then raise exception 'Stale revision accepted';end if;
 select * into r from public.totus_stock_add_source(r.id,2,'44444444-4444-4444-8444-444444444444','prestashop','Product 12','{"state":"ready"}','qa@example.invalid');
 select id into s1 from public.ops_stock_sources where receipt_id=r.id and source_kind='supplier';
 select id into s2 from public.ops_stock_sources where receipt_id=r.id and source_kind='prestashop';
 result=jsonb_build_object('complete',true,'coverage',jsonb_build_array(
  jsonb_build_object('source_id',s1,'complete',true,'explanation','Read page 1'),
  jsonb_build_object('source_id',s2,'complete',true,'explanation','Read row 1')),
 'rows',jsonb_build_array(jsonb_build_object('id','r1','supplier_name','Product','prestashop_name','Product PS','supplier_qty',10,'prestashop_qty',12,
 'adjustment_qty',2,'adjustment_included','yes','adjustment_reason','Other stock adjustment','unit_factor',1,'unit','unidad','unit_confirmed',true,'match_confirmed',true,
 'source_refs',jsonb_build_array(jsonb_build_object('source_id',s1,'line_id','p1l1','locator','Page 1'),jsonb_build_object('source_id',s2,'line_id','r1','locator','Row 1')))));
 select * into r from public.totus_stock_save_result(r.id,r.revision,result,'qa@example.invalid');
 if r.status<>'matched' then raise exception 'Matched result got %',r.status;end if;
 select private.totus_stock_result(r.id,jsonb_set(result,'{rows,0,prestashop_qty}','13')) into got;
 if got<>'differences' then raise exception 'Difference not detected';end if;
 select private.totus_stock_result(r.id,jsonb_set(result,'{rows,0,supplier_qty}','null')) into got;
 if got<>'needs_review' then raise exception 'Unknown quantity became green';end if;
 select private.totus_stock_result(r.id,jsonb_set(result,'{coverage}','[]')) into got;
 if got<>'needs_review' then raise exception 'Missing coverage became green';end if;
 failed=false;
 begin perform private.totus_stock_result(r.id,jsonb_set(result,'{rows}',(result->'rows')||jsonb_build_array(jsonb_set(result->'rows'->0,'{id}','"r2"'))));
 exception when others then failed=true;end;
 if not failed then raise exception 'Duplicate source line accepted';end if;
 failed=false;
 begin update public.ops_documents set sha256='new-original' where id='33333333-3333-4333-8333-333333333333';
 exception when others then failed=true;end;
 if not failed then raise exception 'Protected original changed';end if;
 if (select count(*) from public.ops_stock_revisions where receipt_id=r.id)<>4 then raise exception 'Missing audit revisions';end if;
 select * into r from public.totus_stock_remove_source(r.id,r.revision,s2,'Wrong association','qa@example.invalid');
 if r.status<>'pending' or jsonb_array_length(r.result->'rows')<>0 then raise exception 'Source removal retained old green result';end if;
 if not exists(select 1 from public.ops_documents where id='44444444-4444-4444-8444-444444444444') then raise exception 'Original deleted by unlink';end if;
 raise notice 'STOCK DB QA: guarded writes, revisions, source identity, states, adjustments and protected originals OK';
end $test$;
-- A public/browser session must not impersonate the SQL connector.
set request.jwt.claims='{}';
set role authenticated;
do $test$
declare denied boolean=false;
begin
 begin perform public.totus_stock_create('11111111-1111-4111-8111-111111111111','Denied','x',current_date,'','qa@example.invalid');
 exception when others then denied=true;end;
 if not denied then raise exception 'Unauthenticated connector impersonation';end if;
end $test$;
reset role;
