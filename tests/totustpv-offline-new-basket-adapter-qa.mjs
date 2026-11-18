import test from 'node:test';import assert from 'node:assert/strict';import {createCentralTpvAdapter} from '../src/totustpv/central-adapter.js';
test('new offline basket uses cached native prices and last scoped payment choices without a prepare request',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');let online=true,prepareCalls=0,transportError=null;
 Object.defineProperty(globalThis,'navigator',{configurable:true,get:()=>({onLine:online})});
 try{
  const session={id:'session',storeId:'store',drawerId:'drawer',status:'open'},station={environment:'qa',connectionId:'connection',connectionRevision:1,shopId:1,storeId:'store',drawerId:'drawer',canSell:true,canOpen:true,canReconcile:true,session,nativeProfile:{counter_customer_id:1,counter_address_id:2}};
  const values=new Map(),stamp=Date.now(),page={requestedAt:stamp,savedAt:stamp,data:{pricingContext:{customerId:1,addressId:2,shopId:1,currency:'EUR',roundMode:2,roundType:1,computingPrecision:2,quantity:1},items:[{id:'8:0',nativeProductId:8,quantityBreaks:[1],priceValidForMs:300000,unitTaxInclMicros:8012100,unitTaxExclMicros:6621600}]}};
  const adapter=createCentralTpvAdapter({actorId:'operator',storage:{getItem:key=>values.get(key)||null,setItem:(key,v)=>values.set(key,v)},catalogueCache:()=>({pages:async()=>[page]}),invoke:async input=>{
   if(input.action==='context')return {actorId:'operator',workstations:[station]};
   if(input.action==='payment-options')return {options:{enabledMethods:['cash'],labels:{cash:'Efectivo'},referencePolicy:{}}};
   if(input.action==='prepare'){prepareCalls++;if(transportError){const error=Error(transportError);error.code=transportError;throw error;}}
   throw Error('Unexpected remote request '+input.action);
  }});
  await adapter.context();await adapter.selectSession(session);online=false;
  await assert.rejects(adapter.quote({lines:[{productId:'8:0',qty:2}]}),/medios de cobro/);
  online=true;await adapter.paymentOptions();online=false;
  const quote=await adapter.quote({lines:[{productId:'8:0',qty:2}]});
  assert.equal(quote.localEstimate,true);assert.equal(quote.totalCents,1602);assert.deepEqual(quote.paymentMethods,['cash']);assert.equal(prepareCalls,0);
  const ticket=adapter.localSaleTicket({operationId:quote.id,payments:[{method:'cash',amountCents:1602,receivedCents:2000}]});
  assert.equal(ticket.cashSessionId,session.id);assert.equal(ticket.commercial.customerId,1);assert.equal(ticket.lines[0].qty,2);
  adapter.leaveLocalTicket(quote.id);
  const next=await adapter.quote({lines:[{productId:'8:0',qty:2}]});assert.notEqual(next.id,quote.id,'Identical consecutive offline tickets must remain distinct purchases');
  const clock=Date.now;try{Date.now=()=>quote.quoteExpiresAt;assert.throws(()=>adapter.localSaleTicket({operationId:quote.id,payments:[{method:'cash',amountCents:1602}]}),/caducado/);}finally{Date.now=clock;}
  await assert.rejects(adapter.quote({lines:[{productId:'8:0',qty:2}],coupon:'PROMO'}),/descuentos/);
  online=true;transportError='TPV_CONNECTION_UNAVAILABLE';const unavailable=await adapter.quote({lines:[{productId:'8:0',qty:3}]});assert.equal(unavailable.localEstimate,true);assert.equal(prepareCalls,1);
  transportError='TPV_PERMISSION_DENIED';await assert.rejects(adapter.quote({lines:[{productId:'8:0',qty:4}]}),/TPV_PERMISSION_DENIED/);assert.equal(prepareCalls,2);
  online=false;await assert.rejects(adapter.quote({lines:[{productId:'8:0',qty:3}]}),/Conecta para comprobar/);
  online=true;transportError=null;await adapter.context();await adapter.paymentOptions();online=false;
  page.requestedAt=Date.now()-400000;await assert.rejects(adapter.quote({lines:[{productId:'8:0',qty:3}]}),/precio vigente/);
 }finally{if(original)Object.defineProperty(globalThis,'navigator',original);else delete globalThis.navigator;}
});
