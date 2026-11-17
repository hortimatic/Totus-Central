import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductIntakeService,productIntakeView} from '../src/totustpv/server/product-intake-service.js';
import {scopedProductRequest} from '../src/totustpv/server/official-products.js';
import {TOTUS_QA_POLICY} from '../src/totustpv/server/deployment-qa-policy.js';
const id='00000000-0000-4000-8000-000000000001',token='00000000-0000-4000-8000-000000000002',fp='a'.repeat(64);
const scope={connectionId:TOTUS_QA_POLICY.connectionId,connectionRevision:6,shopId:2,environment:'qa',currency:'EUR'};
const input={name:'Producto',reference:'PRODUCTO-1',price:'12,50',categoryId:'2',quantity:3};
function fixture(){
 let row=null,loseBase=false,loseAck=false;const calls=[],native=new Map();
 const rpc=async(name,{p_action:action,p_id,p_data:data})=>{
  assert.equal(name,'totus_tpv_product_intake');assert.equal(p_id,id);
  calls.push(action);
  if(action==='get')return row?{data:structuredClone(row)}:{error:{message:'TPV_PRODUCT_NOT_FOUND'}};
  if(action==='create')row={id,payload:data.payload,manifestHash:data.manifestHash,basePayload:data.basePayload,baseFingerprint:data.baseFingerprint,
   steps:data.plan.map(step=>({...step,status:'pending'})),currentStep:0,status:'ready',version:1};
  if(action==='start'){
   if(row.status==='processing')return {data:{...structuredClone(row),busy:true}};
   if(!['completed','cancelled'].includes(row.status))Object.assign(row,{status:'processing',leaseToken:data.token});
  }
  if(action==='verified'){
   if(loseAck){loseAck=false;return {error:{message:'TPV_STORAGE_UNAVAILABLE'}};}
   assert.equal(data.token,row.leaseToken);assert.equal(data.stepKey,row.steps[row.currentStep].key);
   Object.assign(row.steps[row.currentStep],{status:'verified',recordId:data.recordId});row.currentStep++;
   Object.assign(row,{status:row.currentStep===row.steps.length?'completed':'ready',leaseToken:null});
  }
  if(action==='failed')Object.assign(row,{status:'attention',leaseToken:null,errorCode:data.code});
  if(action==='cancel')row.status='cancelled';
  return {data:structuredClone(row)};
 };
 const products={parent:async()=>native.get('base')||null,profile:async()=>({ok:true,language_ids:['1']}),prepareBase:async()=>({ok:true,can_commit:true,fingerprint:fp}),
  commitBase:async requestId=>{assert.equal(requestId,id);calls.push('base');const result={ok:true,verified:true,persisted:true,record_id:'99'};native.set('base',result);
   if(loseBase){loseBase=false;throw Error('reply lost');}return result;},
  prepareStage:async(parent,product,stage)=>{assert.equal(parent,id);assert.equal(product,'99');calls.push('prepare:'+stage.kind);
   return native.get(stage.step_key)||{ok:true,can_commit:true,fingerprint:fp};},
  commitStage:async(parent,product,stage)=>{calls.push('write:'+stage.kind);const result={ok:true,verified:true,persisted:true,record_id:stage.kind==='finish'?'99':'100'};native.set(stage.step_key,result);return result;},
  attribute:async key=>({id:key,id_attribute_group:'1'}),list:async()=>({rows:[{id:'1',iso_code:'EUR'}]})};
 return {service:createProductIntakeService({rpc,products,scope,uuid:()=>token}),products,calls,native,get row(){return row;},
  loseBase:()=>{loseBase=true;},loseAck:()=>{loseAck=true;},expire:()=>{row.status='attention';row.leaseToken=null;}};
}
test('shop-scoped transport binds every verb, stock selection and denies foreign/group contexts before any request',async()=>{
 const calls=[],request=scopedProductRequest({connection:{id:scope.connectionId,revision:6,endpoint:TOTUS_QA_POLICY.origin+'/api'},scope,
  request:async(url,init)=>{calls.push({url:new URL(url),init});return new Response('{}');}});
 for(const method of ['GET','POST','PUT'])await request(TOTUS_QA_POLICY.origin+'/api/products',{method,redirect:'follow'});
 await request(TOTUS_QA_POLICY.origin+'/api/stock_availables');
 assert.ok(calls.every(row=>row.url.searchParams.get('id_shop')==='2'&&row.init.redirect==='error'&&row.init.credentials==='omit'));
 assert.equal(calls[3].url.searchParams.get('filter[id_shop]'),'[2]');
 for(const suffix of ['?id_shop=all','?id_shop=1','?id_shop=2&id_shop=2','?id_shop_group=1','?id_shop[]=2','?id_group_shop=2'])
  await assert.rejects(request(TOTUS_QA_POLICY.origin+'/api/products'+suffix),/SCOPE_INVALID/);
 await assert.rejects(request('https://hortimatic.com/api/products'),/SCOPE_INVALID/);
 assert.equal(calls.length,4);
});
test('prepared workflow exposes progress but no image bytes, native payload, actor or lease',async()=>{
 const f=fixture(),prepared=await f.service.prepare(id,input);
 assert.equal(prepared.status,'ready');assert.equal(f.native.size,0);
 const again=await f.service.prepare(id,input);assert.deepEqual(again,prepared);
 await assert.rejects(f.service.prepare(id,{...input,price:'13'}),/ALREADY_BOUND/);
 const view=productIntakeView({...f.row,actorId:'private',leaseToken:token,payload:{...f.row.payload,images:[{base64:'secret'}]}});
 for(const key of ['payload','basePayload','baseFingerprint','manifestHash','actorId','leaseToken'])assert.equal(Object.hasOwn(view,key),false);
 assert.equal(JSON.stringify(view).includes('secret'),false);
});
test('base lost reply retains the same root and activation waits for verified stock',async()=>{
 const f=fixture();await f.service.prepare(id,input);f.loseBase();
 assert.equal((await f.service.advance(id)).status,'attention');assert.equal(f.row.currentStep,0);
 assert.equal((await f.service.advance(id)).productId,'99');assert.equal(f.row.currentStep,1);
 assert.equal(f.calls.includes('write:finish'),false);
 await f.service.advance(id);assert.equal(f.row.currentStep,2);
 assert.equal((await f.service.advance(id)).status,'completed');
 assert.deepEqual(f.calls.filter(value=>value.startsWith('write:')),['write:stock','write:finish']);
 const count=f.calls.length;await f.service.advance(id);assert.deepEqual(f.calls.slice(count),['start']);
});
test('lost coordinator acknowledgement recovers native stage and never repeats its write',async()=>{
 const f=fixture();await f.service.prepare(id,input);await f.service.advance(id);f.loseAck();
 await assert.rejects(f.service.advance(id),/STORAGE_UNAVAILABLE/);
 assert.equal((await f.service.advance(id)).busy,true);f.expire();
 await f.service.advance(id);assert.equal(f.row.currentStep,2);
 assert.equal(f.calls.filter(value=>value==='write:stock').length,1);
});
test('rejects adopting a Products root, repeated attribute groups and cancellation after native creation',async()=>{
 const f=fixture();f.native.set('base',{});await assert.rejects(f.service.prepare(id,input),/ALREADY_BOUND/);assert.equal(f.row,null);
 f.native.clear();await assert.rejects(f.service.prepare(id,{...input,quantity:0,variants:[{attributeValueIds:['1','2']}]}),/ATTRIBUTE_GROUP_REPEATED/);
 assert.equal(f.row,null);await f.service.prepare(id,input);await f.service.advance(id);
 await assert.rejects(f.service.cancel(id),/RECONCILIATION_REQUIRED/);
});
