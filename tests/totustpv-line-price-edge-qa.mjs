import test from 'node:test';
import assert from 'node:assert/strict';
import {createCentralTpvHandler} from '../supabase/functions/totus-tpv/handler.js';
const actor='00000000-0000-4000-8000-000000000001',drawer='00000000-0000-4000-8000-000000000002',session='00000000-0000-4000-8000-000000000003',connection='b554f6cc-4df1-412b-b063-e1cbd82d9e66';
function fixture({enabled=false,requireSaleNote=false,capability={source:'native-product-capabilities',product_id:12,shop_id:1,unit_price_override:true}}={}){
 const calls=[],outbound=[],errors=[];const row={connectionId:connection,connectionRevision:5,shopId:1,storeId:actor,drawerId:drawer,environment:'qa',profileRevision:1,session:{id:session,status:'open'},canSell:true,canReconcile:true,canOpen:true,nativeProfile:{verified:true,configured:true,native_version:'8.2.8',installation_id:actor,shop_id:1,currency:'EUR',paid_state_id:4,payment_labels:{cash:'Efectivo',card:'Tarjeta'}}};
 const env={get:key=>({SUPABASE_URL:'https://fixture.invalid',SUPABASE_ANON_KEY:'fixture-public',SUPABASE_SERVICE_ROLE_KEY:'fixture-server-only'}[key])};
 const factory=(url,key)=>({auth:{getUser:async()=>({data:{user:{id:actor}}})},rpc:async(name,args)=>{calls.push({name,key,args});
  if(name==='totus_tpv_context')return {data:{actorId:actor,workstations:[row]}};
  if(name==='totus_tpv_payment_options')return {data:{revision:0,options:{enabledMethods:['cash','card'],labels:{cash:'Efectivo',card:'Tarjeta'}}}};
  if(name==='totus_tpv_check')return {data:true};
  if(name==='totus_tpv_stock_policy')return {data:{allowOutOfStock:false}};
  if(name==='totus_tpv_line_options')return {data:{allowPriceChanges:enabled,requireSaleNote}};
  if(name==='totus_api_server')return {data:{id:connection,revision:5,verified_revision:5,enabled:true,real_data_authorized:true,protocol:'prestashop',endpoint:'https://preproduccion.hortimatic.com/api',auth_kind:'basic',secret:'fictional-fixture-key'}};
  if(name==='totus_api_call')return {data:{ok:true}};
  throw Error('Unexpected RPC '+name);
 }});
 const handle=createCentralTpvHandler({factory,env,onError:error=>errors.push({name:error.name,message:error.message}),resolve:async()=>['93.184.216.34'],request:async(url,init)=>{outbound.push({url,method:init.method});assert.equal(init.method,'GET');return new Response(JSON.stringify(capability),{status:200,headers:{'Content-Type':'application/json'}});}});
 const intent={action:'prepare',selection:{connectionId:connection,shopId:1,drawerId:drawer,sessionId:session},operationId:crypto.randomUUID(),lines:[{productId:12,attributeId:0,qty:1,discount:{kind:'price',value:725}}]};
 const call=async changes=>{const response=await handle(new Request('https://central.local/tpv',{method:'POST',headers:{Authorization:'Bearer synthetic-fixture','Content-Type':'application/json'},body:JSON.stringify({...intent,...changes})}));return {status:response.status,body:await response.json()};};
 return {calls,outbound,errors,call};
}
test('disabled price policy and forged browser options fail before native preparation',async()=>{
 const f=fixture();assert.equal((await f.call()).body.error,'TPV_PRICE_CHANGE_FORBIDDEN');assert.equal(f.outbound.length,0);assert.equal(f.calls.some(row=>row.name==='totus_tpv_native_command'),false);
 for(const value of [{lineOptions:{allowPriceChanges:true}},{allowPriceChanges:true},{nativeCapabilities:{unit_price_override:true}}])assert.equal((await f.call(value)).body.error,'TPV_REQUEST_FIELD_FORBIDDEN');
 assert.equal(f.outbound.length,0);assert.equal(f.calls.some(row=>row.name==='totus_tpv_journal'),false);
});
test('old, absent, untyped or foreign native price capabilities fail before any POST or command claim',async()=>{
 for(const capability of [{items:[]},{source:'native-product-capabilities',product_id:12,shop_id:1,unit_price_override:false},{source:'native-product-capabilities',product_id:12,shop_id:1,unit_price_override:1},{source:'native-product-capabilities',product_id:13,shop_id:1,unit_price_override:true},{source:'native-product-capabilities',product_id:12,shop_id:2,unit_price_override:true}]){
  const f=fixture({enabled:true,capability}),result=await f.call();assert.equal(result.status,400,JSON.stringify(f.errors));assert.equal(result.body.error,'TPV_NATIVE_PRICE_CHANGE_UNAVAILABLE',JSON.stringify(f.errors));assert.equal(f.outbound.length,1);assert.equal(f.calls.some(row=>['totus_tpv_native_command','totus_tpv_journal'].includes(row.name)),false);
  const url=new URL(f.outbound[0].url);assert.equal(url.pathname,'/api/totus_tpv_catalogue');assert.equal(url.searchParams.get('product_capabilities_only'),'1');assert.equal(url.searchParams.get('product_id'),'12');
 }
});
test('malformed line prices are rejected before native I/O even when the preference permits changes',async()=>{
 for(const discount of [null,{kind:'price',value:0},{kind:'price',value:'725'},{kind:'price',value:7.25},{kind:'price',value:1000000000},{kind:'price',value:725,actorId:actor}]){
  const f=fixture({enabled:true}),result=await f.call({lines:[{productId:12,attributeId:0,qty:1,discount}]});assert.equal(result.status,400,JSON.stringify(f.errors));assert.equal(result.body.error,'TPV_LINE_ADJUSTMENT_INVALID',JSON.stringify(f.errors));assert.equal(f.outbound.length,0);assert.equal(f.calls.some(row=>['totus_tpv_native_command','totus_tpv_journal'].includes(row.name)),false);
 }
});

test('required or malformed private notes stop before native write; old capability is refused',async()=>{
 const lines=[{productId:12,attributeId:0,qty:1}];
 for(const note of [undefined,'   ']){const f=fixture({requireSaleNote:true});assert.equal((await f.call({lines,...(note===undefined?{}:{note})})).body.error,'TPV_SALE_NOTE_REQUIRED');assert.equal(f.outbound.length,0);assert.equal(f.calls.some(row=>row.name==='totus_tpv_native_command'),false);}
 for(const note of [null,1,[], '<script>private</script>','🙂'.repeat(501),'bad\u0000']){const f=fixture();assert.equal((await f.call({lines,note})).body.error,'TPV_SALE_NOTE_INVALID');assert.equal(f.outbound.length,0);}
 const f=fixture();assert.equal((await f.call({lines,note:'Nota privada'})).body.error,'TPV_NATIVE_SALE_NOTE_UNAVAILABLE');assert.equal(f.outbound.length,1);assert.equal(f.calls.some(row=>row.name==='totus_tpv_native_command'),false);
});
