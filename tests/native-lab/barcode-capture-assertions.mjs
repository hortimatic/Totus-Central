export async function exerciseBarcodeCapture({db,id,scope,check,denied}){
 const configure=async value=>{await db.exec('reset role;set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(5)]);const result=(await db.query('select public.totus_tpv_barcode_options($1,$2,$3,$4::jsonb) value',[scope.connectionId,scope.shopId,scope.drawerId,JSON.stringify(value)])).rows[0].value;await db.exec('reset role;set role service_role');return result;};
 const jobId=id(2001),otherId=id(2002),emptyId=id(2003);
 const call=async(action,job=jobId,data={},selected=scope)=>(await db.query('select public.totus_tpv_barcode_jobs($1,$2,$3::jsonb,$4::jsonb) value',[action,job,JSON.stringify(selected),JSON.stringify(data)])).rows[0].value;
 const item=n=>({product_id:n,attribute_id:0,name:'Artículo '+n,variant_name:'',reference:'QA-'+n});
 const page=(start,end,more)=>({source:'native-missing-barcode-targets',plan_version:1,field:'ean13',shop_id:scope.shopId,items:Array.from({length:end-start+1},(_,i)=>item(start+i)),has_more:more,cursor:[end,0],bounds:{product:100,attribute:50}});
 const first=page(1,50,true),second=page(51,75,false);
 // Maximum metadata can expand sixfold when serialized as JSON escapes.
 first.items=first.items.map(row=>({...row,name:'\x01'.repeat(255),variant_name:'\x02'.repeat(255),reference:'\x03'.repeat(64)}));
 await db.exec('reset role');const before=(await db.query("select (select count(*) from private.totus_tpv_native_commands) commands,(select count(*) from private.totus_tpv_operations) operations,(select count(*) from private.totus_tpv_payment_events) payments")).rows[0];
 try{
  for(const role of ['anon','authenticated']){await db.exec('reset role;set role '+role);await denied(()=>call('create'),/permission denied/);}
  await db.exec('reset role;set role service_role');await denied(()=>call(null),/REQUEST_INVALID/);await denied(()=>call('create'),/BARCODE_DISABLED/);
  await configure({field:'ean13',generatorEnabled:true});
  const created=await call('create');check(created.status,'preparing');check(created.capturedCount,0);check(created.scope.sessionId,undefined);
  check((await call('create')).version,created.version);await denied(()=>call('create',otherId),/ALREADY_ACTIVE/);
  await denied(()=>call('confirm',jobId,{accepted:true}),/STATE_INVALID/);
  const captured=await call('capture',jobId,{fromCursor:[0,0],page:first});check(captured.capturedCount,50);check(captured.status,'preparing');check(captured.cursor,[50,0]);check(captured.bounds,first.bounds);
  check((await call('capture',jobId,{fromCursor:[0,0],page:first})).version,captured.version,'Lost capture response is idempotent');
  const invalid=[{...second,field:'upc'},{...second,shop_id:scope.shopId+1},{...second,bounds:{product:101,attribute:50}},{...second,cursor:[50,0],has_more:true},{...second,items:[item(50)]},{...second,items:[item(52),item(51)]},{...second,items:[{...item(51),name:3}]},{...second,items:[{...item(51),product_id:2147483648}]},{...second,items:Array(51).fill(item(51))}];
  for(const bad of invalid)await denied(()=>call('capture',jobId,{fromCursor:[50,0],page:bad}),/CAPTURE_INVALID/);
  check((await call('get')).capturedCount,50,'Rejected pages roll back all target inserts');
  check((await call('pause')).status,'paused');await denied(()=>call('capture',jobId,{fromCursor:[50,0],page:second}),/CAPTURE_STALE/);check((await call('resume')).status,'preparing');
  const ready=await call('capture',jobId,{fromCursor:[50,0],page:second});check(ready.status,'review');check(ready.captureComplete,true);check(ready.capturedCount,75);check(ready.items.length,50);check(ready.hasMore,true);
  const tail=await call('get',jobId,{after:50,pageSize:25});check(tail.items.map(row=>row.productId),Array.from({length:25},(_,i)=>i+51));check(tail.hasMore,false);
  await db.exec('reset role');const definition=(await db.query("select pg_get_functiondef('private.totus_module_can(text,text,text)'::regprocedure) source")).rows[0].source;
  try{
   await db.exec(`create or replace function private.totus_module_can(email text,module text,action text) returns boolean language sql stable as $$select not($2='productos' and $3='edit') and exists(select 1 from public.profiles p where p.email=$1 and p.active and p.role='admin')$$`);await db.exec('set role service_role');
   check((await call('get')).capturedCount,75);await denied(()=>call('confirm',jobId,{accepted:true}),/BARCODE_FORBIDDEN/);
  }finally{await db.exec('reset role');await db.exec(definition);await db.exec('set role service_role');}
  await denied(()=>call('get',jobId,{pageSize:101}),/REQUEST_INVALID/);await denied(()=>call('confirm',jobId,{accepted:false}),/REQUEST_INVALID/);
  await configure({generatorEnabled:false});await denied(()=>call('confirm',jobId,{accepted:true}),/SETTINGS_CHANGED/);await configure({generatorEnabled:true});
  const confirmed=await call('confirm',jobId,{accepted:true});check(confirmed.status,'processing');check(typeof confirmed.confirmedAt,'string');check((await call('confirm',jobId,{accepted:true})).version,confirmed.version);
  check((await call('pause')).status,'paused');check((await call('resume')).status,'processing');check((await call('cancel')).status,'cancelled');check((await call('cancel')).capturedCount,75);
  await call('create',emptyId);const nothing={...first,items:[],has_more:false,cursor:[0,0]};const done=await call('capture',emptyId,{fromCursor:[0,0],page:nothing});check(done.status,'completed');check(done.capturedCount,0);
  check((await call('list',null)).length,2);
  await denied(()=>call('get',jobId,{}, {...scope,actorId:id(9)}),/FORBIDDEN|INVALID|INACTIVE/);
  await denied(()=>call('get',jobId,{}, {...scope,drawerId:id(999)}),/FORBIDDEN|INVALID/);
  await db.exec('reset role;set role authenticated');await denied(()=>db.query('select * from private.totus_tpv_barcode_jobs'),/permission denied/);await denied(()=>db.query('select * from private.totus_tpv_barcode_targets'),/permission denied/);
  await db.exec('reset role');check((await db.query("select (select count(*) from private.totus_tpv_native_commands) commands,(select count(*) from private.totus_tpv_operations) operations,(select count(*) from private.totus_tpv_payment_events) payments")).rows[0],before);
  console.log('PASS barcode capture SQL: 75 persisted targets, bounded pages and rollback, lost-response recovery, full-list review before confirmation, pause/resume/cancel, settings revocation and direct-browser denial. No native command, order or payment created; execution integration remains separate.');
 }finally{await configure({field:'ean13',generatorEnabled:false});await db.exec('reset role;set role authenticated');}
}
