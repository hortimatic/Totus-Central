import {internalBarcode} from '../../src/totustpv/barcode-options.js';
export async function exerciseBarcodeExecution({db,id,scope,check,denied}){
 const configure=async enabled=>{
  await db.exec('reset role;set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[scope.actorId]);
  await db.query('select public.totus_tpv_barcode_options($1,$2,$3,$4::jsonb)',[scope.connectionId,scope.shopId,scope.drawerId,JSON.stringify({field:'ean13',generatorEnabled:enabled})]);await db.exec('reset role;set role service_role');
 };
 const job=id(2100),call=async(fn,action,data={},operation=job)=>(await db.query('select public.'+fn+'($1,$2,$3::jsonb,$4::jsonb) value',[action,operation,JSON.stringify(scope),JSON.stringify(data)])).rows[0].value;
 const jobs=(a,d)=>call('totus_tpv_barcode_jobs',a,d),run=(a,d)=>call('totus_tpv_barcode_execution',a,d);
 const item=n=>({product_id:n,attribute_id:0,name:'Producto '+n,variant_name:'',reference:''});
 const plan=(start,count,skip=[])=>({source:'native-missing-barcodes-plan',plan_version:1,capability:{can_execute:true,reason:'ready'},field:'ean13',scheme:'rcn13-04',shop_id:scope.shopId,
  items:Array.from({length:count},(_,i)=>start+i).filter(n=>!skip.includes(n)).map(n=>({...item(n),code:internalBarcode('ean13',n),snapshot_fingerprint:'a'.repeat(64)})),
  skipped_targets:skip.map(n=>({product_id:n,attribute_id:0,reason:'already-set',code:'EXISTING-'+n})),has_more:false,skipped_shared:0,plan_fingerprint:'b'.repeat(64)});
 const complete=async next=>{
  const p=next.payload,result={verified:true,native_reference:next.operationId,shop_id:scope.shopId,plan_version:1,field:p.field,scheme:'rcn13-04',plan_fingerprint:p.plan_fingerprint,item_index:p.item_index,items:[p.items[p.item_index]],count:1};
  return call('totus_tpv_native_command','complete',{result},next.operationId);
 };
 try{
  await configure(true);await jobs('create');
  for(const [start,count,more] of [[1,50,true],[51,25,false]])await jobs('capture',{fromCursor:[start-1,0],page:{source:'native-missing-barcode-targets',plan_version:1,field:'ean13',shop_id:scope.shopId,items:Array.from({length:count},(_,i)=>item(start+i)),has_more:more,cursor:[start+count-1,0],bounds:{product:75,attribute:0}}});
  check((await run('next')).kind,'idle');await denied(()=>run('plan',{afterOrdinal:0,plan:plan(1,50)}),/STATE_INVALID/);
  await jobs('confirm',{accepted:true});let next=await run('next');check(next.kind,'plan');check(next.targets.length,15);
  await denied(()=>run('plan',{afterOrdinal:0,plan:plan(1,14)}),/PLAN_INVALID/);
  const first=plan(1,15,[2]);first.items=first.items.map(row=>({...row,name:'\x01'.repeat(255),variant_name:'\x02'.repeat(255),reference:'\x03'.repeat(64)}));
  next=await run('plan',{afterOrdinal:0,plan:first});check(next.kind,'execute');
  check(new TextEncoder().encode(JSON.stringify({protocol:1,operation_id:next.operationId,installation_id:id(1),shop_id:scope.shopId,actor_id:scope.actorId,command:'barcodes.assign',payload:next.payload})).length<=65536,true);
  const bound=next.operationId;check((await run('plan',{afterOrdinal:0,plan:first})).operationId,bound);
  await denied(()=>run('plan',{afterOrdinal:0,plan:{...first,plan_fingerprint:'c'.repeat(64)}}),/PLAN_CHANGED/);
  await denied(()=>call('totus_tpv_native_command','claim',{command:'barcodes.assign',payload:next.payload},id(2199)),/NOT_APPROVED/);
  await denied(()=>call('totus_tpv_native_command','claim',{command:'barcodes.assign',payload:{...next.payload,item_index:1}},bound),/ALREADY_BOUND/);
  await jobs('pause');await denied(()=>call('totus_tpv_native_command','claim',{command:'barcodes.assign',payload:next.payload},bound),/STATE_INVALID/);check((await run('next')).kind,'idle');await jobs('resume');
  const claim=await call('totus_tpv_native_command','claim',{command:'barcodes.assign',payload:next.payload},bound);check(claim.won,true);
  check((await call('totus_tpv_native_command','claim',{command:'barcodes.assign',payload:next.payload},bound)).won,false);
  await jobs('pause');check((await run('next')).kind,'recover');await call('totus_tpv_native_command','uncertain',{},bound);
  await denied(()=>call('totus_tpv_native_command','complete',{result:{verified:true,native_reference:bound}},bound),/READBACK_REQUIRED/);
  await complete(next);check((await run('next')).kind,'idle');await jobs('resume');
  const external=await run('next'),selected=external.payload.items[external.payload.item_index];
  await call('totus_tpv_native_command','claim',{command:'barcodes.assign',payload:external.payload},external.operationId);
  const proof={plan_version:1,shop_id:scope.shopId,field:'ean13',product_id:selected.product_id,attribute_id:selected.attribute_id,code:'EXTERNAL-CODE-3',plan_fingerprint:external.payload.plan_fingerprint,item_index:external.payload.item_index};
  await denied(()=>run('preserve',{operationId:external.operationId,proof}),/PRESERVATION_INVALID/);
  await call('totus_tpv_native_command','uncertain',{},external.operationId);
  await denied(()=>run('preserve',{operationId:external.operationId,proof:{...proof,product_id:9999}}),/PRESERVATION_INVALID/);
  await run('preserve',{operationId:external.operationId,proof});await run('preserve',{operationId:external.operationId,proof});
  await denied(()=>run('preserve',{operationId:external.operationId,proof:{...proof,code:'CHANGED'}}),/PRESERVATION_CHANGED/);
  const kept=await jobs('get');check(kept.keptCount,2);check(kept.uncertainCount,0);check(kept.items[2].status,'already-set');check(kept.items[2].code,'EXTERNAL-CODE-3');
  const failed=await call('totus_tpv_native_command','get',{},external.operationId);check(failed.status,'uncertain');check(failed.result,null);
  await denied(()=>run('plan',{afterOrdinal:15,plan:plan(16,15)}),/PLAN_STALE/);
  for(let n=0;n<100;n++){
   next=await run('next');if(next.kind==='completed')break;
   if(next.kind==='plan'){check(next.targets.length,Math.min(15,75-next.afterOrdinal));await run('plan',{afterOrdinal:next.afterOrdinal,plan:plan(next.targets[0].productId,next.targets.length)});continue;}
   check(next.kind,'execute');await call('totus_tpv_native_command','claim',{command:'barcodes.assign',payload:next.payload},next.operationId);await complete(next);
  }
  const finished=await jobs('get');check(finished.status,'completed');check(finished.generatedCount,73);check(finished.keptCount,2);check(finished.pendingCount,0);check(finished.uncertainCount,0);
  check(finished.items[0].status,'generated');check(finished.items[0].code,internalBarcode('ean13',1));check(finished.items[1].code,'EXISTING-2');
  check(JSON.stringify(finished).includes('plan_fingerprint'),false);check(JSON.stringify(finished).includes('operationId'),false);check((await run('next')).kind,'idle');
  await db.exec('reset role');const counts=(await db.query('select count(*)::int total,count(operation_id)::int assigned,count(*) filter(where skip_reason is not null)::int kept from private.totus_tpv_barcode_lines where job_id=$1',[job])).rows[0];check(counts,{total:75,assigned:74,kept:1});
  for(const role of ['anon','authenticated']){await db.exec('reset role;set role '+role);await denied(()=>run('next'),/permission denied/);}
  console.log('PASS barcode execution SQL: complete 75-target capture, stable per-target operations, sequential blocks, preserved existing code, pause stops new claims, GET recovery remains available, exact receipt required, browser roles denied. Synthetic commands only; no native writes.');
 }finally{await configure(false);await db.exec('reset role;set role authenticated');}
}
