import assert from 'node:assert/strict';
import {paymentSummary, cashSessionSummary, saleTransition, canSubmitSale, verifyRemoteSale, returnQuantityRemaining, TOTUSTPV_MODULE} from '../src/totustpv/model.js';

assert.equal(TOTUSTPV_MODULE.host, 'Totus Central');
assert.equal(TOTUSTPV_MODULE.path, 'tpv');
const cash = paymentSummary(801, [{id: 'p1', method: 'cash', status: 'settled', amountCents: 801, receivedCents: 1000}]);
assert.equal(cash.changeCents, 199);
assert.equal(cash.cashAppliedCents, 801);
assert.equal(cash.fullyPaid, true);
const mixed = paymentSummary(801, [
  {id: 'cash', method: 'cash', status: 'settled', amountCents: 400, receivedCents: 500},
  {id: 'card', method: 'card', status: 'settled', amountCents: 401}
]);
assert.equal(mixed.cashAppliedCents, 400);
assert.equal(mixed.changeCents, 100);
const pending = paymentSummary(801, [{id:'card',method:'card',status:'pending',amountCents:801}]);
assert.equal(pending.fullyPaid, false);
assert.equal(pending.outstandingCents, 801);
const credit = paymentSummary(1000, [{id:'deposit',method:'cash',status:'settled',amountCents:250,receivedCents:250}], {allowCredit:true});
assert.equal(credit.outstandingCents, 750);
assert.equal(paymentSummary(1000,[],{allowCredit:true}).outstandingCents,1000);
assert.throws(()=>paymentSummary(1000,[]),/PAYMENTS_REQUIRED/);
const cheque=paymentSummary(1000,[{id:'cheque-1',method:'cheque',status:'settled',amountCents:1000}]);
assert.equal(cheque.cashAppliedCents,0);
for (const allocations of [
  [{id:'p',method:'cash',status:'settled',amountCents:801,receivedCents:800}],
  [{id:'p',method:'card',status:'settled',amountCents:801,receivedCents:1000}],
  [{id:'p',method:'card',status:'settled',amountCents:802}],
  [{id:'p',method:'card',status:'settled',amountCents:400},{id:'p',method:'bizum',status:'settled',amountCents:401}],
  [{id:'p',method:'card',status:'settled',amountCents:8.01}]
]) assert.throws(()=>paymentSummary(801, allocations));

const scope={storeId:'hortimatic',drawerId:'vape',sessionId:'shift_1',currency:'EUR'};
const entry=(id,method,kind,amountCents)=>({...scope,id,method,kind,amountCents});
const entries=[entry('a','cash','sale',801),entry('b','card','sale',3000),entry('c','bizum','sale',2000),entry('d','cash','refund',100),entry('e','cash','cash-in',500),entry('f','cash','cash-out',200),entry('g','cash','transfer-out',1000)];
const closing=cashSessionSummary({...scope,openingCents:11000,entries,countedCents:11000});
assert.equal(closing.expectedCashCents, 11001);
assert.equal(closing.differenceCents, -1);
assert.throws(()=>cashSessionSummary({...scope,openingCents:11000,entries:[...entries,entries[0]]}),/DUPLICATE/);
assert.throws(()=>cashSessionSummary({...scope,openingCents:11000,entries:[{...entries[0],storeId:'another'}]}),/SCOPE_MISMATCH/);
assert.throws(()=>cashSessionSummary({...scope,openingCents:11000,entries:[entry('a','card','cash-in',1)]}),/NONCASH/);
assert.throws(()=>cashSessionSummary({...scope,openingCents:0,entries:[entry('a','cash','refund',1)]}),/NEGATIVE/);

assert.equal(saleTransition('ready','submit'),'submitting');
assert.equal(saleTransition('submitting','timeout'),'uncertain');
assert.equal(canSubmitSale({state:'uncertain'}),false);
assert.equal(canSubmitSale({state:'ready',remoteOrderId:46542}),false);
assert.equal(canSubmitSale({state:'ready'}),true);
assert.throws(()=>saleTransition('uncertain','submit'),/FORBIDDEN/);
assert.throws(()=>saleTransition('verifying','confirm'),/READBACK_REQUIRED/);
assert.equal(saleTransition('uncertain','reconcile'),'verifying');
assert.equal(saleTransition('parked','resume'),'draft');

const expected={storeId:'hortimatic',shopId:1,cartId:70814,currency:'EUR',paymentModule:'native_cash',totalCents:801,shippingCents:0,paidStateIds:[11],lines:[{productId:1003030,attributeId:5,qty:1,unitTaxInclCents:801,unitTaxExclCents:662,stockBefore:5}]};
const observed={storeId:'hortimatic',shopId:1,cartId:70814,orderId:46542,currency:'EUR',paymentModule:'native_cash',totalCents:801,shippingCents:0,receivedCents:801,stateId:11,statePaid:true,lines:structuredClone(expected.lines),payments:[{id:99,amountCents:801,currency:'EUR',recordVerified:true}],inventory:[{productId:1003030,attributeId:5,before:5,after:4,ambiguous:false}]};
Object.assign(expected,{customerId:501,invoiceAddressId:601,deliveryAddressId:601,currencyId:1});
Object.assign(observed,{customerId:501,invoiceAddressId:601,deliveryAddressId:601,currencyId:1});
observed.inventory[0].mode='isolated-fixture';
const valid=verifyRemoteSale(expected,observed);
assert.equal(valid.status,'confirmed');
assert.equal(saleTransition('verifying','confirm',valid),'confirmed');
for (const patch of [
  {stateId:0}, {stateId:null}, {stateId:23}, {statePaid:false},
  {customerId:999}, {invoiceAddressId:999}, {deliveryAddressId:999}, {currencyId:2},
  {storeId:'another'}, {shopId:2}, {currency:'USD'}, {cartId:70813},
  {totalCents:1544}, {shippingCents:743}, {receivedCents:1602}, {payments:[]},
  {payments:[{id:99,amountCents:801,currency:'EUR',recordVerified:false}]},
  {payments:[{id:99,amountCents:400,currency:'EUR',recordVerified:true},{id:99,amountCents:401,currency:'EUR',recordVerified:true}]},
  {lines:[{...observed.lines[0],attributeId:6}]},
  {lines:[{...observed.lines[0],qty:2}]},
  {inventory:[{...observed.inventory[0],after:3}]},
  {inventory:[{...observed.inventory[0],ambiguous:true}]}
]) {
  const result=verifyRemoteSale(expected,{...observed,...patch});
  assert.equal(result.status,'uncertain');
  assert.equal(result.orderId,46542,'A failed check must preserve the created order');
  assert.equal(result.retryOrderForbidden,true);
}
assert.equal(verifyRemoteSale({...expected,shopId:undefined},{...observed,shopId:undefined}).status,'uncertain');
assert.equal(returnQuantityRemaining(3,1,2),0);
assert.throws(()=>returnQuantityRemaining(3,2,2),/RETURN_QUANTITY/);
console.log('PASS TotusTPV: original integrated contracts, cash/mixed/credit arithmetic, drawer isolation, no blind resubmission, strict readback and return limits. No HTTP, database writes or POSTPV installation used.');
