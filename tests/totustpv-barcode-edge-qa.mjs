import test from 'node:test';
import assert from 'node:assert/strict';
import {createCentralTpvHandler} from '../supabase/functions/totus-tpv/handler.js';
const actor='00000000-0000-4000-8000-000000000001',drawer='00000000-0000-4000-8000-000000000002',connection='b554f6cc-4df1-412b-b063-e1cbd82d9e66';
function fixture({denyEdit=false,denyView=false}={}){
 const calls=[],outbound=[],row={connectionId:connection,connectionRevision:5,shopId:1,storeId:actor,drawerId:drawer,environment:'qa',profileRevision:1,canReconcile:true,canSell:false,session:null,
  nativeProfile:{verified:true,configured:true,native_version:'8.2.8',installation_id:actor,shop_id:1,currency:'EUR',paid_state_id:4,payment_labels:{cash:'Efectivo'}}};
 const factory=(url,key)=>({auth:{getUser:async()=>({data:{user:{id:actor}}})},rpc:async(name,args)=>{
  calls.push({name,key,args});
  if(name==='totus_tpv_context')return {data:{actorId:actor,workstations:[row]}};
  if(name==='totus_tpv_check')return {data:true};
  if(name==='totus_products_context')return args.p_action==='edit'&&denyEdit||args.p_action==='view'&&denyView?{error:{message:'TPV_BARCODE_FORBIDDEN'}}:{data:{connections:[{id:connection,revision:5}],websites:[{connection_id:connection,origin:'https://preproduccion.hortimatic.com',status:'active',key:'qa'}]}};
  if(name==='totus_tpv_barcode_options')return {data:{field:'ean13',generatorEnabled:true}};
  if(name==='totus_api_server')return {data:{id:connection,revision:5,verified_revision:5,enabled:true,real_data_authorized:true,protocol:'prestashop',endpoint:'https://preproduccion.hortimatic.com/api',auth_kind:'basic',secret:'synthetic-fixture-only'}};
  if(name==='totus_api_call')return {data:{ok:true}};
  if(name==='totus_tpv_barcode_jobs')return {data:args.p_action==='list'?[]:{status:args.p_action==='capture'?'review':'preparing',field:'ean13',cursor:[0,0],bounds:null}};
  if(name==='totus_tpv_barcode_execution')return {data:{kind:'idle'}};
  throw Error('Unexpected RPC '+name);
 }});
 const handle=createCentralTpvHandler({factory,env:{get:k=>({SUPABASE_URL:'https://fixture.invalid',SUPABASE_ANON_KEY:'public-fixture',SUPABASE_SERVICE_ROLE_KEY:'server-fixture'}[k])},resolve:async()=>['93.184.216.34'],
  request:async(url,init)=>{outbound.push({url,method:init.method});return new Response(JSON.stringify({source:'native-missing-barcode-targets',plan_version:1,field:'ean13',shop_id:1,items:[],has_more:false,cursor:[0,0],bounds:{product:0,attribute:0}}),{headers:{'Content-Type':'application/json'}});}});
 const call=async changes=>{const r=await handle(new Request('https://central.local/tpv',{method:'POST',headers:{Authorization:'Bearer synthetic', 'Content-Type':'application/json'},body:JSON.stringify({action:'barcodes',selection:{connectionId:connection,shopId:1,drawerId:drawer},operationId:actor,...changes})}));return {status:r.status,body:await r.json()};};
 return {call,calls,outbound};
}
test('barcode options use normal authenticated RPC without retrieving native credentials',async()=>{
 const f=fixture(),r=await f.call({action:'barcode-options',settings:{field:'ean13',generatorEnabled:true}});assert.equal(r.status,200);
 const saved=f.calls.find(c=>c.name==='totus_tpv_barcode_options');assert.equal(saved.key,'public-fixture');assert.equal(f.calls.some(c=>c.name==='totus_api_server'),false);assert.equal(f.outbound.length,0);
});
test('barcode capture works without an open cash session and rechecks product permission before native GET',async()=>{
 const f=fixture(),r=await f.call({action:'barcode-capture'});assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.status,'review');assert.equal(f.outbound.length,1);
 assert.equal(f.outbound[0].method,'GET');assert.match(f.outbound[0].url,/totus_tpv_barcodes/);
 const capture=f.calls.find(c=>c.name==='totus_tpv_barcode_jobs'&&c.args.p_action==='capture');assert.equal(capture.args.p_scope.sessionId,undefined);
 assert.ok(f.calls.filter(c=>c.name==='totus_products_context'&&c.args.p_action==='edit').length>=2);
});
test('product permission denial precedes credential access and confirmation requires explicit acceptance',async()=>{
 const f=fixture({denyEdit:true}),r=await f.call({action:'barcode-capture'});assert.equal(r.status,400);assert.equal(f.calls.some(c=>c.name==='totus_api_server'),false);assert.equal(f.outbound.length,0);
 const view=fixture({denyView:true});assert.equal((await view.call()).status,400);assert.equal(view.calls.some(c=>c.name==='totus_api_server'),false);
 const confirm=fixture();assert.equal((await confirm.call({action:'barcode-confirm',accepted:false})).body.error,'TPV_BARCODE_CONFIRMATION_REQUIRED');assert.equal(confirm.calls.some(c=>c.name==='totus_tpv_barcode_jobs'),false);
 assert.equal((await confirm.call({action:'barcode-step',payload:{}})).body.error,'TPV_REQUEST_FIELD_FORBIDDEN');
});
