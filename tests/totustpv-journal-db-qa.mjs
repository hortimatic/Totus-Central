import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createPostgresCheckoutLedger} from '../src/totustpv/postgres-journal.js';
import {createCheckoutService} from '../src/totustpv/checkout-service.js';
import {createNativeRequestService} from '../src/totustpv/server/native-request-service.js';
import {createStockReceiptService} from '../src/totustpv/server/stock-receipt-service.js';
import {productIntakeDraft,productIntakeBase,productIntakePlan} from '../src/totustpv/product-intake-contract.js';
import {exerciseBudgetLedger} from './native-lab/budget-ledger-assertions.mjs';
import {exerciseCentralCashLedger} from './native-lab/central-cash-ledger-assertions.mjs';
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
 create table public.profiles(id uuid primary key,email text,active boolean,role text,full_name text default 'Operador original de la venta');
 create table public.ops_stores(id uuid primary key,active boolean,name text default 'Tienda de prueba');
 create table public.ops_cash_drawers(id uuid primary key,store_id uuid,active boolean,name text default 'Caja de prueba');
 create table public.team_members(email text,active boolean,role text);
 create table public.ops_daily_closings(id uuid primary key);
 create table private.totus_api_connections(id uuid primary key,revision bigint,verified_revision bigint,
   enabled boolean,real_data_authorized boolean,protocol text);
 create table private.totus_websites(key text primary key,connection_id uuid,business_id uuid,status text,origin text,include_in_totals boolean default false);
 create function private.totus_module_can(email text,module text,action text) returns boolean
 language sql stable as $$select exists(select 1 from public.profiles p where p.email=$1 and p.active and p.role='admin')$$;
 revoke all on function private.totus_module_can(text,text,text) from public,anon,authenticated,service_role;
 insert into public.profiles(id,email,active,role) values('${id(5)}','operator@example.invalid',true,'admin'),('${id(9)}','denied@example.invalid',true,'employee');
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
 await db.exec(await readFile(new URL('../supabase/migrations/20261116172741_totustpv_server_permission_helper.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261116175354_totustpv_failed_sale_review.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261116180903_totustpv_workspace_preferences.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261116192744_totustpv_stock_receipts.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261116205052_totustpv_catalogue_layout.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261117021112_totustpv_workstation_access.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261117031559_totustpv_customer_display.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261117052454_totustpv_product_intake.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261117093928_totustpv_cash_counting.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('native-lab/directory-journal.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261117100653_totustpv_catalogue_helpers.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261117104005_totustpv_catalogue_tax_display.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261117105231_totustpv_search_preferences.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261117111400_totustpv_catalogue_filters.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261117123814_totustpv_variant_order.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261117125500_totustpv_stock_policy.sql',import.meta.url),'utf8'));
 await db.query('insert into private.totus_tpv_workspace_preferences(actor_id,connection_id,shop_id,drawer_id,display_options,stock_policy) values($1,$2,1,$3,$4::jsonb,$5::jsonb)',[id(9),id(1),id(33),JSON.stringify({showPrices:false,variantOrder:'price:desc'}),JSON.stringify({allowOutOfStock:true})]);
 await db.exec(await readFile(new URL('../supabase/migrations/20261117143621_totustpv_quantity_picker.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261117145654_totustpv_line_price_options.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261117152204_totustpv_parking_expiry.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261117155256_totustpv_private_sale_note.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261117162118_totustpv_receipt_line_discounts.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261117170825_totustpv_temporary_line_names.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261117181754_totustpv_receipt_numbering.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261117191716_totustpv_commercial_budgets.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261118001954_totustpv_cash_report_drawer_scope.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/migrations/20261118002455_totustpv_central_cash_bridge.sql',import.meta.url),'utf8'));
 const migratedQuantity=(await db.query('select display_options,stock_policy from private.totus_tpv_workspace_preferences where actor_id=$1',[id(9)])).rows[0];
 check(migratedQuantity.display_options,{requireQuantity:false,showPrices:false,variantOrder:'price:desc'});check(migratedQuantity.stock_policy,{allowOutOfStock:true});
 await db.query('delete from private.totus_tpv_workspace_preferences where actor_id=$1',[id(9)]);
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
 check((await lookup(draftScope,4901))[0].operatorName,'Operador original de la venta');
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
 check((await report(draftScope)).every(row=>[draftScope.sessionId,historicalScope.sessionId].includes(row.sessionId)),true);
 check((await report(draftScope,qaScope.sessionId)).length,0);
 await db.exec('set role authenticated');await denied(()=>report(draftScope),/permission denied/);await db.exec('reset role;set role service_role');
 await denied(()=>journal('get',id(255),{},historicalScope),/SCOPE_MISMATCH/);
 check((await configure({profile:{...profile,payment_labels:{...profile.payment_labels,bizum:'Bizum'}}})).configured,true);
 await configure();
 check((await db.query('select profile from private.totus_tpv_native_profiles where connection_id=$1',[qaConnection])).rows[0].profile.payment_labels.bizum,'Bizum');
 await db.exec('reset role');
 const secured=await db.query(`select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='private' and c.relname in ('totus_tpv_assignments','totus_tpv_sessions','totus_tpv_operations','totus_tpv_payment_events') and c.relrowsecurity`);
 check(secured.rows[0].n,4);
 await db.exec('set role service_role');
 const failedId=id(310),failedExpected=expected(1910);
 await journal('prepare',failedId,{expected:failedExpected,quoteExpiresAt:Date.now()+60000},historicalScope);
 await journal('claim',failedId,{revision:1,expected:failedExpected,payments},historicalScope);
 await journal('uncertain',failedId,{revision:1,reason:'TPV_TEST_NATIVE_FAILURE'},historicalScope);
 const proof={operationId:failedId,cartId:1910,executionFinished:true,effectObserved:false,ordersObserved:0,nativeCommand:'sale.commit',nativeCode:'TOTUS_NATIVE_EXECUTION_FAILED',checkedAt:Date.now()};
 const review=async(p=proof)=>(await db.query('select public.totus_tpv_resolve_incident($1::jsonb,$2,$3,$4,$5::jsonb) result',[JSON.stringify(historicalScope),failedId,'Ensayo sin pedido ni cobro externo','not-collected',JSON.stringify(p)])).rows[0].result;
 await denied(()=>review({...proof,executionFinished:false}),/NATIVE_PROOF_REQUIRED/);
 await denied(()=>review({...proof,ordersObserved:1}),/NATIVE_PROOF_REQUIRED/);
 await denied(()=>review({...proof,effectObserved:true}),/NATIVE_PROOF_REQUIRED/);
 check((await review()).status,'cancelled');check((await review()).status,'cancelled');
 check((await journal('get',failedId,{},historicalScope)).status,'cancelled');
 check((await journal('claim',failedId,{revision:1,expected:failedExpected,payments},historicalScope)).won,false);
 await db.exec('set role authenticated');await denied(()=>review(),/permission denied/);await db.exec('reset role');
 const prefs=async(selected=qaScope,value=null)=>(await db.query('select public.totus_tpv_workspace_preferences($1,$2,$3,$4::jsonb) result',[selected.connectionId,selected.shopId,selected.drawerId,value===null?null:JSON.stringify(value)])).rows[0].result;
 await db.exec('set role anon');await denied(()=>prefs(),/permission denied/);
 await db.exec('reset role;set role authenticated');
 await db.exec(`set request.jwt.claim.sub='${id(5)}'`);
 check((await prefs()).viewMode,'grid');check((await prefs(qaScope,{viewMode:'list',initialCategoryId:12})).initialCategoryId,12);
 check((await prefs()).customerDisplay,{enabled:false,showPrices:true,showCustomer:false,color:'#1773c9',fontSize:23});
 check((await prefs()).cash.denominations,[50000,20000,10000,5000,2000,1000,500,200,100,50,20,10,5,2,1]);
 check((await prefs(qaScope,{cash:{denominations:[2000,500,100,1]}})).cash.denominations,[2000,500,100,1]);
 for(const cash of [null,[],true,{denominations:[]},{denominations:'all'},{denominations:[2000,2000]},{denominations:['2000']},{denominations:[0]},{denominations:[-1]},{denominations:[300]},{denominations:[1.5]},{denominations:[100000000000]},{currency:'USD'},{denominations:[100],allowNegative:true}])
  await denied(()=>prefs(qaScope,{cash}),/INVALID/);
 check((await prefs(qaScope,{cash:{}})).cash.denominations,[2000,500,100,1]);
 check((await prefs(qaScope,{customerDisplay:{enabled:true,showPrices:false,color:'#112233',fontSize:40}})).customerDisplay,
  {enabled:true,showPrices:false,showCustomer:false,color:'#112233',fontSize:40});
 check((await prefs(qaScope,{customerDisplay:{showCustomer:true}})).customerDisplay.color,'#112233');
 for(const customerDisplay of [null,[],true,{enabled:'true'},{showPrices:0},{showCustomer:'false'},{color:'red'},{color:'#fff'},{color:'url(https://evil.invalid)'},{fontSize:13},{fontSize:41},{fontSize:23.5},{customerEmail:true}])
  await denied(()=>prefs(qaScope,{customerDisplay}),/INVALID/);
 check((await prefs(qaScope,{viewMode:'list'})).customerDisplay.enabled,true);
 check((await prefs()).cash.denominations,[2000,500,100,1]);
 check((await prefs()).viewMode,'list');await denied(()=>prefs({...qaScope,drawerId:id(999)}),/FORBIDDEN/);
 check((await prefs(qaScope,{columns:['name','photo','stock'],sortField:'stock',sortDirection:'desc'})).sortField,'stock');
 check((await prefs()).columns,['name','photo','stock']);check((await prefs()).viewMode,'list');
 check((await prefs(qaScope,{viewMode:'table'})).sortDirection,'desc');
 check((await prefs(qaScope,{display:{showPrices:false,ticketNewestFirst:true}})).display.showPrices,false);
 check((await prefs()).display.showStock,true);
 check((await prefs()).display.layout,'balanced');
 check((await prefs()).display.returnToStart,false);
 for(const layout of ['catalogue','ticket','balanced'])check((await prefs(qaScope,{display:{layout}})).display.layout,layout);
 check((await prefs(qaScope,{display:{returnToStart:true}})).display.returnToStart,true);
 for(const layout of ['<script>',true,null,4])await denied(()=>prefs(qaScope,{display:{layout}}),/INVALID/);
 await denied(()=>prefs(qaScope,{display:{returnToStart:'true'}}),/INVALID/);
 check((await prefs(qaScope,{columns:['name','price']})).display.ticketNewestFirst,true);
 await denied(()=>prefs(qaScope,{display:{showPrices:'false'}}),/INVALID/);
 check((await prefs(qaScope,{display:{priceMode:'net'},columns:['name','netPrice','price']})).display.priceMode,'net');
 check((await prefs(qaScope)).columns,['name','netPrice','price']);
 for(const priceMode of ['gross','net'])check((await prefs(qaScope,{display:{priceMode}})).display.priceMode,priceMode);
 for(const priceMode of ['<script>',true,null,4,'none'])await denied(()=>prefs(qaScope,{display:{priceMode}}),/INVALID/);
 check((await prefs()).display.variantOrder,'name:asc');
 check((await prefs()).display.requireQuantity,false);
 check((await prefs(qaScope,{display:{requireQuantity:true}})).display.requireQuantity,true);
 check((await prefs(qaScope,{viewMode:'table'})).display.requireQuantity,true);
 for(const requireQuantity of ['true',1,null,[],{}])await denied(()=>prefs(qaScope,{display:{requireQuantity}}),/INVALID/);
 check((await prefs(qaScope,{display:{requireQuantity:false}})).display.requireQuantity,false);
 for(const variantOrder of ['name:asc','name:desc','stock:asc','stock:desc','price:asc','price:desc','reference:asc','reference:desc'])check((await prefs(qaScope,{display:{variantOrder}})).display.variantOrder,variantOrder);
 check((await prefs(qaScope,{viewMode:'table'})).display.variantOrder,'reference:desc');
 for(const variantOrder of [null,true,3,{},'stock','cost:desc','name;drop:asc'])await denied(()=>prefs(qaScope,{display:{variantOrder}}),/INVALID/);
 check((await prefs()).stockPolicy,{allowOutOfStock:false});
 check((await prefs()).lineOptions,{allowPriceChanges:false,requireSaleNote:false,allowNameChanges:false});
 // Numbering is shared by the shop, allocated at confirmation and immutable.
 const series=async settings=>(await db.query('select public.totus_tpv_receipt_series($1::uuid,$2::bigint,$3::uuid,$4::jsonb) result',[qaScope.connectionId,1,qaScope.drawerId,settings===undefined?null:JSON.stringify(settings)])).rows[0].result;
 check(await series(),{enabled:false,salePrefix:'V',returnPrefix:'D',lastSaleNumber:0,lastReturnNumber:0});
 for(const settings of [true,[],{enabled:'true'},{salePrefix:'<x>'},{salePrefix:'a'.repeat(13)},{lastSaleNumber:-1},{lastReturnNumber:1.5},{actorId:id(9)}])await denied(()=>series(settings),/INVALID/);
 await db.exec('begin');check(await series({enabled:true,lastSaleNumber:40,lastReturnNumber:8}),{enabled:true,salePrefix:'V',returnPrefix:'D',lastSaleNumber:40,lastReturnNumber:8});
 await db.exec('reset role;set role service_role');
 const numbered=expected(9501);await journal('prepare',id(9501),{expected:numbered,quoteExpiresAt:Date.now()+60000},qaScope);
 await journal('claim',id(9501),{revision:1,expected:numbered,payments},qaScope);
 const confirmNumbered=()=>journal('confirm',id(9501),{revision:1,orderId:9501,verification:{status:'confirmed',readbackVerified:true,orderId:9501}},qaScope);
 await confirmNumbered();await confirmNumbered();
 check((await db.query('select number,prefix from private.totus_tpv_receipt_numbers where operation_id=$1',[id(9501)])).rows,[{number:41,prefix:'V'}]);
 await db.exec('reset role;set role authenticated');check((await series()).lastSaleNumber,41);await series({salePrefix:'NEW'});
 await db.exec('reset role;set role service_role');check((await db.query('select prefix from private.totus_tpv_receipt_numbers where operation_id=$1',[id(9501)])).rows[0].prefix,'V');
 const readNumber=async(operation,kind)=>(await db.query('select public.totus_tpv_receipt_number($1::jsonb,$2::uuid,$3) result',[JSON.stringify(qaScope),operation,kind])).rows[0].result;
 check(await readNumber(id(9501),'sale'),{kind:'sale',number:41,prefix:'V',label:'V41'});
 await db.query("insert into private.totus_tpv_refunds(id,sale_id,session_id,actor_id,scope,intent,line_amounts,total_cents) values($1,$2,$3,$4,$5,'{}','[]',0)",[id(9502),id(9501),qaScope.sessionId,qaScope.actorId,JSON.stringify(qaScope)]);
 await db.query("update private.totus_tpv_refunds set status='confirmed',result='{}' where id=$1",[id(9502)]);
 check((await db.query('select number,prefix from private.totus_tpv_receipt_numbers where operation_id=$1',[id(9502)])).rows,[{number:9,prefix:'D'}]);
 check(await readNumber(id(9502),'return'),{kind:'return',number:9,prefix:'D',label:'D9'});
 // A historical V4 + 2 must not collide with a later V + 42.
 await db.query("insert into private.totus_tpv_receipt_numbers(operation_id,kind,connection_id,shop_id,store_id,number,prefix) values($1,'sale',$2,1,$3,2,'V4')",[id(9503),qaScope.connectionId,qaScope.storeId]);
 await db.exec('reset role;set role authenticated');await series({salePrefix:'V'});await db.exec('reset role;set role service_role');
 const collisionExpected=expected(9504);await journal('prepare',id(9504),{expected:collisionExpected,quoteExpiresAt:Date.now()+60000},qaScope);await journal('claim',id(9504),{revision:1,expected:collisionExpected,payments},qaScope);
 await journal('confirm',id(9504),{revision:1,orderId:9504,verification:{status:'confirmed',readbackVerified:true,orderId:9504}},qaScope);
 check(await readNumber(id(9504),'sale'),{kind:'sale',number:43,prefix:'V',label:'V43'});
 await db.exec('savepoint counter_check');await denied(()=>series({lastSaleNumber:40}),/permission denied/);await db.exec('rollback to counter_check');
 await db.exec('reset role;set role authenticated;savepoint counter_decrease');await denied(()=>series({lastSaleNumber:40}),/COUNTER_DECREASE_FORBIDDEN/);await db.exec('rollback to counter_decrease');
 await db.exec('rollback');
 for(const lineOptions of [null,[],true,{allowPriceChanges:'true'},{allowPriceChanges:null},{allowPriceChanges:1},{price:true},{allowPriceChanges:true,actorId:id(9)}])await denied(()=>prefs(qaScope,{lineOptions}),/INVALID/);
 await exerciseBudgetLedger({db,scope:qaScope,id,check,denied});
 check((await prefs(qaScope,{lineOptions:{allowPriceChanges:true}})).lineOptions,{allowPriceChanges:true,requireSaleNote:false,allowNameChanges:false});
 check((await prefs(qaScope,{viewMode:'table'})).lineOptions,{allowPriceChanges:true,requireSaleNote:false,allowNameChanges:false});
 const serverLineOptions=async selected=>(await db.query('select public.totus_tpv_line_options($1::jsonb) result',[JSON.stringify(selected)])).rows[0].result;
 await denied(()=>serverLineOptions(qaScope),/permission denied/);await db.exec('reset role;set role service_role');check(await serverLineOptions(qaScope),{allowPriceChanges:true,requireSaleNote:false,allowNameChanges:false});
 await denied(()=>serverLineOptions({...qaScope,actorId:id(9)}),/FORBIDDEN|INVALID/);await denied(()=>serverLineOptions({...qaScope,drawerId:id(999)}),/FORBIDDEN|INVALID/);
 const pricedDraft={lines:[{productId:101,attributeId:0,qty:2,discount:{kind:'price',value:725}}]};
 const namedDraft={lines:[{productId:101,attributeId:0,qty:2,displayName:'Preparado del cliente 🙂',originalLabel:'Artículo del catálogo'}]};
 check((await db.query('select private.totus_tpv_draft_payload($1::jsonb) result',[JSON.stringify(namedDraft)])).rows[0].result,namedDraft);
 for(const displayName of ['<nombre>','a'.repeat(256),'bad\n',true,' nombre '])await denied(()=>db.query('select private.totus_tpv_draft_payload($1::jsonb)',[JSON.stringify({lines:[{...namedDraft.lines[0],displayName}]})]),/INVALID/);
 await db.exec('reset role;set role authenticated');
 check((await prefs(qaScope,{lineOptions:{allowNameChanges:true}})).lineOptions.allowNameChanges,true);
 check((await prefs(qaScope,{viewMode:'grid'})).lineOptions.allowNameChanges,true);
 for(const value of ['true',null,1,{}])await denied(()=>prefs(qaScope,{lineOptions:{allowNameChanges:value}}),/INVALID/);
 await db.exec('reset role;set role service_role');check((await serverLineOptions(qaScope)).allowNameChanges,true);
 const namedExpected={...expected(9001),hasLineNameOverrides:true,metadata:'🙂'.repeat(20000)};
 check((await journal('prepare',id(9001),{expected:namedExpected,quoteExpiresAt:Date.now()+60000},qaScope)).status,'ready');
 await denied(()=>journal('prepare',id(9002),{expected:{...expected(9002),metadata:'a'.repeat(70000)},quoteExpiresAt:Date.now()+60000},qaScope),/INVALID/);
 await denied(()=>journal('prepare',id(9003),{expected:{...expected(9003),hasLineNameOverrides:true,metadata:'a'.repeat(1048576)},quoteExpiresAt:Date.now()+60000},qaScope),/INVALID/);
 await db.exec('reset role;set role authenticated');await prefs(qaScope,{lineOptions:{allowNameChanges:false}});await db.exec('reset role;set role service_role');
 await denied(()=>journal('claim',id(9001),{revision:1,expected:namedExpected,payments},qaScope),/LINE_NAME_FORBIDDEN/);
 check((await journal('get',id(9001),{},qaScope)).status,'ready');
 await db.exec('reset role;set role authenticated');await prefs(qaScope,{lineOptions:{allowNameChanges:true}});await db.exec('reset role;set role service_role');
 check((await journal('claim',id(9001),{revision:1,expected:namedExpected,payments},qaScope)).won,true);
 await db.exec('reset role;set role authenticated');await prefs(qaScope,{lineOptions:{allowNameChanges:false}});await db.exec('reset role;set role service_role');
 check((await journal('confirm',id(9001),{revision:1,orderId:9001,verification:{status:'confirmed',readbackVerified:true,orderId:9001}},qaScope)).status,'confirmed');
 check((await db.query('select private.totus_tpv_draft_payload($1::jsonb) result',[JSON.stringify(pricedDraft)])).rows[0].result,pricedDraft);
 await denied(()=>db.query('select private.totus_tpv_draft_payload($1::jsonb)',[JSON.stringify({...pricedDraft,adjustment:{kind:'price',value:725}})]),/INVALID/);
 await asAdmin(`create or replace function private.totus_module_can(email text,module text,action text) returns boolean language sql stable as $$select action<>'edit' and exists(select 1 from public.profiles p where p.email=$1 and p.active and p.role='admin')$$`);
 check(await serverLineOptions(qaScope),{allowPriceChanges:false,requireSaleNote:false,allowNameChanges:false});await db.exec('reset role;set role authenticated');await denied(()=>prefs(qaScope,{lineOptions:{allowPriceChanges:true}}),/PRICE_CHANGE_FORBIDDEN/);
 await asAdmin(`create or replace function private.totus_module_can(email text,module text,action text) returns boolean language sql stable as $$select exists(select 1 from public.profiles p where p.email=$1 and p.active and p.role='admin')$$`);
 await db.exec('reset role;set role authenticated');check((await prefs(qaScope,{lineOptions:{allowPriceChanges:false}})).lineOptions,{allowPriceChanges:false,requireSaleNote:false,allowNameChanges:false});
 check((await prefs(qaScope,{lineOptions:{requireSaleNote:true}})).lineOptions,{allowPriceChanges:false,requireSaleNote:true,allowNameChanges:false});
 check((await prefs(qaScope,{viewMode:'grid'})).lineOptions.requireSaleNote,true);
 for(const lineOptions of [{requireSaleNote:'true'},{requireSaleNote:null},{requireSaleNote:1},{requireSaleNote:true,note:'forged'}])await denied(()=>prefs(qaScope,{lineOptions}),/INVALID/);
 await db.exec('reset role;set role service_role');check((await serverLineOptions(qaScope)).requireSaleNote,true);
 const notePayload={...pricedDraft,note:'Recoger el miércoles\nAvisar al equipo 🙂'};
 check((await db.query('select private.totus_tpv_draft_payload($1::jsonb) result',[JSON.stringify(notePayload)])).rows[0].result,notePayload);
 check((await db.query('select private.totus_tpv_draft_payload($1::jsonb) result',[JSON.stringify({...pricedDraft,note:'🙂'.repeat(500)})])).rows[0].result.note,'🙂'.repeat(500));
 for(const note of [null,[],true,'','🙂'.repeat(501),'<script>privado</script>','nota\rcontrol','nota\u0007'])await denied(()=>db.query('select private.totus_tpv_draft_payload($1::jsonb)',[JSON.stringify({...pricedDraft,note})]),/INVALID/);
 await db.exec('reset role;set role authenticated');check((await prefs(qaScope,{lineOptions:{requireSaleNote:false,allowNameChanges:false}})).lineOptions,{allowPriceChanges:false,requireSaleNote:false,allowNameChanges:false});
 check((await prefs(qaScope,{stockPolicy:{allowOutOfStock:true}})).stockPolicy,{allowOutOfStock:true});
 check((await prefs(qaScope,{viewMode:'table'})).stockPolicy,{allowOutOfStock:true});
 for(const stockPolicy of [null,[],true,{allowOutOfStock:'true'},{allowOutOfStock:null},{allowOutOfStock:1},{sell:true},{allowOutOfStock:true,actorId:id(9)}])await denied(()=>prefs(qaScope,{stockPolicy}),/INVALID/);
 check((await prefs(qaScope,{stockPolicy:{allowOutOfStock:false}})).stockPolicy,{allowOutOfStock:false});
 const serverStockPolicy=async selected=>(await db.query('select public.totus_tpv_stock_policy($1::jsonb) result',[JSON.stringify(selected)])).rows[0].result;
 await denied(()=>serverStockPolicy(qaScope),/permission denied/);await db.exec('reset role;set role service_role');check(await serverStockPolicy(qaScope),{allowOutOfStock:false});
 await denied(()=>serverStockPolicy({...qaScope,actorId:id(9)}),/FORBIDDEN|INVALID/);await db.exec('reset role;set role authenticated');
 await prefs(qaScope,{stockPolicy:{allowOutOfStock:true}});await db.exec('reset role;set role service_role');check(await serverStockPolicy(qaScope),{allowOutOfStock:true});
 await denied(()=>serverStockPolicy({...qaScope,drawerId:id(999)}),/FORBIDDEN|INVALID/);await db.exec('reset role;set role authenticated');await prefs(qaScope,{stockPolicy:{allowOutOfStock:false}});
 await asAdmin(`update private.totus_tpv_assignments set can_reconcile=false where connection_id='${qaConnection}' and actor_id='${id(5)}'`);check(await serverStockPolicy(qaScope),{allowOutOfStock:false});
 await db.exec('reset role;set role authenticated');await denied(()=>prefs(),/WORKSPACE_PREFERENCES_FORBIDDEN/);
 await asAdmin(`update private.totus_tpv_assignments set can_reconcile=true where connection_id='${qaConnection}' and actor_id='${id(5)}'`);await db.exec('reset role;set role authenticated');
 check((await prefs()).search,{fields:['reference','ean13','upc','name'],numericKeyboard:false});
 check((await prefs(qaScope,{search:{fields:['isbn'],numericKeyboard:true}})).search,{fields:['isbn'],numericKeyboard:true});
 check((await prefs(qaScope,{search:{numericKeyboard:false}})).search.fields,['isbn']);
 for(const fields of [[],['isbn','isbn'],['title'],[null],null,'isbn'])await denied(()=>prefs(qaScope,{search:{fields}}),/INVALID/);
 for(const numericKeyboard of ['true',null,4])await denied(()=>prefs(qaScope,{search:{numericKeyboard}}),/INVALID/);
 await denied(()=>prefs(qaScope,{search:{actorId:id(9)}}),/INVALID/);
 check((await prefs()).catalogue,{hideUnavailable:false,excludedCategories:[],extraDetails:false});
 check((await prefs(qaScope,{catalogue:{hideUnavailable:true,excludedCategories:[2,3],extraDetails:true}})).catalogue,{hideUnavailable:true,excludedCategories:[2,3],extraDetails:true});
 check((await prefs(qaScope,{catalogue:{excludedCategories:[]}})).catalogue.hideUnavailable,true);
 for(const excludedCategories of [[0],[-1],['2'],[2.1],[2147483648],[2,2],null,'2',Array.from({length:101},(_,n)=>n+1)])await denied(()=>prefs(qaScope,{catalogue:{excludedCategories}}),/INVALID/);
 for(const hideUnavailable of ['true',4,null])await denied(()=>prefs(qaScope,{catalogue:{hideUnavailable}}),/INVALID/);
 await denied(()=>prefs(qaScope,{catalogue:{extraDetails:'true'}}),/INVALID/);await denied(()=>prefs(qaScope,{catalogue:{includeDisabled:true}}),/INVALID/);
 await denied(()=>prefs(qaScope,{display:{canChangeTax:true}}),/INVALID/);
 await denied(()=>prefs(qaScope,{display:null}),/INVALID/);
 check((await prefs(qaScope,{receipt:{title:'Mi justificante',footer:'Gracias\nHasta pronto',fontSize:14,fontFamily:'monospace',showReferences:false}})).receipt.fontSize,14);
 check((await prefs(qaScope,{viewMode:'grid'})).receipt.footer,'Gracias\nHasta pronto');
 check((await prefs(qaScope,{receipt:{showDate:false}})).receipt.title,'Mi justificante');
 check((await prefs()).receipt.showReferences,false);
 for(const key of ['showOriginalPrice','showLineDiscount','includeLineDiscountsInTotal']){check((await prefs()).receipt[key],false);check((await prefs(qaScope,{receipt:{[key]:true}})).receipt[key],true);check((await prefs(qaScope,{viewMode:'grid'})).receipt[key],true);for(const value of ['true',1,null])await denied(()=>prefs(qaScope,{receipt:{[key]:value}}),/INVALID/);check((await prefs(qaScope,{receipt:{[key]:false}})).receipt[key],false);}

 check((await prefs()).receipt.showLogo,true);
 check((await prefs()).receipt.showBarcode,false);
 for(const key of ['showUnitPrice','showLineTax','showOperator','showWebsite']){
  check((await prefs()).receipt[key],false);
  check((await prefs(qaScope,{receipt:{[key]:true}})).receipt[key],true);
  await denied(()=>prefs(qaScope,{receipt:{[key]:'true'}}),/INVALID/);
 }
 check((await prefs(qaScope,{receipt:{showBarcode:true}})).receipt.showBarcode,true);
 await denied(()=>prefs(qaScope,{receipt:{showBarcode:'true'}}),/INVALID/);
 check((await prefs(qaScope,{receipt:{showLogo:false}})).receipt.showLogo,false);
 await denied(()=>prefs(qaScope,{receipt:{showLogo:'true'}}),/INVALID/);
 check((await prefs()).receipt.showOrderReference,true);
 check((await prefs(qaScope,{receipt:{showOrderReference:false,numberLines:true}})).receipt.numberLines,true);
 check((await prefs()).receipt.showOrderReference,false);
 await denied(()=>prefs(qaScope,{receipt:{numberLines:1}}),/INVALID/);
 check((await prefs()).receipt.showCustomer,false);
 for(const option of ['showAfterSale','printAfterSale']){
  check((await prefs()).receipt[option],false);
  check((await prefs(qaScope,{receipt:{[option]:true}})).receipt[option],true);
  await denied(()=>prefs(qaScope,{receipt:{[option]:'true'}}),/INVALID/);
 }
 for(const option of ['showCustomer','showCustomerPhone','showCustomerEmail','showAddressComment','showDeliveryAddress','showCustomerCompany']){
  check((await prefs(qaScope,{receipt:{[option]:true}})).receipt[option],true);
  await denied(()=>prefs(qaScope,{receipt:{[option]:'true'}}),/INVALID/);
 }
 for(const receipt of [null,{unknown:true},{fontSize:'12'},{fontSize:12.5},{fontSize:17},{showDate:'false'},{title:''},{title:'x'.repeat(81)},
  {footer:'x'.repeat(501)},{fontFamily:'url(evil)'},{dateFormat:'injected'},{title:'Header\nInjected'}])await denied(()=>prefs(qaScope,{receipt}),/INVALID/);
 await denied(()=>prefs(qaScope,{columns:['name','name']}),/INVALID/);
 await denied(()=>prefs(qaScope,{columns:['photo']}),/INVALID/);
 await denied(()=>prefs(qaScope,{columns:['name','secret']}),/INVALID/);
 await denied(()=>prefs(qaScope,{sortField:'injected;drop'}),/INVALID/);
 await denied(()=>prefs(qaScope,{sortField:null}),/INVALID/);
 await denied(()=>prefs(qaScope,{columns:null}),/INVALID/);
 await denied(()=>prefs(qaScope,{viewMode:'bad',initialCategoryId:0}),/INVALID/);
 await db.exec(`set request.jwt.claim.sub='${id(9)}'`);await denied(()=>prefs(),/FORBIDDEN|ACCESS/);
 await denied(()=>prefs(qaScope,{customerDisplay:{enabled:true}}),/FORBIDDEN|ACCESS/);
 await db.exec('reset role');
 await db.exec('set role service_role');
 const stockRpc=async(name,args)=>{
  const signatures={totus_tpv_stock_receipts:['p_action','p_id','p_scope','p_data'],totus_tpv_native_command:['p_action','p_id','p_scope','p_data']};
  const keys=signatures[name];assert(keys,'Only the expected stock journal may be called');
  try{return {data:(await db.query(`select public.${name}($1,$2::uuid,$3::jsonb,$4::jsonb) result`,
   keys.map(key=>typeof args[key]==='object'&&args[key]!==null?JSON.stringify(args[key]):args[key]))).rows[0].result};}
  catch(error){return {error:{message:error.message}};}
 };
 let stockPosts=0,stockReadLost=true;const stockResults=new Map();
 const stockNative=createNativeRequestService({scope:historicalScope,rpc:stockRpc,transport:{
  async nativeCommand({operationId,payload}){stockPosts++;stockResults.set(operationId,{verified:true,native_reference:7000+stockPosts,
   stock_movement_id:7000+stockPosts,shop_id:1,product_id:payload.product_id,attribute_id:payload.attribute_id,quantity:payload.quantity,before:4,after:4+payload.quantity});},
  async readNativeOperation(operationId){if(stockReadLost){stockReadLost=false;throw Error('Lost read response');}
   return {operation_id:operationId,status:'verified',result:stockResults.get(operationId)};}
 }});
 const stockReceipts=createStockReceiptService({rpc:stockRpc,nativeRequests:stockNative,scope:historicalScope});
 const stockPayload={reason:'Albarán QA aislado',lines:[{productId:101,attributeId:0,quantity:2,label:'Artículo uno'},
  {productId:102,attributeId:3,quantity:1,label:'Variante dos'}]};
 const stockCreated=await stockReceipts.create(id(401),stockPayload);
 check(stockCreated.status,'pending');check(stockPosts,0);
 check((await stockReceipts.create(id(401),stockPayload)).lines[0].operationId,stockCreated.lines[0].operationId);
 await denied(()=>stockReceipts.create(id(401),{...stockPayload,reason:'Distinto'}),/ALREADY_BOUND/);
 await denied(()=>stockReceipts.create(id(402),{...stockPayload,lines:[stockPayload.lines[0],stockPayload.lines[0]]}),/DUPLICATE_PRODUCT/);
 await denied(()=>stockReceipts.create(id(402),{...stockPayload,lines:[{...stockPayload.lines[0],quantity:0}]}),/INVALID/);
 await denied(()=>stockReceipts.create(id(402),{...stockPayload,lines:[{...stockPayload.lines[0],quantity:1.5}]}),/INVALID/);
 await denied(()=>stockReceipts.create(id(402),{...stockPayload,lines:[{...stockPayload.lines[0],productId:'101'}]}),/INVALID/);
 await denied(()=>asAdmin(`update private.totus_tpv_sessions set status='closed' where id='${historicalScope.sessionId}';`),/STOCK_RECEIPT_PENDING/);
 await db.exec('reset role;set role service_role');
 check((await stockReceipts.advance(id(401))).lines[0].status,'uncertain');check(stockPosts,1);
 await denied(()=>stockReceipts.cancel(id(401)),/STARTED/);
 check((await stockReceipts.advance(id(401))).lines[0].status,'verified');check(stockPosts,1);
 check((await stockReceipts.advance(id(401))).status,'verified');check(stockPosts,2);
 check((await stockReceipts.advance(id(401))).status,'verified');check(stockPosts,2);
 check((await stockReceipts.list()).length,1);
 await stockReceipts.create(id(403),stockPayload);check((await stockReceipts.cancel(id(403))).status,'cancelled');
 check((await stockReceipts.advance(id(403))).status,'cancelled');check(stockPosts,2);
 const wrongStock=createStockReceiptService({rpc:stockRpc,nativeRequests:stockNative,scope:{...historicalScope,actorId:id(9)}});
 await denied(()=>wrongStock.get(id(401)),/FORBIDDEN|ASSIGNMENT/);
 for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);
  await denied(()=>db.query('select public.totus_tpv_stock_receipts($1,$2::uuid,$3::jsonb,$4::jsonb)',
   ['list',null,JSON.stringify(historicalScope),'{}']),/permission denied/);
  await denied(()=>stockReceipts.list(),/TPV_STORAGE_UNAVAILABLE/);}
 await db.exec('reset role');

 await db.exec('set role service_role');
 const accessList=async(actor=id(5),revision=1)=>(await db.query('select public.totus_tpv_workstation_access($1,$2,$3) result',[actor,qaConnection,revision])).rows[0].result;
 const accessChange=async(request,data,actor=id(5))=>(await db.query('select public.totus_tpv_update_workstation_access($1,$2,1,$3,$4::jsonb) result',[actor,qaConnection,request,JSON.stringify(data)])).rows[0].result;
 const accessRow=async()=>(await accessList()).items.find(row=>row.operatorId===id(5)&&row.drawerId===id(3)&&row.shopId===1);
 await denied(()=>accessList(id(9)),/CONFIGURATION_FORBIDDEN/);await denied(()=>accessList(id(5),99),/CONTEXT_STALE/);
 let access=await accessRow();check(access.permissions,{sell:true,open:true,reconcile:true});
 const accessData=(permissions,active=true)=>({operatorId:id(5),drawerId:id(3),shopId:1,expectedRevision:access.revision,permissions,active});
 const observer={sell:false,open:false,reconcile:true},cashManager={sell:false,open:true,reconcile:true};
 const originalAccess=accessData(observer),readOnly=await accessChange(id(501),originalAccess);check(readOnly.revision,access.revision+1);
 check(await accessChange(id(501),originalAccess),readOnly);check((await db.query('select count(*)::int n from private.totus_tpv_access_changes')).rows[0].n,1);
 await denied(()=>accessChange(id(501),{...originalAccess,active:false}),/ALREADY_BOUND/);
 await denied(()=>accessChange(id(502),originalAccess),/ACCESS_CHANGED/);
 access=await accessRow();await db.exec('reset role');await db.query('update private.totus_tpv_assignments set can_sell=true where connection_id=$1 and actor_id=$2',[qaConnection,id(5)]);await db.exec('set role service_role');
 await denied(()=>accessChange(id(503),accessData(observer)),/ACCESS_CHANGED/);access=await accessRow();
 await accessChange(id(504),accessData(observer));access=await accessRow();
 await db.exec('reset role;set role authenticated');await db.exec(`set request.jwt.claim.sub='${id(5)}'`);
 check((await prefs()).stockPolicy,{allowOutOfStock:false});await denied(()=>prefs(qaScope,{stockPolicy:{allowOutOfStock:true}}),/STOCK_POLICY_FORBIDDEN/);
 check((await prefs(qaScope,{viewMode:'table'})).stockPolicy,{allowOutOfStock:false});await db.exec('reset role;set role service_role');
 check((await cash('summary',id(505),{},qaScope)).status,'open');
 check((await lookup({...qaScope,sessionId:undefined},911))[0].orderId,911);
 await denied(()=>lookup({...qaScope,sessionId:undefined,storeId:id(22)},911),/ASSIGNMENT_OR_CONNECTION_INVALID/);
 await denied(()=>lookup({...qaScope,sessionId:undefined,currency:'USD'},911),/ASSIGNMENT_OR_CONNECTION_INVALID/);
 check((await db.query('select public.totus_tpv_check($1::jsonb,$2) result',[JSON.stringify(historicalScope),'sell'])).rows[0].result,true);

 await denied(()=>journal('prepare',id(506),{expected:expected(1999),quoteExpiresAt:Date.now()+60000},qaScope),/ACTION_FORBIDDEN/);
 await denied(()=>serverStockPolicy(qaScope),/ACTION_FORBIDDEN/);
 await denied(()=>cash('movement',id(507),{kind:'cash-in',amountCents:100,reason:'Solo consulta'},qaScope),/ACTION_FORBIDDEN/);
 await denied(()=>cash('close',id(508),{countedCents:0,note:'Solo consulta'},qaScope),/ACTION_FORBIDDEN/);
 await accessChange(id(509),accessData(cashManager));access=await accessRow();
 const cashInput={kind:'cash-in',amountCents:100,reason:'Gestión de caja sin permiso de venta'};
 const managed=await cash('movement',id(510),cashInput,qaScope);check(managed.status,'open');
 await denied(()=>journal('prepare',id(511),{expected:expected(1999),quoteExpiresAt:Date.now()+60000},qaScope),/ACTION_FORBIDDEN/);
 await accessChange(id(512),accessData(observer));access=await accessRow();
 check((await cash('movement',id(510),cashInput,qaScope)).expectedCashCents,managed.expectedCashCents);
 check((await db.query('select count(*)::int n from private.totus_tpv_cash_movements where id=$1',[id(510)])).rows[0].n,1);
 await denied(()=>cash('movement',id(513),cashInput,qaScope),/ACTION_FORBIDDEN/);
 await accessChange(id(514),accessData(cashManager));access=await accessRow();
 const closeInput={countedCents:managed.expectedCashCents,note:'Cierre por responsable de caja'};
 check((await cash('close',id(515),closeInput,qaScope)).status,'closed');
 await accessChange(id(516),accessData(observer));access=await accessRow();
 check((await cash('close',id(515),closeInput,qaScope)).status,'closed');
 await accessChange(id(517),accessData(observer,false));access=await accessRow();check(access.active,false);
 await denied(()=>cash('summary',id(518),{},qaScope),/ASSIGNMENT_OR_CONNECTION_INVALID/);
 await denied(()=>accessChange(id(519),{...accessData(observer),permissions:{...observer,reconcile:false}}),/ACCESS_REQUEST_INVALID/);
 await denied(()=>accessChange(id(519),{...accessData(observer),active:'true'}),/ACCESS_REQUEST_INVALID/);
 await denied(()=>accessChange(id(519),{...accessData(observer),actorId:id(9)}),/ACCESS_REQUEST_INVALID/);
 await accessChange(id(520),accessData(observer));access=await accessRow();check(access.active,true);
 check((await accessChange(id(501),originalAccess)).revision,readOnly.revision);check((await accessRow()).revision,access.revision,'Readback of an old request cannot restore obsolete permissions');
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);
  await denied(()=>accessList(),/permission denied/);await denied(()=>accessChange(id(521),accessData(observer)),/permission denied/);
  await denied(()=>db.query('select * from private.totus_tpv_access_changes'),/permission denied/);}
 await db.exec('reset role;set role service_role');
 await denied(()=>db.query('update private.totus_tpv_access_changes set reply=reply'),/permission denied/);
 await denied(()=>db.query('delete from private.totus_tpv_access_changes'),/permission denied/);
 await db.exec('reset role');
 // Product workflows retain their own source and confirmed steps. The common
 // product writer is tested separately; this block tests actual SQL guards.
 await asAdmin(`update private.totus_tpv_assignments set can_sell=true,can_open=true,can_reconcile=true,active=true
  where actor_id='${id(5)}' and connection_id='${qaConnection}';`);
 const productScope={...qaScope,sessionId:id(601)},productReadScope={...productScope};delete productReadScope.sessionId;
 await journal('open',id(601),{openingCents:0},productScope);
 const intake=async(action,request,data={},selected=productScope)=>(await db.query('select public.totus_tpv_product_intake($1,$2,$3::jsonb,$4::jsonb) result',
  [action,request,JSON.stringify(selected),JSON.stringify(data)])).rows[0].result;
 const productDraft=productIntakeDraft({name:'Artículo ficticio',reference:'LAB-PRODUCT-001',categoryId:'2',price:'12.50',cost:'6',quantity:4});
 const intakeData={manifestHash:'b'.repeat(64),payload:productDraft,basePayload:productIntakeBase(productDraft,['1']),baseFingerprint:'a'.repeat(64),plan:productIntakePlan(productDraft)};
 let product=await intake('create',id(610),intakeData);check(product.status,'ready');check(product.currentStep,0);check(product.steps.map(row=>row.status),['pending','pending','pending']);
 check((await intake('create',id(610),intakeData)).version,1);
 await denied(()=>intake('create',id(610),{...intakeData,payload:{...productDraft,price:'1.000000'}}),/ALREADY_BOUND/);
 await denied(()=>intake('create',id(611),{...intakeData,plan:[{kind:'finish',key:'finish',label:'Fin'}]}),/INVALID/);
 await denied(()=>intake('create',id(611),{...intakeData,actorId:id(9)}),/INVALID/);
 await denied(()=>intake('get',id(610),{}, {...productReadScope,shopId:2}),/ASSIGNMENT|INVALID/);
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);
  await denied(()=>intake('get',id(610)),/permission denied/);await denied(()=>db.query('select * from private.totus_tpv_product_intakes'),/permission denied/);}
 await db.exec('reset role;set role service_role');
 const startedProduct=await intake('start',id(610),{token:id(612)});check(startedProduct.status,'processing');
 check((await intake('start',id(610),{token:id(613)})).busy,true);
 check((await intake('verified',id(610),{token:id(613),stepKey:'base',recordId:'101'})).superseded,true);
 await denied(()=>intake('verified',id(610),{token:id(612),stepKey:'finish',recordId:'101'}),/STEP_CHANGED/);
 product=await intake('verified',id(610),{token:id(612),stepKey:'base',recordId:'101'});check(product.currentStep,1);check(product.steps[0].recordId,'101');
 check((await intake('failed',id(610),{token:id(612),stepKey:'base',code:'TPV_PRODUCT_STEP_UNCERTAIN'})).superseded,true);
 check((await intake('create',id(610),intakeData)).steps[0].status,'verified');
 await denied(()=>intake('cancel',id(610)),/RECONCILIATION_REQUIRED/);
 await cash('close',id(614),{countedCents:0,note:'Caja cerrada con alta de producto pendiente'},productScope);
 check((await intake('get',id(610),{},productReadScope)).currentStep,1);
 await denied(()=>intake('start',id(610),{token:id(615)}),/CASH_SESSION_MISMATCH/);
 productScope.sessionId=id(616);await journal('open',id(616),{openingCents:0},productScope);
 product=await intake('start',id(610),{token:id(617)});check(product.currentStep,1);
 await asAdmin(`update private.totus_tpv_product_intakes set lease_until=clock_timestamp()-interval '1 second' where id='${id(610)}';`);
 check((await intake('start',id(610),{token:id(618)})).leaseToken,id(618));
 check((await intake('verified',id(610),{token:id(617),stepKey:'stock-main',recordId:'301'})).superseded,true);
 await denied(()=>intake('failed',id(610),{token:id(618),stepKey:'stock-main'}),/RESULT_INVALID/);
 product=await intake('failed',id(610),{token:id(618),stepKey:'stock-main',code:'TPV_PRODUCT_STEP_UNCERTAIN'});check(product.status,'attention');check(product.currentStep,1);
 await intake('start',id(610),{token:id(619)});
 product=await intake('verified',id(610),{token:id(619),stepKey:'stock-main',recordId:'301'});check(product.currentStep,2);
 await intake('start',id(610),{token:id(620)});
 product=await intake('verified',id(610),{token:id(620),stepKey:'finish',recordId:'101'});check(product.status,'completed');check(product.steps.every(step=>step.status==='verified'),true);
 check((await intake('start',id(610),{token:id(621)})).version,product.version);
 await denied(()=>intake('cancel',id(610)),/RECONCILIATION_REQUIRED/);
 await intake('create',id(630),intakeData);const cancelledProduct=await intake('cancel',id(630));check(cancelledProduct.status,'cancelled');
 check((await intake('cancel',id(630))).version,cancelledProduct.version);check((await intake('start',id(630),{token:id(631)})).status,'cancelled');
 for(let n=700;n<800;n++)await intake('create',id(n),intakeData);
 const unfinishedProducts=await intake('list',null,{},productReadScope);check(unfinishedProducts.length,100);check(unfinishedProducts.every(row=>row.status==='ready'),true,'Pending work is never hidden behind completed history');
 await denied(()=>intake('create',id(800),intakeData),/ACTIVE_LIMIT/);check((await intake('create',id(700),intakeData)).status,'ready');
 await intake('cancel',id(700));check((await intake('create',id(800),intakeData)).status,'ready');
 const categoryData={kind:'category',payload:{name:'Categoría ficticia',parentId:'2'},payloadHash:'c'.repeat(64),fingerprint:'d'.repeat(64)};
 const category=async(action,request,data={},selected=productScope)=>(await db.query('select public.totus_tpv_catalogue_intake($1,$2,$3::jsonb,$4::jsonb) result',
  [action,request,JSON.stringify(selected),JSON.stringify(data)])).rows[0].result;
 let categoryRow=await category('create',id(900),categoryData);check(categoryRow.status,'ready');check(categoryRow.payload,categoryData.payload);
 check((await category('create',id(900),categoryData)).version,1);
 await denied(()=>category('create',id(900),{...categoryData,payload:{name:'Otra',parentId:'2'}}),/BOUND/);
 for(const payload of [{name:'',parentId:'2'},{name:'<script>',parentId:'2'},{name:'Prueba',parentId:'all'},{name:'Prueba',parentId:2},{name:'Prueba',parentId:'2',shopId:2}])
  await denied(()=>category('create',id(901),{...categoryData,payload}),/INVALID/);
 await denied(()=>category(null,id(900)),/INVALID/);
 await denied(()=>category('create',id(901),{...categoryData,actorId:id(9)}),/INVALID/);
 await denied(()=>category('get',id(900),{}, {...productReadScope,shopId:2}),/ASSIGNMENT|INVALID/);
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await denied(()=>category('get',id(900)),/permission denied/);
  await denied(()=>db.query('select * from private.totus_tpv_catalogue_intakes'),/permission denied/);}
 await db.exec('reset role;set role service_role');
 check((await category('start',id(900),{token:id(902)})).leaseToken,id(902));check((await category('start',id(900),{token:id(903)})).busy,true);
 check((await category('verified',id(900),{token:id(903),recordId:'42'})).superseded,true);
 await denied(()=>category('verified',id(900),{token:id(902),recordId:'0'}),/RESULT_INVALID/);
 categoryRow=await category('failed',id(900),{token:id(902),code:'TPV_CATALOGUE_INTENT_UNCERTAIN'});check(categoryRow.status,'attention');
 await cash('close',id(915),{countedCents:0,note:'Cierre con categoría pendiente'},productScope);
 check((await category('get',id(900),{},productReadScope)).status,'attention');
 await denied(()=>category('start',id(900),{token:id(917)}),/CASH_SESSION_MISMATCH/);
 productScope.sessionId=id(916);await journal('open',id(916),{openingCents:0},productScope);
 await category('start',id(900),{token:id(918)});
 await asAdmin(`update private.totus_tpv_catalogue_intakes set lease_until=clock_timestamp()-interval '1 second' where id='${id(900)}';`);
 check((await category('start',id(900),{token:id(919)})).leaseToken,id(919));
 check((await category('failed',id(900),{token:id(918),code:'TPV_CATALOGUE_INTENT_UNCERTAIN'})).superseded,true);
 categoryRow=await category('verified',id(900),{token:id(919),recordId:'42'});check(categoryRow.status,'completed');check(categoryRow.recordId,'42');
 check((await category('start',id(900),{token:id(920)})).version,categoryRow.version);
 await denied(()=>category('cancel',id(900)),/REVIEW_REQUIRED/);
 await category('create',id(901),categoryData);const cancelledCategory=await category('cancel',id(901));check(cancelledCategory.status,'cancelled');
 check((await category('cancel',id(901))).version,cancelledCategory.version);
 for(let n=950;n<1050;n++)await category('create',id(n),categoryData);
 check((await category('list',null,{},productReadScope)).length,100);
 await denied(()=>category('create',id(1050),categoryData),/INTENT_LIMIT/);check((await category('create',id(950),categoryData)).status,'ready');
 await category('cancel',id(950));check((await category('create',id(1050),categoryData)).status,'ready');
 const directoryData={actor_id:productScope.actorId,connection_id:productScope.connectionId,revision:productScope.connectionRevision,resource:'categories',operation:'create',
  signature:'a'.repeat(64),scope_hash:'b'.repeat(64),baseline_ids:[]};
 const dir=async(action,data=directoryData)=>(await db.query('select public.totus_directory_operation($1,$2,$3::jsonb) result',[action,id(940),JSON.stringify(data)])).rows[0].result;
 check(await dir('lookup'),null);check((await dir('claim')).status,'claimed');check((await dir('complete',{...directoryData,record_id:'42'})).status,'completed');
 check((await dir('lookup')).record_id,42);await denied(()=>dir('lookup',{...directoryData,actor_id:id(9)}),/otra operación|identidad/);
 await db.query('select public.totus_directory_operation($1,$2,$3::jsonb)',['claim',id(1050),JSON.stringify({...directoryData,scope_hash:'e'.repeat(64)})]);
 await denied(()=>category('cancel',id(1050)),/REVIEW_REQUIRED/);
 await denied(()=>db.query('delete from private.totus_tpv_catalogue_intakes'),/permission denied/);
 await asAdmin(`create or replace function private.totus_module_can(email text,module text,action text) returns boolean language sql stable
  as $$select exists(select 1 from public.profiles p where p.email=$1 and p.active and p.role='admin') and not($2='productos' and $3='create')$$;`);
 await denied(()=>intake('start',id(800),{token:id(801)}),/PRODUCT_FORBIDDEN/);check((await intake('get',id(800),{},productReadScope)).status,'ready');
 await denied(()=>category('start',id(1050),{token:id(1051)}),/PRODUCT_FORBIDDEN/);check((await category('get',id(1050),{},productReadScope)).status,'ready');
 await denied(()=>db.query('delete from private.totus_tpv_product_intakes'),/permission denied/);
 await db.exec('reset role');
 console.log(`PASS TotusTPV PostgreSQL journal: ${assertions} assertions; real SQL transactions/constraints/roles in isolated PGlite. No remote database or PrestaShop writes.`);
 await exerciseCentralCashLedger({db,id,scope:draftScope,closedSession:draftScope.sessionId,otherSession:qaScope.sessionId});
} finally {await db.close();}
