import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperatorPaymentVerifier} from '../src/totustpv/server/operator-payments.js';
import {cashSessionSummary} from '../src/totustpv/model.js';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={actorId:id(1),connectionId:id(2),connectionRevision:1,storeId:id(3),shopId:1,drawerId:id(4),sessionId:id(5),currency:'EUR'};
const policy={enabled:true,revision:1,connectionId:id(2),storeId:id(3),shopId:1,currency:'EUR',modes:{cash:'cash-in-hand',card:'external-terminal'}};
const expected={totalCents:801,operatorPaymentPolicy:{revision:1,modes:policy.modes}};
const requested={allocations:[{id:'card-one',method:'card',amountCents:801}],
 confirmation:{operationId:id(6),totalCents:801,currency:'EUR',accepted:true}};
const fixture=(overrides={})=>createOperatorPaymentVerifier({authorize:async()=>({...scope}),readPolicy:async()=>structuredClone(policy),...overrides});
test('independent-terminal declaration is accepted without any bank/network adapter; physical cash stays unchanged',async()=>{
 const allocations=await fixture().verify({scope,operationId:id(6),expected,requested});
 assert.deepEqual(allocations,[{id:'card-one',method:'card',amountCents:801,status:'settled'}]);
 const summary=cashSessionSummary({...scope,openingCents:10000,entries:[{...scope,id:'entry-one',kind:'sale',method:'card',amountCents:801}]});
 assert.equal(summary.expectedCashCents,10000);
});
test('cash and mixed declarations preserve change and allocate only cash to the drawer',async()=>{
 const allocations=await fixture().verify({scope,operationId:id(6),expected,requested:{...requested,
  allocations:[{id:'cash-one',method:'cash',amountCents:300,receivedCents:500},{id:'card-one',method:'card',amountCents:501}]}});
 assert.equal(allocations[0].receivedCents,500);assert.equal(allocations[1].amountCents,501);
});
test('explicit intent must match operation, total and currency; a caller cannot substitute status/provider proof',async()=>{
 for(const patch of [{accepted:false},{operationId:id(9)},{currency:'USD'},{totalCents:800},{providerVerified:true}])
  await assert.rejects(fixture().verify({scope,operationId:id(6),expected,requested:{...requested,confirmation:{...requested.confirmation,...patch}}}));
 for(const patch of [{status:'settled'},{cardNumber:'sensitive-fixture'},{receivedCents:801}])
  await assert.rejects(fixture().verify({scope,operationId:id(6),expected,requested:{...requested,allocations:[{...requested.allocations[0],...patch}]}}));
});
test('revoked permissions, another cashier/shop and changed payment configuration fail before acceptance',async()=>{
 for(const overrides of [{authorize:async()=>{throw new Error('Permission revoked');}},
  {authorize:async()=>({...scope,actorId:id(9)})},{authorize:async()=>({...scope,shopId:2})},
  {readPolicy:async()=>({...policy,revision:2})},{readPolicy:async()=>({...policy,enabled:false})},
  {readPolicy:async()=>({...policy,modes:{card:'integrated-provider'}})}])
  await assert.rejects(fixture(overrides).verify({scope,operationId:id(6),expected,requested}));
});
test('underpayment, duplicate methods, unconfigured transfer and imaginary noncash change are refused',async()=>{
 for(const allocations of [[{id:'a',method:'card',amountCents:800}],
  [{id:'a',method:'card',amountCents:300},{id:'b',method:'card',amountCents:501}],
  [{id:'a',method:'transfer',amountCents:801}],[{id:'a',method:'cash',amountCents:801,receivedCents:800}]])
  await assert.rejects(fixture().verify({scope,operationId:id(6),expected,requested:{...requested,allocations}}));
});
