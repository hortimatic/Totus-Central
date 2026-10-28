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
 -- Regression: SQL NULL must not bypass the manual-reading confirmation.
 update public.ops_stock_sources set extraction='{"state":"partial"}' where id=s1;
 select private.totus_stock_result(r.id,jsonb_set(result,'{coverage,0,reading_note}','"Original reviewed"')) into got;
 if got<>'needs_review' then raise exception 'Missing explicit manual confirmation became green';end if;
 select private.totus_stock_result(r.id,jsonb_set(jsonb_set(result,'{coverage,0,reading_note}','"Original reviewed"'),'{coverage,0,manually_verified}','true')) into got;
 if got<>'matched' then raise exception 'Explicit complete manual reading was rejected';end if;
 update public.ops_stock_sources set extraction='{}' where id=s1;
 select private.totus_stock_result(r.id,result) into got;
 if got<>'needs_review' then raise exception 'Missing extraction metadata became green';end if;
 update public.ops_stock_sources set extraction='{"state":"ready"}' where id=s1;
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
 -- Review closure is audited and keeps the signed documentary data untouched.
 select * into r from public.totus_stock_save_result(r.id,r.revision,
  jsonb_set(result,'{rows,0,prestashop_qty}','13'), 'qa@example.invalid');
 if r.status<>'differences' then raise exception 'Difference precondition missing';end if;
 failed=false;
 begin perform public.totus_stock_mark_reviewed(r.id,r.revision,'nota corta','qa@example.invalid');
 exception when others then failed=true;end;
 if not failed then raise exception 'Review accepted without meaningful justification';end if;
 failed=false;
 begin perform public.totus_stock_mark_reviewed(r.id,r.revision-1,'Recuento verificado y unidades pendientes anotadas para el equipo.','qa@example.invalid');
 exception when others then failed=true;end;
 if not failed then raise exception 'Stale review revision accepted';end if;
 select * into r from public.totus_stock_mark_reviewed(r.id,r.revision,
  'Recuento contrastado: una unidad pendiente de entrega; diferencias preservadas.',
  'qa@example.invalid');
 if r.status<>'reviewed' or r.result->'review'->>'reviewed_by'<>'qa@example.invalid'
  or r.result->'rows'->0->>'prestashop_qty'<>'13' then
  raise exception 'Review closure lost data or actor';end if;
 if not exists(select 1 from public.ops_stock_revisions where receipt_id=r.id and revision=r.revision and action='reviewed')
  then raise exception 'Review closure not audited';end if;
 failed=false;
 begin perform public.totus_stock_mark_reviewed(r.id,r.revision,'Recuento verificado y registrado previamente.','qa@example.invalid');
 exception when others then failed=true;end;
 if not failed then raise exception 'Review double-closed';end if;
 select * into r from public.totus_stock_save_result(r.id,r.revision,
  r.result,'qa@example.invalid');
 if r.status<>'differences' or r.result ? 'review' then
  raise exception 'A changed cotejo retained the old review sign-off';end if;
 select * into r from public.totus_stock_remove_source(r.id,r.revision,s2,'Wrong association','qa@example.invalid');
 if r.status<>'pending' or jsonb_array_length(r.result->'rows')<>0 then raise exception 'Source removal retained old green result';end if;
 if not exists(select 1 from public.ops_documents where id='44444444-4444-4444-8444-444444444444') then raise exception 'Original deleted by unlink';end if;
 select * into r from public.totus_stock_edit(r.id,r.revision,r.store_id,'Proveedor corregido','Pedido 1',current_date,'Nota','qa@example.invalid');
 if r.supplier<>'Proveedor corregido' or r.status<>'pending' then raise exception 'Receipt metadata edit failed';end if;
 failed=false;
 begin perform public.totus_stock_edit(r.id,r.revision,'22222222-2222-4222-8222-222222222222','Proveedor','Pedido',current_date,'','qa@example.invalid');
 exception when others then failed=true;end;
 if not failed then raise exception 'Metadata edit mixed store documents';end if;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 select * into r from public.totus_stock_register_cloud_document(r.id,r.revision,'prestashop','01 Documentos/Recepciones/pedido.pdf','cloud-item','pedido.pdf',3,repeat('a',64),'Producto 10','{"state":"ready"}','qa@example.invalid');
 if not exists(select 1 from public.ops_stock_sources s join public.ops_onedrive_documents m on m.document_id=s.document_id where s.receipt_id=r.id and m.onedrive_item_id='cloud-item' and m.sha256=repeat('a',64)) then raise exception 'Verified cloud original not associated';end if;
 perform set_config('request.jwt.claims','',true);
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
