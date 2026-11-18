import test from 'node:test';
import assert from 'node:assert/strict';
import {refundIntent,createRefundService} from '../src/totustpv/server/refund-service.js';
const saleId='00000000-0000-4000-8000-000000000001';
function fixture(returned=0){return {scope:{currency:'EUR'},sale:{id:saleId,status:'confirmed',scope:{currency:'EUR'},orderId:7,expected:{currencyId:1}},
 available:{sale_operation_id:saleId,order_id:7,currency_id:1,state_fingerprint:'a'.repeat(64),remaining_payments:{cash:returned?400:801},
  items:[{detail_id:42,sold_quantity:2,returned_quantity:returned,remaining_quantity:2-returned,allocated_cents:801,refunded_cents:returned?401:0,name:'Artículo'}]},
 items:[{detailId:42,qty:1,restock:true}],payments:[{method:'cash',amountCents:returned?400:401}],reason:'Artículo defectuoso'};}
test('successive partial returns allocate every cent once and preserve the immutable reason',()=>{
 const first=refundIntent(fixture()),last=refundIntent(fixture(1));
 assert.equal(first.totalCents,401);assert.equal(last.totalCents,400);assert.equal(first.totalCents+last.totalCents,801);
 assert.equal(first.intent.reason,'Artículo defectuoso');assert.equal(first.intent.items[0].restock,true);
});
test('invalid reasons and over-refunds fail before a native command can be prepared',()=>{
 for(const reason of ['', ' padded ', 'line\nbreak', 'x'.repeat(501), {}, null])
  assert.throws(()=>refundIntent({...fixture(),reason}),/REFUND_REASON_INVALID/);
 assert.throws(()=>refundIntent({...fixture(1),payments:[{method:'cash',amountCents:401}]}),/REFUND_PAYMENT_INVALID/);
 assert.throws(()=>refundIntent({...fixture(1),items:[{detailId:42,qty:2,restock:true}]}),/REFUND_QUANTITY_EXCEEDED/);
});


test('return lookup projects only safe immutable original references and never submits a refund',async()=>{
 const f=fixture();let reads=0;
 const sale={...f.sale,payments:[{method:'card',amountCents:801,reference:'OP-ORIGINAL-42',providerSecret:'not-for-browser'}]};
 const service=createRefundService({scope:f.scope,rpc:async(name)=>{assert.equal(name,'totus_tpv_sale_for_return');return {data:sale};},transport:{readNativeReturnable:async()=>{reads++;return f.available;},nativeCommand:()=>assert.fail('Read lookup must not write'),readNativeOperation:()=>assert.fail('Unexpected native operation')}});
 const result=await service.returnable(saleId);assert.deepEqual(result.originalPaymentReferences,{card:'OP-ORIGINAL-42'});assert.equal(result.state_fingerprint,f.available.state_fingerprint);assert.doesNotMatch(JSON.stringify(result),/providerSecret|not-for-browser/);
 for(const payments of [[{method:'cash',reference:'OP-42'}],[{method:'card',reference:'4111111111111111'}],[{method:'card',reference:'<script>'}],null]){sale.payments=payments;assert.deepEqual((await service.returnable(saleId)).originalPaymentReferences,{});}
 assert.equal(reads,5);
});
