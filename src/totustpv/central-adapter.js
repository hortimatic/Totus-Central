/** Browser adapter: only normal authenticated Central calls. No shop URL,
 * credentials, native commands or privileged client can enter this module.
 * Request IDs survive response loss; financial commands are never auto-retried.
 */
import {lineName} from './line-name.js';
import {saleNote} from './sale-note.js';
import {parkingExpiry} from './parking-options.js';
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
export function createCentralTpvAdapter({invoke,actorId,storage,uuid=()=>crypto.randomUUID()}={}){
 need(typeof invoke==='function'&&actorId&&storage,'No se puede preparar el puesto.');
 let stations=[],selected=null,session=null,prepared=new Map(),returnSources=new Map(),customer=null,activeDraft=null;
 const key='totus:tpv:requests:v1:'+actorId;
 function saved(){const raw=storage.getItem(key);if(!raw)return {};need(raw.length<100000,'El registro de solicitudes requiere revisión.');
  const value=JSON.parse(raw);need(value&&typeof value==='object'&&!Array.isArray(value),'Registro de solicitudes no válido.');return value;}
 const scopeKey=()=>JSON.stringify([selected?.connectionId,selected?.shopId,selected?.drawerId,session?.id]);
 async function operation(kind,payload,requestedId=null){const data=saved(),scope=scopeKey(),
  fingerprint=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(payload))))].map(n=>n.toString(16).padStart(2,'0')).join(''),prior=data[kind];
  if(prior?.scope===scope&&prior.fingerprint===fingerprint)return prior.id;
  if(prior?.scope===scope&&!['prepare','park','claim-draft','release-draft','archive-draft','stock-receipt'].includes(kind))throw new Error('Hay una solicitud pendiente de esta operación. Recupera su resultado con los mismos datos antes de iniciar otra.');
  const id=requestedId||uuid();data[kind]={id,scope,fingerprint};storage.setItem(key,JSON.stringify(data));return id;}
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
 async function call(action,values={},id){const result=await invoke({action,...(action==='context'?{}:{selection:selection(),operationId:id||uuid()}),...values});
  const draft=value=>({...value,...parkingExpiry(value)});
  if(action==='drafts'){need(Array.isArray(result),'No se han podido consultar los tickets aparcados.');return result.map(draft);}
  return ['get-draft','park','claim-draft','release-draft','archive-draft'].includes(action)?draft(result):result;}
 const receipt=(row,extra={})=>({id:row.operationId||row.id,status:row.status,orderId:row.orderId,
  reference:row.orderId?'Pedido #'+row.orderId:'Operación '+(row.operationId||row.id),totalCents:row.totalCents??prepared.get(row.operationId||row.id)?.totalCents??0,...extra});
 const summary=row=>({...row,salesCents:Object.values(row.payments||{}).reduce((n,v)=>n+v,0),cashCents:row.payments?.cash||0,
  refundCashCents:row.refunds?.cash||row.refundPayments?.cash||0,unresolved:(row.unresolvedSales||row.pendingSales||0)+(row.pendingRefunds||0),
  differenceCents:row.countedCents==null?null:row.countedCents-row.expectedCashCents});
 return Object.freeze({
  mode:'qa',
  async context(){const data=await call('context');need(data.actorId===actorId&&Array.isArray(data.workstations),'El puesto no pertenece a esta sesión.');
   stations=data.workstations;need(stations.every(row=>row.environment==='qa'),'Entorno de pruebas no válido.');
   need(stations.every(row=>['canSell','canOpen','canReconcile'].every(key=>typeof row[key]==='boolean')),'No se han podido comprobar los permisos de esta caja.');
   return {stores:[...new Map(stations.map(row=>[row.storeId,{id:row.storeId,name:row.storeName}])).values()],
    drawers:stations.map(row=>({id:row.drawerId,storeId:row.storeId,name:row.drawerName,connectionId:row.connectionId,shopId:row.shopId,
     canSell:row.canSell,canOpen:row.canOpen,canReconcile:row.canReconcile})),
    sessions:stations.filter(row=>row.session).map(row=>({...row.session,storeId:row.storeId,drawerId:row.drawerId}))};},
  async selectSession(value){selected=stations.find(row=>row.drawerId===value.drawerId&&row.storeId===value.storeId);
   need(selected?.session?.id===value.id,'La sesión de caja ha cambiado.');session=clone(value);return clone(session);},
  async openSession({storeId,drawerId,openingCents}){selected=stations.find(row=>row.storeId===storeId&&row.drawerId===drawerId);
   need(selected?.canOpen,'No tienes permiso para abrir esta caja.');session=null;customer=null;activeDraft=null;
   const id=await operation('open',{storeId,drawerId,openingCents}),result=await call('open',{openingCents},id);
   need(result.id===id&&result.status==='open','No se ha confirmado la apertura de caja.');
   session={id,storeId,drawerId,status:'open',openingCents};forget('open',id);return clone(session);},
  async categories(){const data=await call('categories');need(Array.isArray(data.categories)&&data.has_more===false,'No se han podido consultar todas las categorías de esta tienda.');
   return data.categories.map(r=>({...r,label:r.parentName?r.parentName+' / '+r.name:r.name})).sort((a,b)=>a.label.localeCompare(b.label,'es',{numeric:true}));},
  async resolveIncident({operationId,reason,settlementReview}){const result=await call('resolve-incident',{reason,settlementReview},operationId);
   need(result.status==='cancelled','La incidencia sigue pendiente de revisión.');forget('prepare',operationId);forget('submitted-sale',operationId);prepared.delete(operationId);return receipt(result);},
  async searchProducts({search='',page=0,productId=0,categoryId=0,sortField='name',sortDirection='asc',searchFields,catalogueFilters,variantGroupId=0}={}){need(Number.isSafeInteger(variantGroupId)&&variantGroupId>=0&&variantGroupId<=2147483647&&(productId>0||variantGroupId===0),'Revisa el atributo de ordenación.');const fields=catalogueSearchFields(searchFields),filters=normalizeCatalogueFilters(catalogueFilters),data=await call('catalogue',{search,page,productId,categoryId,sortField,sortDirection,searchFields:fields,catalogueFilters:filters,variantGroupId,...(customer?{customerId:customer.id,addressId:customer.addressId}:{})});
   need(data.catalogue_filters?JSON.stringify(data.catalogue_filters)===JSON.stringify(filters):!filters.hideUnavailable&&!filters.excludedCategories.length,'La conexión aún no ha confirmado la visibilidad del catálogo. Pide al responsable que complete su preparación.');
   need(data.search_fields?JSON.stringify(data.search_fields)===JSON.stringify(fields):JSON.stringify(fields)===JSON.stringify(DEFAULT_SEARCH_FIELDS),'La conexión aún no ha confirmado estos criterios. Pide al responsable que complete la preparación del puesto.');
   need(!variantGroupId||data.variant_group_id===variantGroupId,'La conexión aún no ha confirmado el atributo de ordenación.');
   const variantGroups=data.variant_groups===undefined?[]:data.variant_groups;need(Array.isArray(variantGroups)&&variantGroups.length<=64&&variantGroups.every(row=>row&&Number.isSafeInteger(row.id)&&row.id>0&&typeof row.name==='string'&&Array.from(row.name).length<=128)&&new Set(variantGroups.map(row=>row.id)).size===variantGroups.length,'No se han podido comprobar los grupos de variantes.');
   need(Array.isArray(data.items)&&data.currency==='EUR'&&data.payable_cart_quote===false,'Catálogo nativo no válido.');
   if(sortField!=='name'||sortDirection!=='asc')need(data.sort_field===sortField&&data.sort_direction===sortDirection,'La tienda no ha confirmado esta ordenación. El responsable debe completar su preparación.');
   need(!data.building||sortField==='price'&&Number.isSafeInteger(data.building.done)&&Number.isSafeInteger(data.building.total)&&data.building.done>=0&&data.building.done<=data.building.total,'La tienda no ha confirmado el progreso de la ordenación.');
   const items=data.items.map(row=>({id:row.id,name:row.name+(!row.choose_variant&&row.variant_name?' · '+row.variant_name:''),reference:row.reference,
    stock:row.stock,temporaryLineNames:row.temporary_line_names===true,unitPriceOverride:row.unit_price_override===true,allowOutOfStock:row.allow_out_of_stock===true,priceCents:row.preview_cents,netPriceCents:Number.isSafeInteger(row.preview_tax_excl_cents)&&row.preview_tax_excl_cents>=0?row.preview_tax_excl_cents:null,minimumQty:row.minimum_quantity,chooseVariant:row.choose_variant,nativeProductId:row.product_id,
    variantAttributes:row.choose_variant?[]:catalogueVariantAttributes(row.variant_attributes),barcode:row.ean,upc:row.upc,isbn:row.isbn,manufacturer:row.manufacturer,supplier:row.supplier,costCents:row.cost_base_cents,imageUrl:catalogueImageUrl(data.image_origin,row.image_path)}));
   Object.defineProperties(items,{variantGroups:{value:variantGroups.map(row=>({id:row.id,name:row.name}))},variantGroupId:{value:variantGroupId},hasMore:{value:data.has_more},page:{value:data.page},totalCount:{value:Number.isSafeInteger(data.total_count)?data.total_count:undefined},building:{value:data.building||null}});return items;},
  async quote({lines,adjustment,coupon,note}){
   const pending=saved()['submitted-sale'];need(!pending||pending.scope!==scopeKey(),'Hay un cobro pendiente de recuperar. Consulta su resultado antes de preparar otra venta.');
   const intent={...cartIntent(lines,adjustment,coupon,false,note),...(activeDraft?{draftId:activeDraft.id,draftVersion:activeDraft.version}:{})};
   const id=await operation('prepare',intent);let record;
   try{record=await call('prepare',intent,id);}catch(error){
    if(['TPV_NATIVE_QUOTE_EXPIRED','TPV_QUOTE_EXPIRED'].includes(error?.code||error?.message)){
     await releaseDraft();
     forget('prepare',id);
     throw new Error('El cálculo ha caducado. Pulsa de nuevo Calcular y cobrar para obtener uno actualizado.');
    }
    throw error;
   }
   need(record.id===id&&record.status==='ready'&&Number.isSafeInteger(record.expected?.totalCents),'No se ha confirmado el cálculo nativo.');
   if(record.quoteExpiresAt<=Date.now()){forget('prepare',id);throw new Error('El cálculo ha caducado. Pulsa de nuevo Calcular y cobrar para obtener uno actualizado.');}
   if(activeDraft)activeDraft={...activeDraft,version:record.expected.draftVersion,status:'checkout',checkoutId:id};
   const quote={id,totalCents:record.expected.totalCents,currency:record.scope.currency,quoteExpiresAt:record.quoteExpiresAt,
    paymentMethods:['cash','card','bizum','transfer'].filter(method=>Object.hasOwn(record.expected.nativePaymentLabels||{cash:'',card:''},method)),
    lines:clone(record.expected.lines||[]),discountCents:record.expected.discountCents||0};
   prepared.set(id,quote);return clone(quote);},
  async discardQuote(id){const pending=saved()['submitted-sale'];if(pending?.scope===scopeKey()&&pending.id===id){
   const status=await call('sale-status',{},id);need(status.status==='ready','Este cobro ya se envió. Recupera su resultado antes de continuar.');}
   await releaseDraft();forget('prepare',id);forget('submitted-sale',id);prepared.delete(id);},
  async pendingSale(){const data=saved(),scope=scopeKey();for(const kind of ['submitted-sale','prepare'])if(data[kind]?.scope===scope)return data[kind].id;
   const rows=await call('history');return rows.find(row=>['dispatched','uncertain'].includes(row.status))?.id||null;},
  async submit({operationId,payments}){const quote=prepared.get(operationId);need(quote,'Vuelve a preparar el cobro.');
   need(payments.every(row=>row.method==='cash'||['card','bizum','transfer'].includes(row.method)&&row.simulatedAccepted===true),'Confirma que has recibido el cobro externo.');
   const allocations=payments.map(row=>({id:row.method,method:row.method,amountCents:row.amountCents,
    ...(row.method==='cash'?{receivedCents:row.receivedCents}:{})}));
   const request={allocations,confirmation:{operationId,totalCents:quote.totalCents,currency:quote.currency,accepted:true}};
   need(await operation('submitted-sale',request,operationId)===operationId,'Hay otro cobro pendiente de recuperar.');
   const change=payments.filter(row=>row.method==='cash').reduce((n,row)=>n+row.receivedCents-row.amountCents,0);
   try{const result=await call('submit',{payments:request},operationId);if(result.status==='confirmed'){forget('prepare',operationId);forget('submitted-sale',operationId);activeDraft=null;}
    return receipt(result,{totalCents:quote.totalCents,changeCents:change});
   }catch{ return receipt({id:operationId,status:'uncertain',totalCents:quote.totalCents},{changeCents:change}); }
  },
  async recover({operationId}){const status=await call('sale-status',{},operationId);
   if(status.status==='ready'){
    need(status.canSubmit!==false,'Este cobro lo preparó otro operador. No vuelvas a cobrarlo.');
    if(status.draftId)activeDraft=await call('get-draft',{draftId:status.draftId});
    prepared.set(operationId,status);return receipt(status,{payment:status,draft:activeDraft});}
   const result=['confirmed','cancelled'].includes(status.status)?status:await call('recover',{},operationId);
   if(['confirmed','cancelled'].includes(result.status)){forget('prepare',operationId);forget('submitted-sale',operationId);activeDraft=null;}return receipt(result,{totalCents:status.totalCents});},
  async drafts(){return call('drafts');},
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
   return {saleId,reference:'Pedido #'+source.orderId,pendingRefund:source.pendingRefund,availablePayments:clone(source.remaining_payments),
    lines:source.items.map(line=>({productId:String(line.detail_id),name:line.name,remainingQty:line.remaining_quantity}))};},
  async prepareRefund({operationId,saleId,items,reason,refundMethod='original'}){const source=returnSources.get(saleId);need(source,'Vuelve a consultar la venta.');
   const chosen=items.map(item=>({detailId:Number(item.productId),qty:item.qty,restock:item.restock}));
   let total=0;for(const item of chosen){const row=source.items.find(row=>row.detail_id===item.detailId);
    need(row&&Number.isSafeInteger(item.qty)&&item.qty>0&&item.qty<=row.remaining_quantity,'Cantidad de devolución no válida.');
    total+=Number((BigInt(row.allocated_cents)*BigInt(row.returned_quantity+item.qty)*2n+BigInt(row.sold_quantity))/(2n*BigInt(row.sold_quantity)))-row.refunded_cents;}
   need(refundMethod==='original'||['cash','card','bizum','transfer'].includes(refundMethod)&&source.remaining_payments[refundMethod]>=total,
    'El medio elegido no tiene saldo suficiente de la venta original para este reintegro. Selecciona el reparto original.');
   let remaining=total;const payments=[];for(const method of refundMethod==='original'?['cash','card','bizum','transfer']:[refundMethod]){const amount=Math.min(remaining,source.remaining_payments[method]||0);
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
}
