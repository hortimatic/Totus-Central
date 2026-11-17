import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite(),id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const scope={actorId:id(5),connectionId:id(1),connectionRevision:1,storeId:id(2),shopId:1,drawerId:id(3),sessionId:id(4),currency:'EUR',environment:'qa'};
let checks=0;const check=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
const denied=async(fn,pattern)=>{await assert.rejects(fn,pattern);checks++;};
async function admin(sql,values){await db.exec('reset role');try{return values?await db.query(sql,values):await db.exec(sql);}finally{await db.exec('set role service_role');}}
const prefs=async(value=null)=>(await db.query('select public.totus_tpv_workspace_preferences($1,$2,$3,$4::jsonb) result',[scope.connectionId,scope.shopId,scope.drawerId,value===null?null:JSON.stringify(value)])).rows[0].result;
async function configure(value){await db.exec('reset role;set role authenticated');try{return await prefs(value);}finally{await db.exec('reset role;set role service_role');}}
const draft=async(action,ticket,request,data={},selected=scope)=>(await db.query('select public.totus_tpv_drafts($1,$2,$3,$4::jsonb,$5::jsonb) result',[action,ticket,request,JSON.stringify(selected),JSON.stringify(data)])).rows[0].result;
const policy=async(selected=scope)=>(await db.query('select public.totus_tpv_parking_policy($1::jsonb) result',[JSON.stringify(selected)])).rows[0].result;
const journal=async(action,operation,data={})=>(await db.query('select public.totus_tpv_journal($1,$2,$3::jsonb,$4::jsonb) result',[action,operation,JSON.stringify(scope),JSON.stringify(data)])).rows[0].result;
const expected=(ticket,cart)=>({storeId:scope.storeId,shopId:1,cartId:cart,currency:'EUR',paymentModule:'native_cash',customerId:501,invoiceAddressId:601,deliveryAddressId:601,currencyId:1,totalCents:801,shippingCents:0,nativePaymentLabels:{cash:'Efectivo',card:'Tarjeta'},paidStateIds:[11],draftId:ticket.id,draftVersion:ticket.version,lines:[{productId:101,attributeId:0,qty:1,unitTaxInclCents:801,unitTaxExclCents:662,stockBefore:5}]});
const payload={lines:[{productId:101,attributeId:0,qty:1,label:'Artículo ficticio',discount:{kind:'price',value:725}}]};
const expire=async ticket=>admin("update private.totus_tpv_drafts set created_at=clock_timestamp()-interval '2 days',expires_at=clock_timestamp()-interval '1 second' where id=$1",[ticket]);
try{
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

 for(const file of ["../supabase/migrations/20261115182617_totustpv_durable_checkout.sql","../supabase/migrations/20261116110935_totustpv_cash_sessions.sql","../supabase/migrations/20261116111537_totustpv_qa_workstation.sql","../supabase/migrations/20261116112315_totustpv_native_command_journal.sql","../supabase/migrations/20261116114831_totustpv_refund_ledger.sql","../supabase/migrations/20261116123633_totustpv_session_history.sql","../supabase/migrations/20261116135126_totustpv_parked_tickets.sql","../supabase/migrations/20261116142221_totustpv_order_lookup.sql","../supabase/migrations/20261116150203_totustpv_cash_reports.sql","../supabase/migrations/20261116172741_totustpv_server_permission_helper.sql","../supabase/migrations/20261116175354_totustpv_failed_sale_review.sql","../supabase/migrations/20261116180903_totustpv_workspace_preferences.sql","../supabase/migrations/20261116192744_totustpv_stock_receipts.sql","../supabase/migrations/20261116205052_totustpv_catalogue_layout.sql","../supabase/migrations/20261117021112_totustpv_workstation_access.sql","../supabase/migrations/20261117031559_totustpv_customer_display.sql","../supabase/migrations/20261117052454_totustpv_product_intake.sql","../supabase/migrations/20261117093928_totustpv_cash_counting.sql","native-lab/directory-journal.sql","../supabase/migrations/20261117100653_totustpv_catalogue_helpers.sql","../supabase/migrations/20261117104005_totustpv_catalogue_tax_display.sql","../supabase/migrations/20261117105231_totustpv_search_preferences.sql","../supabase/migrations/20261117111400_totustpv_catalogue_filters.sql","../supabase/migrations/20261117123814_totustpv_variant_order.sql","../supabase/migrations/20261117125500_totustpv_stock_policy.sql","../supabase/migrations/20261117143621_totustpv_quantity_picker.sql","../supabase/migrations/20261117145654_totustpv_line_price_options.sql","../supabase/migrations/20261117152204_totustpv_parking_expiry.sql"])await db.exec(await readFile(new URL(file,import.meta.url),'utf8'));
 await db.exec(`insert into private.totus_tpv_assignments(actor_id,connection_id,website_key,store_id,shop_id,drawer_id,can_sell,can_reconcile,can_open) values('${id(5)}','${id(1)}','test-store','${id(2)}',1,'${id(3)}',true,true,true);
 insert into private.totus_tpv_native_profiles(connection_id,shop_id,connection_revision,installation_id,store_id,website_key,profile,configured_by) values('${id(1)}',1,1,'${id(99)}','${id(2)}','test-store','{}','${id(5)}');
 set request.jwt.claim.sub='${id(5)}';set role service_role;`);
 check((await journal('open',id(4),{openingCents:10000})).status,'open');
 check(await policy(),{enabled:true,ttlDays:0});
 await db.exec('reset role;set role authenticated');await denied(()=>policy(),/permission denied/);check((await prefs()).parking,{enabled:true,ttlDays:0});await db.exec('reset role;set role service_role');
 for(const parking of [null,[],true,{enabled:'true'},{enabled:null},{ttlDays:'7'},{ttlDays:7.0+0.1},{ttlDays:2},{ttlDays:-1},{ttlDays:366},{ttlDays:null},{unknown:1}])await denied(()=>configure({parking}),/INVALID/);
 await configure({display:{requireQuantity:true},lineOptions:{allowPriceChanges:true},stockPolicy:{allowOutOfStock:true}});
 for(const ttlDays of [0,1,7,15,30,90,365])check((await configure({parking:{enabled:true,ttlDays}})).parking,{enabled:true,ttlDays});
 const preserved=await configure({parking:{ttlDays:0}});check(preserved.display.requireQuantity,true);check(preserved.lineOptions,{allowPriceChanges:true});check(preserved.stockPolicy,{allowOutOfStock:true});
 await denied(()=>policy({...scope,actorId:id(9)}),/FORBIDDEN/);await denied(()=>policy({...scope,drawerId:id(33)}),/INVALID|FORBIDDEN/);
 check((await db.query("select has_table_privilege('authenticated','private.totus_tpv_drafts','UPDATE') allowed")).rows[0].allowed,false);
 check((await db.query("select has_table_privilege('service_role','private.totus_tpv_workspace_preferences','SELECT') allowed")).rows[0].allowed,false);
 await admin(`update private.totus_tpv_assignments set can_reconcile=false where actor_id='${id(5)}'`);check(await policy(),{enabled:true,ttlDays:0});
 await db.exec('reset role;set role authenticated');await denied(()=>prefs(),/PREFERENCES_FORBIDDEN/);await db.exec('reset role;set role service_role');
 await admin(`update private.totus_tpv_assignments set can_reconcile=true,can_sell=false where actor_id='${id(5)}'`);await denied(()=>configure({parking:{enabled:false}}),/PARKING_FORBIDDEN/);await denied(()=>policy(),/ACTION_FORBIDDEN/);await admin(`update private.totus_tpv_assignments set can_sell=true where actor_id='${id(5)}'`);
 await admin(`create or replace function private.totus_module_can(email text,module text,action text) returns boolean language sql stable as $$select action<>'create' and exists(select 1 from public.profiles p where p.email=$1 and p.active and p.role='admin')$$`);
 await denied(()=>configure({parking:{enabled:false}}),/PARKING_FORBIDDEN/);await denied(()=>policy(),/SELL_FORBIDDEN/);
 await admin(`create or replace function private.totus_module_can(email text,module text,action text) returns boolean language sql stable as $$select exists(select 1 from public.profiles p where p.email=$1 and p.active and p.role='admin')$$`);

 const foreverData={version:0,label:'Siempre',payload};let forever=await draft('park',id(100),id(101),foreverData);check(forever.status,'parked');check(forever.expiresAt,null);check(forever.expired,false);check(forever.payload,payload);
 await configure({parking:{enabled:false,ttlDays:1}});await denied(()=>draft('park',id(102),id(103),{version:0,label:'No permitido',payload}),/PARKING_DISABLED/);
 check((await admin('select count(*)::int n from private.totus_tpv_drafts where id=$1',[id(102)])).rows[0].n,0);
 check(await draft('park',id(100),id(101),foreverData),forever);check((await draft('get',id(100),id(104))).id,id(100));check((await draft('list',null,id(105))).length,1);
 forever=await draft('claim',id(100),id(106),{version:forever.version});check(forever.status,'claimed');
 forever=await draft('bind',id(100),id(107),{version:forever.version,payload,checkoutId:id(108)});check(forever.status,'checkout');
 forever=await draft('release',id(100),id(109),{version:forever.version});check(forever.status,'claimed');
 forever=await draft('archive',id(100),id(110),{version:forever.version});check(forever.status,'archived');check((await draft('get',id(100),id(111))).payload,payload);

 await configure({parking:{enabled:true,ttlDays:1}});const dailyData={version:0,label:'Un día',payload};let daily=await draft('park',id(120),id(121),dailyData);check(daily.expired,false);
 check((await admin("select extract(epoch from expires_at-clock_timestamp()) between 86340 and 86460 valid from private.totus_tpv_drafts where id=$1",[daily.id])).rows[0].valid,true);
 await configure({parking:{ttlDays:30}});check((await draft('park',daily.id,id(121),dailyData)).expiresAt,daily.expiresAt);
 await expire(daily.id);daily=await draft('get',daily.id,id(122));check(daily.expired,true);check((await draft('list',null,id(123)))[0].expired,true);
 await denied(()=>draft('claim',daily.id,id(124),{version:daily.version}),/DRAFT_EXPIRED/);
 const replayExpired=await draft('park',daily.id,id(121),dailyData);check(replayExpired.version,daily.version);check(replayExpired.expiresAt,daily.expiresAt);
 await denied(()=>draft('claim',daily.id,id(125),{version:daily.version,expiresAt:null}),/DRAFT_EXPIRED/);
 daily=await draft('archive',daily.id,id(126),{version:daily.version});check(daily.status,'archived');check((await draft('get',daily.id,id(127))).payload,payload);

 let active=await draft('park',id(130),id(131),{version:0,label:'Reaparcar',payload});active=await draft('claim',active.id,id(132),{version:active.version});await expire(active.id);
 await denied(()=>draft('bind',active.id,id(133),{version:active.version,payload,checkoutId:id(134)}),/DRAFT_EXPIRED/);
 active=await draft('park',active.id,id(135),{version:active.version,label:'Nueva validez',payload});check(active.expired,false);check(active.status,'parked');check(active.payload,payload);
 await denied(()=>draft('get',active.id,id(136),{},{...scope,drawerId:id(33)}),/INVALID|MISMATCH/);
 await denied(()=>draft('park',id(137),id(138),{version:0,label:'Fecha falsa',payload,expiresAt:'2099-01-01T00:00:00Z'}),/REQUEST_INVALID/);

 const operationData=async(ticket,operation)=>{let d=await draft('park',ticket,id(Number(ticket.slice(-3))+1),{version:0,label:'Cobro',payload});d=await draft('claim',d.id,id(Number(ticket.slice(-3))+2),{version:d.version});return draft('bind',d.id,id(Number(ticket.slice(-3))+3),{version:d.version,payload,checkoutId:operation});};
 let checkout=await operationData(id(200),id(210)),price=expected(checkout,1200);await journal('prepare',id(210),{expected:price,quoteExpiresAt:Date.now()+60000});await expire(checkout.id);
 const payment=[{id:'cash',method:'cash',status:'settled',amountCents:801,receivedCents:1000}];
 await denied(()=>journal('claim',id(210),{revision:1,expected:price,payments:payment}),/DRAFT_EXPIRED/);check((await journal('get',id(210))).status,'ready');
 checkout=await operationData(id(220),id(230));price=expected(checkout,1220);await journal('prepare',id(230),{expected:price,quoteExpiresAt:Date.now()+60000});check((await journal('claim',id(230),{revision:1,expected:price,payments:payment})).won,true);await expire(checkout.id);
 const confirmed=await journal('confirm',id(230),{revision:1,orderId:2220,verification:{status:'confirmed',readbackVerified:true,orderId:2220}});check(confirmed.status,'confirmed');const sold=await draft('get',checkout.id,id(231));check(sold.status,'sold');check(sold.expired,false);check(sold.orderId,2220);
 check((await journal('confirm',id(230),{revision:1,orderId:2220,verification:{status:'confirmed',readbackVerified:true,orderId:2220}})).status,'confirmed');check((await draft('get',checkout.id,id(232))).version,sold.version);

 console.log('PASS parking expiry PostgreSQL: '+checks+' assertions on actual isolated SQL, roles, transactions, expiry and checkout/replay; no remote database or native shop.');
}finally{await db.close();}
