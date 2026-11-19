import test from 'node:test';
import assert from 'node:assert/strict';
import {offlineBasketPrices,offlineBasketSubtotals} from '../src/totustpv/offline-basket-prices.js';
import {createCentralTpvAdapter} from '../src/totustpv/central-adapter.js';
const context={customerId:1,addressId:2,shopId:1,currency:'EUR',roundMode:2,roundType:1,computingPrecision:6,quantity:1};
const page=(quantity,price,extra={})=>({requestedAt:100,data:{pricingContext:{...context,quantity},items:[{id:'8:3',nativeProductId:8,quantityBreaks:[1,3,10],priceValidForMs:1000,unitTaxInclMicros:price,unitTaxExclMicros:price,...extra}]}});
const run=(qty,pages)=>offlineBasketPrices({lines:[{productId:8,attributeId:3,qty}],pages,context,now:200});
test('local subtotals preserve observed native row versus initial-total rounding',()=>{
 const lines=[{qty:1,unitTaxExclMicros:1005000,unitTaxInclMicros:1005000},{qty:1,unitTaxExclMicros:1005000,unitTaxInclMicros:1216050}];
 for(const roundType of [1,2,3]){
  const result=offlineBasketSubtotals(lines,{...context,computingPrecision:2,roundType});
  assert.equal(result.productsGrossCents,roundType===3?222:223);
  assert.equal(result.productsNetCents,roundType===3?201:202);
  assert.equal(result.initialGrossCents,roundType===1?223:222);
  assert.equal(result.initialNetCents,roundType===1?202:201);
  assert.equal(result.grossRoundingDifferenceCents,roundType===2?-1:0);
 }
});
test('quantity tiers preserve native micros and never fall back to unit price',()=>{
 const pages=[page(1,1005000),page(3,900000),page(10,800000)];
 for(const [qty,price,tier] of [[1,1005000,1],[2,1005000,1],[3,900000,3],[9,900000,3],[10,800000,10]]){
  const result=run(qty,pages);assert.equal(result.lines[0].unitTaxInclMicros,price);assert.equal(result.lines[0].pricingQuantity,tier);assert.equal(result.validUntil,1100);
 }
 assert.throws(()=>run(3,[pages[0]]),/Falta un precio/);
 const changed=page(1,1005000,{quantityBreaks:[1,4,10]});changed.requestedAt=150;
 assert.throws(()=>run(4,[...pages,changed]),/Falta un precio/);
});
test('expired, other-customer and contradictory prices cannot form a local basket',()=>{
 assert.throws(()=>run(1,[page(1,100,{priceValidForMs:100})]),/Falta un precio/);
 const expiredNewer=page(1,90,{priceValidForMs:50});expiredNewer.requestedAt=150;
 assert.throws(()=>run(1,[page(1,100),expiredNewer]),/Falta un precio/,'an expired newer offer must never revive an older price');
 const other=page(1,100);other.data.pricingContext.customerId=4;
 assert.throws(()=>run(1,[other]),/Falta un precio/);
 assert.throws(()=>run(1,[page(1,100),page(1,101)]),/contradictorios/);
 const newer=page(1,102);newer.requestedAt=101;assert.equal(run(1,[newer,page(1,100)]).lines[0].unitTaxInclMicros,102);
});

test('a later observation within the same quantity tier replaces the old threshold price',()=>{
 const original=page(1,1000000),newer=page(2,1200000);newer.requestedAt=150;
 for(const qty of [1,2])assert.equal(run(qty,[original,newer]).lines[0].unitTaxInclMicros,1200000);
 assert.throws(()=>run(3,[original,newer]),/Falta un precio/);
 const bulk=page(9,800000);bulk.requestedAt=160;
 assert.equal(run(4,[original,newer,bulk]).lines[0].unitTaxInclMicros,800000);
 assert.equal(run(2,[original,newer,bulk]).lines[0].unitTaxInclMicros,1200000);
 const expired=page(2,1200000,{priceValidForMs:50});expired.requestedAt=150;
 assert.throws(()=>run(1,[original,expired]),/Falta un precio/);
 assert.throws(()=>run(1,[page(1,1000000),page(2,1200000)]),/contradictorios/);
});
test('adapter reads local prices without HTTP and rejects station changes during storage read',async()=>{
 const station={environment:'qa',connectionId:'c',connectionRevision:1,shopId:1,storeId:'s',drawerId:'d',canSell:true,canOpen:true,canReconcile:true,nativeProfile:{counter_customer_id:1,counter_address_id:2}};
 let pending=null;const requests=[];const cached=page(3,900000);cached.requestedAt=Date.now();
 const adapter=createCentralTpvAdapter({actorId:'a',storage:{getItem:()=>null,setItem:()=>{}},catalogueCache:()=>({pages:async()=>{if(pending)await pending;return [cached];}}),invoke:async request=>{requests.push(request.action);assert.equal(request.action,'context');return {actorId:'a',workstations:[station,{...station,storeId:'other',drawerId:'other'}]};}});
 await adapter.context();await adapter.selectWorkstation({storeId:'s',drawerId:'d'});
 const args={lines:[{productId:8,attributeId:3,qty:4}],pricingContext:context};
 assert.equal((await adapter.localBasketPrices(args)).lines[0].unitTaxInclMicros,900000);assert.deepEqual(requests,['context']);
 assert.equal((await adapter.localBasketPrices({lines:args.lines})).lines[0].unitTaxInclMicros,900000);
 await assert.rejects(adapter.localBasketPrices({...args,pricingContext:{...context,customerId:9}}),/cliente/);
 let unlock;pending=new Promise(resolve=>{unlock=resolve;});const immutable=adapter.localBasketPrices(args);args.lines[0].qty=1;unlock();assert.equal((await immutable).lines[0].qty,4);args.lines[0].qty=4;pending=null;
 let release;pending=new Promise(resolve=>{release=resolve;});const reading=adapter.localBasketPrices(args);
 await adapter.selectWorkstation({storeId:'other',drawerId:'other'});release();await assert.rejects(reading,/ha cambiado/);
});
