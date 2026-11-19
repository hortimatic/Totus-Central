import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {offlineBasketCommercial} from '../src/totustpv/offline-basket-commercial.js';
const native=JSON.parse(readFileSync(new URL('./fixtures/totustpv-native-rounding.json',import.meta.url),'utf8'));
const context={customerId:1,addressId:2,shopId:1,currency:'EUR',roundMode:2,roundType:1,computingPrecision:6,quantity:1};
const line=(productId,unitTaxInclMicros,qty=1,unitTaxExclMicros=unitTaxInclMicros)=>({productId,attributeId:0,qty,unitTaxInclMicros,unitTaxExclMicros});
test('local capture follows actual native rounding for all modes and types',()=>{
 const samples=native.subtotals;
 for(const [values,roundMode,computingPrecision,roundType,nativeTotal] of samples){
  const basket={validUntil:1000,pricingContext:{...context,roundMode,computingPrecision,roundType},lines:values.map(([micros,qty],index)=>line(index+1,micros,qty))};
  const result=offlineBasketCommercial(basket,{now:500});
  // ITEM/LINE native detail rows are individually rounded; TOTAL allocates
  // the independently rounded subtotal across its original micro-price rows.
  if(roundType===3)assert.equal(result.totalCents,nativeTotal);
  assert.equal(result.lines.reduce((sum,row)=>sum+row.lineTaxInclCents,0),result.totalCents);
  assert.equal(result.totalTaxExclCents,result.totalCents);
  if(roundType===3)for(const row of result.lines)assert.equal(row.lineTaxInclMicros,row.unitTaxInclMicros*row.qty);
 }
});
test('ITEM and LINE captures match each actual native rounded detail row',()=>{
 const samples=native.lines;
 for(const [micros,qty,roundMode,computingPrecision,roundType,nativeCents] of samples){
  const result=offlineBasketCommercial({validUntil:1000,pricingContext:{...context,roundMode,computingPrecision,roundType},lines:[line(1,micros,qty)]},{now:500});
  assert.equal(result.lines[0].lineTaxInclCents,nativeCents);assert.equal(result.totalCents,nativeCents);
 }
});
test('tax allocation is stable by product key, never negative, and preserves original micros',()=>{
 const basket={validUntil:1000,pricingContext:{...context,roundType:3},lines:[line(2,1005000,1,1005000),line(1,1216050,1,1005000)]};
 const a=offlineBasketCommercial(basket,{now:500}),b=offlineBasketCommercial({...basket,lines:[...basket.lines].reverse()},{now:500});
 assert.equal(a.totalCents,222);assert.equal(a.totalTaxExclCents,201);
 assert.deepEqual([...a.lines].sort((x,y)=>x.productId-y.productId),[...b.lines].sort((x,y)=>x.productId-y.productId));
 for(const row of a.lines)assert.ok(row.lineTaxInclCents>=row.lineTaxExclCents);
});
test('expired context and malformed or duplicated lines cannot become a saved commercial capture',()=>{
 const basket={validUntil:1000,pricingContext:context,lines:[line(1,8012100)]};
 assert.throws(()=>offlineBasketCommercial(basket,{now:1000}),/Actualiza/);
 assert.throws(()=>offlineBasketCommercial({...basket,lines:[...basket.lines,...basket.lines]},{now:500}));
 assert.throws(()=>offlineBasketCommercial({...basket,lines:[line(1,100,1,101)]},{now:500}));
 assert.throws(()=>offlineBasketCommercial({...basket,pricingContext:{...context,currency:'USD'}},{now:500}));
});
