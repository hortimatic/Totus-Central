import test from 'node:test';
import assert from 'node:assert/strict';
import {createCentralTpvAdapter,orderLookupInput,catalogueVariantAttributes} from '../src/totustpv/central-adapter.js';

test('barcode creation keeps its identity after a lost response and requires review before confirmation without opening cash',async()=>{
 const values=new Map(),requests=[],station={environment:'qa',connectionId:'connection',shopId:1,storeId:'store',drawerId:'drawer',canSell:false,canOpen:false,canReconcile:true};let lost=true;
 const build=()=>createCentralTpvAdapter({actorId:'operator',storage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},invoke:async body=>{
  requests.push(body);if(body.action==='context')return {actorId:'operator',workstations:[station]};
  if(body.action==='barcode-create'){if(lost){lost=false;throw Error('Lost reply');}return {id:body.operationId,status:'preparing'};}
  if(body.action==='barcode-confirm')return {id:body.operationId,status:'processing'};throw Error('Unexpected '+body.action);
 }});
 let adapter=build();await adapter.context();await adapter.selectWorkstation({storeId:'store',drawerId:'drawer'});await assert.rejects(adapter.createBarcodeJob(),/Lost reply/);
 adapter=build();await adapter.context();await adapter.selectWorkstation({storeId:'store',drawerId:'drawer'});const job=await adapter.createBarcodeJob();
 const attempts=requests.filter(r=>r.action==='barcode-create');assert.equal(attempts[0].operationId,attempts[1].operationId);assert.equal(attempts[1].selection.sessionId,undefined);
 await assert.rejects(adapter.confirmBarcodeJob(job.id,false),/Confirma/);assert.equal(requests.some(r=>r.action==='barcode-confirm'),false);
 await adapter.confirmBarcodeJob(job.id,true);assert.equal(requests.at(-1).accepted,true);assert.equal(requests.some(r=>r.action==='open'),false);
});

test('fresh recovery preserves sealed tax totals even when the recovery result contains only the order identity',async()=>{
 const requests=[],values=new Map();let base=662;
 const station={environment:'qa',connectionId:'connection',shopId:1,storeId:'store',drawerId:'drawer',canSell:true,canOpen:true,canReconcile:true};
 const adapter=createCentralTpvAdapter({actorId:'operator',storage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},invoke:async body=>{
  requests.push(body.action);
  if(body.action==='context')return {actorId:'operator',workstations:[station]};
  if(body.action==='open')return {id:body.operationId,status:'open'};
  if(body.action==='sale-status')return {id:body.operationId,status:'uncertain',totalCents:801,totalTaxExclCents:base};
  if(body.action==='recover')return {id:body.operationId,status:'confirmed',orderId:42};
  throw Error('Unexpected '+body.action);
 }});
 await adapter.context();await adapter.openSession({storeId:'store',drawerId:'drawer',openingCents:0});
 const result=await adapter.recover({operationId:'sale'});assert.equal(result.totalCents,801);assert.equal(result.totalTaxExclCents,662);
 base=802;await assert.rejects(adapter.recover({operationId:'sale'}),{code:'TPV_TAX_SUMMARY_INVALID'});
 assert.equal(requests.includes('submit'),false);assert.equal(requests.includes('prepare'),false);
});
test('expired parked preparation releases only the unsubmitted binding before a new explicit calculation',async()=>{
 const values=new Map(),requests=[],station={environment:'qa',connectionId:'connection',shopId:1,storeId:'store',drawerId:'drawer',canSell:true,canOpen:true,canReconcile:true};let draft,expire=true;
 const adapter=createCentralTpvAdapter({actorId:'operator',storage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},invoke:async body=>{
  requests.push(structuredClone(body));if(body.action==='context')return {actorId:'operator',workstations:[station]};
  if(body.action==='open'){draft={id:'draft',version:1,status:'claimed',mine:true,sessionId:body.operationId,payload:{lines:[{productId:12,attributeId:0,qty:1,label:'Artículo'}]}};return {id:body.operationId,status:'open'};}
  if(['get-draft','claim-draft'].includes(body.action))return structuredClone(draft);
  if(body.action==='release-draft'){assert.equal(body.version,draft.version);draft={...draft,status:'claimed',version:draft.version+1};return structuredClone(draft);}
  assert.equal(body.action,'prepare');assert.equal(body.draftVersion,draft.version);draft={...draft,status:'checkout',version:draft.version+1};
  if(expire){expire=false;throw Error('TPV_NATIVE_QUOTE_EXPIRED');}
  return {id:body.operationId,status:'ready',expected:{totalCents:801,draftVersion:draft.version},scope:{currency:'EUR'},quoteExpiresAt:Date.now()+120000};
 }});
 await adapter.context();await adapter.openSession({storeId:'store',drawerId:'drawer',openingCents:0});await adapter.claimDraft({draftId:'draft'});
 const ticket={lines:[{productId:'12:0',qty:1}]};await assert.rejects(adapter.quote(ticket),/caducado/);assert.equal(draft.status,'claimed');
 assert.equal(requests.filter(row=>row.action==='prepare').length,1);await adapter.quote(ticket);const attempts=requests.filter(row=>row.action==='prepare');assert.notEqual(attempts[0].operationId,attempts[1].operationId);assert.equal(attempts[1].draftVersion,3);
});
test('expired preparation gets a new identity only on the next explicit calculation; uncertain replies keep their identity',async()=>{
 const values=new Map(),attempts=[],station={environment:'qa',connectionId:'connection',shopId:1,storeId:'store',drawerId:'drawer',canSell:true,canOpen:true,canReconcile:true};let outcome='expired';
 const adapter=createCentralTpvAdapter({actorId:'operator',storage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},invoke:async body=>{
  if(body.action==='context')return {actorId:'operator',workstations:[station]};
  if(body.action==='open')return {id:body.operationId,status:'open'};
  assert.equal(body.action,'prepare');attempts.push(body.operationId);
  if(outcome==='expired'){const error=Error('Friendly message');error.code='TPV_NATIVE_QUOTE_EXPIRED';throw error;}
  if(outcome==='uncertain')throw Error('Lost reply');
  return {id:body.operationId,status:'ready',expected:{totalCents:801},scope:{currency:'EUR'},quoteExpiresAt:Date.now()+120000};
 }});
 await adapter.context();await adapter.openSession({storeId:'store',drawerId:'drawer',openingCents:0});const ticket={lines:[{productId:'12:0',qty:1}]};
 await assert.rejects(adapter.quote(ticket),/caducado/);assert.equal(attempts.length,1,'Never retry automatically');
 outcome='uncertain';await assert.rejects(adapter.quote(ticket),/Lost reply/);assert.notEqual(attempts[1],attempts[0]);
 await assert.rejects(adapter.quote(ticket),/Lost reply/);assert.equal(attempts[2],attempts[1]);
 outcome='ready';const ready=await adapter.quote(ticket);assert.equal(ready.id,attempts[1]);assert.equal(attempts.length,4);
});
test('native variant attributes retain their groups and labels without importing extra native data',()=>{
 const row={id:3,groupId:2,name:'Rojo',groupName:'Color',private:'discarded'};
 assert.deepEqual(catalogueVariantAttributes([row]),[{id:3,groupId:2,name:'Rojo',groupName:'Color'}]);
 assert.deepEqual(catalogueVariantAttributes(undefined),[]);
 for(const value of [null,{},[row,row],[{...row,id:0}],[{...row,name:''}],[{...row,groupId:'2'}],Array(65).fill(row)])assert.throws(()=>catalogueVariantAttributes(value),/atributos/);
});
test('a selected variant group requires native confirmation and bounded metadata',async()=>{
 let response={items:[],currency:'EUR',payable_cart_quote:false,variant_group_id:3,variant_groups:[{id:3,name:'Color',secret:'omit'}]};
 const station={environment:'qa',connectionId:'connection',shopId:1,storeId:'store',drawerId:'drawer',canSell:true,canOpen:true,canReconcile:true};
 const adapter=createCentralTpvAdapter({actorId:'operator',invoke:async body=>body.action==='context'?{actorId:'operator',workstations:[station]}:response,storage:{getItem:()=>null,setItem:()=>{}},uuid:()=>crypto.randomUUID()});
 await adapter.context();await adapter.selectWorkstation({storeId:'store',drawerId:'drawer'});
 assert.deepEqual((await adapter.searchProducts({productId:12,variantGroupId:3})).variantGroups,[{id:3,name:'Color'}]);
 response={...response,variant_group_id:4};await assert.rejects(adapter.searchProducts({productId:12,variantGroupId:3}),/atributo de ordenación/);
 response={...response,variant_group_id:3,variant_groups:[{id:3,name:'Color'},{id:3,name:'Duplicate'}]};await assert.rejects(adapter.searchProducts({productId:12,variantGroupId:3}),/grupos/);
 await assert.rejects(adapter.searchProducts({variantGroupId:3}),/atributo/);
});
function fixture({requireOriginalPayment=false}={}){let sequence=0;const actor='00000000-0000-4000-8000-000000000001',requests=[],values=new Map(),
 storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},station={environment:'qa',connectionId:'connection',
  shopId:1,storeId:'store',storeName:'Tienda',drawerId:'drawer',drawerName:'Caja',canOpen:true,canSell:true,canReconcile:true,session:null};
 let dispatches=0,movementLost=true,productReplyLost=true,productMissing=false;const productDrafts=new Map();
 const invoke=async body=>{requests.push(structuredClone(body));switch(body.action){
  case 'context':return {actorId:actor,workstations:[station]};
  case 'open':return {id:body.operationId,status:'open'};
  case 'prepare':return {id:body.operationId,status:'ready',expected:{totalCents:801,totalTaxExclCents:662,nativePaymentLabels:{bizum:'Bizum',card:'Tarjeta',cash:'Efectivo',transfer:'Transferencia'}},scope:{currency:'EUR'},quoteExpiresAt:Date.now()+120000};
  case 'submit':dispatches++;throw Error('Lost reply');
  case 'sale-status':return {id:body.operationId,status:'confirmed',orderId:42,totalCents:801,totalTaxExclCents:662};
  case 'history':return [];
  case 'orders':return [{id:'sale-fixture',status:'confirmed',orderId:42,totalCents:150}];
  case 'cash-movement':if(movementLost)throw Error('Lost reply');return {expectedCashCents:9900,payments:{cash:801,card:200}};
  case 'customer-write':return {verified:true,persisted:true,record_id:'7'};
  case 'product-intake-prepare':{const row={id:body.operationId,status:'ready',name:body.payload.name};productDrafts.set(row.id,row);if(productReplyLost){productReplyLost=false;throw Error('Lost product preparation reply');}return row;}
  case 'product-intake-get':{if(productMissing||!productDrafts.has(body.operationId)){const error=Error('Not found');error.code='TPV_PRODUCT_NOT_FOUND';throw error;}return productDrafts.get(body.operationId);}
  case 'returnable':return {returnPolicy:{allowPartial:true,requireOriginalPayment},orderId:42,originalPaymentReferences:{card:'OP-ORIGINAL-42'},remaining_payments:{cash:400,card:401},items:[{detail_id:77,name:'Artículo',sold_quantity:2,
   returned_quantity:0,remaining_quantity:2,allocated_cents:801,refunded_cents:0}]};
  case 'prepare-refund':return {id:body.operationId,status:'ready',totalCents:401};
  default:throw Error('Unexpected action '+body.action);
 }};
 const create=()=>createCentralTpvAdapter({actorId:actor,invoke,storage,uuid:()=>`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`});
 return {create,requests,values,station,dispatches:()=>dispatches,settle:()=>movementLost=false,missingProduct:()=>{productMissing=true;}};
}
test('the real adapter projects explicit workstation rights and rejects missing or malformed permission flags',async()=>{
 const f=fixture();f.station.canSell=false;f.station.canOpen=false;const context=await f.create().context();
 assert.deepEqual([context.drawers[0].canSell,context.drawers[0].canOpen,context.drawers[0].canReconcile],[false,false,true]);
 for(const value of [undefined,'true',1,null]){f.station.canSell=value;await assert.rejects(f.create().context(),/permisos de esta caja/);}
});
test('lost submit is recovered by server status, never resent or reconstructed from browser prices',async()=>{
 const f=fixture(),adapter=f.create();await adapter.context();await adapter.openSession({storeId:'store',drawerId:'drawer',openingCents:10000});
 const quote=await adapter.quote({lines:[{productId:'12:3',qty:2,discount:{kind:'percent',value:1000}}]});
 assert.deepEqual(quote.paymentMethods,['cash','card','bizum','transfer']);assert.equal(quote.totalTaxExclCents,662);
 const result=await adapter.submit({operationId:quote.id,payments:[{method:'cash',amountCents:801,receivedCents:1000}]});
 assert.equal(result.status,'uncertain');assert.equal(result.changeCents,199);assert.equal(f.dispatches(),1);
 assert.equal(await adapter.pendingSale(),quote.id,'Reload can discover the bound sale without storing customer or payment details');
 await assert.rejects(adapter.quote({lines:[{productId:'12:3',qty:3}]}),/pendiente de recuperar/);
 const recovered=await adapter.recover({operationId:quote.id});assert.equal(recovered.orderId,42);assert.equal(recovered.totalTaxExclCents,662);assert.equal(f.dispatches(),1);
 assert.equal(await adapter.pendingSale(),null,'Verified recovery releases the pending pointer');
 const request=f.requests.find(row=>row.action==='prepare');assert.deepEqual(request.lines,[{productId:12,attributeId:3,qty:2,discount:{kind:'percent',value:1000}}]);
 assert.equal(Object.hasOwn(request,'totalCents'),false);
});
test('uncertain cash intent keeps its identity and prevents changed retries; storage retains hashes instead of customer fields',async()=>{
 const f=fixture(),adapter=f.create();await adapter.context();await adapter.openSession({storeId:'store',drawerId:'drawer',openingCents:10000});
 const intent={kind:'cash-out',amountCents:100,reason:'Retirada'};
 await assert.rejects(adapter.cashMovement(intent),/Lost reply/);const sent=f.requests.at(-1).operationId;
 await assert.rejects(adapter.cashMovement({...intent,amountCents:200}),/solicitud pendiente/);
 assert.equal(f.requests.filter(row=>row.action==='cash-movement').length,1);
 f.settle();await adapter.cashMovement(intent);assert.equal(f.requests.at(-1).operationId,sent);
 await adapter.writeCustomer({resource:'customers',fields:{firstname:'Confidential Fixture',email:'private@example.invalid'}});
 assert.equal([...f.values.values()].some(value=>value.includes('Confidential')||value.includes('private@example.invalid')),false);
});

test('a partial return can choose an original payment method only within its remaining collected balance',async()=>{
 const f=fixture(),adapter=f.create();await adapter.context();await adapter.openSession({storeId:'store',drawerId:'drawer',openingCents:10000});
 const source=await adapter.returnable({saleId:'sale'});assert.deepEqual(source.availablePayments,{cash:400,card:401});assert.deepEqual(source.originalPaymentReferences,{card:'OP-ORIGINAL-42'});
 const values={saleId:'sale',operationId:'refund',items:[{productId:'77',qty:1,restock:false}],reason:'Defectuoso'};
 await assert.rejects(adapter.prepareRefund({...values,refundMethod:'cash'}),/saldo suficiente/);
 assert.equal(f.requests.filter(row=>row.action==='prepare-refund').length,0);
 await adapter.prepareRefund({...values,refundMethod:'card'});
 assert.deepEqual(f.requests.at(-1).payments,[{method:'card',amountCents:401}]);assert.equal(f.requests.at(-1).reason,'Defectuoso');
});

test('order lookup distinguishes ordinary IDs from namespaced scanned references',async()=>{
 assert.deepEqual(orderLookupInput(' 00042 '),{orderId:42});assert.deepEqual(orderLookupInput(''),{});
 assert.deepEqual(orderLookupInput('R:00042'),{reference:'00042'});
 assert.deepEqual(orderLookupInput('r:abcdefghi'),{reference:'ABCDEFGHI'});
 assert.deepEqual(orderLookupInput('ab-cd12efg'),{reference:'AB-CD12EFG'});
 for(const value of ['0','R:','x'.repeat(11),'[ABCDEFGHI]','ABC%','<script>','9999999999999999'])assert.throws(()=>orderLookupInput(value),/válid/);
 const f=fixture(),adapter=f.create();await adapter.context();await adapter.openSession({storeId:'store',drawerId:'drawer',openingCents:0});
 assert.equal((await adapter.orders({reference:'abcdefghi'}))[0].orderId,42);
 assert.equal(f.requests.at(-1).reference,'ABCDEFGHI');assert.equal(Object.hasOwn(f.requests.at(-1),'orderId'),false);
 await assert.rejects(adapter.orders({orderId:42,reference:'ABCDEFGHI'}),/número o por referencia/);
 await assert.rejects(adapter.orders({reference:'[unsafe]'}),/válida/);
 assert.equal(f.dispatches(),0);
});
test('a lost product preparation is recovered across a new adapter without keeping image bytes or needing open cash',async()=>{
 const f=fixture(),adapter=f.create();await adapter.context();await adapter.openSession({storeId:'store',drawerId:'drawer',openingCents:0});
 const payload={name:'Private product draft',images:[{base64:'private-image-data'}]};
 await assert.rejects(adapter.prepareProductIntake(payload),/Lost product/);const id=f.requests.at(-1).operationId;
 await assert.rejects(adapter.prepareProductIntake({...payload,name:'Other draft'}),/solicitud pendiente/);
 assert.equal([...f.values.values()].some(value=>value.includes('Private product')||value.includes('private-image')),false);
 const reopened=f.create();await reopened.context();await reopened.selectWorkstation({storeId:'store',drawerId:'drawer'});
 assert.equal((await reopened.recoverProductPreparation()).id,id);assert.equal(await reopened.recoverProductPreparation(),null);
 assert.equal(f.requests.filter(row=>row.action==='product-intake-prepare').length,1);
 assert.equal(f.requests.filter(row=>row.action==='product-intake-get').at(-1).selection.sessionId,undefined);
});
test('an unobserved preparation can release its local pointer because it never creates a native product',async()=>{
 const f=fixture(),adapter=f.create();await adapter.context();await adapter.openSession({storeId:'store',drawerId:'drawer',openingCents:0});
 await assert.rejects(adapter.prepareProductIntake({name:'First'}),/Lost product/);f.missingProduct();
 assert.equal(await adapter.recoverProductPreparation(),null);await adapter.prepareProductIntake({name:'Corrected'});
 assert.equal(f.requests.filter(row=>row.action==='product-intake-prepare').length,2);
});


test('offline delivery recovers a lost receipt in its original workstation and never resends a bound sale',async()=>{
 const requests=[],values=new Map(),actor='00000000-0000-4000-8000-000000000001',device='00000000-0000-4000-8000-000000000002',operation='00000000-0000-4000-8000-000000000003';
 const station={environment:'qa',connectionId:'connection',shopId:1,storeId:'store',drawerId:'drawer',canOpen:true,canSell:true,canReconcile:true};let saved=null,lose=true;
 const adapter=createCentralTpvAdapter({actorId:actor,storage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},invoke:async body=>{
  requests.push(body);if(body.action==='context')return {actorId:actor,workstations:[station]};if(body.action==='open')return {id:body.operationId,status:'open'};
  if(body.action==='offline-receive'){saved={id:body.operationId,deviceId:body.deviceId,ticket:structuredClone(body.ticket),checkoutId:null};if(lose){lose=false;throw Error('Receipt response lost');}return saved;}
  if(body.action==='offline-get')return saved;
  if(body.action==='offline-sync'){saved.checkoutId=body.operationId;return {operationId:body.operationId,status:'confirmed',verified:true};}
  if(body.action==='offline-recover')return {operationId:body.operationId,status:'confirmed',verified:true};throw Error('Unexpected action '+body.action);
 }});
 await adapter.context();await adapter.openSession({storeId:'store',drawerId:'drawer',openingCents:0});const delivery=adapter.offlineDelivery({deviceId:device}),ticket={currency:'EUR',totalCents:100};
 await assert.rejects(delivery.dispatch({operationId:operation,ticket}),/Receipt response lost/);
 assert.equal((await delivery.recover({operationId:operation,ticket})).status,'confirmed');await delivery.recover({operationId:operation,ticket});
 assert.equal(requests.filter(r=>r.action==='offline-receive').length,1);assert.equal(requests.filter(r=>r.action==='offline-sync').length,1);assert.equal(requests.filter(r=>r.action==='offline-recover').length,1);
 const count=requests.length;await assert.rejects(delivery.recover({operationId:operation,ticket:{...ticket,totalCents:101}}),/no coincide/);assert.equal(requests.length,count+1);
 await adapter.openSession({storeId:'store',drawerId:'drawer',openingCents:0});const before=requests.length;await assert.rejects(delivery.recover({operationId:operation,ticket}),/puesto ha cambiado/);assert.equal(requests.length,before);
});


test('mandatory original refund allocation is derived from verified balances and shown unchanged for confirmation',async()=>{
 const f=fixture({requireOriginalPayment:true}),adapter=f.create();await adapter.context();await adapter.openSession({storeId:'store',drawerId:'drawer',openingCents:0});const source=await adapter.returnable({saleId:'sale'});assert.equal(source.requireOriginalPayment,true);
 const args={saleId:'sale',operationId:'refund',items:[{productId:'77',qty:1,restock:false}]};await assert.rejects(adapter.prepareRefund({...args,refundMethod:'card'}),/exige repartir/);
 const result=await adapter.prepareRefund(args);assert.deepEqual(result.payments,[{method:'cash',amountCents:200},{method:'card',amountCents:201}]);assert.deepEqual(f.requests.at(-1).payments,result.payments);
});
