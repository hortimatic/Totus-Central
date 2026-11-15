import test from 'node:test';
import assert from 'node:assert/strict';
import {nativePaymentPlan,verifyNativePaymentBreakdown} from '../src/totustpv/server/payment-readback.js';
const expected={totalCents:801,nativePaymentLabels:{cash:'Efectivo',card:'Tarjeta'}};
const accepted=[{id:'cash',method:'cash',amountCents:300,receivedCents:500,status:'settled'},
 {id:'card',method:'card',amountCents:501,status:'settled'}];
test('native mixed payments must preserve each original method and amount',()=>{
 assert.equal(verifyNativePaymentBreakdown(expected,accepted,[{methodLabel:'Tarjeta',amountCents:501},{methodLabel:'Efectivo',amountCents:300}]),true);
 assert.deepEqual(nativePaymentPlan(expected,accepted),[{methodLabel:'Efectivo',amountCents:300},{methodLabel:'Tarjeta',amountCents:501}]);
 for(const observed of [[{methodLabel:'Efectivo',amountCents:801}],
  [{methodLabel:'Efectivo',amountCents:501},{methodLabel:'Tarjeta',amountCents:300}],
  [{methodLabel:'Cash',amountCents:300},{methodLabel:'Tarjeta',amountCents:501}],[],[{methodLabel:'Tarjeta',amountCents:801}]])
  assert.throws(()=>verifyNativePaymentBreakdown(expected,accepted,observed),/METHOD_MISMATCH/);
});
test('ambiguous/missing configured labels are rejected before dispatch',()=>{
 for(const nativePaymentLabels of [{cash:'Pago',card:'Pago'},{cash:'Efectivo'},{cash:'Efectivo',card:' Tarjeta'},
  {cash:'Efectivo',card:'Tarjeta\n'},{cash:'',card:'Tarjeta'}])
  assert.throws(()=>nativePaymentPlan({...expected,nativePaymentLabels},accepted));
});
