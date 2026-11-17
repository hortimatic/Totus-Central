import test from 'node:test';
import assert from 'node:assert/strict';
import {createCentralTpvAdapter,orderLookupInput} from '../src/totustpv/central-adapter.js';
function fixture(){let sequence=0;const actor='00000000-0000-4000-8000-000000000001',requests=[],values=new Map(),
 storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},station={environment:'qa',connectionId:'connection',
  shopId:1,storeId:'store',storeName:'Tienda',drawerId:'drawer',drawerName:'Caja',canOpen:true,canSell:true,canReconcile:true,session:null};
 let dispatches=0,movementLost=true;
 const invoke=async body=>{requests.push(structuredClone(body));switch(body.action){
  case 'context':return {actorId:actor,workstations:[station]};
  case 'open':return {id:body.operationId,status:'open'};
  case 'prepare':return {id:body.operationId,status:'ready',expected:{totalCents:801,nativePaymentLabels:{bizum:'Bizum',card:'Tarjeta',cash:'Efectivo',transfer:'Transferencia'}},scope:{currency:'EUR'},quoteExpiresAt:Date.now()+120000};
  case 'submit':dispatches++;throw Error('Lost reply');
  case 'sale-status':return {id:body.operationId,status:'confirmed',orderId:42,totalCents:801};
  case 'history':return [];
  case 'orders':return [{id:'sale-fixture',status:'confirmed',orderId:42,totalCents:150}];
  case 'cash-movement':if(movementLost)throw Error('Lost reply');return {expectedCashCents:9900,payments:{cash:801,card:200}};
  case 'customer-write':return {verified:true,persisted:true,record_id:'7'};
  case 'returnable':return {orderId:42,remaining_payments:{cash:400,card:401},items:[{detail_id:77,name:'Artículo',sold_quantity:2,
   returned_quantity:0,remaining_quantity:2,allocated_cents:801,refunded_cents:0}]};
  case 'prepare-refund':return {id:body.operationId,status:'ready',totalCents:401};
  default:throw Error('Unexpected action '+body.action);
 }};
 const create=()=>createCentralTpvAdapter({actorId:actor,invoke,storage,uuid:()=>`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`});
 return {create,requests,values,station,dispatches:()=>dispatches,settle:()=>movementLost=false};
}
test('the real adapter projects explicit workstation rights and rejects missing or malformed permission flags',async()=>{
 const f=fixture();f.station.canSell=false;f.station.canOpen=false;const context=await f.create().context();
 assert.deepEqual([context.drawers[0].canSell,context.drawers[0].canOpen,context.drawers[0].canReconcile],[false,false,true]);
 for(const value of [undefined,'true',1,null]){f.station.canSell=value;await assert.rejects(f.create().context(),/permisos de esta caja/);}
});
test('lost submit is recovered by server status, never resent or reconstructed from browser prices',async()=>{
 const f=fixture(),adapter=f.create();await adapter.context();await adapter.openSession({storeId:'store',drawerId:'drawer',openingCents:10000});
 const quote=await adapter.quote({lines:[{productId:'12:3',qty:2,discount:{kind:'percent',value:1000}}]});
 assert.deepEqual(quote.paymentMethods,['cash','card','bizum','transfer']);
 const result=await adapter.submit({operationId:quote.id,payments:[{method:'cash',amountCents:801,receivedCents:1000}]});
 assert.equal(result.status,'uncertain');assert.equal(result.changeCents,199);assert.equal(f.dispatches(),1);
 assert.equal(await adapter.pendingSale(),quote.id,'Reload can discover the bound sale without storing customer or payment details');
 await assert.rejects(adapter.quote({lines:[{productId:'12:3',qty:3}]}),/pendiente de recuperar/);
 assert.equal((await adapter.recover({operationId:quote.id})).orderId,42);assert.equal(f.dispatches(),1);
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
 const source=await adapter.returnable({saleId:'sale'});assert.deepEqual(source.availablePayments,{cash:400,card:401});
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
