import {exerciseCentralBarcodes} from './barcode-central-flow.mjs';
import {exerciseReceiptVariants} from './receipt-variants-flow.mjs';
import {exercisePaymentReference} from './payment-reference-flow.mjs';
import {exercisePaymentReferenceBrowser} from './payment-reference-browser.mjs';
import {exerciseReceiptVariantsBrowser} from './receipt-variants-browser.mjs';
import {exercisePaymentSettingsBrowser} from './payment-settings-browser.mjs';
import {exerciseNativeLineName} from './line-name-flow.mjs';
import {exerciseDisabledStock} from './disabled-stock-flow.mjs';
import {exerciseDisabledStockBrowser} from './disabled-stock-browser.mjs';
import {exerciseCommercialBudget} from './commercial-budget-flow.mjs';
/** Actual handler + migrated PostgreSQL + native HTTP. Auth/secret lookup and
 * DNS delivery are explicit local fixtures; no remote endpoint is contacted.
 */
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createCentralTpvHandler} from '../../supabase/functions/totus-tpv/handler.js';
import {exerciseCentralBrowser} from './central-browser-flow.mjs';
import {loadProductJournal} from './product-journal.mjs';
import {exerciseProductIntake} from './product-intake-flow.mjs';
import {exerciseNativeProductBrowser} from './product-intake-browser.mjs';
import {exerciseNativeCashCountBrowser} from './cash-counting-browser.mjs';
import {exerciseNativeSearch} from './search-flow.mjs';
import {exerciseNativeSearchBrowser} from './search-browser.mjs';
import {exerciseNativeCatalogueFilters} from './catalogue-filter-flow.mjs';
import {exerciseNativeCatalogueFilterBrowser} from './catalogue-filter-browser.mjs';
import {exerciseNativeStockPolicy} from './stock-policy-flow.mjs';
import {exerciseNativeStockPolicyBrowser} from './stock-policy-browser.mjs';
import {exerciseNativeSaleNote} from './sale-note-flow.mjs';
import {exerciseNativeLinePrice} from './line-price-flow.mjs';
import {exerciseNativeLinePriceBrowser} from './line-price-browser.mjs';
import {exerciseNativeBillingBrowser} from './billing-browser.mjs';
import {exerciseNativeCentralCashBrowser} from './central-cash-browser.mjs';
export async function exerciseCentralEdge({fixture,profile,base,focus='complete',simulateCartAckLoss,simulateCataloguePriceChange,inspectCommercialCart,inspectDisabledStock,setExternalBarcode,changeCurrentBarcode}){
 const db=new PGlite(),actor=randomUUID(),store=randomUUID(),drawer=randomUUID(),session=randomUUID(),
  connection='b554f6cc-4df1-412b-b063-e1cbd82d9e66';let nativePosts=0,cartOptions=null,dropProductReply=false,dropProductAck=null;const paths=[];
 let dropBudgetConfirm=false,dropBudgetCreate=false,raceBudgetCreate=false,dropBarcodeComplete=false,dropReferenceSaleReply=false;
 try{
  await db.exec(`create schema private;create schema auth;create role anon;create role authenticated;create role service_role;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create table public.profiles(id uuid primary key,email text,active boolean,role text,full_name text default 'Operador original de la venta');
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
   insert into public.profiles(id,email,active,role) values('${actor}','edge-fixture@example.invalid',true,'admin');
   insert into public.team_members values('edge-fixture@example.invalid',true,'admin');
   insert into public.ops_stores values('${store}',true,'QA local');
   insert into public.ops_cash_drawers values('${drawer}','${store}',true,'Mostrador local');
   insert into private.totus_api_connections values('${connection}',5,5,true,true,'prestashop');
   insert into private.totus_websites values('qa-shop','${connection}',null,'active','https://preproduccion.hortimatic.com',false);`);
  for(const file of ['20261115182617_totustpv_durable_checkout.sql','20261116110935_totustpv_cash_sessions.sql',
   '20261116111537_totustpv_qa_workstation.sql','20261116112315_totustpv_native_command_journal.sql','20261116114831_totustpv_refund_ledger.sql','20261116123633_totustpv_session_history.sql','20261116135126_totustpv_parked_tickets.sql','20261116142221_totustpv_order_lookup.sql','20261116150203_totustpv_cash_reports.sql','20261116172741_totustpv_server_permission_helper.sql',
   '20261116175354_totustpv_failed_sale_review.sql','20261116180903_totustpv_workspace_preferences.sql',
   '20261116192744_totustpv_stock_receipts.sql','20261116205052_totustpv_catalogue_layout.sql','20261117021112_totustpv_workstation_access.sql','20261117031559_totustpv_customer_display.sql','20261117052454_totustpv_product_intake.sql','20261117093928_totustpv_cash_counting.sql'])
   await db.exec(await readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('directory-journal.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../../supabase/migrations/20261117100653_totustpv_catalogue_helpers.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../../supabase/migrations/20261117104005_totustpv_catalogue_tax_display.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../../supabase/migrations/20261117105231_totustpv_search_preferences.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../../supabase/migrations/20261117111400_totustpv_catalogue_filters.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../../supabase/migrations/20261117123814_totustpv_variant_order.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/20261117125500_totustpv_stock_policy.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/20261117143621_totustpv_quantity_picker.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/20261117145654_totustpv_line_price_options.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/20261117152204_totustpv_parking_expiry.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/20261117155256_totustpv_private_sale_note.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/20261117162118_totustpv_receipt_line_discounts.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/20261117170825_totustpv_temporary_line_names.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/20261117181754_totustpv_receipt_numbering.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/20261117191716_totustpv_commercial_budgets.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/20261117234736_totustpv_billing_bridge.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/20261118001954_totustpv_cash_report_drawer_scope.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/20261118002455_totustpv_central_cash_bridge.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/20261118020431_totustpv_disabled_stock_search.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/20261118023253_totustpv_tax_summary.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/20261118034019_totustpv_barcode_settings.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/20261118035905_totustpv_barcode_capture.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/20261118044052_totustpv_barcode_execution.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/20261118091942_totustpv_barcode_preserved_codes.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/20261118100416_totustpv_payment_settings.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/20261118103540_totustpv_receipt_variants.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/20261118110124_totustpv_payment_reference_options.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/20261118110722_totustpv_payment_reference_ledger.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/20261118112532_totustpv_receipt_payment_references.sql',import.meta.url),'utf8'));
  if(focus==='products')await loadProductJournal(db);
  await db.exec('set role service_role');
  await db.query('select public.totus_tpv_configure($1,$1,$2,5,$3,$4,$5,$6::jsonb,$7::jsonb)',
   [actor,connection,store,drawer,'qa-shop',JSON.stringify(profile),JSON.stringify({sell:true,open:true,reconcile:true})]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);
  const argsByRpc={totus_tpv_barcode_options:['p_connection','p_shop','p_drawer','p_settings'],totus_tpv_barcode_jobs:['p_action','p_id','p_scope','p_data'],totus_tpv_barcode_execution:['p_action','p_id','p_scope','p_data'],totus_tpv_central_cash_context:[],totus_tpv_central_cash_read:['p_selection','p_section','p_query'],totus_tpv_billing_context:[],totus_tpv_billing_read:['p_scope','p_sale','p_query'],totus_tpv_context:[],totus_tpv_stock_policy:['p_scope'],totus_tpv_line_options:['p_scope'],totus_tpv_cash_reports:['p_scope','p_session_id'],totus_tpv_orders:['p_scope','p_order_id','p_sale_id'],totus_tpv_history:['p_scope','p_before'],totus_tpv_check:['p_scope','p_action'],
   totus_tpv_journal:['p_action','p_operation_id','p_scope','p_data'],totus_tpv_cash:['p_action','p_request_id','p_scope','p_data'],
   totus_tpv_budgets:['p_action','p_scope','p_id','p_data'],totus_tpv_commercial_options:['p_scope'],totus_tpv_budget_checkout:['p_scope','p_id','p_version','p_action'],
   totus_tpv_native_command:['p_action','p_id','p_scope','p_data'],totus_tpv_sale_for_return:['p_scope','p_sale_id'],
   totus_tpv_refund_journal:['p_action','p_id','p_scope','p_data'],totus_directory_operation:['p_action','p_request_id','p_data'],
   totus_tpv_drafts:['p_action','p_id','p_request_id','p_scope','p_data'],
   totus_tpv_stock_receipts:['p_action','p_id','p_scope','p_data'],
   totus_tpv_product_intake:['p_action','p_id','p_scope','p_data'],
   totus_tpv_catalogue_intake:['p_action','p_id','p_scope','p_data'],
   totus_prestashop_product_create_journal:['p_action','p_request_id','p_data'],
   totus_prestashop_product_step:['p_action','p_request_id','p_stage','p_data'],
   totus_tpv_receipt_series:['p_connection','p_shop','p_drawer','p_settings'],totus_tpv_receipt_number:['p_scope','p_operation','p_kind'],totus_tpv_workspace_preferences:['p_connection','p_shop','p_drawer','p_preferences']};
  const factory=(url,key,options)=>({auth:{getUser:async()=>({data:{user:{id:actor}}})},rpc:async(name,args={})=>{
   if(name==='totus_tpv_payment_options'){
    assert.equal(key,'fixture-public');await db.exec('reset role;set role authenticated');
    try{return {data:(await db.query('select public.totus_tpv_payment_options($1,$2,$3,$4::jsonb) result',[args.p_connection,args.p_shop,args.p_drawer,args.p_options===null?null:JSON.stringify(args.p_options)])).rows[0].result};}catch(error){return {error:{message:error.message}};}
   }
   if(name==='totus_products_context'){assert.equal(key,'fixture-public');return {data:{connections:[{id:connection,revision:5}],websites:[{key:'qa-shop',connection_id:connection,origin:'https://preproduccion.hortimatic.com',status:'active',name:'QA local'}]}};}
   if(name==='totus_tpv_product_intake'&&args.p_action==='verified'&&args.p_data.stepKey===dropProductAck){dropProductAck=null;return {error:{message:'TPV_STORAGE_UNAVAILABLE'}};}
   if(name==='totus_directory_context'){assert.equal(key,'fixture-public');return {data:{connections:[{id:connection,revision:5}]}};}
   if(name==='totus_api_server')return {data:{id:connection,revision:5,verified_revision:5,enabled:true,real_data_authorized:true,
    protocol:'prestashop',endpoint:'https://preproduccion.hortimatic.com/api',auth_kind:'basic',secret:fixture.key}};
   if(name==='totus_api_call')return {data:{ok:true}};
   if(name==='totus_tpv_native_command'&&args.p_action==='complete'&&dropBarcodeComplete){dropBarcodeComplete=false;return {error:{message:'TPV_STORAGE_UNAVAILABLE'}};}
   if(name==='totus_tpv_journal'&&args.p_action==='confirm'&&dropBudgetConfirm){dropBudgetConfirm=false;return {error:{message:'TPV_STORAGE_UNAVAILABLE'}};}
   if(name==='totus_tpv_budgets'&&args.p_action==='create'&&dropBudgetCreate){dropBudgetCreate=false;return {error:{message:'TPV_BUDGET_STORAGE_UNAVAILABLE'}};}
   assert.ok(Object.hasOwn(argsByRpc,name),'Unexpected RPC '+name);
   await db.exec('reset role');await db.exec('set role '+(key==='fixture-secret'?'service_role':'authenticated'));
   try{const keys=argsByRpc[name],values=keys.map(k=>args[k]!==null&&typeof args[k]==='object'?JSON.stringify(args[k]):args[k]);
    const data=(await db.query(`select public.${name}(${keys.map((_,i)=>'$'+(i+1)).join(',')}) result`,values)).rows[0].result;
    if(name==='totus_tpv_budgets'&&args.p_action==='create'&&raceBudgetCreate){raceBudgetCreate=false;return {error:{message:'TPV_BUDGET_ALREADY_BOUND'}};}
    return {data};
   }catch(error){if(name==='totus_directory_operation')console.log('Local directory SQL diagnostic:',error.message);return {error:{message:error.message}};}
  }});
  const preferences=async(drawer,value)=>{
   const response=await factory('https://local-edge.invalid','fixture-public').rpc('totus_tpv_workspace_preferences',{
    p_connection:drawer.connectionId,p_shop:drawer.shopId,p_drawer:drawer.id,p_preferences:value??null});
   assert.equal(response.error,undefined,response.error?.message);return response.data;
  };
  await preferences({connectionId:connection,shopId:1,id:drawer},{customerDisplay:{enabled:true,showPrices:true,showCustomer:true,color:'#1773c9',fontSize:23},receipt:{showBarcode:true,showUnitPrice:true,showLineTax:true,showOperator:true,showWebsite:true,showCustomer:true,showCustomerPhone:true,showCustomerEmail:true,
   showAddressComment:true,showDeliveryAddress:true,showCustomerCompany:true}});
  const env={get:key=>({SUPABASE_URL:'https://local-edge.invalid',SUPABASE_ANON_KEY:'fixture-public',SUPABASE_SERVICE_ROLE_KEY:'fixture-secret',
   ...(focus==='products'?{TOTUS_PRESTASHOP_PRODUCT_CREATE_ENABLED:'1',TOTUS_PRESTASHOP_PRODUCT_STAGES_ENABLED:'1'}:{})}[key])};
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
   if(dropReferenceSaleReply&&init.method==='POST'&&target.pathname==='/api/totus_tpv_sales'&&response.ok){dropReferenceSaleReply=false;await response.body.cancel();throw Error('Synthetic lost external-reference sale response');}
   if(dropProductReply&&init.method==='POST'&&target.pathname==='/api/products'&&response.ok){dropProductReply=false;await response.body.cancel();throw Error('Synthetic lost native product response');}
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
   await exerciseCentralBrowser({handle,actor,productId:fixture.productId,reference:fixture.reference,focus,preferences,nativeWriteCount:()=>nativePosts,cashSessionCount:async()=>Number((await db.query('select count(*) n from private.totus_tpv_sessions where connection_id=$1 and drawer_id=$2',[connection,drawer])).rows[0].n)});
   if(focus==='customers')assert.equal(paths.filter(row=>row.method==='POST'&&row.path==='/api/totus_tpv_sales').length,0);
   return {focus,remoteShopTouched:false};
  }
  const selection={connectionId:connection,shopId:1,drawerId:drawer,sessionId:session};
  const call=async(body)=>{const response=await handle(new Request('https://central.local/tpv',{method:'POST',
   headers:{Authorization:'Bearer synthetic-auth-fixture','Content-Type':'application/json'},body:JSON.stringify(body)}));
   const result=await response.json();assert.equal(response.status,200,JSON.stringify({result,cartOptions}));return result;};
  if(focus==='barcodes')return await exerciseCentralBarcodes({call,handle,actor,setExternalCode:setExternalBarcode,changeCurrentCode:changeCurrentBarcode,fixtureProductId:fixture.productId,selection:{connectionId:connection,shopId:1,drawerId:drawer},db,paths,loseCompletion:()=>{dropBarcodeComplete=true;},nativeRead:async resource=>{
   const target=new URL(resource,base);target.searchParams.set('output_format','JSON');target.searchParams.set('id_shop','1');target.searchParams.set('display','full');const response=await fetch(target,{headers:{Authorization:'Basic '+Buffer.from(fixture.key+':').toString('base64')},redirect:'error'});assert.equal(response.status,200);return response.json();
  }});
  if(focus==='budgets')return await exerciseCommercialBudget({handle,call,selection,fixture,db,paths,inspectCommercialCart,actor,preferences,simulateBudgetConfirmLoss:()=>{dropBudgetConfirm=true;},simulateBudgetCreateFailure:()=>{dropBudgetCreate=true;},simulateBudgetCreateRace:()=>{raceBudgetCreate=true;}});
  await call({action:'open',selection:{connectionId:connection,shopId:1,drawerId:drawer},operationId:session,openingCents:10000});
  if(focus==='payment-reference'){
   const result=await exercisePaymentReference({call,handle,selection,fixture,db,paths,loseSaleReply:()=>{dropReferenceSaleReply=true;}});
   await exercisePaymentReferenceBrowser({handle,actor,preferences,fixture,paths});return result;
  }
  if(focus==='receipt-variants'){
   const result=await exerciseReceiptVariants({call,selection,fixture,rename:fixture.renameReceiptVariant,preferences});
   await exerciseReceiptVariantsBrowser({handle,actor,preferences,...result});return result;
  }
  if(focus==='payments'){
   const options=settings=>call({action:'payment-options',selection,operationId:randomUUID(),...(settings?{settings}:{})});
   await options({enabledMethods:['card'],labels:{card:'Datáfono'}});
   const prepare=async()=>{const operationId=randomUUID();return {operationId,result:await call({action:'prepare',selection,operationId,lines:[{productId:fixture.productId,attributeId:0,qty:1}]})};};
   const first=await prepare();assert.deepEqual(Object.keys(first.result.expected.operatorPaymentPolicy.modes),['card']);
   await options({enabledMethods:['card'],labels:{card:'Tarjeta en mostrador'}});
   const request=prepared=>({action:'submit',selection,operationId:prepared.operationId,payments:{allocations:[{id:'card',method:'card',amountCents:prepared.result.expected.totalCents}],confirmation:{accepted:true,operationId:prepared.operationId,totalCents:prepared.result.expected.totalCents,currency:'EUR'}}});
   const before=paths.filter(row=>row.method==='POST'&&row.path==='/api/totus_tpv_sales').length;
   const response=await handle(new Request('https://central.local/tpv',{method:'POST',headers:{Authorization:'Bearer synthetic-auth-fixture','Content-Type':'application/json'},body:JSON.stringify(request(first))}));
   assert.equal(response.status,400);assert.equal((await response.json()).error,'TPV_PAYMENT_POLICY_STALE');
   assert.equal(paths.filter(row=>row.method==='POST'&&row.path==='/api/totus_tpv_sales').length,before);
   const second=await prepare(),sold=await call(request(second));assert.equal(sold.status,'confirmed');
   assert.equal((await call({action:'cash-summary',selection,operationId:randomUUID()})).expectedCashCents,10000);
   console.log('PASS drawer payment policy: native quote, shared SQL settings, changed configuration refuses stale tender before native sale, fresh card-only sale confirmed and physical cash unchanged. Local HTTP only.');
   await exercisePaymentSettingsBrowser({handle,actor,preferences});
   return {focus,remoteShopTouched:false};
  }
  if(focus==='disabled-stock'){
   await exerciseDisabledStock({call,handle,selection,fixture,paths,inspect:inspectDisabledStock});
   return await exerciseDisabledStockBrowser({handle,actor,fixture,selection,preferences,inspect:inspectDisabledStock,paths});
  }
  if(['stock-policy','line-price','sale-note','line-name'].includes(focus)){
   const raw=async body=>{const response=await handle(new Request('https://central.local/tpv',{method:'POST',headers:{Authorization:'Bearer synthetic-auth-fixture','Content-Type':'application/json'},body:JSON.stringify(body)}));return {status:response.status,result:await response.json()};};
   const nativeRead=async resource=>{const target=new URL(resource,base);target.searchParams.set('output_format','JSON');target.searchParams.set('id_shop','1');if(!target.searchParams.has('display'))target.searchParams.set('display','full');const response=await fetch(target,{headers:{Authorization:'Basic '+Buffer.from(fixture.key+':').toString('base64')},redirect:'error'});assert.equal(response.status,200);return response.json();};
   if(focus==='line-name'){
    const numbering=async value=>{const response=await factory('https://local-edge.invalid','fixture-public').rpc('totus_tpv_receipt_series',{p_connection:connection,p_shop:1,p_drawer:drawer,p_settings:value??null});assert.equal(response.error,undefined,response.error?.message);return response.data;};
    await numbering({enabled:true,salePrefix:'V-',returnPrefix:'D-',lastSaleNumber:100,lastReturnNumber:50});
    return await exerciseNativeLineName({call,raw,selection,fixture,preferences,nativeRead,paths,numbering});
   }
   if(focus==='sale-note'){const backend=await exerciseNativeSaleNote({call,raw,selection,fixture,preferences,nativeRead,paths});const screen=await exerciseNativeLinePriceBrowser({handle,actor,fixture,preferences,selection,note:'Nota interna del equipo 🙂',salesCount:()=>paths.filter(row=>row.method==='POST'&&row.path==='/api/totus_tpv_sales').length});return {...backend,screen};}
   if(focus==='line-price'){const backend=await exerciseNativeLinePrice({call,raw,selection,fixture,preferences,nativeRead,paths,changeCataloguePrice:simulateCataloguePriceChange}),before=await nativeRead(`products?filter[id]=[${fixture.linePriceSetup.items.normal.id}]`);
    const screen=await exerciseNativeLinePriceBrowser({handle,actor,fixture,preferences,selection,salesCount:()=>paths.filter(row=>row.method==='POST'&&row.path==='/api/totus_tpv_sales').length});
    const after=await nativeRead(`products?filter[id]=[${fixture.linePriceSetup.items.normal.id}]`);assert.equal(after.products[0].price,before.products[0].price);return {...backend,screen};}
   const backend=await exerciseNativeStockPolicy({call,raw,selection,fixture,preferences,nativeRead,paths,actor,simulateCartAckLoss});
   const screen=await exerciseNativeStockPolicyBrowser({handle,actor,fixture,preferences,selection,salesCount:()=>paths.filter(row=>row.method==='POST'&&row.path==='/api/totus_tpv_sales').length});
   const stock=await nativeRead(`stock_availables?filter[id_product]=[${fixture.stockPolicySetup.items.allowed.id}]&filter[id_product_attribute]=[0]&filter[id_shop]=[1]`);assert.equal(Number(stock.stock_availables[0].quantity),0);
   const webshop=await nativeRead(`stock_availables?filter[id_product]=[${fixture.stockPolicySetup.items.denied.id}]&filter[id_product_attribute]=[0]&filter[id_shop]=[1]`);assert.equal(Number(webshop.stock_availables[0].quantity),0);assert.equal(Number(webshop.stock_availables[0].out_of_stock),0,'Counter sale and return must preserve the online refusal policy');
   return {...backend,screen};
  }
  if(focus==='catalogue-filters'){
   await exerciseNativeCatalogueFilters({call:values=>call({action:'catalogue',selection,operationId:randomUUID(),...values}),fixture,nativeWriteCount:()=>nativePosts});
   await exerciseNativeCatalogueFilterBrowser({handle,actor,fixture,preferences,nativeWriteCount:()=>nativePosts});
   return {focus,remoteShopTouched:false};
  }
  if(focus==='search'){
   await exerciseNativeSearch({call:values=>call({action:'catalogue',selection,operationId:randomUUID(),...values}),fixture,nativeWriteCount:()=>nativePosts});
   await exerciseNativeSearchBrowser({handle,actor,fixture,preferences});return {focus,remoteShopTouched:false};
  }
  if(focus==='products'){
   const prices=await call({action:'catalogue',selection,operationId:randomUUID(),search:fixture.reference});
   const originalPrice=prices.items.find(row=>String(row.product_id)===String(fixture.productId));
   assert.ok(originalPrice,'The original simple article must be found by its native reference');
   assert.equal(originalPrice.preview_cents,801);assert.equal(originalPrice.preview_tax_excl_cents,662);
   const nativeRead=async resource=>{const target=new URL(resource,base);target.searchParams.set('output_format','JSON');target.searchParams.set('id_shop','1');if(!target.searchParams.has('display'))target.searchParams.set('display','full');
    const response=await fetch(target,{headers:{Authorization:'Basic '+Buffer.from(fixture.key+':').toString('base64')},redirect:'error'});assert.equal(response.status,200);return response.json();};
   const productResult=await exerciseProductIntake({call:(action,values,id)=>call({action,selection,operationId:id,...values}),db,scope:selection,fixture:fixture.productSetup,paths,nativeRead,
    loseBaseReply:()=>{dropProductReply=true;},loseStageAck:key=>{dropProductAck=key;}});
   await exerciseNativeProductBrowser({handle,actor,fixture,preferences});return productResult;
  }
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
  if(focus==='cash-counting'){
   await exerciseNativeCashCountBrowser({handle,actor,preferences,db,session});return {focus,saleId,orderId:sold.orderId,remoteShopTouched:false};
  }
  const available=await call({action:'returnable',selection,operationId:randomUUID(),saleId});
  const refundId=randomUUID(),preparedRefund=await call({action:'prepare-refund',selection,operationId:refundId,saleId,
   items:[{detailId:available.items[0].detail_id,qty:1,restock:true}],payments:[{method:'cash',amountCents:801}]});
  assert.equal(preparedRefund.status,'ready');assert.equal(preparedRefund.totalCents,801);
  const refunded=await call({action:'submit-refund',selection,operationId:refundId,
   confirmation:{accepted:true,operationId:refundId,totalCents:801,currency:'EUR'}});
  assert.equal(refunded.status,'confirmed',JSON.stringify(refunded));
  const billingSelection={connectionId:connection,shopId:1},billingPosts=nativePosts;
  const billingContext=await call({action:'billing-context'});assert.equal(billingContext.sources.length,1);
  const billingList=await call({action:'billing-list',selection:billingSelection,query:{search:String(sold.orderId)}});
  assert.equal(billingList.items.length,1);assert.equal(billingList.items[0].id,saleId);assert.equal(billingList.items[0].refundCents,801);
  const billing=await call({action:'billing-document',selection:billingSelection,operationId:saleId,kind:'billing'});
  assert.equal(billing.document.order_id,sold.orderId);assert.equal(billing.document.total_cents,801);assert.equal(billing.sale.refunds[0].id,refundId);
  for(const kind of ['invoice','credit-note']){
   const doc=await call({action:'billing-document',selection:billingSelection,operationId:saleId,kind,...(kind==='credit-note'?{refundId}:{})});
   assert.equal(Buffer.from(doc.base64,'base64').subarray(0,5).toString(),'%PDF-');
  }
  assert.equal(nativePosts,billingPosts);
  console.log('PASS Facturación bridge: confirmed native invoice details, original invoice and credit-note PDFs from the journal, without cash selection or native writes. Local native HTTP and real SQL.');
  await exerciseNativeBillingBrowser({handle,actor,selection:billingSelection,saleId,orderId:sold.orderId,posts:()=>nativePosts});
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
  await exerciseNativeCentralCashBrowser({handle,actor,selection:{connectionId:connection,shopId:1},sessionId:session,saleId,orderId:sold.orderId,nativeCalls:()=>paths.length,nativePosts:()=>nativePosts});
  assert.equal(paths.filter(row=>row.method==='POST'&&row.path==='/api/totus_tpv_sales').length,1);
  // The growing disposable catalogue is deliberately paginated; locate the
  // fixture by exact reference, never assume its alphabetical page.
  await exerciseCentralBrowser({handle,actor,productId:fixture.productId,reference:fixture.reference,variant:fixture.variant,preferences,nativeWriteCount:()=>nativePosts,cashSessionCount:async()=>Number((await db.query('select count(*) n from private.totus_tpv_sessions where connection_id=$1 and drawer_id=$2',[connection,drawer])).rows[0].n)});
  console.log('PASS local complete handler → SQL journal → native HTTP → order/payment/invoice/stock proof → physical cash → close; lost-response recovery never posts again. Auth and endpoint delivery are fixtures; no deployment or remote shop.');
  return {orderId:sold.orderId,saleId,nativePosts};
 }finally{await db.close();}
}
