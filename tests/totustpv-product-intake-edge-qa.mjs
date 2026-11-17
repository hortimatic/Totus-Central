import test from 'node:test';
import assert from 'node:assert/strict';
import {createCentralTpvHandler} from '../supabase/functions/totus-tpv/handler.js';
import {TOTUS_QA_POLICY} from '../src/totustpv/server/deployment-qa-policy.js';
const actor='00000000-0000-4000-8000-000000000001',drawer='00000000-0000-4000-8000-000000000002',id='00000000-0000-4000-8000-000000000003';
const selection={connectionId:TOTUS_QA_POLICY.connectionId,shopId:1,drawerId:drawer};
function fixture({denied=false,foreignWebsite=false,session=false}={}){
 const calls=[];let outbound=0;
 const row={connectionId:selection.connectionId,connectionRevision:6,shopId:1,drawerId:drawer,storeId:actor,environment:'qa',canReconcile:true,canSell:true,
  session:session?{id,status:'open'}:null,nativeProfile:{verified:true,configured:true,native_version:'8.2.8',shop_id:1,currency:'EUR',installation_id:actor}};
 const env={get:key=>({SUPABASE_URL:'https://fixture.invalid',SUPABASE_ANON_KEY:'normal-key',SUPABASE_SERVICE_ROLE_KEY:'server-key'}[key])};
 const factory=(url,key)=>({auth:{getUser:async()=>({data:{user:{id:actor,user_metadata:{canCreate:true,actorId:drawer}}}})},rpc:async(name,args)=>{
  calls.push({key,name,args});
  if(name==='totus_tpv_context')return {data:{actorId:actor,workstations:[row]}};
  if(name==='totus_tpv_check')return {data:true};
  if(name==='totus_products_context'){assert.equal(key,'normal-key');return denied?{error:{message:'TPV_PRODUCT_FORBIDDEN'}}:
   {data:{connections:[{id:selection.connectionId,revision:6}],websites:[{key:'qa-shop',connection_id:selection.connectionId,origin:foreignWebsite?'https://hortimatic.com':TOTUS_QA_POLICY.origin,status:'active'}]}};}
  if(name==='totus_api_server'){assert.equal(key,'server-key');return {data:{id:selection.connectionId,revision:6,endpoint:TOTUS_QA_POLICY.origin+'/api'}};}
  if(name==='totus_api_call')return {data:true};
  if(name==='totus_tpv_catalogue_intake'){
   assert.equal(key,'server-key');assert.equal(args.p_scope.actorId,actor);assert.equal(args.p_scope.sessionId,undefined);
   if(args.p_action==='list')return {data:[{id,name:'Familia',status:'attention'}]};
   assert.equal(args.p_action,'get');return {data:{id,payload:{name:'Familia',parentId:'2'},payloadHash:'private-hash',fingerprint:'private-fingerprint',leaseToken:drawer,status:'attention'}};
  }
  if(name==='totus_tpv_product_intake'){
   assert.equal(key,'server-key');assert.equal(args.p_scope.actorId,actor);assert.equal(args.p_scope.drawerId,drawer);assert.equal(args.p_scope.sessionId,undefined);
   if(args.p_action==='list')return {data:[{id,name:'Artículo',reference:'ART-001',status:'attention'}]};
   assert.equal(args.p_action,'get');return {data:{id,payload:{name:'Artículo',reference:'ART-001',images:[{base64:'private-image'}]},actorId:actor,
    leaseToken:drawer,basePayload:{private:'native-payload'},baseFingerprint:'secret-fingerprint',steps:[{key:'base',kind:'base',label:'Ficha',status:'verified',recordId:'99'}],currentStep:1,status:'attention'}};
  }
  throw Error('Unexpected RPC '+name);
 }});
 const handler=createCentralTpvHandler({factory,env,request:async()=>{outbound++;throw Error('Unexpected native request');}});
 const call=async body=>{const response=await handler(new Request('https://fixture.invalid/tpv',{method:'POST',headers:{Authorization:'Bearer fixture-token','Content-Type':'application/json'},body:JSON.stringify(body)}));return {status:response.status,body:await response.json()};};
 return {call,calls,get outbound(){return outbound;}};
}

test('category history is readable after closing cash while creation still needs Products rights and a session',async()=>{
 const f=fixture();assert.equal((await f.call({action:'product-categories',selection,operationId:id})).status,200);
 const result=await f.call({action:'product-category-get',selection,operationId:id});assert.equal(result.body.name,'Familia');
 for(const key of ['payload','payloadHash','fingerprint','leaseToken'])assert.equal(Object.hasOwn(result.body,key),false);
 assert.equal((await f.call({action:'product-category-step',selection,operationId:id})).status,400);assert.equal(f.outbound,0);
 const denied=fixture({denied:true,session:true});assert.equal((await denied.call({action:'product-category-prepare',selection:{...selection,sessionId:id},operationId:id,payload:{name:'Familia',parentId:'2'}})).status,400);
 assert.equal(denied.calls.some(call=>call.name==='totus_api_server'),false,'Category permission is checked before retrieving credentials');
});
test('saved product work can be read after cash closes, without exposing its private command or image',async()=>{
 const f=fixture();assert.equal((await f.call({action:'product-intakes',selection,operationId:id})).status,200);
 const result=await f.call({action:'product-intake-get',selection:{...selection,sessionId:id},operationId:id});assert.equal(result.status,200);assert.equal(result.body.productId,'99');
 for(const key of ['payload','actorId','leaseToken','basePayload','baseFingerprint'])assert.equal(Object.hasOwn(result.body,key),false);
 assert.equal(JSON.stringify(result).includes('private-image'),false);assert.equal(f.outbound,0);
 assert.ok(f.calls.findIndex(row=>row.name==='totus_products_context')<f.calls.findIndex(row=>row.name==='totus_api_server'));
});
test('normal Products rights and registered QA website are required before loading credentials',async()=>{
 for(const options of [{denied:true},{foreignWebsite:true}]){
  const f=fixture(options),response=await f.call({action:'product-intakes',selection,operationId:id});assert.equal(response.status,400);
  assert.equal(f.calls.some(row=>row.name==='totus_api_server'),false);assert.equal(f.outbound,0);
 }
});
test('writes need an open selected cash session and cannot accept an actor, shop URL or arbitrary metadata resource',async()=>{
 const f=fixture();assert.equal((await f.call({action:'product-intake-step',selection,operationId:id})).body.error,'TPV_CASH_SESSION_MISMATCH');
 assert.equal(f.calls.some(row=>row.name==='totus_api_server'),false);
 for(const extra of [{actorId:drawer},{endpoint:TOTUS_QA_POLICY.origin},{productId:'99'}])
  assert.equal((await f.call({action:'product-intake-get',selection,operationId:id,...extra})).body.error,'TPV_REQUEST_FIELD_FORBIDDEN');
 assert.equal((await f.call({action:'product-metadata',selection,operationId:id,resource:'products'})).body.error,'TPV_PRODUCT_METADATA_INVALID');
 assert.equal(f.outbound,0);
});
test('the larger authenticated image envelope does not expand other action contracts',async()=>{
 const f=fixture();assert.equal((await f.call({action:'product-intake-get',selection,operationId:id,payload:'x'.repeat(70000)})).body.error,'TPV_REQUEST_INVALID');
 assert.equal((await f.call({action:'product-intake-get',selection,operationId:id,payload:'€'.repeat(30000)})).body.error,'TPV_REQUEST_INVALID','The original byte limit also holds for non-ASCII input');
 assert.equal(f.calls.length,0);assert.equal(f.outbound,0);
});
