import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeCapabilityAdapter} from '../src/totustpv/server/native-capability-adapter.js';
const id='00000000-0000-4000-8000-000000000001';
const scope={connectionId:id,connectionRevision:1,storeId:id,shopId:1,actorId:id,drawerId:id,sessionId:id,currency:'EUR',environment:'qa'};
const expected={cartId:7,totalCents:801,paymentModule:'totuscentralconnector',nativeQuoteOperationId:id,
 nativeQuoteFingerprint:'a'.repeat(64),nativePaymentLabels:{cash:'Efectivo',card:'Tarjeta'}};
const payments=[{id:'cash-1',method:'cash',amountCents:300,receivedCents:1000,status:'settled'},
 {id:'card-1',method:'card',amountCents:501,status:'settled'}];
function fixture(change={}){
 const calls=[];const receipt={verified:true,native_reference:42,order_id:42,cart_id:7,total_cents:801,
  quote_operation_id:id,quote_fingerprint:'a'.repeat(64),invoice_ids:[9],inventory:[],...change};
 const transport={read:async()=>{throw Error('Unused');},assertMutationTarget:()=>true,
  createOrderOnce:async()=>{throw Error('Classic order dispatch forbidden');},
  nativeCommand:async command=>{calls.push(command);return receipt;},
  readNativeOperation:async operationId=>{calls.push({read:operationId});return {status:'verified',result:receipt};}};
 return {calls,adapter:createNativeCapabilityAdapter({scope,transport,verifyPrepared:async()=>({unchanged:true,cartId:7})})};
}
test('native sale receives an explicit shortage opt-in only from a prepared server record',async()=>{
 const f=fixture();await f.adapter.submitOrderOnce({scope,operationId:id,expected:{...expected,allowOutOfStock:true},payments});
 assert.equal(f.calls[0].payload.allow_out_of_stock,true);
 const ordinary=fixture();await ordinary.adapter.submitOrderOnce({scope,operationId:id,expected,payments});assert.equal(Object.hasOwn(ordinary.calls[0].payload,'allow_out_of_stock'),false);
});
test('mixed payment uses one named native command with immutable quote and exact cash received',async()=>{
 const f=fixture();assert.deepEqual(await f.adapter.submitOrderOnce({scope,operationId:id,expected,payments}),{orderId:42});
 assert.equal(f.calls.length,2);assert.equal(f.calls[0].command,'sale.commit');
 assert.equal(f.calls[0].operationId,id);assert.equal(f.calls[0].payload.quote_operation_id,id);
 assert.deepEqual(f.calls[0].payload.payments,[{method:'cash',amount_cents:300,received_cents:1000},{method:'card',amount_cents:501}]);
 assert.deepEqual(f.calls[1],{read:id});
});
test('foreign cashier, absent owned quote, unsupported method and unpaid amount never dispatch',async()=>{
 for(const patch of [{scope:{...scope,actorId:'other'}},{expected:{...expected,nativeQuoteOperationId:null}},
  {payments:[{id:'x',method:'transfer',amountCents:801,status:'settled'}]},
  {payments:[{id:'x',method:'cash',amountCents:300,receivedCents:300,status:'settled'}]}]){
  const f=fixture();await assert.rejects(f.adapter.submitOrderOnce({scope,operationId:id,expected,payments,...patch}));
  assert.equal(f.calls.length,0);
 }
});
test('another cart, changed quote or missing invoice stays unverified without another POST',async()=>{
 for(const change of [{cart_id:8},{quote_fingerprint:'b'.repeat(64)},{invoice_ids:[]}]){
  const f=fixture(change);await assert.rejects(f.adapter.submitOrderOnce({scope,operationId:id,expected,payments}),/RECEIPT_MISMATCH/);
  assert.equal(f.calls.filter(row=>row.command).length,1);
 }
});
