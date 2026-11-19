import {originalRefundPayments} from './refund-payments.js';
import {createOfflineWorkstationCache} from './offline-workstation-cache.js';
import {offlineBasketCommercial} from './offline-basket-commercial.js';
import {cataloguePricingContext} from './catalogue-pricing-context.js';
import {prepareOfflineCatalogue} from './offline-catalogue-preparation.js';
import {offlineCatalogueSearch} from './offline-catalogue-search.js';
import {offlineBasketPrices} from './offline-basket-prices.js';
import {createOfflineSourceStore} from './offline-source-store.js';
import {createOfflineCatalogueCache} from './offline-catalogue-cache.js';
import {commercialFromExpected,catalogueUnitMicros} from './offline-commercial.js';
/** Browser adapter: only normal authenticated Central calls. No shop URL,
 * credentials, native commands or privileged client can enter this module.
 * Request IDs survive response loss; financial commands are never auto-retried.
 */
import {lineName} from './line-name.js';
import {budgetDraft} from './budget-contract.js';
import {saleNote} from './sale-note.js';
import {taxSummary} from './tax-summary.js';
import {parkingExpiry} from './parking-options.js';
import {quotePaymentMethods} from './payment-options.js';
import {paymentReference,documentPaymentReferences} from './payment-reference.js';
import {catalogueSearchFields,DEFAULT_SEARCH_FIELDS} from './search-preferences.js';
import {catalogueFilters as normalizeCatalogueFilters} from './catalogue-preferences.js';
const need=(ok,message)=>{if(!ok)throw new Error(message);};
const clone=value=>structuredClone(value);
const ordered=value=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'?
 Object.fromEntries(Object.keys(value).sort().map(key=>[key,ordered(value[key])])):value;
const canonical=value=>JSON.stringify(ordered(value));
export function catalogueVariantAttributes(value){
 if(value===undefined)return [];
 need(Array.isArray(value)&&value.length<=64,'La tienda no ha confirmado los atributos de la variante.');
 const ids=new Set();return value.map(row=>{
  need(row&&Number.isSafeInteger(row.id)&&row.id>0&&Number.isSafeInteger(row.groupId)&&row.groupId>0&&
   typeof row.name==='string'&&row.name.trim().length>0&&Array.from(row.name).length<=128&&typeof row.groupName==='string'&&Array.from(row.groupName).length<=128&&!ids.has(row.id),'La tienda no ha confirmado los atributos de la variante.');
  ids.add(row.id);return {id:row.id,groupId:row.groupId,name:row.name,groupName:row.groupName};
 });
}
export function orderLookupInput(value){const text=String(value??'').trim();if(!text)return {};
 const tagged=/^R:/i.test(text);
 if(!tagged&&/^[0-9]+$/.test(text)){const orderId=Number(text);need(text.length<=15&&Number.isSafeInteger(orderId)&&orderId>0,'Escribe un número de pedido válido.');return {orderId};}
 const reference=(tagged?text.slice(2):text).toUpperCase();
 need(/^[A-Z0-9-]{1,10}$/.test(reference),'Escribe un número de pedido o una referencia válida.');return {reference};}
export function catalogueImageUrl(origin,path){
 try{const base=new URL(origin);if(base.protocol==='https:'&&base.href===base.origin+'/'&&
  typeof path==='string'&&/^\/img\/p\/(?:[0-9]\/)+[0-9]+\.jpg$/.test(path))return base.origin+path;}catch{}
 return null;
}
export function createCentralTpvAdapter({invoke,actorId,storage,uuid=()=>crypto.randomUUID(),catalogueCache=createOfflineCatalogueCache,centralCatalogueSource=()=>null,canReadCentralCatalogue=()=>true,sourceStore=createOfflineSourceStore}={}){
 need(typeof invoke==='function'&&actorId&&storage,'No se puede preparar el puesto.');
 let stations=[],selected=null,session=null,prepared=new Map(),localSnapshots=new Map(),returnSources=new Map(),customer=null,activeDraft=null,cachedPaymentOptions=null,offlineAccessDenied=false;
 const key='totus:tpv:requests:v1:'+actorId;
 const workstationCache=createOfflineWorkstationCache({actorId,storage});
 async function cachedRead(action){
  const scope=action==='context'?'':canonical([selection(),selected.connectionRevision]);
  let revision;try{revision=workstationCache.revision();}catch{}
  let data;try{data=await call(action);}catch(error){
   if(error?.code!=='TPV_CONNECTION_UNAVAILABLE')throw error;
   let saved;try{saved=workstationCache.get(action,scope);}catch{}
   if(!saved)throw error;return saved;
  }
  let currentRevision=revision;try{currentRevision=workstationCache.revision();}catch{}
  need(revision===undefined||currentRevision===revision,'El acceso ha cambiado durante la consulta. Actualiza el puesto.');
  const readAt=Date.now();try{workstationCache.put(action,scope,data,{expectedRevision:revision});}catch{}return {data,readAt};
 }
 function saved(){const raw=storage.getItem(key);if(!raw)return {};need(raw.length<100000,'El registro de solicitudes requiere revisión.');
  const value=JSON.parse(raw);need(value&&typeof value==='object'&&!Array.isArray(value),'Registro de solicitudes no válido.');return value;}
 const scopeKey=()=>JSON.stringify([selected?.connectionId,selected?.shopId,selected?.drawerId,session?.id]);
 const budgetScopeKey=()=>JSON.stringify([selected?.connectionId,selected?.shopId,selected?.drawerId]);
 async function operation(kind,payload,requestedId=null){const data=saved(),scope=['budget','barcode'].includes(kind)?budgetScopeKey():scopeKey(),
  fingerprint=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(payload))))].map(n=>n.toString(16).padStart(2,'0')).join(''),prior=data[kind];
  if(prior?.scope===scope&&prior.fingerprint===fingerprint)return prior.id;
  if(prior?.scope===scope&&!['prepare','park','claim-draft','release-draft','archive-draft','stock-receipt'].includes(kind))throw new Error('Hay una solicitud pendiente de esta operación. Recupera su resultado con los mismos datos antes de iniciar otra.');
  const id=requestedId||uuid();data[kind]={id,scope,fingerprint,...(kind==='budget'?{payload:clone(payload)}:{})};storage.setItem(key,JSON.stringify(data));return id;}
 function forget(kind,id){const data=saved();if(data[kind]?.id===id){delete data[kind];storage.setItem(key,JSON.stringify(data));}}
 const selection=()=>{need(selected,'Selecciona un puesto de caja.');return {connectionId:selected.connectionId,shopId:selected.shopId,
  drawerId:selected.drawerId,...(session?{sessionId:session.id}:{})};};
 function nativeLines(lines,labels=false){return lines.map(line=>{const pair=String(line.productId).split(':').map(Number);
  need(pair.length===2&&Number.isSafeInteger(pair[0])&&pair[0]>0&&Number.isSafeInteger(pair[1])&&pair[1]>=0,'Selecciona la variante del producto.');
  return {productId:pair[0],attributeId:pair[1],qty:line.qty,...(line.discount?{discount:line.discount}:{}),...(lineName(line.displayName)!==undefined?{displayName:lineName(line.displayName)}:{}),...(labels?{label:line.name||'Producto #'+pair[0],...(line.originalName?{originalLabel:line.originalName}:{})}:{})};});}
 const cartIntent=(lines,adjustment,coupon,labels=false,note)=>({lines:nativeLines(lines,labels),...(saleNote(note)?{note:saleNote(note)}:{}),...(adjustment?{adjustment}:{}),...(coupon?{coupon}:{}),
  ...(customer?{customerId:customer.id,invoiceAddressId:customer.addressId,deliveryAddressId:customer.addressId}:{})});
 async function releaseDraft(){if(!activeDraft)return;
  activeDraft=await call('get-draft',{draftId:activeDraft.id});
  if(activeDraft.status==='checkout'){
   const values={draftId:activeDraft.id,version:activeDraft.version},id=await operation('release-draft',values);
   activeDraft=await call('release-draft',values,id);forget('release-draft',id);
  }
  need(activeDraft.status==='claimed'&&activeDraft.mine&&activeDraft.sessionId===session.id,'El borrador ha cambiado. Consulta de nuevo los tickets aparcados.');
 }
 async function call(action,values={},id){let result;try{result=await invoke({action,...(action==='context'?{}:{selection:selection(),operationId:id||uuid()}),...values});}
  catch(error){if(/FORBIDDEN|PERMISSION|AUTH_REQUIRED|CONTEXT_STALE|CONNECTION_STALE/.test(error?.code||error?.message||'')){offlineAccessDenied=true;cachedPaymentOptions=null;try{workstationCache.revoke();}catch{}}throw error;}
  const draft=value=>({...value,...parkingExpiry(value)});
  if(action==='drafts'){need(Array.isArray(result),'No se han podido consultar los tickets aparcados.');return result.map(draft);}
  return ['get-draft','park','claim-draft','release-draft','archive-draft'].includes(action)?draft(result):result;}
 const receipt=(row,extra={})=>{
  const id=row.operationId||row.id,stored=prepared.get(id),base=row.totalTaxExclCents??stored?.totalTaxExclCents;
  const result={id,status:row.status,orderId:row.orderId,reference:row.orderId?'Pedido #'+row.orderId:'Operación '+id,
   totalCents:row.totalCents??stored?.totalCents??0,...(base===undefined?{}:{totalTaxExclCents:base}),...extra};
  taxSummary(result);return result;
 };
 const summary=row=>({...row,salesCents:Object.values(row.payments||{}).reduce((n,v)=>n+v,0),cashCents:row.payments?.cash||0,
  refundCashCents:row.refunds?.cash||row.refundPayments?.cash||0,unresolved:(row.unresolvedSales||row.pendingSales||0)+(row.pendingRefunds||0),
  differenceCents:row.countedCents==null?null:row.countedCents-row.expectedCashCents});
 async function restoreClaimedDraft(result){
  if(['sold','archived'].includes(result.status)){activeDraft=null;throw new Error('Este ticket ya se ha vendido o archivado. Consulta su historial.');}
  need(result.status==='claimed'&&result.mine,'Otro operador está utilizando este ticket.');activeDraft=result;
  const p=activeDraft.payload;let displayCustomer=null;customer=null;
  if(p.customerId&&p.customerId!==selected.nativeProfile?.counter_customer_id){
   const data=await call('customers',{customerId:p.customerId}),client=data.items?.find(row=>row.id===p.customerId),address=data.addresses?.find(row=>row.id===p.invoiceAddressId);
   need(client&&address,'Revisa el cliente y la dirección de este ticket antes de cobrar.');
   customer={id:p.customerId,addressId:p.invoiceAddressId};displayCustomer={...customer,name:[client.firstname,client.lastname].join(' '),addressLabel:address.alias};
  }
  return {draft:clone(activeDraft),customer:displayCustomer,adjustment:p.adjustment,coupon:p.coupon,note:saleNote(p.note),
   lines:p.lines.map(line=>({productId:line.productId+':'+line.attributeId,name:lineName(line.displayName)||line.label||'Producto #'+line.productId,originalName:line.originalLabel||line.label||'Producto #'+line.productId,...(lineName(line.displayName)?{customName:lineName(line.displayName)}:{}),
    qty:line.qty,unitCents:0,pricePending:true,stock:10000,minimumQty:1,
    ...(line.discount?{discountKind:line.discount.kind,discountValue:(line.discount.value/100).toFixed(2).replace('.',',')}:{})}))};
 }
 async function catalogueSource(){
   const chosen=selection(),revision=selected.connectionRevision,origin=canonical([chosen,revision]);
   if(!canReadCentralCatalogue()||!Number.isSafeInteger(revision)||revision<1)return null;
   let disk=null;try{disk=sourceStore({scope:{actorId,connectionId:chosen.connectionId,revision,shopId:chosen.shopId}});}catch{}
   const source=await centralCatalogueSource({connectionId:chosen.connectionId,revision});
   need(canonical([selection(),selected.connectionRevision])===origin,'El puesto ha cambiado durante la lectura del catálogo.');
   need(canReadCentralCatalogue(),'Ya no tienes acceso al catálogo compartido.');
   if(source===null){const cached=disk?await disk.get():null;need(canReadCentralCatalogue()&&canonical([selection(),selected.connectionRevision])===origin,'El acceso al catálogo ha cambiado.');return cached;}
   need(source&&source.connectionId===chosen.connectionId&&source.revision===revision&&source.productsComplete===true&&Array.isArray(source.products)&&Number.isSafeInteger(source.readAt)&&source.readAt>0&&source.readAt<=Date.now(),'La copia de Productos no corresponde a esta conexión.');
   need(typeof source.store==='string'&&source.store.length>0&&source.products.every(row=>row&&row.__store===source.store&&/^[1-9][0-9]{0,14}$/.test(String(row.id)))&&new Set(source.products.map(row=>String(row.id))).size===source.products.length,'La copia de Productos contiene artículos de otro catálogo o repetidos.');
   // A complete product list is not a payable quote: combinations, stock,
   // customer pricing and the workstation's tax policy have separate coverage.
   if(disk)await disk.put(source);
   need(canReadCentralCatalogue()&&canonical([selection(),selected.connectionRevision])===origin,'El acceso al catálogo ha cambiado.');return clone(source);
 }
 function catalogueStore(){return catalogueCache({scope:{actorId,connectionId:selected.connectionId,revision:selected.connectionRevision??0,drawerId:selected.drawerId,shopId:selected.shopId,customerId:customer?.id||0,addressId:customer?.addressId||0}});}
 function catalogueRequest({pricingQuantity=1,search='',page=0,productId=0,categoryId=0,sortField='name',sortDirection='asc',searchFields,catalogueFilters,variantGroupId=0,inventoryOnly=false}={}){
  return {...(pricingQuantity===1?{}:{pricingQuantity}),search,page,productId,categoryId,sortField,sortDirection,searchFields:catalogueSearchFields(searchFields),catalogueFilters:normalizeCatalogueFilters(catalogueFilters),variantGroupId,...(inventoryOnly?{inventoryOnly:true}:{}),...(customer?{customerId:customer.id,addressId:customer.addressId}:{})};
 }
 async function localQuote(id,intent){
   need(!offlineAccessDenied&&selected?.canSell===true&&session?.status==='open'&&!activeDraft,'Conecta para comprobar este puesto antes de preparar el cobro.');
   need(!intent.adjustment&&!intent.coupon&&!intent.lines.some(line=>line.discount),'Conecta para comprobar los descuentos de esta venta antes de cobrar.');
   const policy=cachedPaymentOptions;
   need(policy?.scope===scopeKey()&&Date.now()-policy.readAt>=0&&Date.now()-policy.readAt<300000,'Conecta para actualizar los medios de cobro de esta caja.');
   const options=policy.data.options,methods=options.enabledMethods;
   need(Array.isArray(methods)&&methods.length>0&&methods.every(method=>['cash','card','bizum','transfer'].includes(method)),'No se han confirmado los medios de cobro de esta caja.');
   const scope=scopeKey(),basket=await api.localBasketPrices({lines:intent.lines});
   need(scope===scopeKey(),'La caja ha cambiado durante el cálculo local.');
   const commercial=offlineBasketCommercial(basket);
   need(commercial.totalCents>0,'Revisa los importes de este ticket antes de cobrar.');
   const quote={id,totalCents:commercial.totalCents,totalTaxExclCents:commercial.totalTaxExclCents,currency:commercial.currency,
    quoteExpiresAt:Math.min(basket.validUntil,policy.readAt+300000),localEstimate:true,paymentMethods:clone(methods),paymentLabels:clone(options.labels),referencePolicy:clone(options.referencePolicy),lines:clone(commercial.lines),discountCents:0};
   localSnapshots.set(id,{expected:commercial,intent:clone(intent),scope});prepared.set(id,quote);return clone(quote);
 }
 async function warmCatalogue(){try{await catalogueSource();}catch{/* Online checkout remains available when optional device storage is unavailable. */}}
 const api=Object.freeze({
  mode:'qa',
  catalogueSource,
  async localBasketPrices({lines,pricingContext}){
   lines=clone(lines);
   let context=cataloguePricingContext(pricingContext);
   need(selected&&canReadCentralCatalogue(),'No tienes acceso al catálogo de este puesto.');
   const customerId=customer?.id??selected.nativeProfile?.counter_customer_id,addressId=customer?.addressId??selected.nativeProfile?.counter_address_id;
   const origin=canonical([selection(),selected.connectionRevision,customer]);
   const pages=await catalogueStore().pages({includeExpired:true});
   need(canReadCentralCatalogue()&&canonical([selection(),selected.connectionRevision,customer])===origin,'El puesto o cliente ha cambiado durante la consulta de precios.');
   if(!context){
    const candidates=pages.map(page=>({context:cataloguePricingContext(page.data?.pricingContext),at:page.requestedAt})).filter(row=>row.context?.shopId===selected.shopId&&row.context.customerId===customerId&&row.context.addressId===addressId).sort((a,b)=>b.at-a.at);
    need(candidates.length,'Falta el contexto de precios guardado para este cliente.');context={...candidates[0].context,quantity:1};
    need(!candidates.some(row=>row.at===candidates[0].at&&Object.keys(context).some(key=>key!=='quantity'&&row.context[key]!==context[key])),'La configuración de precios guardada es contradictoria. Actualiza el catálogo.');
   }
   need(context.shopId===selected.shopId&&context.customerId===customerId&&context.addressId===addressId,'Los precios no corresponden al cliente de esta venta.');
   return offlineBasketPrices({lines,pages,context});
  },
  async prepareOfflineCatalogue({onProgress=()=>{},signal,beforePage}={}){
   const origin=canonical([selection(),selected.connectionRevision,customer]);
   const isCurrent=()=>!signal?.aborted&&canReadCentralCatalogue()&&canonical([selection(),selected.connectionRevision,customer])===origin;
   const source=await catalogueSource();need(isCurrent(),'El puesto ha cambiado.');
   if(!source)return null;
   let cache=null;try{cache=catalogueStore();}catch{}
   return prepareOfflineCatalogue({source,isCurrent,onProgress,signal,beforePage,readCachedPage:async query=>{
    const saved=cache?await cache.get(catalogueRequest(query),{maxAgeMs:300000}):null;
    need(isCurrent(),'El puesto ha cambiado.');
    if(saved&&saved.data.pricingContext&&saved.requestedAt>=source.readAt&&saved.data.items.every(row=>Array.isArray(row.quantityBreaks)&&Number.isSafeInteger(row.priceValidForMs)&&row.priceValidForMs>0&&Number.isSafeInteger(row.unitTaxInclMicros)&&Number.isSafeInteger(row.unitTaxExclMicros))){
     const rows=saved.data.items;Object.defineProperties(rows,{priceReadAt:{value:saved.requestedAt},pricingContext:{value:saved.data.pricingContext},page:{value:saved.data.page},hasMore:{value:saved.data.hasMore}});return rows;
    }
    return null;
   },readPage:async query=>{
    const rows=await api.searchProducts(query);
    need(!rows.offlineCached&&!rows.cacheUnavailable,'No se pudo completar la copia de las variantes. Vuelve a intentarlo con conexión.');
    return rows;
   }});
  },
  offlineDelivery({deviceId}){
   need(typeof deviceId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(deviceId)&&session&&selected,'Abre la caja y prepara este dispositivo antes de sincronizar.');
   const original=canonical(selection());
   const guard=()=>need(canonical(selection())===original,'El puesto ha cambiado. Vuelve a las ventas pendientes de su caja original.');
   const send=async(action,operationId,values={})=>{guard();const result=await call(action,values,operationId);guard();return result;};
   const receive=async(operationId,ticket)=>{const saved=await send('offline-receive',operationId,{deviceId,ticket});
    need(saved?.id===operationId&&saved.deviceId===deviceId&&canonical(saved.ticket)===canonical(ticket),'No se ha podido verificar el ticket pendiente guardado en Central.');return saved;};
   const result=async(action,operationId)=>{const observed=await send(action,operationId);
    need(observed?.operationId===operationId,'La respuesta no corresponde a esta venta pendiente.');if(observed.status==='confirmed'&&observed.verified===true){forget('prepare',operationId);forget('submitted-sale',operationId);localSnapshots.delete(operationId);activeDraft=null;}return observed;};
   return Object.freeze({
    async dispatch({operationId,ticket}){await receive(operationId,ticket);return result('offline-sync',operationId);},
    async recover({operationId,ticket}){
     let saved=await send('offline-get',operationId);
     if(!saved)saved=await receive(operationId,ticket);
     need(saved.id===operationId&&saved.deviceId===deviceId&&canonical(saved.ticket)===canonical(ticket),'El ticket guardado no coincide con esta venta local.');
     // Before binding, the server resumes deterministic cart/quote steps. Once
     // bound, recovery consults the same financial operation without a new sale.
     return result(saved.checkoutId?'offline-recover':'offline-sync',operationId);
    }
   });
  },
  async context(){const {data}=await cachedRead('context');need(data.actorId===actorId&&Array.isArray(data.workstations),'El puesto no pertenece a esta sesión.');
   stations=data.workstations;need(stations.every(row=>row.environment==='qa'),'Entorno de pruebas no válido.');
   need(stations.every(row=>['canSell','canOpen','canReconcile'].every(key=>typeof row[key]==='boolean')),'No se han podido comprobar los permisos de esta caja.');
   offlineAccessDenied=false;
   return {stores:[...new Map(stations.map(row=>[row.storeId,{id:row.storeId,name:row.storeName}])).values()],
    drawers:stations.map(row=>({id:row.drawerId,storeId:row.storeId,name:row.drawerName,connectionId:row.connectionId,shopId:row.shopId,
     canSell:row.canSell,canOpen:row.canOpen,canReconcile:row.canReconcile})),
    sessions:stations.filter(row=>row.session).map(row=>({...row.session,storeId:row.storeId,drawerId:row.drawerId}))};},
  async selectSession(value){selected=stations.find(row=>row.drawerId===value.drawerId&&row.storeId===value.storeId);
   need(selected?.session?.id===value.id,'La sesión de caja ha cambiado.');session=clone(value);await warmCatalogue();need(session?.id===value.id,'La caja ha cambiado.');return clone(session);},
  async openSession({storeId,drawerId,openingCents}){selected=stations.find(row=>row.storeId===storeId&&row.drawerId===drawerId);
   need(selected?.canOpen,'No tienes permiso para abrir esta caja.');session=null;customer=null;activeDraft=null;
   const id=await operation('open',{storeId,drawerId,openingCents}),result=await call('open',{openingCents},id);
   need(result.id===id&&result.status==='open','No se ha confirmado la apertura de caja.');
   session={id,storeId,drawerId,status:'open',openingCents};forget('open',id);await warmCatalogue();need(session?.id===id,'La caja ha cambiado.');return clone(session);},
  async categories(){const {data}=await cachedRead('categories');need(Array.isArray(data.categories)&&data.has_more===false,'No se han podido consultar todas las categorías de esta tienda.');
   return data.categories.map(r=>({...r,label:r.parentName?r.parentName+' / '+r.name:r.name})).sort((a,b)=>a.label.localeCompare(b.label,'es',{numeric:true}));},
  async resolveIncident({operationId,reason,settlementReview}){const result=await call('resolve-incident',{reason,settlementReview},operationId);
   need(result.status==='cancelled','La incidencia sigue pendiente de revisión.');forget('prepare',operationId);forget('submitted-sale',operationId);prepared.delete(operationId);return receipt(result);},
  async searchProducts({pricingQuantity=1,search='',page=0,productId=0,categoryId=0,sortField='name',sortDirection='asc',searchFields,catalogueFilters,variantGroupId=0,inventoryOnly=false}={}){need(Number.isSafeInteger(pricingQuantity)&&pricingQuantity>=1&&pricingQuantity<=10000&&(pricingQuantity===1||productId>0&&sortField==='name')&&typeof inventoryOnly==='boolean'&&Number.isSafeInteger(variantGroupId)&&variantGroupId>=0&&variantGroupId<=2147483647&&(productId>0||variantGroupId===0),'Revisa el atributo de ordenación.');const fields=catalogueSearchFields(searchFields),filters=normalizeCatalogueFilters(catalogueFilters),query=catalogueRequest({pricingQuantity,search,page,productId,categoryId,sortField,sortDirection,searchFields:fields,catalogueFilters:filters,variantGroupId,inventoryOnly});
   const origin=canonical([selection(),customer]),requestedAt=Date.now();
   const guard=()=>need(canonical([selection(),customer])===origin,'El puesto o cliente ha cambiado. Vuelve a consultar los artículos.');
   let cache=null;try{if(!inventoryOnly)cache=catalogueStore();}catch{}
   let data;try{data=await call('catalogue',query);guard();}catch(error){
    guard();if(error?.code!=='TPV_CONNECTION_UNAVAILABLE'||!cache)throw error;
    const saved=await cache.get(query);guard();if(!saved){const source=await catalogueSource();guard();if(pricingQuantity===1&&source&&typeof cache.pages==='function'){const pages=await cache.pages();guard();return offlineCatalogueSearch(source,pages,query);}throw Error('No hay una copia reciente de estos artículos en este dispositivo. Conecta para descargarlos.');}
    const rows=saved.data.items;Object.defineProperties(rows,Object.fromEntries(Object.entries({...saved.data,items:undefined,offlineCached:true,cachedAt:saved.savedAt}).filter(([key])=>key!=='items').map(([key,value])=>[key,{value}])));return rows;
   }
   need((data.inventory_only??false)===inventoryOnly&&(!inventoryOnly||data.items?.every(row=>typeof row.enabled_for_sale==='boolean')),'La conexión no ha confirmado el catálogo de reposición. Pide al responsable que complete su preparación.');
   need(data.catalogue_filters?JSON.stringify(data.catalogue_filters)===JSON.stringify(filters):!filters.hideUnavailable&&!filters.excludedCategories.length,'La conexión aún no ha confirmado la visibilidad del catálogo. Pide al responsable que complete su preparación.');
   need(data.search_fields?JSON.stringify(data.search_fields)===JSON.stringify(fields):JSON.stringify(fields)===JSON.stringify(DEFAULT_SEARCH_FIELDS),'La conexión aún no ha confirmado estos criterios. Pide al responsable que complete la preparación del puesto.');
   need(!variantGroupId||data.variant_group_id===variantGroupId,'La conexión aún no ha confirmado el atributo de ordenación.');
   const variantGroups=data.variant_groups===undefined?[]:data.variant_groups;need(Array.isArray(variantGroups)&&variantGroups.length<=64&&variantGroups.every(row=>row&&Number.isSafeInteger(row.id)&&row.id>0&&typeof row.name==='string'&&Array.from(row.name).length<=128)&&new Set(variantGroups.map(row=>row.id)).size===variantGroups.length,'No se han podido comprobar los grupos de variantes.');
   need(Array.isArray(data.items)&&data.currency==='EUR'&&data.payable_cart_quote===false,'Catálogo nativo no válido.');
   if(sortField!=='name'||sortDirection!=='asc')need(data.sort_field===sortField&&data.sort_direction===sortDirection,'La tienda no ha confirmado esta ordenación. El responsable debe completar su preparación.');
   need(!data.building||sortField==='price'&&Number.isSafeInteger(data.building.done)&&Number.isSafeInteger(data.building.total)&&data.building.done>=0&&data.building.done<=data.building.total,'La tienda no ha confirmado el progreso de la ordenación.');
   const pricingContext=cataloguePricingContext(data.pricing_context);
   need(pricingQuantity===1&&!pricingContext||pricingContext?.quantity===pricingQuantity,'La tienda no ha confirmado el precio para esta cantidad.');
   need(!pricingContext||pricingContext.shopId===selected.shopId&&(!customer||pricingContext.customerId===customer.id&&pricingContext.addressId===customer.addressId),'El contexto de precios pertenece a otro puesto o cliente.');
   const items=data.items.map(row=>({id:row.id,name:row.name+(!row.choose_variant&&row.variant_name?' · '+row.variant_name:''),reference:row.reference,saleEnabled:row.enabled_for_sale!==false,
    quantityBreaks:row.quantity_breaks,priceValidForMs:row.price_valid_for_ms,unitTaxInclMicros:catalogueUnitMicros(row.unit_tax_incl),unitTaxExclMicros:catalogueUnitMicros(row.unit_tax_excl),stock:row.stock,temporaryLineNames:row.temporary_line_names===true,unitPriceOverride:row.unit_price_override===true,allowOutOfStock:row.allow_out_of_stock===true,priceCents:row.preview_cents,netPriceCents:Number.isSafeInteger(row.preview_tax_excl_cents)&&row.preview_tax_excl_cents>=0?row.preview_tax_excl_cents:null,minimumQty:row.minimum_quantity,chooseVariant:row.choose_variant,nativeProductId:row.product_id,
    variantAttributes:row.choose_variant?[]:catalogueVariantAttributes(row.variant_attributes),barcode:row.ean,upc:row.upc,isbn:row.isbn,manufacturer:row.manufacturer,supplier:row.supplier,costCents:row.cost_base_cents,imageUrl:catalogueImageUrl(data.image_origin,row.image_path)}));
   Object.defineProperties(items,{priceReadAt:{value:requestedAt},pricingContext:{value:pricingContext},variantGroups:{value:variantGroups.map(row=>({id:row.id,name:row.name}))},variantGroupId:{value:variantGroupId},hasMore:{value:data.has_more},page:{value:data.page},totalCount:{value:Number.isSafeInteger(data.total_count)?data.total_count:undefined},building:{value:data.building||null}});
   if(cache&&!data.building){try{await cache.put(query,{...(pricingContext?{pricingContext}:{}),items:[...items],hasMore:items.hasMore,page:items.page,variantGroups:items.variantGroups,variantGroupId,...(items.totalCount===undefined?{}:{totalCount:items.totalCount})},{requestedAt});}catch{Object.defineProperty(items,'cacheUnavailable',{value:true});}guard();}return items;},
  async quote({lines,adjustment,coupon,note}){
   const pending=saved()['submitted-sale'];need(!pending||pending.scope!==scopeKey(),'Hay un cobro pendiente de recuperar. Consulta su resultado antes de preparar otra venta.');
   const intent={...cartIntent(lines,adjustment,coupon,false,note),...(activeDraft?{draftId:activeDraft.id,draftVersion:activeDraft.version}:{})};
   const origin=scopeKey(),id=await operation('prepare',intent);let record;need(origin===scopeKey(),'La caja ha cambiado durante la preparación del ticket.');
   if(globalThis.navigator?.onLine===false)return localQuote(id,intent);
   try{record=await call('prepare',intent,id);}catch(error){
    if(['TPV_NATIVE_QUOTE_EXPIRED','TPV_QUOTE_EXPIRED'].includes(error?.code||error?.message)){
     await releaseDraft();
     forget('prepare',id);
     throw new Error('El cálculo ha caducado. Pulsa de nuevo Calcular y cobrar para obtener uno actualizado.');
    }
    if(error?.code==='TPV_CONNECTION_UNAVAILABLE')return localQuote(id,intent);
    throw error;
   }
   need(record.id===id&&record.status==='ready'&&Number.isSafeInteger(record.expected?.totalCents),'No se ha confirmado el cálculo nativo.');
   taxSummary(record.expected);
   if(record.quoteExpiresAt<=Date.now()){forget('prepare',id);throw new Error('El cálculo ha caducado. Pulsa de nuevo Calcular y cobrar para obtener uno actualizado.');}
   if(activeDraft)activeDraft={...activeDraft,version:record.expected.draftVersion,status:'checkout',checkoutId:id};
   const quote={id,totalCents:record.expected.totalCents,...(record.expected.totalTaxExclCents!==undefined?{totalTaxExclCents:record.expected.totalTaxExclCents}:{}),currency:record.scope.currency,quoteExpiresAt:record.quoteExpiresAt,
    paymentMethods:quotePaymentMethods(record.expected),
    paymentLabels:clone(record.expected.operatorPaymentPolicy?.labels||{}),
    referencePolicy:clone(record.expected.operatorPaymentPolicy?.referencePolicy||{}),
    lines:clone(record.expected.lines||[]),discountCents:record.expected.discountCents||0};
   localSnapshots.set(id,{expected:clone(record.expected),intent:clone(intent),scope:scopeKey()});
   prepared.set(id,quote);return clone(quote);},
  localSaleTicket({operationId,payments}){
   const snapshot=localSnapshots.get(operationId);if(!snapshot)return null;
   const local=prepared.get(operationId);need(!local?.localEstimate||!offlineAccessDenied&&Date.now()<local.quoteExpiresAt,'El cálculo sin conexión ha caducado. Vuelve al ticket y calcula de nuevo antes de cobrar.');
   need(snapshot.scope===scopeKey()&&session,'La caja del ticket ha cambiado.');
   need(payments.every(row=>row.method==='cash'||row.simulatedAccepted===true),'Confirma que has recibido el cobro externo.');
   const commercial=commercialFromExpected(snapshot.expected),intent=snapshot.intent;
   return {commercial,cashSessionId:session.id,currency:commercial.currency,totalCents:commercial.totalCents,lines:clone(intent.lines),...(intent.note?{note:intent.note}:{}),...(intent.adjustment?{adjustment:clone(intent.adjustment)}:{}),...(intent.coupon?{coupon:intent.coupon}:{}),payments:payments.map(row=>({method:row.method,amountCents:row.amountCents,...(row.method==='cash'?{receivedCents:row.receivedCents}:{}),...(row.reference===undefined?{}:{reference:paymentReference(row.reference)})}))};
  },
  leaveLocalTicket(id){
   const snapshot=localSnapshots.get(id);
   const pending=saved().prepare;
   need(snapshot?.scope===scopeKey()&&prepared.has(id)||pending?.scope===scopeKey()&&pending.id===id,'No se encuentra el ticket guardado de esta caja.');
   // The durable device journal owns this ticket now. Release only the browser
   // preparation pointer so an identical NEXT purchase receives another ID.
   forget('prepare',id);
   if(snapshot&&activeDraft?.id===snapshot.intent.draftId)activeDraft=null;
  },
  async discardQuote(id){const pending=saved()['submitted-sale'];if(pending?.scope===scopeKey()&&pending.id===id){
   const status=await call('sale-status',{},id);need(status.status==='ready','Este cobro ya se envió. Recupera su resultado antes de continuar.');}
   await releaseDraft();forget('prepare',id);forget('submitted-sale',id);prepared.delete(id);localSnapshots.delete(id);},
  async pendingSale(){const data=saved(),scope=scopeKey();for(const kind of ['submitted-sale','prepare'])if(data[kind]?.scope===scope)return data[kind].id;
   let rows;try{rows=await call('history');}catch(error){if(error?.code==='TPV_CONNECTION_UNAVAILABLE')return null;throw error;}return rows.find(row=>['dispatched','uncertain'].includes(row.status))?.id||null;},
  async submit({operationId,payments}){const quote=prepared.get(operationId);need(quote,'Vuelve a preparar el cobro.');
   need(payments.every(row=>row.method==='cash'||['card','bizum','transfer'].includes(row.method)&&row.simulatedAccepted===true),'Confirma que has recibido el cobro externo.');
   const allocations=payments.map(row=>({id:row.method,method:row.method,amountCents:row.amountCents,
    ...(row.reference===undefined?{}:{reference:paymentReference(row.reference)}),
    ...(row.method==='cash'?{receivedCents:row.receivedCents}:{})}));
   const request={allocations,confirmation:{operationId,totalCents:quote.totalCents,currency:quote.currency,accepted:true}};
   need(await operation('submitted-sale',request,operationId)===operationId,'Hay otro cobro pendiente de recuperar.');
   const change=payments.filter(row=>row.method==='cash').reduce((n,row)=>n+row.receivedCents-row.amountCents,0);
   try{const result=await call('submit',{payments:request},operationId);if(result.status==='confirmed'){forget('prepare',operationId);forget('submitted-sale',operationId);localSnapshots.delete(operationId);activeDraft=null;}
    return receipt(result,{totalCents:quote.totalCents,changeCents:change});
   }catch{ return receipt({id:operationId,status:'uncertain',totalCents:quote.totalCents},{changeCents:change}); }
  },
  async recover({operationId}){const status=await call('sale-status',{},operationId);
   if(status.status==='ready'){
    taxSummary(status);
    need(status.canSubmit!==false,'Este cobro lo preparó otro operador. No vuelvas a cobrarlo.');
    if(status.draftId)activeDraft=await call('get-draft',{draftId:status.draftId});
    if(status.localSnapshot){const expected=commercialFromExpected(status.localSnapshot.expected);need(expected.totalCents===status.totalCents&&expected.currency===status.currency,'El ticket recuperado no coincide con su cálculo.');localSnapshots.set(operationId,{expected,intent:clone(status.localSnapshot.intent),scope:scopeKey()});}
    prepared.set(operationId,status);return receipt(status,{payment:status,draft:activeDraft});}
   const result=['confirmed','cancelled'].includes(status.status)?status:await call('recover',{},operationId);
   if(['confirmed','cancelled'].includes(result.status)){forget('prepare',operationId);forget('submitted-sale',operationId);activeDraft=null;}
   return receipt(result,{totalCents:status.totalCents,...(status.totalTaxExclCents===undefined?{}:{totalTaxExclCents:status.totalTaxExclCents})});},
  async drafts(){return call('drafts');},
  async budgets(query={}){return call('budgets',{query});},
  async getBudget(id){return call('budget-get',{},id);},
  pendingBudget(){return saved().budget?.scope===budgetScopeKey();},
  async recoverBudgetPreparation(){const pending=saved().budget;if(!pending||pending.scope!==budgetScopeKey())return null;
   need(pending.payload,'No se conservan los datos de este presupuesto. Revisa su resultado antes de preparar otro.');
   const result=await call('budget-create',{payload:budgetDraft(pending.payload)},pending.id);need(result.id===pending.id,'No se ha confirmado el presupuesto.');forget('budget',pending.id);return result;},
  async saveBudget({lines,adjustment,coupon,note,title,publicNote,validDays}){
   const payload=budgetDraft({...cartIntent(lines,adjustment,coupon,false,note),title,publicNote,validDays});
   need(new TextEncoder().encode(JSON.stringify(payload)).byteLength<=60000,'El presupuesto contiene demasiado texto. Reduce los nombres o el número de artículos.');
   const id=await operation('budget',payload),result=await call('budget-create',{payload},id);need(result.id===id&&result.status==='saved','No se ha confirmado el guardado del presupuesto.');forget('budget',id);return result;
  },
  async findInvoiceSignature(saleId){return call('signature-find',{},saleId);},
  async prepareInvoiceSignature({operationId,saleId}){return call('signature-prepare',{saleId},operationId);},
  async getInvoiceSignature(operationId){return call('signature-get',{},operationId);},
  async signInvoice({operationId,originalSha256,ink,accepted}){return call('signature-sign',{originalSha256,ink,accepted},operationId);},
  async cancelInvoiceSignature(operationId){return call('signature-cancel',{},operationId);},
  async openBudget({id,version}){need(!activeDraft,'Aparca o descarta el ticket actual antes de abrir un presupuesto.');
   const result=await call('budget-open',{version},id);need(result.budget?.id===id&&result.draft,'No se ha confirmado la conversión del presupuesto.');
   if(result.draft.status==='checkout')return {budget:result.budget,checkoutId:result.draft.checkoutId};
   return {...await restoreClaimedDraft({...result.draft,...parkingExpiry(result.draft)}),budget:result.budget};
  },
  async cancelBudget({id,version}){const result=await call('budget-cancel',{version},id);need(result.budget?.id===id&&result.budget.status==='cancelled','No se ha confirmado la anulación del presupuesto.');return result.budget;},
  async archiveDraft({draftId,version}){const values={draftId,version},id=await operation('archive-draft',values),result=await call('archive-draft',values,id);
   need(result.status==='archived','No se ha confirmado el archivo del ticket.');forget('archive-draft',id);return result;},
  async park({lines,adjustment,coupon,note,label}){
   if(activeDraft){const current=await call('get-draft',{draftId:activeDraft.id});if(current.status==='parked'){
    activeDraft=null;const same=canonical(current.payload)===canonical(cartIntent(lines,adjustment,coupon,true,note))&&current.label===label;
    if(same)return current;throw new Error('El ticket anterior ya está aparcado. Los cambios actuales siguen en pantalla; puedes aparcarlos como otro ticket.');
   }}
   await releaseDraft();const values={version:activeDraft?.version||0,label,payload:cartIntent(lines,adjustment,coupon,true,note),
    ...(activeDraft?{draftId:activeDraft.id}:{})},id=await operation('park',values),result=await call('park',values,id);
   need(result.status==='parked','No se ha confirmado el ticket aparcado.');forget('park',id);activeDraft=null;return result;
  },
  async claimDraft({draftId}){
   need(!activeDraft||activeDraft.id===draftId,'Aparca o descarta el ticket actual antes de abrir otro.');
   const current=await call('get-draft',{draftId}),values={draftId,version:current.version},id=await operation('claim-draft',values);
   const result=await call('claim-draft',values,id);forget('claim-draft',id);
   return restoreClaimedDraft(result);
  },
  async abandonDraft(){if(!activeDraft)return;const current=await call('get-draft',{draftId:activeDraft.id});
   if(current.status==='archived'){activeDraft=null;return;}await releaseDraft();
   const values={draftId:activeDraft.id,version:activeDraft.version},id=await operation('archive-draft',values);
   const result=await call('archive-draft',values,id);need(result.status==='archived','El borrador sigue pendiente.');forget('archive-draft',id);activeDraft=null;
  },
  async history(){return (await call('history')).map(row=>receipt(row,{...row,
    reference:row.orderId?'Pedido #'+row.orderId:'Cobro preparado'}));},
  async orders({orderId,reference}={}){
   need(orderId===undefined||Number.isSafeInteger(orderId)&&orderId>0,'Escribe un número de pedido válido.');
   need(reference===undefined||typeof reference==='string'&&/^[A-Za-z0-9-]{1,10}$/.test(reference),'Escribe una referencia válida.');
   need(orderId===undefined||reference===undefined,'Busca por número o por referencia.');
   return (await call('orders',reference!==undefined?{reference:reference.toUpperCase()}:orderId?{orderId}:{})).map(row=>receipt(row,{...row,reference:'Pedido #'+row.orderId}));},
  async document({saleId,kind,refundId}){return call('document',{kind,...(refundId?{refundId}:{})},saleId);},
  async searchCustomers({search='',page=0,customerId=0}={}){const data=await call('customers',{search,page,customerId});
   need(data?.shop_id===selected.shopId&&Array.isArray(data.items)&&Array.isArray(data.addresses)&&data.defaults?.guest_group_id>0,'No se ha podido verificar el directorio de esta tienda.');return data;},
  async customerMetadata(countryId){return call('customer-metadata',{countryId});},
  async setCustomer(value){if(value===null){customer=null;return;}
   const current=await call('customers',{customerId:value.id});
   need(current.items.length===1&&current.addresses.some(row=>row.id===value.addressId),'Selecciona una dirección vigente de este cliente.');
   customer={id:value.id,addressId:value.addressId};},
  async writeCustomer({resource,recordId,fields}){const values={resource,operation:recordId?'update':'create',...(recordId?{recordId}:{}),fields},
   id=await operation('customer-write',values);let result;
   try{result=await call('customer-write',values,id);}catch(error){if(error.code==='TPV_CUSTOMER_FIELDS_REJECTED')forget('customer-write',id);throw error;}
   need((result.persisted===true||result.unchanged===true)&&result.verified===true,'No se ha confirmado la ficha en la tienda.');forget('customer-write',id);return result;},
  async returnable({saleId}){const source=await call('returnable',{saleId});returnSources.set(saleId,source);
   const references=source.originalPaymentReferences;
   const payment_intent=references&&typeof references==='object'&&!Array.isArray(references)?Object.entries(references).map(([method,external_reference])=>({method,external_reference})):null;
   return {saleId,reference:'Pedido #'+source.orderId,pendingRefund:source.pendingRefund,availablePayments:clone(source.remaining_payments),requireOriginalPayment:source.returnPolicy?.requireOriginalPayment===true,
    originalPaymentReferences:documentPaymentReferences({kind:'receipt',payment_intent}),
    lines:source.items.map(line=>({productId:String(line.detail_id),name:line.name,remainingQty:line.remaining_quantity}))};},
  async prepareRefund({operationId,saleId,items,reason,refundMethod='original'}){const source=returnSources.get(saleId);need(source,'Vuelve a consultar la venta.');
   const chosen=items.map(item=>({detailId:Number(item.productId),qty:item.qty,restock:item.restock}));
   let total=0;for(const item of chosen){const row=source.items.find(row=>row.detail_id===item.detailId);
    need(row&&Number.isSafeInteger(item.qty)&&item.qty>0&&item.qty<=row.remaining_quantity,'Cantidad de devolución no válida.');
    total+=Number((BigInt(row.allocated_cents)*BigInt(row.returned_quantity+item.qty)*2n+BigInt(row.sold_quantity))/(2n*BigInt(row.sold_quantity)))-row.refunded_cents;}
   need(refundMethod==='original'||['cash','card','bizum','transfer'].includes(refundMethod)&&source.remaining_payments[refundMethod]>=total,
    'El medio elegido no tiene saldo suficiente de la venta original para este reintegro. Selecciona el reparto original.');
   need(source.returnPolicy?.requireOriginalPayment!==true||refundMethod==='original','Esta caja exige repartir el reintegro entre los medios originales. Vuelve a consultar la venta.');
   let remaining=total;let payments=[];if(source.returnPolicy?.requireOriginalPayment===true){payments=originalRefundPayments(total,source.remaining_payments);remaining=0;}else for(const method of refundMethod==='original'?['cash','card','bizum','transfer']:[refundMethod]){const amount=Math.min(remaining,source.remaining_payments[method]||0);
    if(amount>0){payments.push({method,amountCents:amount});remaining-=amount;}}
   need(remaining===0,'No se puede distribuir este reintegro con los pagos originales.');
   return {...await call('prepare-refund',{saleId,items:chosen,payments,...(reason?{reason}:{})},operationId),payments};},
  async submitRefund({operationId,totalCents,refundConfirmed}){need(refundConfirmed===true,'Confirma el reintegro al cliente.');
   try{return await call('submit-refund',{confirmation:{operationId,totalCents,currency:'EUR',accepted:true}},operationId);}
   catch{return {id:operationId,status:'uncertain',totalCents,retryRefundForbidden:true};}},
  async cancelRefund(id){return call('cancel-refund',{},id);},async recoverRefund(id){return call('recover-refund',{},id);},
  async sessionSummary(){return summary(await call('cash-summary'));},
  async cashReports({sessionId}={}){return call('cash-reports',sessionId?{reportSessionId:sessionId}:{});},
  async selectWorkstation({storeId,drawerId}){need(!session,'La caja ya está seleccionada para la sesión abierta.');
   const row=stations.find(row=>row.storeId===storeId&&row.drawerId===drawerId);need(row?.canReconcile,'No tienes acceso a los informes de esta caja.');selected=row;},
  async cashMovement(values){const id=await operation('movement',values);try{const result=await call('cash-movement',values,id);forget('movement',id);return summary(result);}
   catch(error){if(['TPV_CASH_BALANCE_INVALID','TPV_CASH_MOVEMENT_INVALID'].includes(error.code))forget('movement',id);throw error;}},
  async receiveStock({productId,quantity,reason}){const [product,attribute]=productId.split(':').map(Number),values={productId:product,attributeId:attribute,quantity,reason},
   id=await operation('stock',values),result=await call('stock-receive',values,id);if(result.status==='verified')forget('stock',id);return result;},
  async stockReceipts(){return call('stock-receipts');},
  async barcodeOptions(settings){return call('barcode-options',settings===undefined?{}:{settings});},
  async paymentOptions(settings){const scope=scopeKey(),{data,readAt}=settings===undefined?await cachedRead('payment-options'):{data:await call('payment-options',{settings}),readAt:Date.now()};need(scope===scopeKey(),'La caja ha cambiado.');if(settings!==undefined)try{workstationCache.put('payment-options',canonical([selection(),selected.connectionRevision]),data);}catch{}cachedPaymentOptions={scope,readAt,data:clone(data)};return data;},
  async barcodeLabels(id,query={}){return call('barcode-labels',{query},id);},
  async barcodeJobs(){return call('barcodes');},
  async createBarcodeJob(){const id=await operation('barcode',{}),result=await call('barcode-create',{},id);forget('barcode',id);return result;},
  async getBarcodeJob(id,query={}){const result=await call('barcode-get',{query},id);forget('barcode',id);return result;},
  async captureBarcodeJob(id){return call('barcode-capture',{},id);},
  async confirmBarcodeJob(id,accepted){need(accepted===true,'Confirma que has revisado los artículos antes de generar sus códigos.');return call('barcode-confirm',{accepted:true},id);},
  async advanceBarcodeJob(id){return call('barcode-step',{},id);},
  async pauseBarcodeJob(id){return call('barcode-pause',{},id);},
  async resumeBarcodeJob(id){return call('barcode-resume',{},id);},
  async cancelBarcodeJob(id){return call('barcode-cancel',{},id);},
  async createStockReceipt({reason,lines}){const payload={reason,lines:lines.map(row=>{
   const [productId,attributeId]=row.productId.split(':').map(Number);return {productId,attributeId,quantity:row.quantity,label:row.name};})};
   const id=await operation('stock-receipt',payload),result=await call('stock-receipt-create',{payload},id);forget('stock-receipt',id);return result;},
  async advanceStockReceipt(id){return call('stock-receipt-step',{},id);},
  async getStockReceipt(id){return call('stock-receipt-get',{},id);},
  async cancelStockReceipt(id){return call('stock-receipt-cancel',{},id);},
  async productProfile(){return call('product-profile');},
  async productMetadata(resource,page=0,recordId){return call('product-metadata',{resource,page,...(recordId?{recordId}:{})});},
  async productIntakes(){return call('product-intakes');},
  async categoryIntakes(){return call('product-categories');},
  async prepareCategoryIntake(payload){const id=await operation('category-intake',payload);
   try{const result=await call('product-category-prepare',{payload},id);forget('category-intake',id);return result;}
   catch(error){if(['TPV_CATALOGUE_FIELDS_REJECTED','TPV_PRODUCT_WRITE_UNAVAILABLE'].includes(error.code))forget('category-intake',id);throw error;}},
  async getCategoryIntake(id){const result=await call('product-category-get',{},id);forget('category-intake',id);return result;},
  async advanceCategoryIntake(id){return call('product-category-step',{},id);},
  async cancelCategoryIntake(id){return call('product-category-cancel',{},id);},
  async recoverCategoryPreparation(){const pending=saved()['category-intake'];if(!pending)return null;
   let prior;try{prior=JSON.parse(pending.scope);}catch{throw Error('Revisa el registro de solicitudes de esta cuenta.');}
   if(JSON.stringify(prior.slice(0,3))!==JSON.stringify([selected?.connectionId,selected?.shopId,selected?.drawerId]))return null;
   try{const result=await call('product-category-get',{},pending.id);forget('category-intake',pending.id);return result;}
   catch(error){if(error.code!=='TPV_CATALOGUE_INTENT_NOT_FOUND')throw error;forget('category-intake',pending.id);return null;}},
  async recoverProductPreparation(){const pending=saved()['product-intake'];if(!pending)return null;
   let prior;try{prior=JSON.parse(pending.scope);}catch{throw Error('Revisa el registro de solicitudes de esta cuenta.');}
   if(JSON.stringify(prior.slice(0,3))!==JSON.stringify([selected?.connectionId,selected?.shopId,selected?.drawerId]))return null;
   try{const result=await call('product-intake-get',{},pending.id);forget('product-intake',pending.id);return result;}
   catch(error){if(error.code!=='TPV_PRODUCT_NOT_FOUND')throw error;
    // Preparation never writes a native product. A late response can only save
    // another reviewable draft, which the saved-work list will retain.
    forget('product-intake',pending.id);return null;}},
  async prepareProductIntake(payload){const id=await operation('product-intake',payload);
   try{const result=await call('product-intake-prepare',{payload},id);forget('product-intake',id);return result;}
   catch(error){if(['TPV_PRODUCT_ATTRIBUTE_GROUP_REPEATED','TPV_PRODUCT_METADATA_INVALID','TPV_PRODUCT_CURRENCY_INVALID','TPV_PRODUCT_WRITE_UNAVAILABLE'].includes(error.code))forget('product-intake',id);throw error;}},
  async getProductIntake(id){const result=await call('product-intake-get',{},id);forget('product-intake',id);return result;},
  async advanceProductIntake(id){return call('product-intake-step',{},id);},
  async cancelProductIntake(id){return call('product-intake-cancel',{},id);},
  async closeSession({countedCents,note=''}){const id=await operation('close',{countedCents,note}),result=await call('close',{countedCents,note},id);
   need(result.status==='closed','No se ha confirmado el cierre.');forget('close',id);session=null;activeDraft=null;customer=null;return summary(result);}
 });
 return api;
}
