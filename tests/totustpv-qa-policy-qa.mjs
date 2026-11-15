import assert from 'node:assert/strict';
import test from 'node:test';
import {assertQaTarget,planDomainTransition} from '../src/totustpv/server/qa-policy.js';
import {TOTUS_QA_POLICY as policy} from '../src/totustpv/server/deployment-qa-policy.js';
import {createTpvNativeTransport} from '../src/totustpv/server/native-transport.js';
import {assertSameCheckoutScope,remoteOrderKey} from '../src/totustpv/context.js';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const connection={id:policy.connectionId,revision:5,verified_revision:5,enabled:true,real_data_authorized:true,
 protocol:'prestashop',endpoint:policy.origin+'/api',website_origin:policy.origin,secret:'fixture-not-a-real-key'};
const scope={connectionId:policy.connectionId,connectionRevision:5,shopId:1,storeId:id(1),environment:'qa'};
test('only the explicit 8.2.8 preproduction connection and QA scope match',()=>{
 assert.equal(assertQaTarget(connection,scope,policy),true);
 for(const patch of [{environment:'production'},{connectionId:id(8)}])
  assert.throws(()=>assertQaTarget(connection,{...scope,...patch},policy),/QA_TARGET/);
 assert.throws(()=>assertQaTarget(connection,scope,null),/QA_POLICY/);
 assert.throws(()=>assertQaTarget(connection,scope,{...policy,stage:'production'}),/QA_POLICY/);
 assert.throws(()=>assertQaTarget(connection,scope,{...policy,nativeVersion:'9.0.0'}),/QA_POLICY/);
});
test('both production origins, their www aliases and their original connection IDs are protected',()=>{
 for(const host of ['hortimatic.com','www.hortimatic.com','newoldsmok.com','www.newoldsmok.com']){
  const origin='https://'+host;
  assert.throws(()=>assertQaTarget({...connection,endpoint:origin+'/api',website_origin:origin},scope,policy),/PRODUCTION_FORBIDDEN/);
  assert.throws(()=>assertQaTarget(connection,scope,{...policy,origin}),/PRODUCTION_FORBIDDEN/);
 }
 for(const connectionId of policy.protectedConnectionIds)
  assert.throws(()=>assertQaTarget({...connection,id:connectionId},scope,policy),/PRODUCTION_FORBIDDEN/);
});
test('an ordinary enabled checkout cannot dispatch without the independent QA policy',async()=>{
 let calls=0;const transport=createTpvNativeTransport(connection,scope,{allowOrderCreation:async()=>true,
  allowedPaymentModules:['ps_cashondelivery'],resolve:async()=>['93.184.216.34'],request:async()=>{calls++;throw Error('Unexpected request');}});
 const expected={storeId:scope.storeId,shopId:1,cartId:1,customerId:2,invoiceAddressId:3,deliveryAddressId:3,
  currencyId:1,languageId:1,carrierId:1,paymentModule:'ps_cashondelivery',paymentLabel:'QA',totalCents:801,
  totalTaxExclCents:662,productsTaxInclCents:801,productsTaxExclCents:662,lines:[{productId:4,attributeId:0,qty:1}]};
 await assert.rejects(transport.createOrderOnce(expected),/QA_POLICY/);assert.equal(calls,0);
});
test('QA reads are also confined to preproduction, without calling a protected website',async()=>{
 let calls=0;const origin='https://hortimatic.com';
 const transport=createTpvNativeTransport({...connection,endpoint:origin+'/api',website_origin:origin},scope,
  {qaPolicy:policy,resolve:async()=>['93.184.216.34'],request:async()=>{calls++;throw Error('Unexpected request');}});
 await assert.rejects(transport.read('orders'),/PRODUCTION_FORBIDDEN/);assert.equal(calls,0);
});
test('domain change stays a non-executable plan until every acceptance condition is complete',()=>{
 const candidate={connectionId:policy.connectionId,installationId:id(10),businessId:id(1),origin:policy.origin,nativeVersion:'8.2.8'};
 const retiring={connectionId:policy.protectedConnectionIds[0],installationId:id(11),businessId:id(1),origin:'https://hortimatic.com'};
 const acceptance={approved:true,sales:true,mixedPayments:true,refunds:true,stock:true,users:true,cashDrawers:true,
  recovery:true,documents:true,migrationRehearsal:true,qaDataIsolation:true,legacyHistory:true};
 for(const key of Object.keys(acceptance))assert.throws(()=>planDomainTransition({candidate,retiring,
  targetOrigin:retiring.origin,acceptance:{...acceptance,[key]:false}}),/CUTOVER_NOT_READY/);
 assert.throws(()=>planDomainTransition({candidate,retiring:{...retiring,businessId:id(2)},
  targetOrigin:retiring.origin,acceptance}),/IDENTITIES_REQUIRED/,'Another business cannot become the retirement target');
 const plan=planDomainTransition({candidate,retiring,targetOrigin:retiring.origin,acceptance});
 assert.equal(plan.executable,false);assert.equal(plan.connectionId,candidate.connectionId);
 assert.equal(plan.installationId,candidate.installationId);assert.equal(plan.mergeNativeIds,false);
 assert.equal(plan.disableRetiredEndpointBeforeSwitch,true);assert.equal(plan.excludeQaOperationsFromLiveTotals,true);
});
test('environment stays separate while technical order identity survives a hostname change',()=>{
 assert.throws(()=>assertSameCheckoutScope(scope,{...scope,environment:'production'}),/SCOPE_MISMATCH/);
 const before=remoteOrderKey(scope,42);
 assert.equal(before,remoteOrderKey({...scope,websiteOrigin:'https://hortimatic.com'},42));
 assert.notEqual(before,remoteOrderKey({...scope,connectionId:policy.protectedConnectionIds[0]},42));
});
