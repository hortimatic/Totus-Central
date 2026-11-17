import {budgetDraft} from '../budget-contract.js';
import {saleNoteHash} from '../sale-note.js';
import {nativeQuoteFingerprint} from './quote-contract.js';
import {commercialFromNativeQuote} from './commercial-quote-contract.js';
import {createNativeRequestService,nativeStepId} from './native-request-service.js';
const need=(ok,code)=>{if(!ok)throw Error(code);};
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
/** Non-financial commercial workflow. Quotation identities are separate from
 * cash sessions; conversion will always prepare an ordinary payable cart. */
export function createCommercialBudgetService({rpc,scope,transport,nativeProfile,authorizeCustomer=async()=>{throw Error('TPV_CUSTOMER_CONTEXT_INVALID');}}){
 need(typeof rpc==='function'&&scope?.actorId,'TPV_BUDGET_STORAGE_UNAVAILABLE');scope=structuredClone(scope);nativeProfile=structuredClone(nativeProfile);
 async function result(name,args){const response=await rpc(name,args);if(response?.error)throw Error(/^TPV_[A-Z0-9_]{1,90}$/.test(response.error.message||'')?response.error.message:'TPV_BUDGET_STORAGE_UNAVAILABLE');need(response&&Object.hasOwn(response,'data'),'TPV_BUDGET_STORAGE_UNAVAILABLE');return response.data;}
 const stored=(action,id,data={},selected=scope)=>result('totus_tpv_budgets',{p_action:action,p_scope:selected,p_id:id,p_data:data});
 const transition=(action,id,version)=>{need(uuid(id)&&Number.isSafeInteger(version)&&version>0,'TPV_BUDGET_REQUEST_INVALID');return result('totus_tpv_budget_checkout',{p_action:action,p_scope:scope,p_id:id,p_version:version});};
 return Object.freeze({list:query=>stored('list',null,query||{}),get:id=>{need(uuid(id),'TPV_BUDGET_REQUEST_INVALID');return stored('get',id);},
  open:(id,version)=>transition('open',id,version),cancel:(id,version)=>transition('cancel',id,version),
  async create(operationId,input){
   need(uuid(operationId),'TPV_BUDGET_REQUEST_INVALID');operationId=operationId.toLowerCase();const draft=budgetDraft(input),commercialScope={...scope,sessionId:operationId},intentHash=await nativeQuoteFingerprint(draft);
   const prior=await stored('recover',operationId,{intentHash},commercialScope);if(prior)return prior;
   need(transport&&nativeProfile?.verified===true&&nativeProfile.configured===true&&nativeProfile.native_version==='8.2.8'&&nativeProfile.shop_id===scope.shopId,'TPV_WORKSTATION_NOT_CONFIGURED');
   const options=await result('totus_tpv_commercial_options',{p_scope:commercialScope}),priceLines=draft.lines.filter(line=>line.discount?.kind==='price'),named=draft.lines.filter(line=>line.displayName!==undefined);
   need(!priceLines.length||options?.allowPriceChanges===true,'TPV_PRICE_CHANGE_FORBIDDEN');need(!named.length||options?.allowNameChanges===true,'TPV_LINE_NAME_FORBIDDEN');
   const products=[...new Set(draft.lines.map(line=>line.productId))];for(let i=0;i<products.length;i+=4)await Promise.all(products.slice(i,i+4).map(async productId=>{
    const c=await transport.readNativeProductCapabilities(productId);need(c?.source==='native-product-capabilities'&&c.product_id===productId&&c.shop_id===scope.shopId&&c.commercial_quotes===true&&c.commercial_scope===true&&c.commercial_document_data===true,'TPV_NATIVE_COMMERCIAL_QUOTE_UNAVAILABLE');
    need(!priceLines.some(line=>line.productId===productId)||c.unit_price_override===true,'TPV_NATIVE_PRICE_CHANGE_UNAVAILABLE');need(!named.some(line=>line.productId===productId)||c.temporary_line_names===true,'TPV_NATIVE_LINE_NAME_UNAVAILABLE');
   }));
   const customerId=draft.customerId??nativeProfile.counter_customer_id,invoiceAddressId=draft.invoiceAddressId??nativeProfile.counter_address_id,deliveryAddressId=draft.deliveryAddressId??invoiceAddressId;
   if(customerId!==nativeProfile.counter_customer_id)await authorizeCustomer();
   const native=createNativeRequestService({rpc,transport,scope:commercialScope}),cartOperationId=await nativeStepId(operationId,'cart','budget'),quoteOperationId=await nativeStepId(operationId,'quote','budget');
   const verified=record=>{need(record?.status==='verified'&&record.result?.verified===true,'TPV_NATIVE_RESULT_UNCERTAIN');return record.result;};
   const cart=verified(await native.execute({operationId:cartOperationId,command:'cart.prepare',payload:{session_id:commercialScope.sessionId,drawer_id:scope.drawerId,customer_id:customerId,invoice_address_id:invoiceAddressId,delivery_address_id:deliveryAddressId,commercial_only:true,
    lines:draft.lines.map(line=>({product_id:line.productId,attribute_id:line.attributeId,quantity:line.qty,...(line.discount?{discount:line.discount}:{}),...(line.displayName?{display_name:line.displayName}:{})})),...(draft.adjustment?{adjustment:draft.adjustment}:{}),...(draft.coupon?{coupon:draft.coupon}:{}),...(draft.note?{sale_note:draft.note}:{})}}));
   need(cart.commercial_only===true,'TPV_NATIVE_COMMERCIAL_QUOTE_UNAVAILABLE');
   const quoted=verified(await native.execute({operationId:quoteOperationId,command:'cart.quote',payload:{cart_id:cart.cart_id,commercial_only:true}}));
   need((quoted.quote?.sale_note_hash??undefined)===await saleNoteHash(draft.note),'TPV_NATIVE_SALE_NOTE_MISMATCH');
   const commercial=await commercialFromNativeQuote({scope:commercialScope,ownedCart:{...commercialScope,commercialOnly:true,cartId:cart.cart_id,customerId,counterCustomerId:nativeProfile.counter_customer_id,invoiceAddressId,deliveryAddressId,currencyId:nativeProfile.currency_id,languageId:nativeProfile.language_id,carrierId:nativeProfile.carrier_id},profile:{...commercialScope,verified:true,nativeVersion:'8.2.8',quoteLifetimeMs:120000},response:quoted});
   need(commercial.snapshot.merchant,'TPV_BUDGET_DOCUMENT_INVALID');
   const payload={lines:draft.lines.map(line=>{const item=commercial.snapshot.lines.find(item=>item.productId===line.productId&&item.attributeId===line.attributeId);need(item,'TPV_BUDGET_SNAPSHOT_INVALID');return {...line,label:item.name,originalLabel:item.catalogueName};}),customerId,invoiceAddressId,deliveryAddressId,...(draft.adjustment?{adjustment:draft.adjustment}:{}),...(draft.coupon?{coupon:draft.coupon}:{}),...(draft.note?{note:draft.note}:{})};
   return stored('create',operationId,{intentHash,payload,snapshot:commercial.snapshot,cartOperationId,quoteOperationId,calculationExpiresAt:commercial.calculationExpiresAt,title:draft.title,publicNote:draft.publicNote,validDays:draft.validDays},commercialScope);
  }
 });
}
