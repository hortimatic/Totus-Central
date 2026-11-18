import test from 'node:test';import assert from 'node:assert/strict';
import {createCentralTpvHandler} from '../supabase/functions/totus-tpv/handler.js';
const actor='00000000-0000-4000-8000-000000000001',drawer='00000000-0000-4000-8000-000000000002',connection='b554f6cc-4df1-412b-b063-e1cbd82d9e66';
function fixture({denied=false,prepared}={}){
 const calls=[],row={connectionId:connection,connectionRevision:5,shopId:1,storeId:actor,drawerId:drawer,environment:'qa',profileRevision:1,canReconcile:true,canSell:true,session:null,nativeProfile:{verified:true,configured:true,native_version:'8.2.8',installation_id:actor,shop_id:1,currency:'EUR',paid_state_id:4,payment_labels:{cash:'Efectivo nativo',card:'Tarjeta nativa'}}};
 const factory=(url,key)=>({auth:{getUser:async()=>({data:{user:{id:actor}}})},rpc:async(name,args)=>{
  calls.push({name,args,key});
  if(name==='totus_tpv_context')return {data:{actorId:actor,workstations:[row]}};
  if(name==='totus_tpv_check')return {data:true};
  if(name==='totus_tpv_journal'&&args.p_action==='get'&&prepared)return {data:prepared};
  if(name==='totus_tpv_payment_options')return denied?{error:{message:'TPV_PAYMENT_SETTINGS_FORBIDDEN'}}:{data:{revision:1,options:args.p_options||{enabledMethods:['card'],labels:{cash:'Efectivo',card:'Datáfono'}}}};
  throw Error('Unexpected RPC '+name);
 }});
 const handle=createCentralTpvHandler({factory,env:{get:k=>({SUPABASE_URL:'https://fixture.invalid',SUPABASE_ANON_KEY:'public-fixture',SUPABASE_SERVICE_ROLE_KEY:'server-fixture'}[k])},request:async()=>{throw Error('No native network allowed');}});
 const call=async changes=>{const response=await handle(new Request('https://central.invalid/tpv',{method:'POST',headers:{Authorization:'Bearer synthetic-fixture','Content-Type':'application/json'},body:JSON.stringify({action:'payment-options',selection:{connectionId:connection,shopId:1,drawerId:drawer},operationId:actor,...changes})}));return {status:response.status,body:await response.json()};};
 return {calls,call,row};
}

test('recovering an unsubmitted quote preserves its configured order and counter names',async()=>{
 const f=fixture({prepared:{id:actor,status:'ready',scope:{actorId:actor,currency:'EUR'},quoteExpiresAt:Date.now()+60000,expected:{totalCents:150,nativePaymentLabels:{cash:'Efectivo nativo',card:'Tarjeta nativa'},operatorPaymentPolicy:{enabled:true,methodOrder:['card'],modes:{card:'external-terminal'},labels:{card:'Datáfono'}}}}});
 f.row.session={id:actor,status:'open'};
 const result=await f.call({action:'sale-status',selection:{connectionId:connection,shopId:1,drawerId:drawer,sessionId:actor}});
 assert.equal(result.status,200,JSON.stringify(result.body));assert.deepEqual(result.body.paymentMethods,['card']);assert.deepEqual(result.body.paymentLabels,{card:'Datáfono'});
});
test('drawer payment settings use normal JWT and retain native identities without native credentials',async()=>{
 const f=fixture(),result=await f.call();assert.equal(result.status,200);
 assert.deepEqual(result.body.choices,[{id:'card',label:'Datáfono',nativeLabel:'Tarjeta nativa'}]);
 const options=f.calls.find(row=>row.name==='totus_tpv_payment_options');assert.equal(options.key,'public-fixture');assert.equal(options.args.p_drawer,drawer);
 const settings={enabledMethods:['cash'],labels:{cash:'Caja',card:'Datáfono'}};
 assert.equal((await f.call({settings})).status,200);assert.deepEqual(f.calls.filter(row=>row.name==='totus_tpv_payment_options').at(-1).args.p_options,settings);
 assert.equal(f.calls.some(row=>row.name==='totus_api_server'),false);
});
test('revoked configuration rights and forged targets fail before any native request',async()=>{
 assert.equal((await fixture({denied:true}).call({settings:{enabledMethods:['cash']}})).status,400);
 const f=fixture();assert.equal((await f.call({actorId:actor})).status,400);
 assert.equal((await f.call({selection:{connectionId:connection,shopId:2,drawerId:drawer}})).status,400);
 assert.equal(f.calls.some(row=>row.name==='totus_tpv_payment_options'),false);
});
