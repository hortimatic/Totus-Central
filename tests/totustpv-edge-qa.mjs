import test from 'node:test';
import assert from 'node:assert/strict';
import {createCentralTpvHandler,catalogueForActor} from '../supabase/functions/totus-tpv/handler.js';
import {nativeStepId} from '../src/totustpv/server/native-request-service.js';
const actor='00000000-0000-4000-8000-000000000001',drawer='00000000-0000-4000-8000-000000000002',
 session='00000000-0000-4000-8000-000000000003',connection='b554f6cc-4df1-412b-b063-e1cbd82d9e66';
test('catalogue response excludes procurement data without server-observed Products permission',()=>{
 const native={items:[{id:'1:0',name:'Artículo',stock:3,preview_cents:150,cost_base_cents:75,unexpected_private_field:'not public'}]};
 for(const permission of [false,undefined,'true'])assert.deepEqual(catalogueForActor(native,permission).items[0],{id:'1:0',name:'Artículo',stock:3,preview_cents:150});
 assert.equal(catalogueForActor(native,true).items[0].cost_base_cents,75);
 assert.equal(Object.hasOwn(catalogueForActor(native,true).items[0],'unexpected_private_field'),false);
});
test('variant metadata exposes only bounded attribute identities and public labels',()=>{
 const attribute={id:2,groupId:1,name:'Rojo',groupName:'Color',cost:99,secret:'omit'};
 assert.deepEqual(catalogueForActor({items:[{variant_attributes:[attribute]}]},false).items[0].variant_attributes,[{id:2,groupId:1,name:'Rojo',groupName:'Color'}]);
 for(const value of [null,{},Array(65).fill(attribute),[{...attribute,id:0}],[{...attribute,name:'x'.repeat(129)}]])assert.throws(()=>catalogueForActor({items:[{variant_attributes:value}]},false),/TPV_CATALOGUE_INVALID/);
});
test('variant group names cannot expose other native fields or an unbounded metadata list',()=>{
 const result=catalogueForActor({items:[],variant_groups:[{id:3,name:'Color',secret:'not public'}]},false);
 assert.deepEqual(result.variant_groups,[{id:3,name:'Color'}]);
 for(const variant_groups of [null,{},Array(65).fill({id:1,name:'Color'}),[{id:0,name:'Color'}]])assert.throws(()=>catalogueForActor({items:[],variant_groups},false),/TPV_CATALOGUE_INVALID/);
});
function fixture({badAuth=false,denied=false,otherConnection=false,reportDenied=false,nativeRows,nativeDocument,noSession=false}={}){
 const calls=[],nativeRequests=[];let outbound=0;
 const env={get:key=>({SUPABASE_URL:'https://fixture.invalid',SUPABASE_ANON_KEY:'fixture-public',SUPABASE_SERVICE_ROLE_KEY:'fixture-server-only'}[key])};
 const row={connectionId:otherConnection?actor:connection,connectionRevision:5,shopId:1,storeId:actor,drawerId:drawer,
  environment:'qa',profileRevision:1,session:nativeRows===undefined||noSession?null:{id:session,status:'open'},canSell:false,canReconcile:!reportDenied,nativeProfile:{verified:true,configured:true,native_version:'8.2.8',
   installation_id:actor,shop_id:1,currency:'EUR'}};
 const factory=(url,key,options)=>{
  calls.push({factory:key,options});return {auth:{getUser:async token=>{calls.push({auth:token});return badAuth?
   {error:{message:'invalid'}}:{data:{user:{id:actor,user_metadata:{actorId:'forged'}}}};}},
  rpc:async(name,args)=>{calls.push({name,args,key});
   if(name==='totus_tpv_context')return denied?{error:{message:'TPV_VIEW_FORBIDDEN'}}:{data:{actorId:actor,workstations:[row]}};
   if(name==='totus_tpv_journal')return {data:{status:'open',id:args.p_operation_id,scope:args.p_scope}};
   if(name==='totus_tpv_cash_reports')return {data:[]};
   if(name==='totus_tpv_receipt_number')return {data:null};
   if(name==='totus_tpv_cash')return {data:{status:'closed',id:args.p_scope.sessionId}};
   if(name==='totus_tpv_check')return reportDenied?{error:{message:'TPV_ACTION_FORBIDDEN'}}:{data:true};
   if(name==='totus_api_server')return {data:{id:connection,revision:5,verified_revision:5,enabled:true,real_data_authorized:true,
    protocol:'prestashop',endpoint:'https://preproduccion.hortimatic.com/api',auth_kind:'basic',secret:'fictional-key-not-valid-at-any-shop'}};
   if(name==='totus_api_call')return {data:{ok:true}};
   if(name==='totus_tpv_orders')return reportDenied?{error:{message:'TPV_ACTION_FORBIDDEN'}}:{data:args.p_order_id&&args.p_order_id!==42?[]:
    [{id:actor,status:'confirmed',scope:{actorId:actor},operatorName:'Cajero original',orderId:42,createdAt:'2026-11-17T12:00:00Z',drawerName:'Caja ficticia',totalCents:150,lines:[],refunds:[],private_marker:'must not escape'}]};
   throw Error('Unexpected RPC '+name);
  }};
 };
 const handle=createCentralTpvHandler({factory,env,resolve:async()=>['93.184.216.34'],request:async(url,options)=>{
  outbound++;nativeRequests.push({url,method:options.method});assert.equal(options.method,'GET');
  if(nativeRows===undefined)throw Error('Unexpected native request');
  return new Response(JSON.stringify(nativeDocument??{orders:nativeRows}),{status:200,headers:{'Content-Type':'application/json'}});
 }});
 const call=async(body,auth='Bearer verified-fixture-token')=>{
  const response=await handle(new Request('https://central.invalid/tpv',{method:'POST',headers:{...(auth?{Authorization:auth}:{}),
   'Content-Type':'application/json'},body:JSON.stringify(body)}));return {status:response.status,body:await response.json()};};
 return {call,calls,nativeRequests,get outbound(){return outbound;}};
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
test('a committed cash close can be recovered after the open-session context disappears',async()=>{
 const f=fixture({noSession:true}),selection={connectionId:connection,shopId:1,drawerId:drawer,sessionId:session};
 const result=await f.call({action:'close',selection,operationId:actor,countedCents:0,note:'Cierre ficticio'});
 assert.equal(result.status,200);assert.equal(result.body.status,'closed');
 const rpc=f.calls.find(row=>row.name==='totus_tpv_cash');assert.equal(rpc.args.p_scope.sessionId,session);assert.equal(rpc.args.p_scope.actorId,actor);
 assert.equal(f.outbound,0,'Cash replay does not contact a shop');
 const denied=fixture({noSession:true,reportDenied:true});assert.equal((await denied.call({action:'close',selection,operationId:actor,countedCents:0,note:''})).status,400);
 assert.equal(denied.calls.some(row=>row.name==='totus_tpv_cash'),false);
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

const orderLookup={action:'orders',operationId:session,selection:{connectionId:connection,shopId:1,drawerId:drawer,sessionId:session}};
test('receipt operator and website come from the authorized journal and connection, never native text or the current browser',async()=>{
 const f=fixture({nativeRows:[],nativeDocument:{kind:'receipt',operator_name:'Forged operator',merchant_origin:'https://unrelated.invalid',ticket_number:{kind:'sale',prefix:'FAKE',number:999,label:'FAKE999'}}});
 const result=await f.call({action:'document',operationId:actor,selection:orderLookup.selection,kind:'receipt'});
 assert.equal(result.status,200);assert.equal(result.body.operator_name,'Cajero original');assert.equal(result.body.merchant_origin,'https://preproduccion.hortimatic.com');
 assert.equal(result.body.ticket_number,null);const numbering=f.calls.find(row=>row.name==='totus_tpv_receipt_number');assert.equal(numbering.args.p_operation,actor);assert.equal(numbering.args.p_kind,'sale');assert.equal(numbering.key,'fixture-server-only');
 assert.equal(f.nativeRequests.length,1);assert.equal(new URL(f.nativeRequests[0].url).searchParams.get('actor_id'),actor);
});
test('reference lookup reads native IDs then returns only the matching authorized Central sale',async()=>{
 const f=fixture({noSession:true,nativeRows:[{id:'42',reference:'ABCDEFGHI',id_shop:'1'}]});
 const result=await f.call({...orderLookup,reference:'abcdefghi'});assert.equal(result.status,200);assert.equal(result.body[0].orderId,42);
 assert.equal(Object.hasOwn(result.body[0],'private_marker'),false);
 assert.equal(f.nativeRequests.length,1);const url=new URL(f.nativeRequests[0].url);
 assert.equal(url.pathname,'/api/orders');assert.equal(url.searchParams.get('filter[reference]'),'[ABCDEFGHI]');
 assert.equal(url.searchParams.get('filter[id_shop]'),'[1]');assert.equal(url.searchParams.get('limit'),'0,2');
 assert.equal(f.calls.find(row=>row.name==='totus_tpv_check').args.p_action,'read');
 assert.equal(f.calls.find(row=>row.name==='totus_tpv_orders').args.p_scope.sessionId,undefined,'A history read cannot borrow a caller-supplied cash session');
 assert.equal(f.calls.find(row=>row.name==='totus_tpv_orders').args.p_order_id,42);
 const external=fixture({nativeRows:[{id:'99',reference:'ABCDEFGHI',id_shop:'1'}]});
 assert.deepEqual((await external.call({...orderLookup,reference:'ABCDEFGHI'})).body,[],'An untracked native order cannot be imported by scanning');
});
test('reference lookup rejects ambiguity, native scope mismatch and unsafe input without any native write',async()=>{
 for(const rows of [[{id:'42',reference:'ABCDEFGHI',id_shop:'1'},{id:'43',reference:'ABCDEFGHI',id_shop:'1'}],
  [{id:'42',reference:'ABCDEFGHI',id_shop:'2'}],[{id:'42',reference:'OTHER',id_shop:'1'}]]){
  const f=fixture({nativeRows:rows}),result=await f.call({...orderLookup,reference:'ABCDEFGHI'});
  assert.equal(result.status,400);assert.match(result.body.error,/TPV_ORDER_REFERENCE_(?:AMBIGUOUS|LOOKUP_INVALID)/);
  assert.equal(f.calls.some(row=>row.name==='totus_tpv_orders'),false);assert.ok(f.nativeRequests.every(row=>row.method==='GET'));
 }
 const empty=fixture({nativeRows:[]});assert.deepEqual((await empty.call({...orderLookup,reference:'ABCDEFGHI'})).body,[]);
 for(const invalid of [{reference:'[ABC]'}, {reference:'ABC\n'}, {reference:'ABCDEFGHI',orderId:42},{reference:null}]){
  const f=fixture({nativeRows:[]});assert.equal((await f.call({...orderLookup,...invalid})).status,400);
  assert.equal(f.outbound,0);assert.equal(f.calls.some(row=>row.name==='totus_api_server'),false);
 }
 const denied=fixture({reportDenied:true,nativeRows:[]});assert.equal((await denied.call({...orderLookup,reference:'ABCDEFGHI'})).status,400);
 assert.equal(denied.outbound,0);assert.equal(denied.calls.some(row=>row.name==='totus_api_server'),false);
 const numeric=fixture({nativeRows:[]});assert.equal((await numeric.call({...orderLookup,orderId:42})).status,200);
 assert.equal(numeric.outbound,0,'Numeric historical lookup stays independent of native availability');
});
