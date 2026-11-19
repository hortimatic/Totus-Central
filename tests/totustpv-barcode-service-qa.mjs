import test from 'node:test';
import assert from 'node:assert/strict';
import {createBarcodeService} from '../src/totustpv/server/barcode-service.js';
import {internalBarcode} from '../src/totustpv/barcode-options.js';
const target=n=>({product_id:n,attribute_id:0,name:'Artículo '+n,variant_name:'',reference:''});
const page=(start,count,more)=>({source:'native-missing-barcode-targets',plan_version:1,field:'ean13',shop_id:1,
 items:Array.from({length:count},(_,i)=>target(start+i)),cursor:[start+count-1,0],bounds:{product:75,attribute:0},has_more:more});
function fixture(){
 let job={id:'job',field:'ean13',status:'preparing',cursor:[0,0],bounds:null};
 const events=[],captured=[];let lose=false,denied=false,reads=0;
 const build=()=>createBarcodeService({scope:{shopId:1},authorize:async()=>{events.push('authorize');if(denied)throw Error('denied');},
  transport:{readNativeBarcodeTargets:async query=>{events.push('native');reads++;assert.deepEqual(query.cursor,job.cursor);return query.cursor[0]===0?page(1,50,true):page(51,25,false);}},
  rpc:async(_,args)=>{events.push(args.p_action);if(args.p_action==='get')return {data:structuredClone(job)};
   if(args.p_action==='capture'){
    assert.deepEqual(args.p_data.fromCursor,job.cursor);captured.push(...args.p_data.page.items);
    job={...job,cursor:args.p_data.page.cursor,bounds:args.p_data.page.bounds,status:args.p_data.page.has_more?'preparing':'review'};
    if(lose){lose=false;throw Error('response lost');}return {data:structuredClone(job)};
   }throw Error('unexpected');}});
 return {build,events,captured,setLost:()=>{lose=true;},deny:()=>{denied=true;},reads:()=>reads};
}
test('capture resumes from durable cursor after a lost response and includes all 75 targets',async()=>{
 const f=fixture();f.setLost();await assert.rejects(f.build().capture('job'),/response lost/);
 const recovered=await f.build().capture('job');assert.equal(recovered.status,'review');
 assert.equal(f.captured.length,75);assert.equal(new Set(f.captured.map(t=>t.product_id)).size,75);
 assert.deepEqual(f.events.slice(0,4),['get','authorize','native','capture']);
 await f.build().capture('job');assert.equal(f.reads(),2);
});
test('revoked product edit permission prevents the native read',async()=>{
 const f=fixture();f.deny();await assert.rejects(f.build().capture('job'),/denied/);assert.equal(f.reads(),0);assert.equal(f.captured.length,0);
});
test('execution persists a plan before dispatch and recovers claimed targets through GET only',async()=>{
 const events=[],operationId='00000000-0000-4000-8000-000000000001';
 const item={...target(1),code:internalBarcode('ean13',1),snapshot_fingerprint:'a'.repeat(64)};
 const plan={source:'native-missing-barcodes-plan',plan_version:1,capability:{can_execute:true,reason:'ready'},field:'ean13',scheme:'rcn13-04',shop_id:1,items:[item],skipped_targets:[],has_more:false,skipped_shared:0,plan_fingerprint:'b'.repeat(64)};
 const payload={plan_version:1,field:'ean13',items:[item],plan_fingerprint:plan.plan_fingerprint,item_index:0};
 let next={kind:'plan',field:'ean13',afterOrdinal:0,targets:[{productId:1,attributeId:0}]};
 const service=createBarcodeService({scope:{shopId:1},authorize:async action=>events.push(action),
  transport:{readNativeBarcodeTargets:async()=>{},readNativeBarcodePlan:async query=>{events.push('native-plan');assert.equal(query.skipExisting,true);return plan;}},
  nativeRequests:{execute:async args=>{events.push('execute');assert.deepEqual(args,{operationId,command:'barcodes.assign',payload});},recover:async id=>{events.push('recover');assert.equal(id,operationId);}},
  rpc:async(name,args)=>{
   events.push(args.p_action);
   if(name==='totus_tpv_barcode_jobs')return {data:{status:'processing'}};
   if(args.p_action==='next')return {data:next};
   assert.equal(args.p_action,'plan');assert.deepEqual(args.p_data,{afterOrdinal:0,plan});return {data:{kind:'execute',operationId,payload}};
  }});
 await service.advance('job');assert.deepEqual(events,['next','edit','native-plan','plan','get']);
 events.length=0;next={kind:'execute',operationId,payload};await service.advance('job');assert.deepEqual(events,['next','edit','execute','get']);
 events.length=0;next={kind:'recover',operationId,payload};await service.advance('job');assert.deepEqual(events,['next','view','recover','get']);
 events.length=0;next={kind:'idle'};await service.advance('job');assert.deepEqual(events,['next','get']);
});
test('label lookup reads the current native code each time instead of reusing the assignment receipt',async()=>{
 const calls=[];let code='4006381333931';
 const service=createBarcodeService({scope:{shopId:1},authorize:async action=>calls.push(action),rpc:async()=>({data:{field:'ean13',items:[{productId:1,attributeId:2,code:'OLD-RECEIPT'}]}}),
  transport:{readNativeBarcodeTargets:async()=>{},readNativeBarcodeLabels:async query=>{
   calls.push('labels');assert.deepEqual(query.targets,[{productId:1,attributeId:2}]);return {source:'native-barcode-labels',field:'ean13',shop_id:1,items:[{product_id:1,attribute_id:2,name:'Artículo',variant_name:'Rojo',reference:'',code,symbology:'ean13',modules:'10'.repeat(47)+'1'}],skipped:[]};
  }}});
 assert.equal((await service.labels('job')).items[0].code,code);code='5901234123457';assert.equal((await service.labels('job')).items[0].code,code);assert.deepEqual(calls,['view','labels','view','labels']);
});
test('preserved native proof resolves the saved intention while retaining GET-only recovery and view permission',async()=>{
 const events=[],proof={code:'EXTERNAL'};
 const service=createBarcodeService({scope:{shopId:1},authorize:async action=>events.push(action),transport:{readNativeBarcodeTargets:async()=>{},readNativeBarcodePlan:async()=>{}},
  nativeRequests:{execute:async()=>assert.fail('Cannot execute a claimed target'),recover:async()=>({status:'preserved',preserved:proof})},
  rpc:async(name,args)=>{events.push(args.p_action);if(name==='totus_tpv_barcode_jobs')return {data:{status:'processing',keptCount:1}};
   if(args.p_action==='next')return {data:{kind:'recover',operationId:'saved-target'}};assert.deepEqual(args.p_data,{operationId:'saved-target',proof});return {data:{kind:'plan'}};}});
 assert.equal((await service.advance('job')).keptCount,1);assert.deepEqual(events,['next','view','preserve','get']);
});
