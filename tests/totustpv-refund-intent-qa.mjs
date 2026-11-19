import test from 'node:test';
import assert from 'node:assert/strict';
import {refundIntent,createRefundService,requireCompleteReturn} from '../src/totustpv/server/refund-service.js';
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

test('disabled partial returns require every remaining native line and exact remaining quantities',()=>{
 const f=fixture(),policy={allowPartial:false};
 assert.throws(()=>requireCompleteReturn(policy,f.available,f.items),/PARTIAL_REFUND_FORBIDDEN/);
 requireCompleteReturn(policy,f.available,[{detailId:42,qty:2}]);
 const multiple={items:[...f.available.items,{detail_id:43,remaining_quantity:1}]};
 assert.throws(()=>requireCompleteReturn(policy,multiple,[{detailId:42,qty:2}]),/PARTIAL_REFUND_FORBIDDEN/);
 requireCompleteReturn(policy,multiple,[{detailId:42,qty:2},{detailId:43,qty:1}]);
 requireCompleteReturn({allowPartial:true},f.available,f.items);
 assert.throws(()=>requireCompleteReturn(null,f.available,f.items),/POLICY_UNAVAILABLE/);
});

test('disabled partial return is rejected before a journal preparation or native write',async()=>{
 const f=fixture();let writes=0;
 const service=createRefundService({scope:f.scope,readPolicy:async()=>({allowPartial:false}),rpc:async name=>{
  if(name==='totus_tpv_sale_for_return')return {data:f.sale};writes++;throw Error('Unexpected write');
 },transport:{readNativeReturnable:async()=>f.available,nativeCommand:()=>assert.fail('Unexpected native write'),readNativeOperation:()=>assert.fail('Unexpected operation read')}});
 await assert.rejects(service.prepare({operationId:saleId,saleId,items:f.items,payments:f.payments,reason:f.reason}),/PARTIAL_REFUND_FORBIDDEN/);
 assert.equal(writes,0);
});


test('mandatory original allocation rejects a shifted payout before prepare and before dispatch',async()=>{
 const f=fixture();f.available.remaining_payments={cash:400,card:401};const policy={allowPartial:true,requireOriginalPayment:true},calls=[];
 const record={id:'refund',saleId,status:'ready',totalCents:401,intent:{items:[{detail_id:42,quantity:1}],payments:[{method:'card',amount_cents:401}]}};
 const service=createRefundService({scope:f.scope,readPolicy:async()=>policy,rpc:async(name,args)=>{calls.push({name,args});if(name==='totus_tpv_sale_for_return')return {data:f.sale};if(name==='totus_tpv_refund_journal'&&args.p_action==='get')return {data:record};if(name==='totus_tpv_refund_journal'&&args.p_action==='prepare')return {data:{...record,intent:args.p_data.intent,totalCents:args.p_data.totalCents}};throw Error('Unexpected write');},transport:{readNativeReturnable:async()=>f.available,nativeCommand:()=>assert.fail('No native write'),readNativeOperation:()=>assert.fail('No native read')}});
 await assert.rejects(service.prepare({operationId:'refund',saleId,items:f.items,payments:[{method:'card',amountCents:401}]}),/ORIGINAL_PAYMENT_REQUIRED/);assert.ok(!calls.some(c=>c.name==='totus_tpv_refund_journal'));
 const ready=await service.prepare({operationId:'refund',saleId,items:f.items,payments:[{method:'cash',amountCents:200},{method:'card',amountCents:201}]});assert.equal(ready.status,'ready');
 await assert.rejects(service.submit({operationId:'refund',confirmation:{operationId:'refund',accepted:true,totalCents:401,currency:'EUR'}}),/ORIGINAL_PAYMENT_REQUIRED/);assert.ok(!calls.some(c=>c.args?.p_action==='claim'));
});
