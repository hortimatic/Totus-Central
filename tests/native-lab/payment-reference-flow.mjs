import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
export async function exercisePaymentReference({call,handle,selection,fixture,db,paths,loseSaleReply}){
 const offlineId=randomUUID(),deviceId=randomUUID(),nativeBeforeOffline=paths.length;
 const ticket={currency:'EUR',totalCents:100,lines:[{productId:fixture.productId,attributeId:0,qty:1}],payments:[{method:'cash',amountCents:100,receivedCents:100}]};
 const pending=await call({action:'offline-receive',selection,operationId:offlineId,deviceId,ticket});assert.equal(pending.status,'received');
 const recoveredOffline=await call({action:'offline-get',selection,operationId:offlineId});assert.deepEqual(recoveredOffline.ticket,ticket);assert.equal(paths.length,nativeBeforeOffline,'Receiving an offline intention must not contact the shop');
 await call({action:'payment-options',selection,operationId:randomUUID(),settings:{enabledMethods:['cash','card'],referencePolicy:{card:'required'}}});
 const id=randomUUID(),prepared=await call({action:'prepare',selection,operationId:id,lines:[{productId:fixture.productId,attributeId:0,qty:1}]});
 assert.equal(prepared.expected.supportsPaymentReferences,true);assert.equal(prepared.expected.operatorPaymentPolicy.referencePolicy.card,'required');
 const total=prepared.expected.totalCents,request=reference=>({action:'submit',selection,operationId:id,payments:{allocations:[{id:'card',method:'card',amountCents:total,...(reference===undefined?{}:{reference})}],confirmation:{accepted:true,operationId:id,totalCents:total,currency:'EUR'}}});
 const posts=()=>paths.filter(row=>row.method==='POST'&&row.path==='/api/totus_tpv_sales').length;
 const before=posts();for(const [reference,error] of [[undefined,'TPV_PAYMENT_REFERENCE_REQUIRED'],['4111111111111111','TPV_PAYMENT_REFERENCE_INVALID']]){
  const response=await handle(new Request('https://central.local/tpv',{method:'POST',headers:{Authorization:'Bearer synthetic-auth-fixture','Content-Type':'application/json'},body:JSON.stringify(request(reference))}));
  assert.equal(response.status,400);assert.equal((await response.json()).error,error);assert.equal(posts(),before);
 }
 const reference='LAB-OP-20261118-0042';loseSaleReply();
 const submitted=await call(request(reference));assert.ok(['confirmed','uncertain'].includes(submitted.status));
 const recovered=await call({action:'recover',selection,operationId:id});assert.equal(recovered.status,'confirmed');assert.equal(posts(),before+1);
 await call(request('CHANGED-REFERENCE'));assert.equal(posts(),before+1);
 await db.exec('reset role');const saved=(await db.query('select payments from private.totus_tpv_operations where id=$1',[id])).rows[0];assert.equal(saved.payments[0].reference,reference);
 const returnable=await call({action:'returnable',selection,operationId:randomUUID(),saleId:id});assert.deepEqual(returnable.originalPaymentReferences,{card:reference});assert.equal(posts(),before+1);
 const document=await call({action:'document',selection,operationId:id,kind:'receipt'});assert.equal(document.payment_intent[0].external_reference,reference);
 const gift=await call({action:'document',selection,operationId:id,kind:'gift'});assert.equal(Object.hasOwn(gift,'payment_intent'),false);
 assert.equal((await call({action:'cash-summary',selection,operationId:randomUUID()})).expectedCashCents,10000);
 console.log('PASS external payment reference: mandatory/PAN refusals before native sale, one native POST despite lost response, read-only recovery, immutable Central/native annotation, gift privacy and unchanged physical cash. Local only.');
 return {id,reference,document};
}
