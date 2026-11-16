import test from 'node:test';
import assert from 'node:assert/strict';
import {createCentralTpvHandler} from '../supabase/functions/totus-tpv/handler.js';
import {nativeStepId} from '../src/totustpv/server/native-request-service.js';
const actor='00000000-0000-4000-8000-000000000001',drawer='00000000-0000-4000-8000-000000000002',
 session='00000000-0000-4000-8000-000000000003',connection='b554f6cc-4df1-412b-b063-e1cbd82d9e66';
function fixture({badAuth=false,denied=false,otherConnection=false,reportDenied=false}={}){
 const calls=[];let outbound=0;
 const env={get:key=>({SUPABASE_URL:'https://fixture.invalid',SUPABASE_ANON_KEY:'fixture-public',SUPABASE_SERVICE_ROLE_KEY:'fixture-server-only'}[key])};
 const row={connectionId:otherConnection?actor:connection,connectionRevision:5,shopId:1,storeId:actor,drawerId:drawer,
  environment:'qa',profileRevision:1,session:null,canReconcile:!reportDenied,nativeProfile:{verified:true,configured:true,native_version:'8.2.8',
   installation_id:actor,shop_id:1,currency:'EUR'}};
 const factory=(url,key,options)=>{
  calls.push({factory:key,options});return {auth:{getUser:async token=>{calls.push({auth:token});return badAuth?
   {error:{message:'invalid'}}:{data:{user:{id:actor,user_metadata:{actorId:'forged'}}}};}},
  rpc:async(name,args)=>{calls.push({name,args,key});
   if(name==='totus_tpv_context')return denied?{error:{message:'TPV_VIEW_FORBIDDEN'}}:{data:{actorId:actor,workstations:[row]}};
   if(name==='totus_tpv_journal')return {data:{status:'open',id:args.p_operation_id,scope:args.p_scope}};
   if(name==='totus_tpv_cash_reports')return {data:[]};
   throw Error('Unexpected RPC '+name);
  }};
 };
 const handle=createCentralTpvHandler({factory,env,request:async()=>{outbound++;throw Error('Unexpected native request');}});
 const call=async(body,auth='Bearer verified-fixture-token')=>{
  const response=await handle(new Request('https://central.invalid/tpv',{method:'POST',headers:{...(auth?{Authorization:auth}:{}),
   'Content-Type':'application/json'},body:JSON.stringify(body)}));return {status:response.status,body:await response.json()};};
 return {call,calls,get outbound(){return outbound;}};
}
test('actual authentication and normal-user context precede privileged clients; browser cannot choose actor',async()=>{
 for(const options of [{},{badAuth:true}]){
  const f=fixture(options);const result=await f.call({action:'context'},options.badAuth?'Bearer invalid':null);
  assert.equal(result.status,401);assert.equal(f.calls.some(row=>row.factory==='fixture-server-only'),false);
 }
 const f=fixture();assert.equal((await f.call({action:'context'})).body.actorId,actor);
 assert.equal(f.calls.some(row=>row.factory==='fixture-server-only'),false);
 assert.equal((await f.call({action:'context',actorId:'forged'})).body.error,'TPV_REQUEST_FIELD_FORBIDDEN');
 assert.equal(f.outbound,0);
});
test('cash opening uses current account, configured QA assignment and server-loaded store/currency',async()=>{
 const f=fixture();const result=await f.call({action:'open',operationId:session,openingCents:10000,
  selection:{connectionId:connection,shopId:1,drawerId:drawer}});
 assert.equal(result.status,200);assert.equal(result.body.status,'open');
 const write=f.calls.find(row=>row.name==='totus_tpv_journal');assert.equal(write.key,'fixture-server-only');
 assert.equal(write.args.p_scope.actorId,actor);assert.equal(write.args.p_scope.environment,'qa');
 assert.equal(write.args.p_scope.currency,'EUR');assert.equal(write.args.p_data.openingCents,10000);
 assert.equal(JSON.stringify(result).includes('fixture-server-only'),false);assert.equal(f.outbound,0);
});
test('foreign or stale selection, absent module rights and caller-supplied URLs never reach credentials or a shop',async()=>{
 for(const options of [{denied:true},{otherConnection:true},{}]){
  const f=fixture(options);const result=await f.call({action:'open',operationId:session,openingCents:0,
   selection:{connectionId:options.otherConnection?actor:connection,shopId:1,drawerId:actor}});
  assert.equal(result.status,400);assert.equal(f.calls.some(row=>row.factory==='fixture-server-only'),false);assert.equal(f.outbound,0);
 }
 const f=fixture();assert.equal((await f.call({action:'prepare',endpoint:'https://production.invalid',operationId:session})).status,400);
 assert.equal(f.outbound,0);
});
test('cart and quote step identities are stable across process restarts and distinct between operations',async()=>{
 const cart=await nativeStepId(session,'cart'),quote=await nativeStepId(session,'quote');
 assert.equal(cart,await nativeStepId(session,'cart'));assert.notEqual(cart,quote);assert.notEqual(cart,await nativeStepId(actor,'cart'));
 assert.match(cart,/^[a-f0-9]{8}-[a-f0-9]{4}-8[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
 await assert.rejects(nativeStepId('-'.repeat(36),'cart'));
});

test('closed cash reports require current reconciliation rights but no new cash session or shop credential',async()=>{
 const body={action:'cash-reports',operationId:session,selection:{connectionId:connection,shopId:1,drawerId:drawer}};
 const f=fixture(),result=await f.call(body);assert.equal(result.status,200);assert.deepEqual(result.body,[]);
 const read=f.calls.find(row=>row.name==='totus_tpv_cash_reports');assert.equal(read.args.p_scope.actorId,actor);
 assert.equal(read.args.p_session_id,null);assert.equal(f.calls.some(row=>row.name==='totus_api_server'),false);assert.equal(f.outbound,0);
 const denied=fixture({reportDenied:true});assert.equal((await denied.call(body)).status,400);
 assert.equal(denied.calls.some(row=>row.factory==='fixture-server-only'),false);
});
