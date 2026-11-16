import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createPostgresCheckoutLedger} from '../src/totustpv/postgres-journal.js';
import {createCheckoutService} from '../src/totustpv/checkout-service.js';
import {createNativeRequestService} from '../src/totustpv/server/native-request-service.js';
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={actorId:id(5),connectionId:id(1),connectionRevision:1,storeId:id(2),shopId:1,
  drawerId:id(3),sessionId:id(4),currency:'EUR',environment:'qa'};
let assertions=0;
const check=(actual,expected)=>{assert.deepEqual(actual,expected);assertions++;};
const denied=async(action,pattern)=>{await assert.rejects(action,pattern);assertions++;};
async function journal(action,operationId,data={},selected=scope){
  const {rows}=await db.query('select public.totus_tpv_journal($1,$2::uuid,$3::jsonb,$4::jsonb) result',
    [action,operationId,JSON.stringify(selected),JSON.stringify(data)]);
  return rows[0].result;
}
async function asAdmin(sql){await db.exec('reset role');await db.exec(sql);await db.exec('set role service_role');}
const expected=cartId=>({storeId:scope.storeId,shopId:1,cartId,currency:'EUR',paymentModule:'native_cash',
 customerId:501,invoiceAddressId:601,deliveryAddressId:601,currencyId:1,
 totalCents:801,shippingCents:0,nativePaymentLabels:{cash:'Efectivo',card:'Tarjeta'},paidStateIds:[11],lines:[{productId:101,attributeId:0,qty:1,unitTaxInclCents:801,unitTaxExclCents:662,stockBefore:5}]});
const payments=[{id:'cash-1',method:'cash',status:'settled',amountCents:400,receivedCents:500},
 {id:'card-1',method:'card',status:'settled',amountCents:401}];
try {
 await db.exec(`
 create schema private;
 create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create role anon;create role authenticated;create role service_role;
 create table public.profiles(id uuid primary key,email text,active boolean,role text);
 create table public.ops_stores(id uuid primary key,active boolean,name text default 'Tienda de prueba');
 create table public.ops_cash_drawers(id uuid primary key,store_id uuid,active boolean,name text default 'Caja de prueba');
 create table public.team_members(email text,active boolean,role text);
 create table public.ops_daily_closings(id uuid primary key);
 create table private.totus_api_connections(id uuid primary key,revision bigint,verified_revision bigint,
   enabled boolean,real_data_authorized boolean,protocol text);
 create table private.totus_websites(key text primary key,connection_id uuid,business_id uuid,status text,origin text,include_in_totals boolean default false);
 create function private.totus_module_can(email text,module text,action text) returns boolean
 language sql stable as $$select exists(select 1 from public.profiles p where p.email=$1 and p.active and p.role='admin')$$;
 insert into public.profiles values('${id(5)}','operator@example.invalid',true,'admin'),('${id(9)}','denied@example.invalid',true,'employee');
 insert into public.ops_stores(id,active) values('${id(2)}',true),('${id(22)}',true);
 insert into public.ops_cash_drawers(id,store_id,active) values('${id(3)}','${id(2)}',true),('${id(33)}','${id(22)}',true);
 insert into private.totus_api_connections values('${id(1)}',1,1,true,true,'prestashop');
 insert into private.totus_websites(key,connection_id,business_id,status) values('test-store','${id(1)}','${id(2)}','active');
 insert into public.team_members values('operator@example.invalid',true,'admin');
 create function private.totus_can(module text,action text) returns boolean language sql stable as $$
  select private.totus_module_can((select email from public.profiles where id=auth.uid()),module,action)$$;
 `);
 await db.exec(await readFile(new URL('../supabase/migrations/20261115182617_totustpv_durable_checkout.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261116110935_totustpv_cash_sessions.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261116111537_totustpv_qa_workstation.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261116112315_totustpv_native_command_journal.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261116114831_totustpv_refund_ledger.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261116123633_totustpv_session_history.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261116135126_totustpv_parked_tickets.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261116142221_totustpv_order_lookup.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261116150203_totustpv_cash_reports.sql',import.meta.url),'utf8'));
 await db.exec(`insert into private.totus_tpv_assignments(actor_id,connection_id,website_key,store_id,shop_id,drawer_id,can_sell,can_reconcile,can_open)
  values('${id(5)}','${id(1)}','test-store','${id(2)}',1,'${id(3)}',true,true,true);`);
 for(const role of ['anon','authenticated']) {
  await db.exec(`set role ${role}`);
  await denied(()=>journal('get',id(6)),/permission denied/);
  await denied(()=>db.query('select * from private.totus_tpv_operations'),/permission denied/);
  await db.exec('reset role');
 }
 await db.exec('set role service_role');
 check((await journal('open',id(4),{openingCents:10000})).status,'open');
 await denied(()=>journal('open',id(45),{openingCents:10000},{...scope,environment:'production'}),/TPV_ENVIRONMENT_FORBIDDEN/);
 await denied(()=>journal('get',id(6),{},Object.fromEntries(Object.entries(scope).filter(([key])=>key!=='environment'))),/TPV_ENVIRONMENT_FORBIDDEN/);
 await asAdmin(`insert into public.ops_daily_closings(id) values('${id(55)}');`);
 await denied(()=>asAdmin(`update private.totus_tpv_sessions set closing_id='${id(55)}' where id='${id(4)}';`),/check constraint/);
 await db.exec('set role service_role');
 check((await journal('open',id(4),{openingCents:10000})).status,'open');
 await denied(()=>journal('open',id(4),{openingCents:9999}),/TPV_SESSION_ID_ALREADY_BOUND/);
 await denied(()=>journal('open',id(44),{openingCents:10000}),/unique constraint/);
 await denied(()=>journal('prepare',id(6),{expected:expected(701),quoteExpiresAt:Date.now()+60000},{...scope,actorId:id(9)}),/TPV_SELL_FORBIDDEN/);
 for(const patch of [{storeId:id(22)},{drawerId:id(33)},{connectionRevision:2},{shopId:2},{currency:'USD'},{sessionId:id(44)}])
  await denied(()=>journal('prepare',id(6),{expected:expected(701),quoteExpiresAt:Date.now()+60000},{...scope,...patch}),/TPV_/);
 const prepared=await journal('prepare',id(6),{expected:expected(701),quoteExpiresAt:Date.now()+60000});
 check(prepared.status,'ready');check(prepared.scope,scope);
 await denied(()=>journal('prepare',id(7),{expected:expected(701),quoteExpiresAt:Date.now()+60000}),/unique constraint/);
 for(const bad of [payments.concat(payments[0]),[{...payments[0],amountCents:801,receivedCents:800}],
   [{...payments[1],amountCents:801,status:'pending'}],[{...payments[1],amountCents:800}],
   [{...payments[1],amountCents:801,cardNumber:'must-never-be-stored'}]])
  await denied(()=>journal('claim',id(6),{revision:1,expected:expected(701),payments:bad}),/TPV_/);
 await denied(()=>journal('claim',id(6),{revision:1,expected:{...expected(701),totalCents:1},payments}),/TPV_QUOTE_OR_PAYMENT_INVALID/);
 const claim=await journal('claim',id(6),{revision:1,expected:expected(701),payments});
 check(claim.won,true);assert.ok(claim.token);
 check((await journal('claim',id(6),{revision:1,expected:expected(701),payments})).won,false);
 await denied(()=>journal('remember',id(6),{revision:1,orderId:901,token:id(99)}),/TPV_CLAIM_MISMATCH/);
 check((await journal('remember',id(6),{revision:1,orderId:901,token:claim.token})).orderId,901);
 await denied(()=>journal('remember',id(6),{revision:1,orderId:902,token:claim.token}),/TPV_REMOTE_ORDER_MISMATCH/);
 await denied(()=>journal('confirm',id(6),{revision:1,orderId:901,verification:{status:'confirmed',readbackVerified:false,orderId:901}}),/TPV_READBACK_REQUIRED/);
 check((await journal('uncertain',id(6),{revision:1,orderId:901,reason:'TPV_REMOTE_STATE_MISSING'})).status,'uncertain');
 check((await journal('claim',id(6),{revision:1,expected:expected(701),payments})).won,false);
 // Simulate a database failure during the payment insert: the operation and all
 // cash/card events must roll back together, rather than confirming half a sale.
 await asAdmin(`create function private.test_tpv_insert_failure() returns trigger language plpgsql as $$
 begin if new.method='card' then raise exception 'TEST_INSERT_FAILURE';end if;return new;end$$;
 create trigger test_tpv_insert_failure before insert on private.totus_tpv_payment_events
 for each row execute function private.test_tpv_insert_failure();`);
 const confirmation={revision:1,orderId:901,verification:{status:'confirmed',readbackVerified:true,orderId:901}};
 await denied(()=>journal('confirm',id(6),confirmation),/TEST_INSERT_FAILURE/);
 check((await journal('get',id(6))).status,'uncertain');
 check((await db.query('select count(*)::int n from private.totus_tpv_payment_events')).rows[0].n,0);
 await asAdmin('drop trigger test_tpv_insert_failure on private.totus_tpv_payment_events;drop function private.test_tpv_insert_failure();');
 check((await journal('confirm',id(6),confirmation)).status,'confirmed');
 check((await journal('confirm',id(6),confirmation)).status,'confirmed');
 check((await journal('uncertain',id(6),{revision:1,orderId:901,reason:'TPV_LATE_TIMEOUT'})).status,'confirmed');
 const totals=await db.query(`select count(*)::int n,sum(amount_cents)::int total,
   sum(case when method='cash' then amount_cents else 0 end)::int physical from private.totus_tpv_payment_events`);
 check(totals.rows[0],{n:2,total:801,physical:400});
 await asAdmin(`update private.totus_tpv_assignments set active=false;`);
 await denied(()=>journal('get',id(6)),/TPV_ASSIGNMENT_OR_CONNECTION_INVALID/);
 await asAdmin(`update private.totus_tpv_assignments set active=true;update public.profiles set active=false where id='${id(5)}';`);
 await denied(()=>journal('get',id(6)),/TPV_ACTOR_INACTIVE/);
 await asAdmin(`update public.profiles set active=true where id='${id(5)}';`);
 // Execute the application service and its production RPC adapter against the
 // actual migrated SQL journal. Only PrestaShop and settlement are simulated.
 const ledger=createPostgresCheckoutLedger({rpc:async(name,args)=>{
  check(name,'totus_tpv_journal');
  try {return {data:await journal(args.p_action,args.p_operation_id,args.p_data,args.p_scope),error:null};}
  catch(error){return {data:null,error:{message:error.message}};}
 }});
 const e=expected(707),operationId=id(77);
 await ledger.prepare({scope,operationId,expected:e,quoteExpiresAt:Date.now()+60000});
 let remoteCreated=false,posts=0;
 const native={
  async validatePayments(){return true;},
  async revalidatePrepared(){return {unchanged:true,cartId:707};},
  async ordersForCart(){return remoteCreated?[{connectionId:scope.connectionId,shopId:1,cartId:707,orderId:907}]:[];},
  async submitOrderOnce(){posts++;remoteCreated=true;throw Error('lost HTTP response');},
  async readSale(){return {...e,connectionId:scope.connectionId,orderId:907,receivedCents:801,stateId:11,statePaid:true,
   payments:[{id:602,amountCents:400,methodLabel:'Efectivo',currency:'EUR',recordVerified:true},
    {id:603,amountCents:401,methodLabel:'Tarjeta',currency:'EUR',recordVerified:true}],
   inventory:[{mode:'isolated-fixture',productId:101,attributeId:0,before:5,after:4,ambiguous:false}]};}
 };
 const service=createCheckoutService({ledger,native,settlements:{verify:async()=>payments},authorize:async()=>{
  await db.query('select private.totus_tpv_authorize($1::jsonb,$2)',[JSON.stringify(scope),'sell']);return scope;
 }});
 const command={operationId,selection:scope,payments:[]};
 check((await service.submit(command)).status,'confirmed');
 check((await service.submit(command)).status,'confirmed');
 check((await service.reconcile(command)).status,'confirmed');check(posts,1);
 check((await db.query('select count(*)::int n from private.totus_tpv_payment_events where operation_id=$1',[operationId])).rows[0].n,2);
 const cash=async(action,requestId,data={},selected=scope)=>(await db.query(
  'select public.totus_tpv_cash($1,$2::uuid,$3::jsonb,$4::jsonb) result',
  [action,requestId,JSON.stringify(selected),JSON.stringify(data)])).rows[0].result;
 check((await cash('summary',id(80))).expectedCashCents,10800);
 check((await cash('movement',id(81),{kind:'cash-in',amountCents:200,reason:'Fondo adicional'})).expectedCashCents,11000);
 check((await cash('movement',id(81),{kind:'cash-in',amountCents:200,reason:'Fondo adicional'})).expectedCashCents,11000);
 await denied(()=>cash('movement',id(81),{kind:'cash-in',amountCents:201,reason:'Fondo adicional'}),/ALREADY_BOUND/);
 check((await cash('movement',id(82),{kind:'cash-out',amountCents:100,reason:'Retirada'})).expectedCashCents,10900);
 await denied(()=>cash('movement',id(83),{kind:'cash-out',amountCents:10901,reason:'Exceso'}),/BALANCE_INVALID/);
 await denied(()=>cash('movement',id(83),{kind:'cash-in',amountCents:1,reason:' ',providerPaid:true}),/MOVEMENT_INVALID/);
 await db.exec('begin');
 await journal('prepare',id(88),{expected:expected(788),quoteExpiresAt:Date.now()+60000});
 await journal('claim',id(88),{revision:1,expected:expected(788),payments});
 await denied(()=>cash('close',id(89),{countedCents:10900,note:''}),/UNRESOLVED_SALES/);
 await db.exec('rollback');
 const closed=await cash('close',id(89),{countedCents:10890,note:'Diferencia anotada'});
 check(closed.status,'closed');check(closed.countedCents,10890);check(closed.expectedCashCents,10900);
 check(await cash('close',id(89),{countedCents:10890,note:'Diferencia anotada'}),closed);
 await denied(()=>cash('close',id(89),{countedCents:10900,note:'Diferencia anotada'}),/ALREADY_BOUND/);
 await denied(()=>cash('movement',id(90),{kind:'cash-in',amountCents:1,reason:'Después de cierre'}),/SESSION/);
 await denied(()=>cash('summary',id(90),{},{...scope,actorId:id(9)}),/FORBIDDEN/);
 await db.exec('set role authenticated');
 await denied(()=>cash('summary',id(90)),/permission denied/);
 const qaConnection='b554f6cc-4df1-412b-b063-e1cbd82d9e66';
 await asAdmin(`insert into private.totus_api_connections values('${qaConnection}',1,1,true,true,'prestashop');
  insert into private.totus_websites(key,connection_id,business_id,status,origin,include_in_totals)
  values('qa-shop','${qaConnection}',null,'active','https://preproduccion.hortimatic.com',false);`);
 const profile={verified:true,configured:true,protocol:1,environment:'qa',native_version:'8.2.8',installation_id:id(96),shop_id:1,
  currency_id:1,currency:'EUR',language_id:1,carrier_id:4,paid_state_id:8,preparing_state_id:7,
  counter_customer_id:501,counter_address_id:601,payment_labels:{cash:'Efectivo',card:'Tarjeta'}};
 const configure=async(patch={})=>(await db.query('select public.totus_tpv_configure($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb) result',
  [patch.actorId||id(5),id(5),patch.connectionId||qaConnection,1,id(2),id(3),'qa-shop',JSON.stringify(patch.profile||profile),
   JSON.stringify({sell:true,open:true,reconcile:true})])).rows[0].result;
 await denied(()=>configure({actorId:id(9)}),/CONFIGURATION_FORBIDDEN/);
 await denied(()=>configure({connectionId:id(1)}),/NATIVE_PROFILE_INVALID/);
 await denied(()=>configure({profile:{...profile,configured:false}}),/NATIVE_PROFILE_INVALID/);
 check((await configure()).configured,true);
 check((await db.query("select business_id from private.totus_websites where key='qa-shop'")).rows[0].business_id,null);
 const qaScope={...scope,connectionId:qaConnection,sessionId:id(95)};
 check((await journal('open',id(95),{openingCents:1000},qaScope)).status,'open');
 let nativePosts=0;const nativeRequestId=id(98);
 const nativeRequests=createNativeRequestService({scope:qaScope,rpc:async(name,args)=>{
  check(name,'totus_tpv_native_command');
  const result=await db.query('select public.totus_tpv_native_command($1,$2::uuid,$3::jsonb,$4::jsonb) result',
   [args.p_action,args.p_id,JSON.stringify(args.p_scope),JSON.stringify(args.p_data)]);
  return {data:result.rows[0].result};
 },transport:{nativeCommand:async()=>{nativePosts++;throw Error('Response lost');},readNativeOperation:async()=>({
  status:'verified',operation_id:nativeRequestId,result:{verified:true,native_reference:811,cart_id:811,session_id:qaScope.sessionId,drawer_id:qaScope.drawerId}})}});
 const prepareNative={operationId:nativeRequestId,command:'cart.prepare',payload:{session_id:qaScope.sessionId,drawer_id:qaScope.drawerId}};
 check((await nativeRequests.execute(prepareNative)).status,'verified');
 check((await nativeRequests.execute(prepareNative)).status,'verified');
 check((await nativeRequests.recover(nativeRequestId)).status,'verified');check(nativePosts,1);
 await denied(()=>nativeRequests.execute({...prepareNative,payload:{...prepareNative.payload,drawer_id:id(33)}}),/ALREADY_BOUND/);
 const returnedSale=id(111),refundId=id(112),sourceExpected=expected(811);
 await journal('prepare',returnedSale,{expected:sourceExpected,quoteExpiresAt:Date.now()+60000},qaScope);
 await journal('claim',returnedSale,{revision:1,expected:sourceExpected,payments},qaScope);
 await journal('confirm',returnedSale,{revision:1,orderId:911,verification:{status:'confirmed',readbackVerified:true,orderId:911}},qaScope);
 const refund=async(action,requestId,data={})=>(await db.query('select public.totus_tpv_refund_journal($1,$2::uuid,$3::jsonb,$4::jsonb) result',
  [action,requestId,JSON.stringify(qaScope),JSON.stringify(data)])).rows[0].result;
 const intent={sale_operation_id:returnedSale,state_fingerprint:'a'.repeat(64),items:[{detail_id:1,quantity:1,restock:true}],
  payments:[{method:'cash',amount_cents:400},{method:'card',amount_cents:401}]};
 const refundData={intent,totalCents:801,lineAmounts:[{detail_id:1,amount_cents:801}]};
 check((await refund('prepare',refundId,refundData)).status,'ready');
 await denied(()=>refund('prepare',id(113),refundData),/ALREADY_PENDING/);
 check((await refund('cancel',refundId)).status,'cancelled');
 check((await refund('prepare',id(113),refundData)).status,'ready');
 const claimedRefund=await refund('claim',id(113),{confirmation:{accepted:true,operationId:id(113),totalCents:801,currency:'EUR'}});
 check(claimedRefund.won,true);check((await cash('summary',id(114),{},qaScope)).reservedCashCents,400);
 check((await cash('summary',id(114),{},qaScope)).availableCashCents,1000);
 await denied(()=>cash('movement',id(114),{kind:'cash-out',amountCents:1001,reason:'Efectivo reservado'},qaScope),/BALANCE_INVALID/);
 await denied(()=>cash('close',id(114),{countedCents:1400,note:''},qaScope),/UNRESOLVED_SALES/);
 check((await refund('claim',id(113),{confirmation:{accepted:true,operationId:id(113),totalCents:801,currency:'EUR'}})).won,false);
 await denied(()=>refund('cancel',id(113)),/ALREADY_DISPATCHED/);
 await refund('uncertain',id(113));
 await asAdmin(`create function private.test_tpv_refund_failure() returns trigger language plpgsql as $$
 begin if new.method='card' then raise exception 'TEST_REFUND_FAILURE';end if;return new;end$$;
 create trigger test_tpv_refund_failure before insert on private.totus_tpv_refund_payments for each row execute function private.test_tpv_refund_failure();`);
 const refundResult={verified:true,native_reference:id(113),sale_operation_id:returnedSale,total_cents:801,refund_payments:intent.payments};
 await denied(()=>refund('confirm',id(113),{result:refundResult}),/TEST_REFUND_FAILURE/);
 check((await db.query('select count(*)::int n from private.totus_tpv_refund_payments')).rows[0].n,0);
 check((await refund('get',id(113))).status,'uncertain');
 await asAdmin('drop trigger test_tpv_refund_failure on private.totus_tpv_refund_payments;drop function private.test_tpv_refund_failure();');
 check((await refund('confirm',id(113),{result:refundResult})).status,'confirmed');
 check((await refund('confirm',id(113),{result:refundResult})).status,'confirmed');
 const afterRefund=await cash('summary',id(114),{},qaScope);check(afterRefund.expectedCashCents,1000);check(afterRefund.reservedCashCents,0);
 check(afterRefund.refunds,{cash:400,card:401});
 await denied(()=>configure({profile:{...profile,installation_id:id(97)}}),/IDENTITY_ALREADY_BOUND/);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(5)]);
 await db.exec('set role authenticated');
 const ctx=(await db.query('select public.totus_tpv_context() result')).rows[0].result;
 check(ctx.actorId,id(5));check(ctx.workstations.length,1);check(ctx.workstations[0].session.id,id(95));
 check(ctx.workstations[0].nativeProfile.installation_id,id(96));
 await denied(()=>configure(),/permission denied/);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(9)]);
 await denied(()=>db.query('select public.totus_tpv_context()'),/VIEW_FORBIDDEN/);
 await db.exec('reset role');
 await db.exec(`insert into public.ops_cash_drawers(id,store_id,active) values('${id(240)}','${scope.storeId}',true);
  insert into private.totus_tpv_assignments(actor_id,connection_id,website_key,store_id,shop_id,drawer_id,can_sell,can_reconcile,can_open)
   values('${scope.actorId}','${qaConnection}','qa-shop','${scope.storeId}',1,'${id(240)}',true,true,true);`);
 const draftScope={...qaScope,drawerId:id(240),sessionId:id(241)},draftId=id(242),draftPayload={lines:[{productId:101,attributeId:0,qty:1,label:'Artículo del laboratorio'}]};
 const draft=async(action,request,data={},draftIdentifier=draftId)=>
  (await db.query('select public.totus_tpv_drafts($1,$2,$3,$4::jsonb,$5::jsonb) result',
   [action,draftIdentifier,request,JSON.stringify(draftScope),JSON.stringify(data)])).rows[0].result;
 await db.exec('set role authenticated');await denied(()=>draft('list',id(243)),/permission denied/);
 await db.exec('reset role;set role service_role');await journal('open',draftScope.sessionId,{openingCents:10000},draftScope);
 const parked=await draft('park',id(243),{version:0,label:'Ticket aparcado',payload:draftPayload});check(parked.version,1);check(parked.status,'parked');
 check((await draft('park',id(243),{version:0,label:'Ticket aparcado',payload:draftPayload})).version,1);
 await denied(()=>draft('park',id(243),{version:0,label:'Otro contenido',payload:draftPayload}),/REQUEST_ALREADY_BOUND/);
 await denied(()=>draft('park',id(244),{version:0,label:'Otro contenido',payload:draftPayload}),/DRAFT_STALE/);
 await denied(()=>draft('park',id(246),{version:0,label:'Precio no autorizado',payload:{lines:[{...draftPayload.lines[0],unitCents:1}]}},id(245)),/PAYLOAD_INVALID/);
 await denied(()=>draft('park',id(248),{version:0,label:'Cantidad no numérica',payload:{lines:[{...draftPayload.lines[0],qty:'1'}]}},id(247)),/PAYLOAD_INVALID/);
 const claimedDraft=await draft('claim',id(249),{version:1});check(claimedDraft.status,'claimed');check(claimedDraft.version,2);
 await denied(()=>draft('claim',id(250),{version:1}),/DRAFT_STALE/);
 const boundDraft=await draft('bind',id(251),{version:2,payload:draftPayload,checkoutId:id(252)});check(boundDraft.version,3);
 const oldDraftExpected={...expected(1501),draftId,draftVersion:3};
 await journal('prepare',id(252),{expected:oldDraftExpected,quoteExpiresAt:Date.now()+60000},draftScope);
 const releasedDraft=await draft('release',id(253),{version:3});check(releasedDraft.status,'claimed');check(releasedDraft.version,4);
 await denied(()=>journal('claim',id(252),{revision:1,expected:oldDraftExpected,payments},draftScope),/DRAFT_STALE/);
 check((await journal('get',id(252),{},draftScope)).status,'ready');
 const rebound=await draft('bind',id(254),{version:4,payload:draftPayload,checkoutId:id(255)});check(rebound.version,5);
 const draftExpected={...expected(1502),draftId,draftVersion:5};
 await journal('prepare',id(255),{expected:draftExpected,quoteExpiresAt:Date.now()+60000},draftScope);
 check((await journal('claim',id(255),{revision:1,expected:draftExpected,payments},draftScope)).won,true);
 await denied(()=>draft('release',id(256),{version:5}),/DRAFT_IN_USE/);
 check((await journal('confirm',id(255),{revision:1,orderId:4901,verification:{status:'confirmed',readbackVerified:true,orderId:4901}},draftScope)).status,'confirmed');
 const soldDraft=await draft('get',id(257));check(soldDraft.status,'sold');check(soldDraft.orderId,4901);check(soldDraft.version,6);
 check((await draft('claim',id(249),{version:1})).status,'sold');
 await denied(()=>draft('claim',id(258),{version:6}),/DRAFT_IN_USE/);
 check((await draft('list',id(259))).length,0);
 const lookup=async(selected=draftScope,orderId=null,saleId=null)=>(await db.query('select public.totus_tpv_orders($1::jsonb,$2,$3) result',
  [JSON.stringify(selected),orderId,saleId])).rows[0].result;
 check((await lookup(draftScope,4901))[0].orderId,4901);
 check((await lookup(draftScope,4902)).length,0);
 check((await lookup(draftScope,null,id(255)))[0].id,id(255));
 await denied(()=>lookup(draftScope,0),/ORDER_QUERY_INVALID/);
 await db.exec('set role authenticated');await denied(()=>lookup(),/permission denied/);
 await db.exec('reset role;set role service_role');
 check((await lookup(qaScope,4901))[0].orderId,4901);
 await cash('close',id(260),{countedCents:10400,note:'Cierre del escenario histórico'},draftScope);
 const historicalScope={...draftScope,sessionId:id(261)};
 await journal('open',historicalScope.sessionId,{openingCents:10000},historicalScope);
 check((await lookup(historicalScope,4901))[0].orderId,4901);
 const report=async(selected,sessionId=null)=>(await db.query('select public.totus_tpv_cash_reports($1::jsonb,$2) result',
  [JSON.stringify(selected),sessionId])).rows[0].result;
 const closedReport=(await report(draftScope,draftScope.sessionId))[0];
 check(closedReport.status,'closed');check(closedReport.countedCents,10400);check(closedReport.differenceCents,0);check(closedReport.orderCount,1);
 check((await report({...draftScope,sessionId:undefined},draftScope.sessionId))[0].status,'closed');
 check((await report(draftScope,id(999))).length,0);
 await db.exec('set role authenticated');await denied(()=>report(draftScope),/permission denied/);await db.exec('reset role;set role service_role');
 await denied(()=>journal('get',id(255),{},historicalScope),/SCOPE_MISMATCH/);
 check((await configure({profile:{...profile,payment_labels:{...profile.payment_labels,bizum:'Bizum'}}})).configured,true);
 await configure();
 check((await db.query('select profile from private.totus_tpv_native_profiles where connection_id=$1',[qaConnection])).rows[0].profile.payment_labels.bizum,'Bizum');
 await db.exec('reset role');
 const secured=await db.query(`select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='private' and c.relname in ('totus_tpv_assignments','totus_tpv_sessions','totus_tpv_operations','totus_tpv_payment_events') and c.relrowsecurity`);
 check(secured.rows[0].n,4);
 console.log(`PASS TotusTPV PostgreSQL journal: ${assertions} assertions; real SQL transactions/constraints/roles in isolated PGlite. No remote database or PrestaShop writes.`);
} finally {await db.close();}
