import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createPostgresCheckoutLedger} from '../src/totustpv/postgres-journal.js';
import {createCheckoutService} from '../src/totustpv/checkout-service.js';
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={actorId:id(5),connectionId:id(1),connectionRevision:1,storeId:id(2),shopId:1,
  drawerId:id(3),sessionId:id(4),currency:'EUR'};
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
 create role anon;create role authenticated;create role service_role;
 create table public.profiles(id uuid primary key,email text,active boolean,role text);
 create table public.ops_stores(id uuid primary key,active boolean);
 create table public.ops_cash_drawers(id uuid primary key,store_id uuid,active boolean);
 create table public.ops_daily_closings(id uuid primary key);
 create table private.totus_api_connections(id uuid primary key,revision bigint,verified_revision bigint,
   enabled boolean,real_data_authorized boolean,protocol text);
 create table private.totus_websites(key text primary key,connection_id uuid,business_id uuid,status text);
 create function private.totus_module_can(email text,module text,action text) returns boolean
 language sql stable as $$select exists(select 1 from public.profiles p where p.email=$1 and p.active and p.role='admin')$$;
 insert into public.profiles values('${id(5)}','operator@example.invalid',true,'admin'),('${id(9)}','denied@example.invalid',true,'employee');
 insert into public.ops_stores values('${id(2)}',true),('${id(22)}',true);
 insert into public.ops_cash_drawers values('${id(3)}','${id(2)}',true),('${id(33)}','${id(22)}',true);
 insert into private.totus_api_connections values('${id(1)}',1,1,true,true,'prestashop');
 insert into private.totus_websites values('test-store','${id(1)}','${id(2)}','active');
 `);
 await db.exec(await readFile(new URL('../supabase/migrations/20261115182617_totustpv_durable_checkout.sql',import.meta.url),'utf8'));
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
 await db.exec('reset role');
 const secured=await db.query(`select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='private' and c.relname in ('totus_tpv_assignments','totus_tpv_sessions','totus_tpv_operations','totus_tpv_payment_events') and c.relrowsecurity`);
 check(secured.rows[0].n,4);
 console.log(`PASS TotusTPV PostgreSQL journal: ${assertions} assertions; real SQL transactions/constraints/roles in isolated PGlite. No remote database or PrestaShop writes.`);
} finally {await db.close();}
