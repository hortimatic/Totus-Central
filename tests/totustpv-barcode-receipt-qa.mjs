import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeRequestService} from '../src/totustpv/server/native-request-service.js';
const id='00000000-0000-4000-8000-000000000001';
const item={product_id:10,attribute_id:12,name:'Artículo',variant_name:'Rojo',reference:'',code:'0400000000255',snapshot_fingerprint:'a'.repeat(64)};
const payload={plan_version:1,field:'ean13',items:[item],plan_fingerprint:'b'.repeat(64),item_index:0};
const receipt={verified:true,native_reference:id,shop_id:1,plan_version:1,field:'ean13',scheme:'rcn13-04',plan_fingerprint:payload.plan_fingerprint,item_index:0,items:[item],count:1};
async function recover(result){
 const actions=[];let posts=0;
 const service=createNativeRequestService({scope:{shopId:1},rpc:async(_,args)=>{
  actions.push(args.p_action);return {data:args.p_action==='get'?{id,command:'barcodes.assign',payload}:args.p_action==='complete'?{status:'verified',result:args.p_data.result}:{status:'uncertain'}};
 },transport:{nativeCommand:async()=>{posts++;},readNativeOperation:async()=>({status:'verified',operation_id:id,result})}});
 return {result:await service.recover(id),actions,posts};
}
test('barcode recovery accepts exact UUID-bound receipt without posting',async()=>{
 const state=await recover(structuredClone(receipt));assert.equal(state.result.status,'verified');assert.equal(state.posts,0);assert.deepEqual(state.actions,['get','complete']);
});
test('barcode recovery rejects changed identity, code, scope and extra receipt fields',async()=>{
 for(const mutate of [r=>r.native_reference='2',r=>r.shop_id=2,r=>r.items[0].attribute_id=0,r=>r.items[0].code='different',r=>r.count=2,r=>r.extra=true,r=>r.plan_fingerprint='c'.repeat(64)]){
  const changed=structuredClone(receipt);mutate(changed);const state=await recover(changed);
  assert.equal(state.result.status,'uncertain');assert.equal(state.posts,0);assert.deepEqual(state.actions,['get','uncertain']);
 }
});
test('a native pre-update field-already-set proof preserves the external code without fabricating a verified receipt',async()=>{
 const preserved={plan_version:1,shop_id:1,field:'ean13',product_id:item.product_id,attribute_id:item.attribute_id,code:'EXTERNAL',plan_fingerprint:payload.plan_fingerprint,item_index:0};
 const valid={status:'preserved',operation_id:id,native_command:'barcodes.assign',retry_command_forbidden:true,execution_finished:true,effect_observed:false,failure_code:'TOTUS_BARCODE_FIELD_ALREADY_SET',preserved};
 for(const mutate of [null,r=>r.execution_finished=false,r=>r.effect_observed=true,r=>r.failure_code='TOTUS_NATIVE_EXECUTION_FAILED',r=>r.operation_id='foreign',r=>r.preserved.attribute_id=0,r=>r.preserved.code='',r=>r.preserved.extra=true]){
  const read=structuredClone(valid);if(mutate)mutate(read);const actions=[];
  const service=createNativeRequestService({scope:{shopId:1},rpc:async(_,args)=>{actions.push(args.p_action);return {data:args.p_action==='get'?{id,command:'barcodes.assign',payload}:{status:'uncertain'}};},transport:{nativeCommand:async()=>assert.fail('Recovery cannot POST'),readNativeOperation:async()=>read}});
  const result=await service.recover(id);assert.equal(result.status,mutate?'uncertain':'preserved');assert.deepEqual(actions,['get','uncertain']);assert.equal(result.result,undefined);
 }
});
