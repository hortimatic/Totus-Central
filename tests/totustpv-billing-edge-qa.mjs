import test from 'node:test';import assert from 'node:assert/strict';
import {createCentralTpvHandler} from '../supabase/functions/totus-tpv/handler.js';
const actor='00000000-0000-4000-8000-000000000001',sale='00000000-0000-4000-8000-000000000002',connection='b554f6cc-4df1-412b-b063-e1cbd82d9e66';
function fixture({denied=false,stale=false}={}){
 const calls=[],requests=[];let contexts=0;
 const row={connectionId:connection,connectionRevision:1,shopId:1,storeId:actor,storeName:'Pruebas',environment:'qa',
  nativeProfile:{verified:true,configured:true,native_version:'8.2.8',installation_id:actor,shop_id:1,currency:'EUR'}};
 const env={get:key=>({SUPABASE_URL:'https://local.invalid',SUPABASE_ANON_KEY:'public-fixture',SUPABASE_SERVICE_ROLE_KEY:'private-fixture'}[key])};
 const factory=(url,key)=>({auth:{getUser:async()=>({data:{user:{id:actor}}})},rpc:async(name,args)=>{
  calls.push({name,key,args});
  if(name==='totus_tpv_billing_context'){assert.equal(key,'public-fixture');contexts++;return denied?{error:{message:'TPV_BILLING_FORBIDDEN'}}:{data:{actorId:actor,sources:[{...row,connectionRevision:stale&&contexts>1?2:1}]}};}
  if(name==='totus_tpv_billing_read')return {data:args.p_sale?{id:sale,orderId:10,sourceActorId:actor,refundSources:[]}:{items:[],hasMore:false,cursor:null}};
  if(name==='totus_api_server')return {data:{id:connection,revision:1,verified_revision:1,protocol:'prestashop',enabled:true,
   real_data_authorized:true,endpoint:'https://preproduccion.hortimatic.com/api',auth_kind:'basic',secret:'fixture-only'}};
  if(name==='totus_api_call')return {data:true};throw Error('Unexpected RPC '+name);
 }});
 const handle=createCentralTpvHandler({factory,env,resolve:async()=>['93.184.216.34'],request:async(url,init)=>{
  requests.push({url,method:init.method});assert.equal(init.method,'GET');return new Response(JSON.stringify({existing_document:true,kind:new URL(url).searchParams.get('kind'),order_id:10,mime:'application/pdf',base64:Buffer.from('%PDF-1.4').toString('base64')}),{headers:{'content-type':'application/json'}});
 }});
 const invoke=async input=>{const response=await handle(new Request('https://central.invalid',{method:'POST',headers:{Authorization:'Bearer session-fixture'},body:JSON.stringify(input)}));return {status:response.status,body:await response.json()};};
 return {invoke,calls,requests};
}
test('Facturación read works without a TPV assignment/session and uses the original sale actor',async()=>{
 const f=fixture();assert.equal((await f.invoke({action:'billing-context'})).status,200);
 assert.equal((await f.invoke({action:'billing-list',selection:{connectionId:connection,shopId:1}})).status,200);
 const pdf=await f.invoke({action:'billing-document',selection:{connectionId:connection,shopId:1},operationId:sale,kind:'invoice'});
 assert.equal(pdf.status,200,JSON.stringify(pdf.body));assert.equal(pdf.body.orderId,10);assert.equal(f.requests.length,1);
 assert.equal(new URL(f.requests[0].url).searchParams.get('actor_id'),actor);
 assert.ok(f.calls.every(row=>!['totus_tpv_context','totus_tpv_check','totus_tpv_cash','totus_save_sales_document'].includes(row.name)));
});
test('absent billing rights and forged scope fail before privileged credentials/native delivery',async()=>{
 const denied=fixture({denied:true});assert.equal((await denied.invoke({action:'billing-list',selection:{connectionId:connection,shopId:1}})).body.error,'TPV_BILLING_FORBIDDEN');
 assert.equal(denied.requests.length,0);assert.equal(denied.calls.some(row=>row.key==='private-fixture'),false);
 const f=fixture();for(const input of [{action:'billing-list',selection:{connectionId:actor,shopId:1}},
  {action:'billing-list',selection:{connectionId:connection,shopId:1,drawerId:actor}},
  {action:'billing-document',selection:{connectionId:connection,shopId:1},operationId:sale,kind:'invoice',sourceActorId:actor},
  {action:'billing-document',selection:{connectionId:connection,shopId:1},operationId:sale,kind:'sale.commit'}])assert.equal((await f.invoke(input)).status,400);
 assert.equal(f.requests.length,0);assert.equal(f.calls.some(row=>row.name==='totus_api_server'),false);
});
test('permission/context is rechecked immediately before native document delivery',async()=>{
 const f=fixture({stale:true});const result=await f.invoke({action:'billing-document',selection:{connectionId:connection,shopId:1},operationId:sale,kind:'invoice'});
 assert.equal(result.body.error,'TPV_BILLING_CONTEXT_STALE');assert.equal(f.requests.length,0);
});
