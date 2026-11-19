import test from 'node:test';import assert from 'node:assert/strict';
import {centralCashSummaryHtml} from '../src/totustpv/central-cash-ui.js';
import {createCentralTpvHandler} from '../supabase/functions/totus-tpv/handler.js';
const actor='00000000-0000-4000-8000-000000000001';
const report={environment:'qa',currency:'EUR',status:'closed',drawerName:'Caja <segura>',storeName:'Pruebas',openedAt:'2026-11-18T09:00:00Z',openedByName:'Empleado',
 openingCents:10000,expectedCashCents:10400,countedCents:10400,differenceCents:0,payments:{cash:801,card:1500},refunds:{cash:401},cashInCents:0,cashOutCents:0,
 orderCount:2,refundCount:1,movementCount:0,note:'<img src=x onerror=alert(1)>'};
test('Central cash summary uses recorded balances, method refunds and escaped labels without internal IDs',()=>{
 const html=centralCashSummaryHtml({...report,sessionId:'private-session',closingRequestId:'private-request'});
 assert.ok(html.includes('Caja &lt;segura&gt;'));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img'));
 assert.ok(!html.includes('private-session'));assert.ok(!html.includes('private-request'));assert.ok(html.includes('104,00'));
 assert.ok(centralCashSummaryHtml({...report,countedCents:null,differenceCents:null}).includes('Sin dato'));
 for(const change of [{environment:'production'},{status:'uncertain'},{currency:'<x>'},{expectedCashCents:NaN}])assert.throws(()=>centralCashSummaryHtml({...report,...change}),/resumen de caja/);
 for(const payments of [{cash:NaN},{cash:Number.MAX_SAFE_INTEGER+1},{cash:-1},[]])assert.throws(()=>centralCashSummaryHtml({...report,payments}),/importes de la caja/);
});
function fixture(denied=false){
 const calls=[],factories=[];const env={get:key=>({SUPABASE_URL:'https://local.invalid',SUPABASE_ANON_KEY:'public-fixture',SUPABASE_SERVICE_ROLE_KEY:'private-fixture'}[key])};
 const factory=(url,key,options)=>{factories.push(key);assert.equal(key,'public-fixture');return {
  auth:{getUser:async()=>({data:{user:{id:actor}}})},rpc:async(name,args)=>{
   calls.push({name,args});assert.equal(options.global?.headers.Authorization,'Bearer session-fixture');
   assert.ok(['totus_tpv_central_cash_context','totus_tpv_central_cash_read'].includes(name));
   return denied?{error:{message:'TPV_CENTRAL_CASH_FORBIDDEN'}}:{data:name==='totus_tpv_central_cash_context'?{actorId:actor,sources:[]}:{items:[],hasMore:false,cursor:null}};
  }};};
 const handle=createCentralTpvHandler({factory,env,request:async()=>{throw Error('Cash consultation must never contact a native shop');}});
 return {calls,factories,invoke:async body=>{const response=await handle(new Request('https://central.local',{method:'POST',headers:{Authorization:'Bearer session-fixture'},body:JSON.stringify(body)}));return {status:response.status,body:await response.json()};}};
}
test('Central Cajas calls only normal-user read RPCs, without cashier context, cash opening or privileged credentials',async()=>{
 const f=fixture();assert.equal((await f.invoke({action:'central-cash-context'})).status,200);
 const selection={connectionId:actor,connectionRevision:1,storeId:actor,shopId:1};
 assert.equal((await f.invoke({action:'central-cash-read',selection})).status,200);
 assert.deepEqual(f.calls[1],{name:'totus_tpv_central_cash_read',args:{p_selection:selection,p_section:'sessions',p_query:{}}});
 assert.ok(f.factories.every(key=>key==='public-fixture'));
});
test('Cash read denies absent permissions and forged request fields without a native or financial call',async()=>{
 const f=fixture(true);assert.equal((await f.invoke({action:'central-cash-context'})).body.error,'TPV_CENTRAL_CASH_FORBIDDEN');
 for(const body of [{action:'central-cash-context',actorId:actor},{action:'central-cash-read',selection:{},section:'close'},
  {action:'central-cash-read',selection:{},query:[]},{action:'central-cash-read',selection:{},endpoint:'https://foreign.invalid'}])
  assert.equal((await f.invoke(body)).status,400);
 assert.equal(f.calls.length,1);
});
