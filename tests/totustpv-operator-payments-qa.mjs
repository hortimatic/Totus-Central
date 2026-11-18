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

test('external references obey current and prepared policies and remain cashier annotations',async()=>{
 for(const mode of ['optional','required']){
  const configured={...policy,referencePolicy:{card:mode}},prepared={...expected,operatorPaymentPolicy:{...configured}};
  const input={...requested,allocations:[{...requested.allocations[0],reference:' OP-0042 '}]};
  const result=await fixture({readPolicy:async()=>configured}).verify({scope,operationId:id(6),expected:prepared,requested:input});
  assert.equal(result[0].reference,'OP-0042');assert.equal(result[0].status,'settled');assert.equal(Object.hasOwn(result[0],'providerVerified'),false);
  if(mode==='required')await assert.rejects(fixture({readPolicy:async()=>configured}).verify({scope,operationId:id(6),expected:prepared,requested}),/REFERENCE_REQUIRED/);
  for(const reference of ['4111 1111 1111 1111','<script>',null])await assert.rejects(fixture({readPolicy:async()=>configured}).verify({scope,operationId:id(6),expected:prepared,requested:{...input,allocations:[{...input.allocations[0],reference}]}}),/REFERENCE_INVALID/);
  await assert.rejects(fixture().verify({scope,operationId:id(6),expected:prepared,requested:input}),/POLICY_STALE/);
 }
 await assert.rejects(fixture().verify({scope,operationId:id(6),expected,requested:{...requested,allocations:[{...requested.allocations[0],reference:'OP-0042'}]}}),/REFERENCE_FORBIDDEN/);
 await assert.rejects(fixture().verify({scope,operationId:id(6),expected,requested:{...requested,allocations:[{id:'cash',method:'cash',amountCents:801,receivedCents:801,reference:'OP-0042'}]}}),/CASH_REFERENCE_FORBIDDEN/);
});

test('drawer payment changes invalidate previously prepared tender even if the method remains enabled',async()=>{
 const current={...policy,settingsRevision:2,drawerId:scope.drawerId};
 const prepared={...expected,operatorPaymentPolicy:{...current}};
 await fixture({readPolicy:async()=>current}).verify({scope,operationId:id(6),expected:prepared,requested});
 for(const patch of [{settingsRevision:3},{settingsRevision:undefined},{settingsRevision:-1},{drawerId:id(99)}])
  await assert.rejects(fixture({readPolicy:async()=>({...current,...patch})}).verify({scope,operationId:id(6),expected:prepared,requested}),/POLICY_STALE/);
 await assert.rejects(fixture({readPolicy:async()=>current}).verify({scope,operationId:id(6),expected,requested}),/POLICY_STALE/);
});
test('independent-terminal declaration is accepted without any bank/network adapter; physical cash stays unchanged',async()=>{
 const allocations=await fixture().verify({scope,operationId:id(6),expected,requested});
 assert.deepEqual(allocations,[{id:'card-one',method:'card',amountCents:801,status:'settled'}]);
 const summary=cashSessionSummary({...scope,openingCents:10000,entries:[{...scope,id:'entry-one',kind:'sale',method:'card',amountCents:801}]});
 assert.equal(summary.expectedCashCents,10000);
});

test('Bizum and transfer require explicit store configuration and leave physical cash unchanged',async()=>{
 for(const method of ['bizum','transfer']){
  const configured={...policy,modes:{...policy.modes,[method]:'external-receipt'}},prepared={...expected,operatorPaymentPolicy:{revision:1,modes:configured.modes}},
   input={...requested,allocations:[{id:'external-one',method,amountCents:801}]};
  const allocations=await fixture({readPolicy:async()=>configured}).verify({scope,operationId:id(6),expected:prepared,requested:input});
  assert.equal(allocations[0].method,method);
  assert.equal(cashSessionSummary({...scope,openingCents:10000,entries:[{...scope,id:'external-one',kind:'sale',method,amountCents:801}]}).expectedCashCents,10000);
  await assert.rejects(fixture().verify({scope,operationId:id(6),expected:prepared,requested:input}),/METHOD_NOT_CONFIGURED/);
 }
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
