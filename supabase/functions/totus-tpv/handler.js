import {boundedText} from '../totus-connections/transport.js';
import {createTpvNativeTransport} from '../../../src/totustpv/server/native-transport.js';
import {TOTUS_QA_POLICY} from '../../../src/totustpv/server/deployment-qa-policy.js';
import {createPostgresCheckoutLedger,createPostgresCashLedger} from '../../../src/totustpv/postgres-journal.js';
import {createCheckoutService} from '../../../src/totustpv/checkout-service.js';
import {createNativeCapabilityAdapter} from '../../../src/totustpv/server/native-capability-adapter.js';
import {createOperatorPaymentVerifier,OPERATOR_PAYMENT_MODES} from '../../../src/totustpv/server/operator-payments.js';
import {createNativeRequestService,nativeStepId} from '../../../src/totustpv/server/native-request-service.js';
import {expectedFromNativeQuote} from '../../../src/totustpv/server/quote-contract.js';
import {createRefundService} from '../../../src/totustpv/server/refund-service.js';
import {createStockReceiptService} from '../../../src/totustpv/server/stock-receipt-service.js';
import {createOfficialProductWriter} from '../../../src/totustpv/server/official-products.js';
import {createProductIntakeService} from '../../../src/totustpv/server/product-intake-service.js';
import {createCatalogueIntakeService} from '../../../src/totustpv/server/catalogue-intake-service.js';
import {createCommercialBudgetService} from '../../../src/totustpv/server/commercial-budget-service.js';
import {budgetDraft} from '../../../src/totustpv/budget-contract.js';
import {readBillingDocument} from '../../../src/totustpv/server/billing-service.js';
import {stockPolicy} from '../../../src/totustpv/stock-policy.js';
import {lineOptions,lineAdjustment} from '../../../src/totustpv/line-options.js';
import {lineName} from '../../../src/totustpv/line-name.js';
import {saleNote,saleNoteHash} from '../../../src/totustpv/sale-note.js';
import {nativeMicros} from '../../../src/totustpv/server/native-adapter.js';
const need=(ok,code)=>{if(!ok)throw new Error(code);};
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const positive=value=>Number.isSafeInteger(value)&&value>0;
export function catalogueForActor(data,canReadCosts){
 need(Array.isArray(data?.items),'TPV_CATALOGUE_INVALID');
 let groups;
 if(Object.hasOwn(data,'variant_groups')){
  need(Array.isArray(data.variant_groups)&&data.variant_groups.length<=64,'TPV_CATALOGUE_INVALID');
  groups=data.variant_groups.map(row=>{need(row&&positive(row.id)&&typeof row.name==='string'&&Array.from(row.name).length<=128,'TPV_CATALOGUE_INVALID');return {id:row.id,name:row.name};});
 }
 const fields=['id','product_id','attribute_id','name','variant_name','variant_attributes','reference','ean','upc','isbn','choose_variant','minimum_quantity','allow_out_of_stock','unit_price_override','temporary_line_names',
  'stock','enabled_for_sale','unit_tax_incl','unit_tax_excl','preview_cents','preview_tax_excl_cents','image_path','manufacturer','supplier',...(canReadCosts===true?['cost_base_cents']:[])];
 return {...data,...(groups?{variant_groups:groups}:{}),items:data.items.map(item=>{
  const projected=Object.fromEntries(fields.filter(key=>Object.hasOwn(item,key)).map(key=>[key,item[key]]));
  if(Object.hasOwn(projected,'enabled_for_sale'))need(typeof projected.enabled_for_sale==='boolean','TPV_CATALOGUE_INVALID');
  if(Object.hasOwn(projected,'variant_attributes')){
   need(Array.isArray(projected.variant_attributes)&&projected.variant_attributes.length<=64,'TPV_CATALOGUE_INVALID');
   projected.variant_attributes=projected.variant_attributes.map(row=>{
    need(row&&positive(row.id)&&positive(row.groupId)&&typeof row.name==='string'&&Array.from(row.name).length<=128&&typeof row.groupName==='string'&&Array.from(row.groupName).length<=128,'TPV_CATALOGUE_INVALID');
    return Object.fromEntries(['id','groupId','name','groupName'].map(key=>[key,row[key]]));
   });
  }return projected;
 })};
}
const check=response=>{if(response?.error)throw new Error(/^TPV_[A-Z0-9_]{1,90}$/.test(response.error.message||'')?response.error.message:'TPV_STORAGE_UNAVAILABLE');
 need(response&&Object.hasOwn(response,'data'),'TPV_STORAGE_UNAVAILABLE');return response.data;};
const headers={'Content-Type':'application/json','Cache-Control':'no-store',
 'Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};

/** Authenticated Central endpoint. Factories are injected only by its server
 * entrypoint/tests, never by request JSON. Production shop writes are blocked
 * independently by the transport and QA database authorization.
 */
export function createCentralTpvHandler({factory,env,request=fetch,resolve,onError=()=>{}}){
 return async function handle(req){
  let audit=null,stage='request';
  const respond=async(body,status=200)=>{
   if(audit){const record=audit;audit=null;try{await record.admin.rpc('totus_api_call',{p_id:record.id,
    p_revision:record.revision,p_call:record.call,p_result:{ok:status<400}});}catch{}}
   return new Response(JSON.stringify(body),{status,headers});
  };
  async function beginAudit(admin,id,revision){const call=crypto.randomUUID();
   check(await admin.rpc('totus_api_call',{p_id:id,p_revision:revision,p_call:call}));audit={admin,id,revision,call};}
  if(req.method==='OPTIONS')return respond({});if(req.method!=='POST')return respond({error:'TPV_METHOD_FORBIDDEN'},405);
  try{
   const bearer=req.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
   if(!bearer)return respond({error:'TPV_AUTH_REQUIRED'},401);
   const url=env.get('SUPABASE_URL')||'',key=JSON.parse(env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default||env.get('SUPABASE_ANON_KEY')||'',
    secret=JSON.parse(env.get('SUPABASE_SECRET_KEYS')||'{}').default||env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
   need(url&&key&&secret,'TPV_SERVER_CONFIGURATION_REQUIRED');
   const options={auth:{persistSession:false,autoRefreshToken:false}};
   stage='authentication';const authenticated=await factory(url,key,options).auth.getUser(bearer);
   const user=authenticated?.data?.user;if(authenticated?.error||!uuid(user?.id))return respond({error:'TPV_AUTH_REQUIRED'},401);
   const scoped=factory(url,key,{...options,global:{headers:{Authorization:'Bearer '+bearer}}});
   const rawInput=await boundedText(req,6291456),input=JSON.parse(rawInput);
   need(input?.action==='product-intake-prepare'||new TextEncoder().encode(rawInput).byteLength<=65536,'TPV_REQUEST_INVALID');
   need(input&&typeof input==='object'&&!Array.isArray(input)&&
    ['context','configure','workstations','update-workstation-access','open','catalogue','categories','resolve-incident','customers','customer-metadata','customer-write','drafts','get-draft','park','claim-draft','release-draft','archive-draft','history','orders','sale-status','document','prepare','submit','recover','cash-summary','cash-reports','cash-movement','close','stock-receive',
     'stock-receipts','stock-receipt-create','stock-receipt-get','stock-receipt-step','stock-receipt-cancel',
     'product-profile','product-metadata','product-intakes','product-intake-prepare','product-intake-get','product-intake-step','product-intake-cancel',
     'product-categories','product-category-prepare','product-category-get','product-category-step','product-category-cancel',
     'central-cash-context','central-cash-read','billing-context','billing-list','billing-document','budgets','budget-get','budget-create','budget-open','budget-cancel','returnable','prepare-refund','submit-refund','recover-refund','cancel-refund'].includes(input.action),
    'TPV_REQUEST_INVALID');
   const permitted={context:['action'],configure:['action','selection','operationId','revision','storeId','operatorId','permissions','confirmQaSetup','paymentMethods'],
    workstations:['action','connectionId','revision'],
    'central-cash-context':['action'],'central-cash-read':['action','selection','section','query'],
    'billing-context':['action'],'billing-list':['action','selection','query'],
    'billing-document':['action','selection','operationId','kind','refundId'],
    'update-workstation-access':['action','selection','operationId','revision','operatorId','assignmentRevision','permissions','active'],
    open:['action','selection','operationId','openingCents'],catalogue:['action','selection','operationId','search','page','productId','customerId','addressId','categoryId','sortField','sortDirection','searchFields','catalogueFilters','variantGroupId','inventoryOnly'],
    categories:['action','selection','operationId'],'resolve-incident':['action','selection','operationId','reason','settlementReview'],
    history:['action','selection','operationId','before'],orders:['action','selection','operationId','orderId','reference'],'sale-status':['action','selection','operationId'],document:['action','selection','operationId','kind','refundId'],
    customers:['action','selection','operationId','search','page','customerId'],'customer-metadata':['action','selection','operationId','countryId'],
    'customer-write':['action','selection','operationId','resource','operation','recordId','fields'],
    budgets:['action','selection','operationId','query'],'budget-get':['action','selection','operationId'],
    'budget-create':['action','selection','operationId','payload'],
    'budget-open':['action','selection','operationId','version'],'budget-cancel':['action','selection','operationId','version'],
    drafts:['action','selection','operationId'],'get-draft':['action','selection','operationId','draftId'],
    park:['action','selection','operationId','draftId','version','label','payload'],
    'claim-draft':['action','selection','operationId','draftId','version'],'release-draft':['action','selection','operationId','draftId','version'],
    'archive-draft':['action','selection','operationId','draftId','version'],
    prepare:['action','selection','operationId','lines','customerId','invoiceAddressId','deliveryAddressId','adjustment','coupon','note','draftId','draftVersion'],
    submit:['action','selection','operationId','payments'],recover:['action','selection','operationId'],
    'cash-summary':['action','selection','operationId'],'cash-movement':['action','selection','operationId','kind','amountCents','reason'],
    'cash-reports':['action','selection','operationId','reportSessionId'],
    close:['action','selection','operationId','countedCents','note'],'stock-receive':['action','selection','operationId','productId','attributeId','quantity','reason'],
    'stock-receipts':['action','selection','operationId'],'stock-receipt-create':['action','selection','operationId','payload'],
    'stock-receipt-get':['action','selection','operationId'],'stock-receipt-step':['action','selection','operationId'],
    'stock-receipt-cancel':['action','selection','operationId'],
    'product-profile':['action','selection','operationId'],'product-metadata':['action','selection','operationId','resource','page','recordId'],
    'product-intakes':['action','selection','operationId'],'product-intake-prepare':['action','selection','operationId','payload'],
    'product-intake-get':['action','selection','operationId'],'product-intake-step':['action','selection','operationId'],
    'product-intake-cancel':['action','selection','operationId'],
    'product-categories':['action','selection','operationId'],'product-category-prepare':['action','selection','operationId','payload'],
    'product-category-get':['action','selection','operationId'],'product-category-step':['action','selection','operationId'],
    'product-category-cancel':['action','selection','operationId'],
    returnable:['action','selection','operationId','saleId'],'prepare-refund':['action','selection','operationId','saleId','items','payments','reason'],
    'submit-refund':['action','selection','operationId','confirmation'],'recover-refund':['action','selection','operationId'],
    'cancel-refund':['action','selection','operationId']};
   need(Object.keys(input).every(key=>permitted[input.action].includes(key)),'TPV_REQUEST_FIELD_FORBIDDEN');
   if(input.action==='catalogue')need(input.inventoryOnly===undefined||typeof input.inventoryOnly==='boolean','TPV_CATALOGUE_QUERY_INVALID');
   if(input.action==='budget-create')input.payload=budgetDraft(input.payload);
   if(input.action==='central-cash-context'){
    const result=check(await scoped.rpc('totus_tpv_central_cash_context'));
    need(result?.actorId===user.id&&Array.isArray(result.sources),'TPV_CENTRAL_CASH_FORBIDDEN');return respond(result);
   }
   if(input.action==='central-cash-read'){
    need(input.selection&&typeof input.selection==='object'&&!Array.isArray(input.selection)&&
     (input.query===undefined||input.query&&typeof input.query==='object'&&!Array.isArray(input.query))&&
     (input.section===undefined||['sessions','session','sales','refunds','movements'].includes(input.section)),'TPV_CENTRAL_CASH_QUERY_INVALID');
    return respond(check(await scoped.rpc('totus_tpv_central_cash_read',{p_selection:input.selection,p_section:input.section??'sessions',p_query:input.query??{}})));
   }
   if(input.action.startsWith('billing-')){
    const billingContext=async()=>{const ctx=check(await scoped.rpc('totus_tpv_billing_context'));
     need(ctx?.actorId===user.id&&Array.isArray(ctx.sources),'TPV_BILLING_FORBIDDEN');return ctx;};
    const ctx=await billingContext();if(input.action==='billing-context')return respond(ctx);
    need(input.selection&&Object.keys(input.selection).every(key=>['connectionId','shopId'].includes(key))&&
     input.selection.connectionId===TOTUS_QA_POLICY.connectionId&&positive(input.selection.shopId),'TPV_BILLING_QUERY_INVALID');
    const row=ctx.sources.find(source=>source.connectionId===input.selection.connectionId&&source.shopId===input.selection.shopId);
    need(row?.nativeProfile?.verified===true&&row.nativeProfile.configured===true&&row.nativeProfile.native_version==='8.2.8'&&
     row.nativeProfile.shop_id===row.shopId&&uuid(row.nativeProfile.installation_id)&&row.environment==='qa','TPV_BILLING_CONTEXT_STALE');
    const scope={actorId:user.id,connectionId:row.connectionId,connectionRevision:row.connectionRevision,shopId:row.shopId,
     storeId:row.storeId,currency:row.nativeProfile.currency,environment:'qa'},admin=factory(url,secret,options),rpc=(name,args)=>admin.rpc(name,args);
    if(input.action==='billing-list'){
     need(input.query===undefined||input.query&&typeof input.query==='object'&&!Array.isArray(input.query),'TPV_BILLING_QUERY_INVALID');
     return respond(check(await rpc('totus_tpv_billing_read',{p_scope:scope,p_sale:null,p_query:input.query??{}})));
    }
    need(uuid(input.operationId)&&['billing','invoice','credit-note'].includes(input.kind)&&
     (input.kind==='credit-note'?uuid(input.refundId):input.refundId===undefined),'TPV_BILLING_QUERY_INVALID');
    const connection=check(await rpc('totus_api_server',{p_id:scope.connectionId,p_revision:scope.connectionRevision}));
    await beginAudit(admin,scope.connectionId,scope.connectionRevision);
    const transport=createTpvNativeTransport({...connection,website_origin:TOTUS_QA_POLICY.origin},scope,{resolve,qaPolicy:TOTUS_QA_POLICY,
     nativeExtension:{verified:true,installationId:row.nativeProfile.installation_id,connectionId:scope.connectionId,
      connectionRevision:scope.connectionRevision,shopId:scope.shopId,protocol:1},
     request:async(target,init)=>{const fresh=(await billingContext()).sources.find(source=>source.connectionId===scope.connectionId&&source.shopId===scope.shopId);
      need(fresh&&fresh.connectionRevision===scope.connectionRevision&&fresh.storeId===scope.storeId&&
       fresh.nativeProfile?.installation_id===row.nativeProfile.installation_id,'TPV_BILLING_CONTEXT_STALE');
      need(init.method==='GET','TPV_BILLING_READ_ONLY');return request(target,init);}});
    return respond(await readBillingDocument({rpc,scope,operationId:input.operationId,kind:input.kind,refundId:input.refundId,transport}));
   }
   if(['workstations','update-workstation-access'].includes(input.action)){
    const connectionId=input.action==='workstations'?input.connectionId:input.selection?.connectionId;
    need(connectionId===TOTUS_QA_POLICY.connectionId&&positive(input.revision),'TPV_CONFIGURATION_INVALID');
    if(input.action==='update-workstation-access')need(uuid(input.operationId)&&uuid(input.operatorId)&&
     positive(input.assignmentRevision)&&positive(input.selection.shopId)&&uuid(input.selection.drawerId)&&
     Object.keys(input.selection).every(key=>['connectionId','shopId','drawerId'].includes(key))&&typeof input.active==='boolean'&&
     input.permissions&&typeof input.permissions==='object'&&!Array.isArray(input.permissions)&&Object.keys(input.permissions).length===3&&
     ['sell','open','reconcile'].every(key=>typeof input.permissions[key]==='boolean')&&(!input.active||input.permissions.reconcile===true),
     'TPV_ACCESS_REQUEST_INVALID');
    stage='workstation-access-context';const manager=check(await scoped.rpc('totus_api_manager'));
    need(manager?.connections?.some(row=>row.id===connectionId&&row.revision===input.revision),'TPV_CONTEXT_STALE');
    const admin=factory(url,secret,options);
    const common={p_actor:user.id,p_connection:connectionId,p_revision:input.revision};
    return respond(check(await admin.rpc(input.action==='workstations'?'totus_tpv_workstation_access':'totus_tpv_update_workstation_access',
     input.action==='workstations'?common:{...common,p_request_id:input.operationId,p_data:{operatorId:input.operatorId,
      drawerId:input.selection.drawerId,shopId:input.selection.shopId,expectedRevision:input.assignmentRevision,
      permissions:input.permissions,active:input.active}})));
   }
   if(input.action==='configure'){
    need(uuid(input.operationId)&&input.selection?.connectionId===TOTUS_QA_POLICY.connectionId&&positive(input.revision)&&
     positive(input.selection.shopId)&&uuid(input.selection.drawerId)&&uuid(input.storeId)&&uuid(input.operatorId)&&
     Object.keys(input.selection).every(key=>['connectionId','shopId','drawerId'].includes(key)),'TPV_CONFIGURATION_INVALID');
    // Existing normal-user admin and store/RLS paths precede loading a key.
    stage='configuration-context';const manager=check(await scoped.rpc('totus_api_manager'));
    need(manager?.connections?.some(row=>row.id===input.selection.connectionId&&row.revision===input.revision),'TPV_CONTEXT_STALE');
    const metadata=check(await scoped.rpc('totus_sales_context'));
    const website=metadata.websites?.find(row=>row.connection_id===input.selection.connectionId&&row.origin===TOTUS_QA_POLICY.origin&&row.status==='active');
    need(website&&metadata.businesses?.some(row=>row.id===input.storeId),'TPV_CONFIGURATION_INVALID');
    const drawer=check(await scoped.from('ops_cash_drawers').select('id,store_id,active').eq('id',input.selection.drawerId).eq('store_id',input.storeId).eq('active',true).maybeSingle());
    need(drawer,'TPV_CONFIGURATION_INVALID');
    const admin=factory(url,secret,options),rpc=(name,args)=>admin.rpc(name,args);
    stage='configuration-connection';const connection=check(await rpc('totus_api_server',{p_id:input.selection.connectionId,p_revision:input.revision}));
    await beginAudit(admin,input.selection.connectionId,input.revision);
    const setupScope={actorId:user.id,connectionId:input.selection.connectionId,connectionRevision:input.revision,storeId:input.storeId,
     shopId:input.selection.shopId,drawerId:input.selection.drawerId,sessionId:input.operationId,currency:'EUR',environment:'qa'};
    const optionsFor=extension=>({request,resolve,qaPolicy:TOTUS_QA_POLICY,nativeExtension:extension,
     allowNativeCommand:async({command})=>{need(command==='setup.qa','TPV_NATIVE_COMMAND_DISABLED');check(await scoped.rpc('totus_api_manager'));return true;}});
    stage='configuration-profile';let transport=createTpvNativeTransport({...connection,website_origin:TOTUS_QA_POLICY.origin},setupScope,optionsFor(null));
    let native=await transport.inspectNativeProfile();
    need(native?.verified===true&&native.environment==='qa'&&native.native_version==='8.2.8'&&native.protocol===1&&
     uuid(native.installation_id)&&native.shop_id===setupScope.shopId,'TPV_NATIVE_PROFILE_INVALID');
    if(native.configured!==true&&input.confirmQaSetup!==true)return respond({setupRequired:true,environment:'qa',nativeVersion:'8.2.8'});
    if(input.confirmQaSetup===true){
     setupScope.currency=native.currency;setupScope.nativeInstallationId=native.installation_id;
     transport=createTpvNativeTransport({...connection,website_origin:TOTUS_QA_POLICY.origin},setupScope,optionsFor({verified:true,
      installationId:native.installation_id,connectionId:setupScope.connectionId,connectionRevision:setupScope.connectionRevision,shopId:setupScope.shopId,protocol:1}));
     stage='configuration-setup';const result=await createNativeRequestService({rpc,transport,scope:setupScope}).execute({operationId:input.operationId,command:'setup.qa',payload:{confirm_qa:true}});
     if(result.status!=='verified')return respond(result);
     native=await transport.readNativeProfile();
    }
    const methods=input.paymentMethods??['cash','card'];
    need(Array.isArray(methods)&&methods.length>=2&&methods.length<=4&&new Set(methods).size===methods.length&&
     ['cash','card'].every(method=>methods.includes(method))&&methods.every(method=>Object.hasOwn(OPERATOR_PAYMENT_MODES,method)&&
      typeof native.payment_labels?.[method]==='string'),'TPV_PAYMENT_METHOD_NOT_CONFIGURED');
    native={...native,payment_labels:Object.fromEntries(methods.map(method=>[method,native.payment_labels[method]]))};
    stage='configuration-assignment';return respond(check(await rpc('totus_tpv_configure',{p_actor:user.id,p_operator:input.operatorId,p_connection:setupScope.connectionId,
     p_revision:input.revision,p_store:input.storeId,p_drawer:setupScope.drawerId,p_website:website.key,p_native:native,p_permissions:input.permissions})));
   }
   async function context(){const result=check(await scoped.rpc('totus_tpv_context'));
    need(result?.actorId===user.id&&Array.isArray(result.workstations),'TPV_CONTEXT_INVALID');return result;}
   if(input.action==='context')return respond(await context());
   need(uuid(input.operationId)&&input.selection&&Object.keys(input.selection).every(key=>
    ['connectionId','shopId','drawerId','sessionId'].includes(key)),'TPV_SELECTION_INVALID');
   async function selected(){
    const ctx=await context(),row=ctx.workstations.find(row=>row.connectionId===input.selection.connectionId&&
     row.shopId===input.selection.shopId&&row.drawerId===input.selection.drawerId);
    need(row?.connectionId===TOTUS_QA_POLICY.connectionId&&row.environment==='qa'&&row.nativeProfile?.verified===true&&row.nativeProfile.configured===true&&
     row.nativeProfile.native_version==='8.2.8'&&row.nativeProfile.shop_id===row.shopId&&uuid(row.nativeProfile.installation_id),
     'TPV_WORKSTATION_NOT_CONFIGURED');
    const readWithoutCash=['budgets','budget-get','budget-create','budget-cancel','cash-reports','categories','catalogue','orders','document','customers','customer-metadata',
     'product-profile','product-metadata','product-intakes','product-intake-get','product-categories','product-category-get'].includes(input.action);
    // SQL checks the historical session against this exact assignment, then
    // permits immutable cash replay before rejecting a new closed-session write.
    const historicalCash=['cash-summary','cash-movement','close'].includes(input.action);
    const sessionId=readWithoutCash?undefined:input.action==='open'?input.operationId:input.selection.sessionId;
    need(readWithoutCash?row.canReconcile===true:uuid(sessionId)&&(historicalCash?row.canReconcile===true:input.action==='open'?!row.session||row.session.id===sessionId:row.session?.id===sessionId),
     'TPV_CASH_SESSION_MISMATCH');
    return {row,scope:{actorId:user.id,connectionId:row.connectionId,connectionRevision:row.connectionRevision,
     storeId:row.storeId,shopId:row.shopId,drawerId:row.drawerId,sessionId,currency:row.nativeProfile.currency,environment:'qa'}};
   }
   const {row,scope}=await selected(),admin=factory(url,secret,options),rpc=(name,args)=>admin.rpc(name,args);
   const ledger=createPostgresCheckoutLedger({rpc}),cash=createPostgresCashLedger({rpc});
   if(input.action==='cash-reports'){
    need(input.reportSessionId===undefined||uuid(input.reportSessionId),'TPV_REPORT_QUERY_INVALID');
    return respond(check(await rpc('totus_tpv_cash_reports',{p_scope:scope,p_session_id:input.reportSessionId??null})));
   }
   async function authorize({action}){const fresh=await selected();
    need(Object.keys(scope).every(key=>scope[key]===fresh.scope[key]),'TPV_CONTEXT_STALE');
    check(await rpc('totus_tpv_check',{p_scope:fresh.scope,p_action:action}));return fresh.scope;}
   if(['budgets','budget-get','budget-open','budget-cancel'].includes(input.action)){
    await authorize({action:input.action==='budget-open'?'sell':'read'});const budgets=createCommercialBudgetService({rpc,scope});
    return respond(input.action==='budgets'?await budgets.list(input.query):input.action==='budget-open'?await budgets.open(input.operationId,input.version):input.action==='budget-cancel'?await budgets.cancel(input.operationId,input.version):await budgets.get(input.operationId));
   }
   if(input.action==='history')return respond(check(await rpc('totus_tpv_history',{p_scope:scope,p_before:input.before??null})));
   const orderRows=async orderId=>{
    const rows=check(await rpc('totus_tpv_orders',{p_scope:scope,p_order_id:orderId??null,p_sale_id:null}));
    return rows.map(record=>({id:record.id,status:record.status,orderId:record.orderId,
     createdAt:record.createdAt,drawerName:record.drawerName,totalCents:record.totalCents,lines:record.lines,
     refunds:record.refunds.map(({id,status,totalCents})=>({id,status,totalCents}))}));
   };
   if(input.action==='orders'){
    need(input.orderId===undefined||Number.isSafeInteger(input.orderId)&&input.orderId>0,'TPV_ORDER_QUERY_INVALID');
    need(input.reference===undefined||typeof input.reference==='string'&&input.reference===input.reference.trim()&&/^[A-Za-z0-9-]{1,10}$/.test(input.reference)&&input.orderId===undefined,'TPV_ORDER_QUERY_INVALID');
    if(input.reference===undefined)return respond(await orderRows(input.orderId));
   }
   if(input.action==='sale-status'){
    await authorize({action:'reconcile'});
    const record=await ledger.get({scope,operationId:input.operationId});
    return respond({id:record.id,status:record.status,orderId:record.orderId,totalCents:record.expected.totalCents,
     currency:record.scope.currency,quoteExpiresAt:record.quoteExpiresAt,lines:record.expected.lines,
     paymentMethods:['cash','card','bizum','transfer'].filter(method=>Object.hasOwn(record.expected.nativePaymentLabels,method)),
     discountCents:record.expected.discountCents,
     canSubmit:record.scope.actorId===scope.actorId,draftId:record.expected.draftId,draftVersion:record.expected.draftVersion});
   }
   if(input.action==='open')return respond(await ledger.open({scope,sessionId:scope.sessionId,openingCents:input.openingCents}));
   const drafts=(action,id,data={},requestId=input.operationId)=>rpc('totus_tpv_drafts',{
    p_action:action,p_id:id,p_request_id:requestId,p_scope:scope,p_data:data});
   if(['drafts','get-draft','park','claim-draft','release-draft','archive-draft'].includes(input.action)){
    const action={drafts:'list','get-draft':'get',park:'park','claim-draft':'claim','release-draft':'release','archive-draft':'archive'}[input.action];
    if(!['list','park'].includes(action))need(uuid(input.draftId),'TPV_DRAFT_REQUEST_INVALID');
    if(action==='park')need(input.draftId===undefined||uuid(input.draftId),'TPV_DRAFT_REQUEST_INVALID');
    return respond(check(await drafts(action,action==='list'?null:input.draftId??input.operationId,
     ['list','get'].includes(action)?{}:{version:input.version,...(action==='park'?{payload:input.payload,label:input.label}:{})})));
   }
   if(['cash-summary','cash-movement','close'].includes(input.action)){
    const common={scope,requestId:input.operationId};
    return respond(input.action==='cash-summary'?await cash.summary(common):input.action==='close'?
     await cash.close({...common,countedCents:input.countedCents,note:input.note}):
     await cash.movement({...common,kind:input.kind,amountCents:input.amountCents,reason:input.reason}));
   }
   if(input.action!=='categories')await authorize({action:['budget-create','orders','catalogue','customers','customer-metadata','document',
    'product-profile','product-metadata','product-intakes','product-intake-get','product-categories','product-category-get'].includes(input.action)?'read':
    ['resolve-incident','stock-receipts','stock-receipt-get','stock-receipt-cancel','recover','recover-refund','cancel-refund'].includes(input.action)?'reconcile':'sell'});
   if(input.action==='resolve-incident')check(await scoped.rpc('totus_api_manager'));
   if(['customers','customer-metadata','customer-write'].includes(input.action)||
     input.action==='prepare'&&input.customerId!==undefined&&input.customerId!==row.nativeProfile.counter_customer_id){
    const directory=check(await scoped.rpc('totus_directory_context',{p_kind:'clientes',p_action:input.action==='customer-write'?
     (input.operation==='create'?'create':'edit'):'view'}));
    need(directory.connections?.some(c=>c.id===scope.connectionId&&c.revision===scope.connectionRevision),'TPV_CUSTOMER_CONTEXT_INVALID');
   }
   const productAction=input.action.startsWith('product-'),productWrite=['product-intake-prepare','product-intake-step','product-intake-cancel',
    'product-category-prepare','product-category-step','product-category-cancel'].includes(input.action);
   async function productContext(denialCode='TPV_PRODUCT_FORBIDDEN'){
    const response=await scoped.rpc('totus_products_context',{p_action:productWrite?'create':'view'});
    if(denialCode==='TPV_INVENTORY_FORBIDDEN')need(!response.error,denialCode);
    const result=check(response);
    need(result.connections?.some(c=>c.id===scope.connectionId&&c.revision===scope.connectionRevision),denialCode);
    const website=result.websites?.find(w=>w.connection_id===scope.connectionId&&w.origin===TOTUS_QA_POLICY.origin&&w.status==='active');
    need(website&&typeof website.key==='string','TPV_PRODUCT_SCOPE_INVALID');return website;
   }
   if(input.action==='catalogue'&&input.inventoryOnly===true)await productContext('TPV_INVENTORY_FORBIDDEN');
   const productWebsite=productAction?await productContext():null;
   const connection=check(await rpc('totus_api_server',{p_id:scope.connectionId,p_revision:scope.connectionRevision}));
   await beginAudit(admin,scope.connectionId,scope.connectionRevision);
   if(productAction){
    const products=createOfficialProductWriter({connection,scope,websiteKey:productWebsite.key,websiteName:productWebsite.name,rpc,env,resolve,
     request:async(target,init)=>{await authorize({action:productWrite?'sell':'read'});await productContext();return request(target,init);}});
    if(input.action==='product-profile')return respond(await products.profile());
    if(input.action==='product-metadata')return respond(await products.list(input.resource,input.page??0,input.recordId));
    if(input.action==='product-categories'||input.action.startsWith('product-category-')){
     const categories=createCatalogueIntakeService({rpc,products,scope,onStepError:error=>onError(error,{stage:'category-intake-step'})});
     return respond(input.action==='product-categories'?await categories.list():input.action==='product-category-prepare'?await categories.prepare(input.operationId,input.payload):
      input.action==='product-category-step'?await categories.advance(input.operationId):input.action==='product-category-cancel'?await categories.cancel(input.operationId):await categories.get(input.operationId));
    }
    const service=createProductIntakeService({rpc,products,scope,onStepError:error=>onError(error,{stage:'product-intake-step'})});
    return respond(input.action==='product-intakes'?await service.list():input.action==='product-intake-prepare'?await service.prepare(input.operationId,input.payload):
     input.action==='product-intake-step'?await service.advance(input.operationId):input.action==='product-intake-cancel'?await service.cancel(input.operationId):await service.get(input.operationId));
   }
   const transport=createTpvNativeTransport({...connection,website_origin:TOTUS_QA_POLICY.origin},scope,{request:input.action==='catalogue'&&input.inventoryOnly?async(target,init)=>{await authorize({action:'read'});await productContext('TPV_INVENTORY_FORBIDDEN');return request(target,init);}:request,resolve,qaPolicy:TOTUS_QA_POLICY,
    nativeExtension:{verified:true,installationId:row.nativeProfile.installation_id,connectionId:scope.connectionId,
     connectionRevision:scope.connectionRevision,shopId:scope.shopId,protocol:1},
    allowNativeQuote:async()=>{await authorize({action:'sell'});return true;},
    allowNativeCommand:async({command,operationId})=>{
     if(input.action==='budget-create'){
      need(['cart.prepare','cart.quote'].includes(command),'TPV_NATIVE_COMMAND_DISABLED');
      await authorize({action:'read'});check(await rpc('totus_tpv_commercial_options',{p_scope:scope}));return true;
     }
     await authorize({action:'sell'});
     if(command==='return.commit')check(await rpc('totus_tpv_refund_journal',{p_action:'get',p_id:operationId,p_scope:scope,p_data:{}}));
     return true;}});
   if(input.action==='budget-create'){
    const budgets=createCommercialBudgetService({rpc,scope,transport,nativeProfile:row.nativeProfile,authorizeCustomer:async()=>{
     const directory=check(await scoped.rpc('totus_directory_context',{p_kind:'clientes',p_action:'view'}));
     need(directory.connections?.some(c=>c.id===scope.connectionId&&c.revision===scope.connectionRevision),'TPV_CUSTOMER_CONTEXT_INVALID');
    }});
    return respond(await budgets.create(input.operationId,input.payload));
   }
   if(input.action==='categories')return respond(await transport.readNativeCategories());
   if(input.action==='orders'){
    const reference=input.reference.toUpperCase(),response=await transport.read('orders',{
     'filter[reference]':`[${reference}]`,'filter[id_shop]':`[${scope.shopId}]`,display:'[id,reference,id_shop]',limit:'0,2'});
    const rows=Array.isArray(response)&&response.length===0?[]:response?.orders;
    need(Array.isArray(rows)&&rows.length<=2,'TPV_ORDER_REFERENCE_LOOKUP_INVALID');
    need(rows.length<2,'TPV_ORDER_REFERENCE_AMBIGUOUS');if(!rows.length)return respond([]);
    const native=rows[0],orderId=Number(native.id);
    need(positive(orderId)&&Number(native.id_shop)===scope.shopId&&typeof native.reference==='string'&&native.reference.toUpperCase()===reference,'TPV_ORDER_REFERENCE_LOOKUP_INVALID');
    return respond(await orderRows(orderId));
   }
   if(input.action==='resolve-incident'){
    const record=await ledger.get({scope,operationId:input.operationId});
    need(record&&['uncertain','cancelled'].includes(record.status)&&record.orderId==null,'TPV_INCIDENT_REVIEW_FORBIDDEN');
    let proof={};
    if(record.status!=='cancelled'){
     const native=await transport.readNativeOperation(record.id,{sourceActorId:record.scope.actorId});
     need(native?.operation_id===record.id&&native.status==='uncertain'&&native.execution_finished===true&&
      native.effect_observed===false&&native.native_command==='sale.commit'&&/^TOTUS_[A-Z0-9_]{1,90}$/.test(native.failure_code||''),'TPV_INCIDENT_NATIVE_PROOF_REQUIRED');
     const response=await transport.read('orders',{'filter[id_cart]':`[${record.expected.cartId}]`,display:'[id,id_cart]',limit:'0,2'});
     const observed=Array.isArray(response)&&response.length===0?[]:response?.orders;
     need(Array.isArray(observed)?observed.length===0:observed&&typeof observed==='object'&&Object.keys(observed).length===0,'TPV_INCIDENT_ORDER_EXISTS');
     proof={operationId:record.id,cartId:record.expected.cartId,executionFinished:true,effectObserved:false,ordersObserved:0,
      nativeCommand:native.native_command,nativeCode:native.failure_code,checkedAt:Date.now()};
    }
    return respond(check(await rpc('totus_tpv_resolve_incident',{p_scope:scope,p_id:record.id,p_reason:input.reason,
     p_settlement:input.settlementReview,p_proof:proof})));
   }
   if(input.action==='customer-write')return respond(await (await import('../../../src/totustpv/server/customer-service.js')).writeTpvCustomer({
    input,scope,websiteKey:row.websiteKey,websiteName:row.storeName+' · preproducción',connection,rpc,request,resolve}));
   if(input.action==='customers')return respond(await transport.readNativeCustomers({search:input.search??'',page:input.page??0,customerId:input.customerId??0}));
   if(input.action==='customer-metadata'){
    need(positive(input.countryId),'TPV_CUSTOMER_COUNTRY_INVALID');
    const [countries,states]=await Promise.all([
     transport.read('countries',{display:'[id,name,active,contains_states,need_identification_number,need_zip_code,zip_code_format]',
      'filter[active]':'[1]',sort:'[id_ASC]',limit:'0,500'}),
     transport.read('states',{display:'[id,name,id_country,active]','filter[id_country]':`[${input.countryId}]`,'filter[active]':'[1]',sort:'[name_ASC]',limit:'0,200'})]);
    const countriesRows=Array.isArray(countries)&&countries.length===0?[]:countries.countries,
     stateRows=Array.isArray(states)&&states.length===0?[]:states.states;
    need(Array.isArray(countriesRows)&&countriesRows.length<500&&Array.isArray(stateRows)&&stateRows.length<200,
     'TPV_CUSTOMER_METADATA_INCOMPLETE');return respond({countries:countriesRows,states:stateRows});
   }
   if(input.action==='document'){
    const rows=check(await rpc('totus_tpv_orders',{p_scope:scope,p_order_id:null,p_sale_id:input.operationId})),sale=rows[0];
    need(rows.length===1&&sale?.status==='confirmed','TPV_DOCUMENT_VERIFIED_SALE_REQUIRED');
    if(input.kind==='credit-note'){
     need(uuid(input.refundId),'TPV_DOCUMENT_QUERY_INVALID');
     const refund=sale.refunds.find(row=>row.id===input.refundId&&row.status==='confirmed');
     need(refund&&uuid(refund.actorId),'TPV_DOCUMENT_VERIFIED_RETURN_REQUIRED');
     const document=await transport.readNativeDocument({operationId:refund.id,sourceActorId:refund.actorId,kind:input.kind});
     return respond({...document,ticket_number:check(await rpc('totus_tpv_receipt_number',{p_scope:scope,p_operation:refund.id,p_kind:'return'}))});
    }
    need(input.refundId===undefined,'TPV_DOCUMENT_QUERY_INVALID');
    const document=await transport.readNativeDocument({operationId:sale.id,sourceActorId:sale.scope.actorId,kind:input.kind});
    return respond(['receipt','gift'].includes(input.kind)?{...document,ticket_number:check(await rpc('totus_tpv_receipt_number',{p_scope:scope,p_operation:sale.id,p_kind:'sale'})),merchant_logo_origin:TOTUS_QA_POLICY.origin,
     merchant_origin:TOTUS_QA_POLICY.origin,operator_name:typeof sale.operatorName==='string'?sale.operatorName.slice(0,100):null}:document);
   }
   if(input.action==='catalogue'){
    need(input.sortField!=='cost'||row.canReadCosts===true,'TPV_COST_FORBIDDEN');
    const data=await transport.readNativeCatalogue({search:input.search??'',page:input.page??0,
     pageSize:20,productId:input.productId??0,customerId:input.customerId,addressId:input.addressId,categoryId:input.categoryId??0,sortField:input.sortField??'name',sortDirection:input.sortDirection??'asc',searchFields:input.searchFields,catalogueFilters:input.catalogueFilters,variantGroupId:input.variantGroupId??0,inventoryOnly:input.inventoryOnly??false});
    need((data.inventory_only??false)===(input.inventoryOnly??false)&&(!input.inventoryOnly||data.items?.every(item=>typeof item.enabled_for_sale==='boolean')),'TPV_CATALOGUE_INVENTORY_UNAVAILABLE');
    return respond({...catalogueForActor(data,row.canReadCosts),image_origin:TOTUS_QA_POLICY.origin});
   }
   if(['returnable','prepare-refund','submit-refund','recover-refund','cancel-refund'].includes(input.action)){
    const refunds=createRefundService({rpc,transport,scope});
    if(input.action==='returnable')return respond(await refunds.returnable(input.saleId));
    if(input.action==='prepare-refund')return respond(await refunds.prepare({operationId:input.operationId,saleId:input.saleId,items:input.items,payments:input.payments,reason:input.reason}));
    if(input.action==='submit-refund')return respond(await refunds.submit({operationId:input.operationId,confirmation:input.confirmation}));
    return respond(input.action==='cancel-refund'?await refunds.cancel(input.operationId):await refunds.recover(input.operationId));
   }
   const nativeRequests=createNativeRequestService({rpc,transport,scope});
   if(input.action.startsWith('stock-receipt')){
    const receipts=createStockReceiptService({rpc,nativeRequests,scope});
    return respond(input.action==='stock-receipts'?await receipts.list():input.action==='stock-receipt-create'?
     await receipts.create(input.operationId,input.payload):input.action==='stock-receipt-step'?await receipts.advance(input.operationId):
     input.action==='stock-receipt-cancel'?await receipts.cancel(input.operationId):await receipts.get(input.operationId));
   }
   const policy=async()=>{const fresh=(await selected()).row;return {enabled:true,revision:fresh.profileRevision,
    environment:'qa',connectionId:scope.connectionId,shopId:scope.shopId,storeId:scope.storeId,currency:scope.currency,
    modes:Object.fromEntries(Object.keys(fresh.nativeProfile.payment_labels).map(method=>[method,OPERATOR_PAYMENT_MODES[method]]))};};
   async function profile(){const fresh=(await selected()).row,p=fresh.nativeProfile;
    const currentStockPolicy=stockPolicy(check(await rpc('totus_tpv_stock_policy',{p_scope:scope})));
    const currentLineOptions=lineOptions(check(await rpc('totus_tpv_line_options',{p_scope:scope})));
    return {verified:true,nativeVersion:'8.2.8',connectionId:scope.connectionId,connectionRevision:scope.connectionRevision,
     allowOutOfStock:currentStockPolicy.allowOutOfStock,
     allowPriceChanges:currentLineOptions.allowPriceChanges,requireSaleNote:currentLineOptions.requireSaleNote,allowNameChanges:currentLineOptions.allowNameChanges,
     shopId:scope.shopId,currency:scope.currency,environment:'qa',quoteLifetimeMs:120000,paymentModule:'totuscentralconnector',
     nativePaymentLabels:p.payment_labels,paidStateIds:[p.paid_state_id],operatorPaymentPolicy:await policy()};}
   async function stockRecords(lines){
    const records=[];
    // Bounded small groups avoid a 200-request burst against a shop.
    for(let i=0;i<lines.length;i+=4)records.push(...await Promise.all(lines.slice(i,i+4).map(async line=>{
     const response=await transport.read('stock_availables',{'filter[id_product]':`[${line.product_id}]`,
      'filter[id_product_attribute]':`[${line.attribute_id}]`,'filter[id_shop]':`[${scope.shopId}]`,display:'full',limit:'0,2'});
     need(response?.stock_availables?.length===1,'TPV_QUOTE_STOCK_MAPPING_REQUIRED');const stock=response.stock_availables[0];
     return {id:Number(stock.id),productId:Number(stock.id_product),attributeId:Number(stock.id_product_attribute),
      shopId:Number(stock.id_shop),shopGroupId:Number(stock.id_shop_group),dependsOnStock:['1',1,true].includes(stock.depends_on_stock),quantity:Number(stock.quantity)};
    })));
    return records;
   }
   const needNative=result=>{need(result?.status==='verified','TPV_NATIVE_RESULT_UNCERTAIN');return result.result;};
   if(input.action==='stock-receive')return respond(await nativeRequests.execute({operationId:input.operationId,command:'stock.receive',
    payload:{product_id:input.productId,attribute_id:input.attributeId,quantity:input.quantity,reason:input.reason}}));
   if(input.action==='prepare'){
    need(Array.isArray(input.lines)&&input.lines.length>0&&input.lines.length<=200&&input.lines.every(line=>
     Object.keys(line).every(key=>['productId','attributeId','qty','discount','displayName'].includes(key))&&positive(line.productId)&&
     Number.isSafeInteger(line.attributeId)&&line.attributeId>=0&&positive(line.qty)&&line.qty<=10000),'TPV_LINES_INVALID');
    for(const line of input.lines){if(Object.hasOwn(line,'discount'))lineAdjustment(line.discount);if(Object.hasOwn(line,'displayName'))need(typeof line.displayName==='string'&&lineName(line.displayName)===line.displayName&&line.displayName!=='','TPV_LINE_NAME_INVALID');}
    const note=saleNote(input.note),preparationProfile=await profile(),priceLines=input.lines.filter(line=>line.discount?.kind==='price'),namedLines=input.lines.filter(line=>line.displayName!==undefined);
    if(namedLines.length){need(preparationProfile.allowNameChanges,'TPV_LINE_NAME_FORBIDDEN');const ids=[...new Set(namedLines.map(line=>line.productId))];for(let i=0;i<ids.length;i+=4)await Promise.all(ids.slice(i,i+4).map(async productId=>{const cap=await transport.readNativeProductCapabilities(productId);need(cap?.source==='native-product-capabilities'&&cap.product_id===productId&&cap.shop_id===scope.shopId&&cap.temporary_line_names===true,'TPV_NATIVE_LINE_NAME_UNAVAILABLE');}));}
    need(!preparationProfile.requireSaleNote||note!==undefined,'TPV_SALE_NOTE_REQUIRED');
    if(note!==undefined){const productId=input.lines[0].productId,capabilities=await transport.readNativeProductCapabilities(productId);need(capabilities?.source==='native-product-capabilities'&&capabilities.product_id===productId&&capabilities.shop_id===scope.shopId&&capabilities.private_sale_note===true,'TPV_NATIVE_SALE_NOTE_UNAVAILABLE');}
    if(priceLines.length){need(preparationProfile.allowPriceChanges,'TPV_PRICE_CHANGE_FORBIDDEN');const ids=[...new Set(priceLines.map(line=>line.productId))];
     for(let i=0;i<ids.length;i+=4)await Promise.all(ids.slice(i,i+4).map(async productId=>{const capabilities=await transport.readNativeProductCapabilities(productId);need(capabilities?.source==='native-product-capabilities'&&capabilities.product_id===productId&&capabilities.shop_id===scope.shopId&&capabilities.unit_price_override===true,'TPV_NATIVE_PRICE_CHANGE_UNAVAILABLE');}));}
    {
     const nativeLines=input.lines.map(line=>({product_id:line.productId,attribute_id:line.attributeId,quantity:line.qty})),stocks=await stockRecords(nativeLines),shortages=new Set();
     for(let i=0;i<nativeLines.length;i++){const line=nativeLines[i],stock=stocks[i];need(stock&&stock.productId===line.product_id&&stock.attributeId===line.attribute_id&&stock.shopId===scope.shopId&&stock.shopGroupId===0&&!stock.dependsOnStock&&Number.isSafeInteger(stock.quantity)&&stock.quantity>=-2147483648&&stock.quantity<=2147483647,'TPV_QUOTE_STOCK_UNAVAILABLE');if(stock.quantity<line.quantity)shortages.add(line.product_id);}
     need(shortages.size===0||preparationProfile.allowOutOfStock,'TPV_QUOTE_STOCK_UNAVAILABLE');
     const ids=[...shortages];for(let i=0;i<ids.length;i+=4)await Promise.all(ids.slice(i,i+4).map(async productId=>{const policy=await transport.readNativeStockPolicy(productId);need(policy?.source==='native-product-stock-policy'&&policy.product_id===productId&&policy.shop_id===scope.shopId&&policy.allow_out_of_stock===true,'TPV_NATIVE_STOCK_POLICY_UNAVAILABLE');}));
    }
    const customerId=input.customerId??row.nativeProfile.counter_customer_id,
     invoiceAddressId=input.invoiceAddressId??row.nativeProfile.counter_address_id,deliveryAddressId=input.deliveryAddressId??invoiceAddressId;
    let draft=null;
    if(input.draftId!==undefined){
     need(uuid(input.draftId)&&positive(input.draftVersion),'TPV_DRAFT_REQUEST_INVALID');
     const original=check(await drafts('get',input.draftId,{},crypto.randomUUID()));
     const payload={lines:input.lines.map(line=>{const previous=original.payload.lines.find(previous=>previous.productId===line.productId&&previous.attributeId===line.attributeId),label=previous?.originalLabel||previous?.label||'Producto #'+line.productId;return {...line,label:line.displayName??label,originalLabel:label};}),
      customerId,invoiceAddressId,deliveryAddressId,...(note?{note}:{}),...(input.adjustment?{adjustment:input.adjustment}:{}),...(input.coupon?{coupon:input.coupon}:{})};
     draft=check(await drafts('bind',input.draftId,{version:input.draftVersion,payload,checkoutId:input.operationId}));
    }else need(input.draftVersion===undefined,'TPV_DRAFT_REQUEST_INVALID');
    const cart=needNative(await nativeRequests.execute({operationId:await nativeStepId(input.operationId,'cart'),command:'cart.prepare',payload:{
     session_id:scope.sessionId,drawer_id:scope.drawerId,customer_id:customerId,invoice_address_id:invoiceAddressId,...(preparationProfile.allowOutOfStock?{allow_out_of_stock:true}:{}),
     delivery_address_id:deliveryAddressId,...(note?{sale_note:note}:{}),lines:input.lines.map(line=>({product_id:line.productId,attribute_id:line.attributeId,quantity:line.qty,
      ...(line.discount?{discount:line.discount}:{}),...(line.displayName!==undefined?{display_name:line.displayName}:{})})),
     ...(input.adjustment?{adjustment:input.adjustment}:{}),...(input.coupon?{coupon:input.coupon}:{})}}));
    const quoteId=await nativeStepId(input.operationId,'quote');
    const quoted=needNative(await nativeRequests.execute({operationId:quoteId,command:'cart.quote',payload:{cart_id:cart.cart_id}}));
    need((quoted.quote?.sale_note_hash??undefined)===await saleNoteHash(note),'TPV_NATIVE_SALE_NOTE_MISMATCH');
    for(const line of namedLines)need(quoted.quote?.lines?.find(row=>row.product_id===line.productId&&row.attribute_id===line.attributeId)?.display_name===line.displayName,'TPV_NATIVE_LINE_NAME_MISMATCH');
    for(const line of priceLines){const native=quoted.quote?.lines?.find(row=>row.product_id===line.productId&&row.attribute_id===line.attributeId);need(native,'TPV_NATIVE_LINE_PRICE_MISMATCH');const micros=nativeMicros(native.unit_tax_incl);need(Math.abs(micros-line.discount.value*10000)<=3&&Math.round(micros/10000)===line.discount.value,'TPV_NATIVE_LINE_PRICE_MISMATCH');}
    const p=row.nativeProfile,prepared=await expectedFromNativeQuote({scope,ownedCart:{...scope,id:cart.cart_id,cartId:cart.cart_id,
     customerId,invoiceAddressId,deliveryAddressId,currencyId:p.currency_id,languageId:p.language_id,carrierId:p.carrier_id},
     profile:preparationProfile,response:quoted,stockRecords:await stockRecords(quoted.quote.lines)});
    prepared.expected.nativeQuoteOperationId=quoteId;
    if(priceLines.length)prepared.expected.hasPriceOverride=true;
    if(note)prepared.expected.hasSaleNote=true;
    if(namedLines.length)prepared.expected.hasLineNameOverrides=true;
    if(draft){prepared.expected.draftId=draft.id;prepared.expected.draftVersion=draft.version;}
    return respond(await ledger.prepare({scope,operationId:input.operationId,...prepared}));
   }
   const native=createNativeCapabilityAdapter({scope,transport,async verifyPrepared({record}){
    const fresh=await profile();need(fresh.operatorPaymentPolicy.revision===record.expected.operatorPaymentPolicy.revision&&
     JSON.stringify(fresh.nativePaymentLabels)===JSON.stringify(record.expected.nativePaymentLabels),'TPV_PAYMENT_POLICY_STALE');
    const prior=record.expected;need((prior.allowOutOfStock===true)===(fresh.allowOutOfStock===true),'TPV_STOCK_POLICY_STALE');
    need(prior.hasPriceOverride!==true||fresh.allowPriceChanges,'TPV_PRICE_CHANGE_FORBIDDEN');
    need(!fresh.requireSaleNote||prior.hasSaleNote===true,'TPV_SALE_NOTE_REQUIRED');
    need(prior.hasLineNameOverrides!==true||fresh.allowNameChanges,'TPV_LINE_NAME_FORBIDDEN');
    const response=await transport.quoteOwnedCart({operationId:crypto.randomUUID(),cartId:record.expected.cartId});
    need(response.quote_fingerprint===record.expected.nativeQuoteFingerprint,'TPV_QUOTE_CHANGED');
    await expectedFromNativeQuote({scope,ownedCart:{...scope,id:prior.cartId,cartId:prior.cartId,customerId:prior.customerId,
     invoiceAddressId:prior.invoiceAddressId,deliveryAddressId:prior.deliveryAddressId,currencyId:prior.currencyId,
     languageId:prior.languageId,carrierId:prior.carrierId},profile:fresh,response,stockRecords:await stockRecords(response.quote.lines)});
    return {unchanged:true,cartId:record.expected.cartId};
   }});
   const settlements=createOperatorPaymentVerifier({authorize:({action})=>authorize({action}),readPolicy:policy});
   const checkout=createCheckoutService({authorize,ledger,native,settlements});
   const command={operationId:input.operationId,selection:input.selection,payments:input.payments};
   return respond(input.action==='recover'?await checkout.reconcile(command):await checkout.submit(command));
  }catch(error){try{onError(error,{stage});}catch{}return respond({error:/^TPV_[A-Z0-9_]{1,90}$/.test(error?.message||'')?error.message:'TPV_REQUEST_FAILED',
   ...(['TPV_CUSTOMER_FIELDS_REJECTED','TPV_CATALOGUE_FIELDS_REJECTED'].includes(error?.message)&&typeof error.detail==='string'?{detail:error.detail}:{})},400);}
 };
}
