import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveCheckoutContext,assertSameCheckoutScope,remoteOrderKey} from '../src/totustpv/context.js';
import {createCheckoutService} from '../src/totustpv/checkout-service.js';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const selection = {connectionId:id(1),connectionRevision:1,storeId:id(2),shopId:1,drawerId:id(3),sessionId:id(4),currency:'EUR'};
const records = () => ({actor:{id:id(5),active:true},connection:{id:id(1),revision:1,active:true},
  store:{id:id(2),active:true},website:{connection_id:id(1),store_id:id(2),shop_id:1,currency:'EUR',status:'active'},
  drawer:{id:id(3),store_id:id(2),active:true},session:{id:id(4),drawer_id:id(3),store_id:id(2),currency:'EUR',status:'open'},
  authorization:{actor_id:id(5),store_id:id(2),connection_id:id(1),drawer_id:id(3),session_id:id(4),sell:true}});

test('context reuses explicit Central identities and rejects stale, inactive and mismatched records',()=>{
  const scope = resolveCheckoutContext(selection,records());
  assert.equal(scope.actorId,id(5));
  assert.ok(Object.isFrozen(scope));
  for (const mutate of [r=>r.actor.active=false,r=>r.connection.active=false,r=>r.connection.revision++,
    r=>r.store.active=false,r=>r.website.connection_id=id(9),r=>r.website.store_id=id(9),
    r=>r.website.shop_id=2,r=>r.drawer.store_id=id(9),r=>r.drawer.active=false,
    r=>r.session.status='closed',r=>r.session.drawer_id=id(9),r=>r.session.currency='USD',
    r=>r.authorization.actor_id=id(9),r=>r.authorization.session_id=id(9),r=>r.authorization.sell=false]) {
    const input=records();mutate(input);assert.throws(()=>resolveCheckoutContext(selection,input));
  }
  assert.throws(()=>assertSameCheckoutScope(scope,{...scope,connectionId:id(99)}));
  assert.notEqual(remoteOrderKey(scope,123),remoteOrderKey({...scope,connectionId:id(99)},123));
  assert.equal(remoteOrderKey(scope,123),remoteOrderKey({...scope,connectionRevision:2},123));
});

// Deliberately simulated dependencies. These tests do not authenticate an HTTP
// caller, write a database or prove a real PrestaShop checkout.
function fixture(options={}) {
  const scope=resolveCheckoutContext(selection,records());
  const expected={storeId:scope.storeId,shopId:1,cartId:701,currency:'EUR',paymentModule:'native_cash',
    customerId:501,invoiceAddressId:601,deliveryAddressId:601,currencyId:1,
    totalCents:801,shippingCents:0,nativePaymentLabels:{cash:'Efectivo',card:'Tarjeta'},paidStateIds:[11],lines:[{productId:101,attributeId:5,qty:1,
      unitTaxInclCents:801,unitTaxExclCents:662,stockBefore:5}]};
  const observed={connectionId:scope.connectionId,...structuredClone(expected),orderId:901,receivedCents:801,
    stateId:11,statePaid:true,payments:[{id:601,amountCents:801,methodLabel:'Efectivo',currency:'EUR',recordVerified:true}],
    inventory:[{mode:'isolated-fixture',productId:101,attributeId:5,before:5,after:4,ambiguous:false}]};
  let record={id:id(6),scope,expected,status:'ready',revision:1,quoteExpiresAt:2000,orderId:null};
  let orders=[],postCount=0,authorizationCount=0,settlementCount=0,storageUnavailable=false;
  const cashEvents=new Set();
  const ledger={
    async get({scope:s}){assertSameCheckoutScope(scope,s);return structuredClone(record);},
    async claimSubmission({revision,payments}){
      if (record.status!=='ready'||record.revision!==revision) return {won:false,record:structuredClone(record)};
      record={...record,status:'dispatched',payments:structuredClone(payments)};
      return {won:true,token:'durable-claim-token-1'};
    },
    async rememberRemote({orderId}){
      if(storageUnavailable)throw Error('database temporarily unavailable');
      if(record.orderId&&record.orderId!==orderId)throw Error('TPV_REMOTE_ORDER_MISMATCH');
      record.orderId=orderId;
    },
    async markUncertain({orderId,reason}){
      if(storageUnavailable)throw Error('database temporarily unavailable');
      if(record.status==='confirmed')return structuredClone(record);
      record={...record,status:'uncertain',orderId:orderId??record.orderId,reason};return structuredClone(record);
    },
    async confirm({orderId}){
      if(storageUnavailable)throw Error('database temporarily unavailable');
      record={...record,status:'confirmed',orderId};cashEvents.add(record.id);return structuredClone(record);
    }
  };
  const native={
    async validatePayments(){if(options.unsupportedPayment)throw Error('TPV_NATIVE_PAYMENT_UNSUPPORTED');return true;},
    async revalidatePrepared(){return {unchanged:!options.quoteChanged,cartId:701};},
    async ordersForCart(){return structuredClone(options.wrongCart?[{orderId:901,cartId:999,shopId:1,connectionId:scope.connectionId}]:orders);},
    async submitOrderOnce(){
      postCount++;
      if(options.failBeforeEffect)throw Error('socket disconnected');
      orders=[{connectionId:scope.connectionId,orderId:901,cartId:701,shopId:1}];
      if(options.storageLossAfterPost)storageUnavailable=true;
      if(options.lostResponse)throw Error('response lost after remote commit');
      return {orderId:901};
    },
    async readSale(){return {...structuredClone(observed),...options.observedPatch};}
  };
  const settlements={async verify(){settlementCount++;return [{id:'cash-1',method:'cash',status:options.unpaid?'pending':'settled',amountCents:801,receivedCents:1000}];}};
  const authorize=async({selection:s})=>{
    authorizationCount++;
    if(options.denied||options.revokeBeforeDispatch&&authorizationCount>1)throw Error('TPV_SELL_FORBIDDEN');
    assertSameCheckoutScope(scope,s);return scope;
  };
  const service=createCheckoutService({authorize,ledger,native,settlements,now:()=>options.expired?3000:1000});
  return {service,command:{operationId:id(6),selection,payments:[{untrustedPaid:true}]},
    count:()=>({postCount,settlementCount,authorizationCount,cashEvents:cashEvents.size}),
    record:()=>structuredClone(record),restoreStorage:()=>storageUnavailable=false,
    setOrders:rows=>orders=rows,patchRecord:patch=>record={...record,...patch}};
}

test('one settled sale records one remote order and one cash event, repeated submit is read-only',async()=>{
  const f=fixture();assert.equal((await f.service.submit(f.command)).status,'confirmed');
  assert.equal((await f.service.submit(f.command)).orderId,901);
  assert.deepEqual({post:f.count().postCount,cash:f.count().cashEvents,settlement:f.count().settlementCount},
    {post:1,cash:1,settlement:1});
});
test('concurrent clicks claim once before the remote effect',async()=>{
  const f=fixture();await Promise.all([f.service.submit(f.command),f.service.submit(f.command)]);
  assert.equal(f.count().postCount,1);assert.equal(f.count().cashEvents,1);
});
test('lost POST response is reconciled against the existing cart without another POST',async()=>{
  const f=fixture({lostResponse:true});const result=await f.service.submit(f.command);
  assert.equal(result.status,'confirmed');assert.equal(result.orderId,901);assert.equal(f.count().postCount,1);
});
test('no observed order remains uncertain; retries and recovery never resend',async()=>{
  const f=fixture({failBeforeEffect:true});assert.equal((await f.service.submit(f.command)).status,'uncertain');
  await f.service.submit(f.command);await f.service.reconcile(f.command);
  assert.equal(f.count().postCount,1);assert.equal(f.count().cashEvents,0);
});
test('storage failure after remote success preserves order identity and a durable dispatch barrier',async()=>{
  const f=fixture({storageLossAfterPost:true});const result=await f.service.submit(f.command);
  assert.equal(result.status,'uncertain');assert.equal(result.orderId,901);assert.equal(result.recoveryPersisted,false);
  assert.equal(f.record().status,'dispatched');await f.service.submit(f.command);assert.equal(f.count().postCount,1);
  f.restoreStorage();assert.equal((await f.service.reconcile(f.command)).status,'confirmed');
  assert.equal(f.count().postCount,1);assert.equal(f.count().cashEvents,1);
});
test('missing remote state, wrong connection, duplicate payments or ambiguous stock cannot confirm',async()=>{
  for(const observedPatch of [{stateId:0},{connectionId:id(99)},{inventory:[]},{payments:[]},
    {inventory:[{productId:101,attributeId:5,before:5,after:4,ambiguous:true}]}]) {
    const f=fixture({observedPatch});const result=await f.service.submit(f.command);
    assert.equal(result.status,'uncertain');assert.equal(result.orderId,901);assert.equal(f.count().cashEvents,0);
    await f.service.submit(f.command);assert.equal(f.count().postCount,1);
  }
});
test('authorization, quote and unsettled payment failures prevent dispatch',async()=>{
  for(const options of [{denied:true},{expired:true},{quoteChanged:true},{unpaid:true},{revokeBeforeDispatch:true}]) {
    const f=fixture(options);await assert.rejects(f.service.submit(f.command));
    assert.equal(f.count().postCount,0);assert.equal(f.record().status,'ready');
  }
});
test('another store/connection/session cannot access or reconcile a prepared operation',async()=>{
  const f=fixture();for(const patch of [{storeId:id(99)},{connectionId:id(99)},{sessionId:id(99)},{shopId:2}])
    await assert.rejects(f.service.submit({...f.command,selection:{...selection,...patch}}));
  assert.equal(f.count().postCount,0);
});
test('wrong cart results are never adopted and an existing cart is never submitted again',async()=>{
  const f=fixture({wrongCart:true});assert.equal((await f.service.submit(f.command)).status,'uncertain');
  assert.equal(f.count().postCount,0);assert.equal(f.count().cashEvents,0);
  const existing=fixture();existing.setOrders([{connectionId:selection.connectionId,orderId:901,cartId:701,shopId:1}]);
  assert.equal((await existing.service.submit(existing.command)).status,'confirmed');assert.equal(existing.count().postCount,0);
});
test('read-only reconciliation cannot start a ready sale',async()=>{
  const f=fixture();await assert.rejects(f.service.reconcile(f.command),/RECONCILIATION_NOT_REQUIRED/);
  assert.equal(f.count().postCount,0);assert.equal(f.count().settlementCount,0);
});
test('correct remote total with the wrong payment method stays uncertain without another POST',async()=>{
 const f=fixture({observedPatch:{payments:[{id:601,amountCents:801,methodLabel:'Tarjeta',currency:'EUR',recordVerified:true}]}});
 const result=await f.service.submit(f.command);assert.equal(result.status,'uncertain');
 assert.equal(result.reason,'TPV_NATIVE_PAYMENT_METHOD_MISMATCH');
 await f.service.reconcile(f.command);assert.equal(f.count().postCount,1);assert.equal(f.count().cashEvents,0);
});
test('unsupported native payment cannot claim or dispatch a sale',async()=>{
 const f=fixture({unsupportedPayment:true});await assert.rejects(f.service.submit(f.command),/PAYMENT_UNSUPPORTED/);
 assert.equal(f.record().status,'ready');assert.equal(f.count().postCount,0);
});
