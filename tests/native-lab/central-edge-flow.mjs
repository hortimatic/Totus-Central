/** Actual handler + migrated PostgreSQL + native HTTP. Auth/secret lookup and
 * DNS delivery are explicit local fixtures; no remote endpoint is contacted.
 */
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createCentralTpvHandler} from '../../supabase/functions/totus-tpv/handler.js';
import {exerciseCentralBrowser} from './central-browser-flow.mjs';
export async function exerciseCentralEdge({fixture,profile,base,focus='complete'}){
 const db=new PGlite(),actor=randomUUID(),store=randomUUID(),drawer=randomUUID(),session=randomUUID(),
  connection='b554f6cc-4df1-412b-b063-e1cbd82d9e66';let nativePosts=0,cartOptions=null;const paths=[];
 try{
  await db.exec(`create schema private;create schema auth;create role anon;create role authenticated;create role service_role;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create table public.profiles(id uuid primary key,email text,active boolean,role text);
   create table public.team_members(email text,active boolean,role text);
   create table public.ops_stores(id uuid primary key,active boolean,name text);
   create table public.ops_cash_drawers(id uuid primary key,store_id uuid,active boolean,name text);
   create table public.ops_daily_closings(id uuid primary key);
   create table private.totus_api_connections(id uuid primary key,revision bigint,verified_revision bigint,enabled boolean,real_data_authorized boolean,protocol text);
   create table private.totus_websites(key text primary key,connection_id uuid,business_id uuid,status text,origin text,include_in_totals boolean);
   create function private.totus_module_can(email text,module text,action text) returns boolean language sql stable as $$
    select exists(select 1 from public.profiles p where p.email=$1 and p.active and p.role='admin')$$;
   revoke all on function private.totus_module_can(text,text,text) from public,anon,authenticated;
   create function private.totus_can(module text,action text) returns boolean language sql stable as $$
    select private.totus_module_can((select email from public.profiles where id=auth.uid()),module,action)$$;
   insert into public.profiles values('${actor}','edge-fixture@example.invalid',true,'admin');
   insert into public.team_members values('edge-fixture@example.invalid',true,'admin');
   insert into public.ops_stores values('${store}',true,'QA local');
   insert into public.ops_cash_drawers values('${drawer}','${store}',true,'Mostrador local');
   insert into private.totus_api_connections values('${connection}',5,5,true,true,'prestashop');
   insert into private.totus_websites values('qa-shop','${connection}',null,'active','https://preproduccion.hortimatic.com',false);`);
  for(const file of ['20261115182617_totustpv_durable_checkout.sql','20261116110935_totustpv_cash_sessions.sql',
   '20261116111537_totustpv_qa_workstation.sql','20261116112315_totustpv_native_command_journal.sql','20261116114831_totustpv_refund_ledger.sql','20261116123633_totustpv_session_history.sql','20261116135126_totustpv_parked_tickets.sql','20261116142221_totustpv_order_lookup.sql','20261116150203_totustpv_cash_reports.sql','20261116172741_totustpv_server_permission_helper.sql',
   '20261116175354_totustpv_failed_sale_review.sql','20261116180903_totustpv_workspace_preferences.sql',
   '20261116192744_totustpv_stock_receipts.sql','20261116205052_totustpv_catalogue_layout.sql'])
   await db.exec(await readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('directory-journal.sql',import.meta.url),'utf8'));
  await db.exec('set role service_role');
  await db.query('select public.totus_tpv_configure($1,$1,$2,5,$3,$4,$5,$6::jsonb,$7::jsonb)',
   [actor,connection,store,drawer,'qa-shop',JSON.stringify(profile),JSON.stringify({sell:true,open:true,reconcile:true})]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);
  const argsByRpc={totus_tpv_context:[],totus_tpv_cash_reports:['p_scope','p_session_id'],totus_tpv_orders:['p_scope','p_order_id','p_sale_id'],totus_tpv_history:['p_scope','p_before'],totus_tpv_check:['p_scope','p_action'],
   totus_tpv_journal:['p_action','p_operation_id','p_scope','p_data'],totus_tpv_cash:['p_action','p_request_id','p_scope','p_data'],
   totus_tpv_native_command:['p_action','p_id','p_scope','p_data'],totus_tpv_sale_for_return:['p_scope','p_sale_id'],
   totus_tpv_refund_journal:['p_action','p_id','p_scope','p_data'],totus_directory_operation:['p_action','p_request_id','p_data'],
   totus_tpv_drafts:['p_action','p_id','p_request_id','p_scope','p_data'],
   totus_tpv_stock_receipts:['p_action','p_id','p_scope','p_data']};
  const factory=(url,key,options)=>({auth:{getUser:async()=>({data:{user:{id:actor}}})},rpc:async(name,args={})=>{
   if(name==='totus_directory_context'){assert.equal(key,'fixture-public');return {data:{connections:[{id:connection,revision:5}]}};}
   if(name==='totus_api_server')return {data:{id:connection,revision:5,verified_revision:5,enabled:true,real_data_authorized:true,
    protocol:'prestashop',endpoint:'https://preproduccion.hortimatic.com/api',auth_kind:'basic',secret:fixture.key}};
   if(name==='totus_api_call')return {data:{ok:true}};
   assert.ok(Object.hasOwn(argsByRpc,name),'Unexpected RPC '+name);
   await db.exec('reset role');await db.exec('set role '+(key==='fixture-secret'?'service_role':'authenticated'));
   try{const keys=argsByRpc[name],values=keys.map(k=>args[k]!==null&&typeof args[k]==='object'?JSON.stringify(args[k]):args[k]);
    return {data:(await db.query(`select public.${name}(${keys.map((_,i)=>'$'+(i+1)).join(',')}) result`,values)).rows[0].result};
   }catch(error){if(name==='totus_directory_operation')console.log('Local directory SQL diagnostic:',error.message);return {error:{message:error.message}};}
  }});
  const env={get:key=>({SUPABASE_URL:'https://local-edge.invalid',SUPABASE_ANON_KEY:'fixture-public',SUPABASE_SERVICE_ROLE_KEY:'fixture-secret'}[key])};
  const handle=createCentralTpvHandler({factory,env,onError:error=>console.log('Local handler diagnostic:',error.name,
   String(error.message).replaceAll(fixture.key,'[synthetic key]').replaceAll(Buffer.from(fixture.key+':').toString('base64'),'[synthetic auth]')),
   resolve:async()=>['93.184.216.34'],request:async(url,init)=>{
   const target=new URL(url);assert.equal(target.origin,'https://preproduccion.hortimatic.com');
   assert.equal(init.headers.Authorization,'Basic '+Buffer.from(fixture.key+':').toString('base64'));
   paths.push({method:init.method,path:target.pathname});if(init.method==='POST')nativePosts++;
   // Every outbound request is redirected by this test adapter to loopback.
   const local=new URL(target.pathname.replace(/^\/api\//,'' )+target.search,base);
   const customerPatch=init.method==='PATCH'&&/^\/api\/customers\/[1-9][0-9]*$/.test(target.pathname);
   const protectedFields=async()=>{const u=new URL(local);u.searchParams.set('display','full');u.searchParams.delete('output_format');
    const read=await fetch(u,{method:'GET',headers:init.headers,signal:AbortSignal.timeout(30000)});assert.equal(read.status,200);
    const xml=await read.text();return ['passwd','secure_key','last_passwd_gen'].map(field=>xml.match(new RegExp('<'+field+'\\b[^>]*>([^]*?)</'+field+'>'))?.[1]||'');};
   const protectedBefore=customerPatch?await protectedFields():null;
   const response=await fetch(local,{...init,signal:AbortSignal.timeout(30000)});
   if(customerPatch&&response.ok){const after=await protectedFields();assert.ok(protectedBefore[1].length>0,'Fixture must have an existing customer security key');
    assert.ok(JSON.stringify(protectedBefore)===JSON.stringify(after),'Customer edit must preserve authentication fields; values never printed or stored');}
   if(!response.ok&&/\/customers(?:\/[0-9]+)?$|\/addresses(?:\/[0-9]+)?$/.test(target.pathname)){
    const text=await response.clone().text(),code=text.match(/<code>\s*(?:<!\[CDATA\[)?([^<\]]+)/)?.[1],
     message=text.match(/<message>\s*<!\[CDATA\[([^]*?)\]\]>/)?.[1];
    console.log('Local customer API diagnostic:',response.status,code||'',(message||'').replaceAll(fixture.key,'[synthetic key]').replace(/<passwd[^]*?<\/passwd>/gi,'[omitted]').slice(0,300));
   }
   if(init.method==='POST'&&response.headers.get('content-type')?.includes('json')){const data=await response.clone().json();if(data.status==='uncertain')console.log('Native laboratory pending:',data.reason);}
   if(/\/carts\/[0-9]+$/.test(target.pathname)&&response.ok){const body=await response.clone().json();
    cartOptions={gift:body.cart?.gift,recyclable:body.cart?.recyclable};}
   return response;
  }});
  if(['customers','browser'].includes(focus)){
   await exerciseCentralBrowser({handle,actor,productId:fixture.productId,reference:fixture.reference,focus});
   if(focus==='customers')assert.equal(paths.filter(row=>row.method==='POST'&&row.path==='/api/totus_tpv_sales').length,0);
   return {focus,remoteShopTouched:false};
  }
  const selection={connectionId:connection,shopId:1,drawerId:drawer,sessionId:session};
  const call=async(body)=>{const response=await handle(new Request('https://central.local/tpv',{method:'POST',
   headers:{Authorization:'Bearer synthetic-auth-fixture','Content-Type':'application/json'},body:JSON.stringify(body)}));
   const result=await response.json();assert.equal(response.status,200,JSON.stringify({result,cartOptions}));return result;};
  await call({action:'open',selection:{connectionId:connection,shopId:1,drawerId:drawer},operationId:session,openingCents:10000});
  const saleId=randomUUID(),prepared=await call({action:'prepare',selection,operationId:saleId,
   lines:[{productId:fixture.productId,attributeId:0,qty:1}]});
  assert.equal(prepared.status,'ready');assert.equal(prepared.expected.totalCents,801);
  const payments={allocations:[{id:'cash-edge',method:'cash',amountCents:801,receivedCents:1000}],
   confirmation:{operationId:saleId,totalCents:801,currency:'EUR',accepted:true}};
  const sold=await call({action:'submit',selection,operationId:saleId,payments});
  assert.equal(sold.status,'confirmed',JSON.stringify(sold));assert.ok(sold.orderId>0);
  const before=nativePosts;
  assert.equal((await call({action:'submit',selection,operationId:saleId,payments})).orderId,sold.orderId);
  assert.equal((await call({action:'recover',selection,operationId:saleId})).orderId,sold.orderId);assert.equal(nativePosts,before);
  const cash=await call({action:'cash-summary',selection,operationId:randomUUID()});assert.equal(cash.expectedCashCents,10801);
  const available=await call({action:'returnable',selection,operationId:randomUUID(),saleId});
  const refundId=randomUUID(),preparedRefund=await call({action:'prepare-refund',selection,operationId:refundId,saleId,
   items:[{detailId:available.items[0].detail_id,qty:1,restock:true}],payments:[{method:'cash',amountCents:801}]});
  assert.equal(preparedRefund.status,'ready');assert.equal(preparedRefund.totalCents,801);
  const refunded=await call({action:'submit-refund',selection,operationId:refundId,
   confirmation:{accepted:true,operationId:refundId,totalCents:801,currency:'EUR'}});
  assert.equal(refunded.status,'confirmed',JSON.stringify(refunded));
  const entries=await call({action:'history',selection,operationId:randomUUID()});
  assert.equal(entries[0].id,saleId);assert.equal(entries[0].orderId,sold.orderId);
  assert.equal(entries[0].refunds[0].id,refundId);assert.equal(entries[0].refunds[0].status,'confirmed');
  const status=await call({action:'sale-status',selection,operationId:saleId});assert.equal(status.totalCents,801);
  const refundPosts=nativePosts;
  await call({action:'submit-refund',selection,operationId:refundId,
   confirmation:{accepted:true,operationId:refundId,totalCents:801,currency:'EUR'}});
  assert.equal(nativePosts,refundPosts);
  const afterRefund=await call({action:'cash-summary',selection,operationId:randomUUID()});assert.equal(afterRefund.expectedCashCents,10000);
  const readStock=async()=>{const result=await call({action:'catalogue',selection,operationId:randomUUID(),search:fixture.reference});
   const item=result.items.find(row=>row.product_id===fixture.productId);assert.ok(item);return item.stock;};
  const stockBefore=await readStock(),receiptId=randomUUID(),stockPostsBefore=nativePosts;
  const receipt=await call({action:'stock-receipt-create',selection,operationId:receiptId,
   payload:{reason:'Albarán ficticio del laboratorio local',lines:[{productId:fixture.productId,attributeId:0,quantity:2,label:'Artículo ficticio'}]}});
  assert.equal(receipt.status,'pending');assert.equal(nativePosts,stockPostsBefore,'Saving a manifest must not change native stock');
  const received=await call({action:'stock-receipt-step',selection,operationId:receiptId});
  assert.equal(received.lines[0].status,'verified');assert.equal(nativePosts,stockPostsBefore+1);
  await call({action:'stock-receipt-step',selection,operationId:receiptId});
  await call({action:'stock-receipt-get',selection,operationId:receiptId});
  assert.equal(nativePosts,stockPostsBefore+1,'Recovering a completed receipt must not post twice');
  assert.equal(await readStock(),stockBefore+2,'Native stock must increase by the received quantity');
  await call({action:'cash-movement',selection,operationId:randomUUID(),kind:'cash-out',amountCents:100,reason:'Retirada ficticia'});
  const closed=await call({action:'close',selection,operationId:randomUUID(),countedCents:9900,note:'Cierre ficticio'});
  assert.equal(closed.status,'closed');assert.equal(closed.expectedCashCents,9900);
  assert.equal(paths.filter(row=>row.method==='POST'&&row.path==='/api/totus_tpv_sales').length,1);
  // The growing disposable catalogue is deliberately paginated; locate the
  // fixture by exact reference, never assume its alphabetical page.
  await exerciseCentralBrowser({handle,actor,productId:fixture.productId,reference:fixture.reference,variant:fixture.variant});
  console.log('PASS local complete handler → SQL journal → native HTTP → order/payment/invoice/stock proof → physical cash → close; lost-response recovery never posts again. Auth and endpoint delivery are fixtures; no deployment or remote shop.');
  return {orderId:sold.orderId,saleId,nativePosts};
 }finally{await db.close();}
}
